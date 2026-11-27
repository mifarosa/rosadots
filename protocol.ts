// Messages between the phones and the online server. Pure TypeScript, shared
// by both sides, so the message shapes and the checks of untrusted input live
// in one place.

import { BOARD_SIZES, Move, Player } from './game';
import { COLOR_IDS, ColorId } from './theme';

// No 0/O or 1/I: codes are read aloud and typed by hand.
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

// Seconds per move a room can be created with (0 = no limit).
export const TURN_SECONDS = [0, 20, 40] as const;
// Quick match has strangers on both sides, so it always has a limit.
export const QUICK_TURN_SECONDS = 40;

export type ErrorReason =
  | 'bad_message'
  | 'not_found'
  | 'full'
  | 'bad_token'
  | 'not_your_turn'
  | 'illegal_move'
  | 'rate_limited'
  | 'server_busy';

export interface SeatInfo {
  color: ColorId;
  connected: boolean;
}

export type ClientMsg =
  | { t: 'create'; size: number; turnSeconds: number; color: ColorId }
  | { t: 'join'; code: string; color: ColorId }
  | { t: 'quick'; size: number; color: ColorId }
  | { t: 'cancelQuick' }
  | { t: 'resume'; code: string; token: string }
  | { t: 'move'; move: Move }
  | { t: 'undo' }
  | { t: 'undoReply'; accept: boolean }
  | { t: 'rematch' }
  | { t: 'leave' };

export type ServerMsg =
  // You are in a room (after create / join / quick match / resume).
  | { t: 'joined'; code: string; seat: Player; token: string; size: number; turnSeconds: number }
  // Who sits where and who is connected. seats[1] is null until a guest joins.
  | { t: 'room'; seats: [SeatInfo | null, SeatInfo | null] }
  // The whole game so far; `seat` is the recipient's player number (it changes on a rematch).
  // remainingMs is the time left for the player to move (null = no limit).
  // `auto` is set when the server played a move because time ran out.
  | { t: 'game'; seat: Player; moves: Move[]; remainingMs: number | null; auto?: Player }
  | { t: 'queued' }
  | { t: 'undoRequest' }
  | { t: 'undoResult'; accepted: boolean }
  | { t: 'rematchOffer' }
  | { t: 'left' } // the other player left the room for good
  | { t: 'error'; reason: ErrorReason };

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const isColor = (x: unknown): x is ColorId => COLOR_IDS.includes(x as ColorId);

export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
    .join('');
}

function parseMove(x: unknown): Move | null {
  if (!isObject(x) || (x.kind !== 'h' && x.kind !== 'v') || !isInt(x.r) || !isInt(x.c)) return null;
  return { kind: x.kind, r: x.r, c: x.c };
}

// Validates one raw message from a client. Returns null for anything malformed.
// Whether a move is legal is not checked here; that is game.ts's job.
export function parseClientMessage(raw: string): ClientMsg | null {
  let x: unknown;
  try {
    x = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(x) || typeof x.t !== 'string') return null;

  switch (x.t) {
    case 'create':
      if (!BOARD_SIZES.includes(x.size as number) || !(TURN_SECONDS as readonly unknown[]).includes(x.turnSeconds) || !isColor(x.color)) return null;
      return { t: 'create', size: x.size as number, turnSeconds: x.turnSeconds as number, color: x.color };
    case 'join': {
      if (typeof x.code !== 'string' || !isColor(x.color)) return null;
      const code = normalizeCode(x.code);
      return code.length === ROOM_CODE_LENGTH ? { t: 'join', code, color: x.color } : null;
    }
    case 'quick':
      if (!BOARD_SIZES.includes(x.size as number) || !isColor(x.color)) return null;
      return { t: 'quick', size: x.size as number, color: x.color };
    case 'resume': {
      if (typeof x.code !== 'string' || typeof x.token !== 'string' || x.token.length > 64) return null;
      const code = normalizeCode(x.code);
      return code.length === ROOM_CODE_LENGTH ? { t: 'resume', code, token: x.token } : null;
    }
    case 'move': {
      const move = parseMove(x.move);
      return move ? { t: 'move', move } : null;
    }
    case 'undoReply':
      return typeof x.accept === 'boolean' ? { t: 'undoReply', accept: x.accept } : null;
    case 'cancelQuick':
    case 'undo':
    case 'rematch':
    case 'leave':
      return { t: x.t };
    default:
      return null;
  }
}
