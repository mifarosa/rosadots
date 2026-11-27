// Client side of the online game: one WebSocket, kept alive and re-joined
// automatically. Framework-free, so it can be tested against the real server.
// The UI reads `getSnapshot()` and calls the action methods.

import { applyMove, GameState, Move, newGame, Player } from '../game';
import { ClientMsg, ErrorReason, SeatInfo, ServerMsg } from '../protocol';
import { ColorId } from '../theme';

export interface SavedRoom {
  code: string;
  token: string;
}

// Where the room code and secret are kept so the game survives an app restart.
export interface RoomStorage {
  load(): Promise<SavedRoom | null>;
  save(room: SavedRoom | null): Promise<void>;
}

export interface OnlineSnapshot {
  link: 'offline' | 'connecting' | 'online';
  queued: boolean; // waiting for a quick-match opponent
  room: null | {
    code: string;
    seat: Player;
    size: number;
    turnSeconds: number;
    seats: [SeatInfo | null, SeatInfo | null];
  };
  game: GameState | null; // null until both players are in the room
  deadline: number | null; // Date.now() value when the player to move runs out of time
  undo: 'none' | 'asked' | 'incoming'; // asked = I asked, incoming = the opponent asks me
  rematch: 'none' | 'asked' | 'incoming';
  opponentLeft: boolean;
  error: ErrorReason | null;
  notice: string | null; // short message for a few seconds
}

const INITIAL: OnlineSnapshot = {
  link: 'offline',
  queued: false,
  room: null,
  game: null,
  deadline: null,
  undo: 'none',
  rematch: 'none',
  opponentLeft: false,
  error: null,
  notice: null,
};

const NOTICE_MS = 3000;
const UNDO_WAIT_MS = 20_000;
const MAX_RETRY_MS = 15_000;

export class OnlineSession {
  private snap: OnlineSnapshot = INITIAL;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private saved: SavedRoom | null = null;
  private wanted = false; // the online screen is open: keep the connection alive
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private timers: Array<ReturnType<typeof setTimeout>> = [];

  constructor(
    private url: string,
    private storage: RoomStorage,
  ) {}

  // ---- state for the UI ----

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.snap;

  private set(patch: Partial<OnlineSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms));
  }

  private notify(text: string) {
    this.set({ notice: text });
    this.later(NOTICE_MS, () => this.snap.notice === text && this.set({ notice: null }));
  }

  // ---- connection ----

  async open(): Promise<void> {
    this.wanted = true;
    this.saved = await this.storage.load();
    this.connect();
  }

  close(): void {
    this.wanted = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.ws?.close();
    this.ws = null;
    this.snap = INITIAL;
    this.listeners.forEach((l) => l());
  }

  // Used when the app returns to the foreground: the phone may have cut the socket.
  reconnectNow(): void {
    if (!this.wanted) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    this.retries = 0;
    this.connect();
  }

  private connect() {
    if (!this.wanted || this.ws) return;
    this.set({ link: 'connecting' });
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      this.set({ link: 'online' });
      if (this.saved) this.send({ t: 'resume', ...this.saved });
    };
    ws.onmessage = (e) => {
      try {
        this.receive(JSON.parse(String(e.data)) as ServerMsg);
      } catch {
        // A malformed message from the server is ignored.
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws) return; // an old socket we already replaced
      this.ws = null;
      this.set({ link: this.wanted ? 'connecting' : 'offline', queued: false });
      if (!this.wanted) return;
      const wait = Math.min(1000 * 2 ** this.retries++, MAX_RETRY_MS);
      this.retryTimer = setTimeout(() => this.connect(), wait);
    };
    ws.onerror = () => {}; // onclose follows and handles the retry
  }

  private send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  // ---- actions ----

  create = (size: number, turnSeconds: number, color: ColorId) => {
    this.set({ error: null });
    this.send({ t: 'create', size, turnSeconds, color });
  };
  join = (code: string, color: ColorId) => {
    this.set({ error: null });
    this.send({ t: 'join', code, color });
  };
  quick = (size: number, color: ColorId) => {
    this.set({ error: null });
    this.send({ t: 'quick', size, color });
  };
  cancelQuick = () => {
    this.send({ t: 'cancelQuick' });
    this.set({ queued: false });
  };
  move = (move: Move) => {
    this.set({ error: null }); // so a repeated error is noticed as a change
    this.send({ t: 'move', move });
  };
  askUndo = () => {
    this.send({ t: 'undo' });
    this.set({ undo: 'asked' });
    this.later(UNDO_WAIT_MS, () => this.snap.undo === 'asked' && this.set({ undo: 'none' }));
  };
  answerUndo = (accept: boolean) => {
    this.send({ t: 'undoReply', accept });
    this.set({ undo: 'none' });
  };
  askRematch = () => {
    this.send({ t: 'rematch' });
    this.set({ rematch: this.snap.rematch === 'incoming' ? 'none' : 'asked' });
  };
  dismissError = () => this.set({ error: null });

  // Leave the room for good (the opponent is told).
  leave = () => {
    this.send({ t: 'leave' });
    this.forgetRoom();
  };

  private forgetRoom() {
    this.saved = null;
    void this.storage.save(null);
    this.set({
      room: null,
      game: null,
      deadline: null,
      undo: 'none',
      rematch: 'none',
      opponentLeft: false,
      queued: false,
    });
  }

  // ---- messages from the server ----

  private receive(m: ServerMsg) {
    switch (m.t) {
      case 'joined': {
        this.saved = { code: m.code, token: m.token };
        void this.storage.save(this.saved);
        const sameRoom = this.snap.room?.code === m.code;
        this.set({
          queued: false,
          opponentLeft: false,
          game: sameRoom ? this.snap.game : null,
          room: {
            code: m.code,
            seat: m.seat,
            size: m.size,
            turnSeconds: m.turnSeconds,
            seats: this.snap.room?.seats ?? [null, null],
          },
        });
        return;
      }
      case 'room':
        if (this.snap.room) this.set({ room: { ...this.snap.room, seats: m.seats } });
        return;
      case 'game': {
        const room = this.snap.room;
        if (!room) return;
        let game: GameState;
        try {
          game = m.moves.reduce(applyMove, newGame(room.size));
        } catch {
          // Out of sync with the server: rejoin to get a fresh copy.
          this.ws?.close();
          return;
        }
        const fresh = m.moves.length === 0;
        this.set({
          room: { ...room, seat: m.seat },
          game,
          deadline: m.remainingMs === null ? null : Date.now() + m.remainingMs,
          undo: 'none',
          rematch: fresh ? 'none' : this.snap.rematch,
        });
        if (m.auto !== undefined) {
          this.notify(m.auto === m.seat ? 'Süre doldu, hamlen otomatik oynandı' : 'Rakibin süresi doldu');
        }
        return;
      }
      case 'queued':
        this.set({ queued: true });
        return;
      case 'undoRequest':
        this.set({ undo: 'incoming' });
        return;
      case 'undoResult':
        if (!m.accepted) this.notify('Rakip geri almayı kabul etmedi');
        this.set({ undo: 'none' });
        return;
      case 'rematchOffer':
        this.set({ rematch: 'incoming' });
        return;
      case 'left':
        this.saved = null;
        void this.storage.save(null);
        this.set({ opponentLeft: true, undo: 'none', deadline: null });
        return;
      case 'error':
        if ((m.reason === 'not_found' || m.reason === 'bad_token') && this.saved && !this.snap.game) {
          // The saved room is gone (finished, expired or left): forget it.
          this.forgetRoom();
        }
        if (m.reason === 'not_your_turn' || m.reason === 'illegal_move') {
          // Our copy of the game was out of date: ask for a fresh one.
          if (this.saved) this.send({ t: 'resume', ...this.saved });
        }
        this.set({ error: m.reason });
        return;
    }
  }
}
