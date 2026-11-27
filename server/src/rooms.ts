// Room logic of the online server. It knows nothing about sockets: messages go
// out through `deps.send`, time comes from `deps.scheduler`. That keeps it easy
// to test. Every move is validated here with game.ts, the server is the truth.

import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { chooseMove } from '../../ai';
import {
  applyMove,
  GameState,
  isLegal,
  isOver,
  Move,
  movesBy,
  newGame,
  Player,
  undoTo,
} from '../../game';
import {
  ClientMsg,
  ErrorReason,
  parseClientMessage,
  QUICK_TURN_SECONDS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SeatInfo,
  ServerMsg,
} from '../../protocol';
import { ColorId } from '../../theme';

export interface Scheduler {
  now(): number;
  after(ms: number, fn: () => void): () => void; // returns a cancel function
}

export interface LobbyDeps {
  send(conn: string, msg: ServerMsg): void;
  close(conn: string): void;
  scheduler: Scheduler;
}

interface Seat {
  token: string;
  conn: string | null; // null while the player is disconnected
  color: ColorId;
}

interface Room {
  code: string;
  size: number;
  turnSeconds: number;
  seats: [Seat | null, Seat | null];
  state: GameState;
  deadline: number | null; // scheduler time when the player to move runs out of time
  cancelTimer: (() => void) | null;
  undoFrom: Player | null; // who asked to take a move back, while waiting for an answer
  rematch: [boolean, boolean];
  closed: boolean; // someone left for good: nobody can join or resume
  lastActive: number;
}

const MAX_ROOMS = 500;
const ORPHAN_ROOM_MS = 15 * 60 * 1000; // nobody connected
const IDLE_ROOM_MS = 2 * 60 * 60 * 1000; // nothing happened

const sameToken = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class Lobby {
  private rooms = new Map<string, Room>();
  private where = new Map<string, { code: string; seat: Player }>();
  private queue: Array<{ conn: string; size: number; color: ColorId }> = [];

  constructor(private deps: LobbyDeps) {}

  stats() {
    return { rooms: this.rooms.size, connections: this.where.size, queued: this.queue.length };
  }

  receive(conn: string, raw: string): void {
    const msg = parseClientMessage(raw);
    if (!msg) return this.fail(conn, 'bad_message');
    this.handle(conn, msg);
  }

  disconnect(conn: string): void {
    this.dequeue(conn);
    const ctx = this.where.get(conn);
    if (!ctx) return;
    this.where.delete(conn);
    const room = this.rooms.get(ctx.code);
    const seat = room?.seats[ctx.seat];
    if (!room || !seat || seat.conn !== conn) return;
    seat.conn = null;
    room.lastActive = this.deps.scheduler.now();
    this.sendRoom(room);
  }

  // Drops rooms nobody uses any more. Call it every minute or so.
  sweep(): void {
    const now = this.deps.scheduler.now();
    for (const room of this.rooms.values()) {
      const online = room.seats.some((s) => s?.conn);
      const idle = now - room.lastActive;
      if ((!online && idle > ORPHAN_ROOM_MS) || idle > IDLE_ROOM_MS) this.deleteRoom(room, true);
    }
  }

  // ---- message handling ----

  private handle(conn: string, msg: ClientMsg): void {
    switch (msg.t) {
      case 'create':
        return this.create(conn, msg.size, msg.turnSeconds, msg.color);
      case 'join':
        return this.join(conn, msg.code, msg.color);
      case 'quick':
        return this.quick(conn, msg.size, msg.color);
      case 'cancelQuick':
        return this.dequeue(conn);
      case 'resume':
        return this.resume(conn, msg.code, msg.token);
      case 'move':
        return this.move(conn, msg.move);
      case 'undo':
        return this.undo(conn);
      case 'undoReply':
        return this.undoReply(conn, msg.accept);
      case 'rematch':
        return this.rematch(conn);
      case 'leave':
        return this.leave(conn);
    }
  }

  private create(conn: string, size: number, turnSeconds: number, color: ColorId): void {
    this.forget(conn);
    if (this.rooms.size >= MAX_ROOMS) return this.fail(conn, 'server_busy');
    const room = this.newRoom(size, turnSeconds);
    this.sit(room, 0, conn, color);
    this.sendJoined(room, 0);
    this.sendRoom(room);
  }

  private join(conn: string, code: string, color: ColorId): void {
    this.forget(conn);
    const room = this.rooms.get(code);
    if (!room || room.closed) return this.fail(conn, 'not_found');
    if (room.seats[1]) return this.fail(conn, 'full');
    this.sit(room, 1, conn, color);
    this.sendJoined(room, 1);
    this.startGame(room);
  }

  private quick(conn: string, size: number, color: ColorId): void {
    this.forget(conn);
    const i = this.queue.findIndex((w) => w.size === size);
    if (i < 0) {
      this.queue.push({ conn, size, color });
      return this.deps.send(conn, { t: 'queued' });
    }
    const [waiting] = this.queue.splice(i, 1);
    if (this.rooms.size >= MAX_ROOMS) {
      this.fail(conn, 'server_busy');
      return this.fail(waiting.conn, 'server_busy');
    }
    const room = this.newRoom(size, QUICK_TURN_SECONDS);
    this.sit(room, 0, waiting.conn, waiting.color);
    this.sit(room, 1, conn, color);
    this.sendJoined(room, 0);
    this.sendJoined(room, 1);
    this.startGame(room);
  }

  private resume(conn: string, code: string, token: string): void {
    this.forget(conn);
    const room = this.rooms.get(code);
    if (!room || room.closed) return this.fail(conn, 'not_found');
    const idx = room.seats.findIndex((s) => s && sameToken(s.token, token));
    if (idx < 0) return this.fail(conn, 'bad_token');
    const seat = idx as Player;
    // Another connection of the same player (a stale socket) is replaced.
    const old = room.seats[seat]!.conn;
    if (old && old !== conn) {
      this.where.delete(old);
      this.deps.close(old);
    }
    room.seats[seat]!.conn = conn;
    this.where.set(conn, { code, seat });
    room.lastActive = this.deps.scheduler.now();
    this.sendJoined(room, seat);
    this.sendRoom(room);
    if (room.seats[0] && room.seats[1]) this.sendGame(room, seat);
  }

  private move(conn: string, move: Move): void {
    const ctx = this.context(conn);
    if (!ctx) return this.fail(conn, 'not_found');
    const { room, seat } = ctx;
    if (!room.seats[1] || room.state.current !== seat) return this.fail(conn, 'not_your_turn');
    if (!isLegal(room.state, move)) return this.fail(conn, 'illegal_move');
    room.state = applyMove(room.state, move);
    room.undoFrom = null;
    room.rematch = [false, false];
    this.touch(room);
    this.startTurn(room);
    this.sendGame(room);
  }

  private undo(conn: string): void {
    const ctx = this.context(conn);
    if (!ctx) return this.fail(conn, 'not_found');
    const { room, seat } = ctx;
    const other = room.seats[1 - seat];
    if (!other?.conn || isOver(room.state) || movesBy(room.state, seat) === 0) {
      return this.fail(conn, 'illegal_move');
    }
    room.undoFrom = seat;
    this.deps.send(other.conn, { t: 'undoRequest' });
  }

  private undoReply(conn: string, accept: boolean): void {
    const ctx = this.context(conn);
    if (!ctx) return this.fail(conn, 'not_found');
    const { room, seat } = ctx;
    const asker = room.undoFrom;
    if (asker === null || asker === seat) return this.fail(conn, 'bad_message');
    room.undoFrom = null;
    const askerConn = room.seats[asker]?.conn;
    if (askerConn) this.deps.send(askerConn, { t: 'undoResult', accepted: accept });
    if (!accept) return;
    room.state = undoTo(room.state, asker);
    this.touch(room);
    this.startTurn(room);
    this.sendGame(room);
  }

  private rematch(conn: string): void {
    const ctx = this.context(conn);
    if (!ctx) return this.fail(conn, 'not_found');
    const { room, seat } = ctx;
    if (!isOver(room.state)) return this.fail(conn, 'illegal_move');
    room.rematch[seat] = true;
    const otherConn = room.seats[1 - seat]?.conn;
    if (!room.rematch[1 - seat]) {
      if (otherConn) this.deps.send(otherConn, { t: 'rematchOffer' });
      return;
    }
    // Both want another game: swap sides so the other player starts this time.
    room.seats = [room.seats[1], room.seats[0]];
    room.seats.forEach((s, i) => s?.conn && this.where.set(s.conn, { code: room.code, seat: i as Player }));
    room.state = newGame(room.size);
    room.rematch = [false, false];
    room.undoFrom = null;
    this.touch(room);
    this.sendRoom(room);
    this.startGame(room);
  }

  private leave(conn: string): void {
    this.dequeue(conn);
    const ctx = this.context(conn);
    if (!ctx) return;
    const { room, seat } = ctx;
    this.where.delete(conn);
    room.seats[seat] = null;
    room.closed = true;
    const other = room.seats[1 - seat];
    if (!other) return this.deleteRoom(room, false);
    if (other.conn) this.deps.send(other.conn, { t: 'left' });
  }

  // ---- helpers ----

  private newRoom(size: number, turnSeconds: number): Room {
    let code = '';
    do {
      code = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room: Room = {
      code,
      size,
      turnSeconds,
      seats: [null, null],
      state: newGame(size),
      deadline: null,
      cancelTimer: null,
      undoFrom: null,
      rematch: [false, false],
      closed: false,
      lastActive: this.deps.scheduler.now(),
    };
    this.rooms.set(code, room);
    return room;
  }

  private sit(room: Room, seat: Player, conn: string, color: ColorId): void {
    room.seats[seat] = { token: randomBytes(16).toString('hex'), conn, color };
    this.where.set(conn, { code: room.code, seat });
    this.touch(room);
  }

  private startGame(room: Room): void {
    this.sendRoom(room);
    this.startTurn(room);
    this.sendGame(room);
  }

  // (Re)starts the move clock for whoever is to move.
  private startTurn(room: Room): void {
    room.cancelTimer?.();
    room.cancelTimer = null;
    room.deadline = null;
    if (room.turnSeconds === 0 || isOver(room.state)) return;
    const ms = room.turnSeconds * 1000;
    room.deadline = this.deps.scheduler.now() + ms;
    room.cancelTimer = this.deps.scheduler.after(ms, () => this.timeout(room));
  }

  // Time ran out: the server plays a simple move for the player.
  private timeout(room: Room): void {
    if (isOver(room.state)) return;
    const who = room.state.current;
    room.state = applyMove(room.state, chooseMove(room.state, 'easy'));
    room.undoFrom = null;
    this.startTurn(room);
    this.sendGame(room, undefined, who);
  }

  private context(conn: string): { room: Room; seat: Player } | null {
    const ctx = this.where.get(conn);
    const room = ctx && this.rooms.get(ctx.code);
    return ctx && room ? { room, seat: ctx.seat } : null;
  }

  // Take a connection out of whatever it was doing (queue or room).
  private forget(conn: string): void {
    this.dequeue(conn);
    if (this.where.has(conn)) this.leave(conn);
  }

  private dequeue(conn: string): void {
    this.queue = this.queue.filter((w) => w.conn !== conn);
  }

  private deleteRoom(room: Room, notify: boolean): void {
    room.cancelTimer?.();
    this.rooms.delete(room.code);
    for (const s of room.seats) {
      if (!s?.conn) continue;
      this.where.delete(s.conn);
      if (notify) this.deps.close(s.conn);
    }
  }

  private touch(room: Room): void {
    room.lastActive = this.deps.scheduler.now();
  }

  private fail(conn: string, reason: ErrorReason): void {
    this.deps.send(conn, { t: 'error', reason });
  }

  private sendJoined(room: Room, seat: Player): void {
    const s = room.seats[seat];
    if (!s?.conn) return;
    this.deps.send(s.conn, {
      t: 'joined',
      code: room.code,
      seat,
      token: s.token,
      size: room.size,
      turnSeconds: room.turnSeconds,
    });
  }

  private sendRoom(room: Room): void {
    const info = (s: Seat | null): SeatInfo | null => s && { color: s.color, connected: s.conn !== null };
    const seats: [SeatInfo | null, SeatInfo | null] = [info(room.seats[0]), info(room.seats[1])];
    for (const s of room.seats) {
      if (s?.conn) this.deps.send(s.conn, { t: 'room', seats });
    }
  }

  // Sends the game to one seat, or to both when `only` is not given.
  private sendGame(room: Room, only?: Player, auto?: Player): void {
    const remainingMs =
      room.deadline === null ? null : Math.max(0, room.deadline - this.deps.scheduler.now());
    for (const i of [0, 1] as Player[]) {
      const conn = room.seats[i]?.conn;
      if (!conn || (only !== undefined && only !== i)) continue;
      this.deps.send(conn, { t: 'game', seat: i, moves: room.state.history, remainingMs, auto });
    }
  }
}
