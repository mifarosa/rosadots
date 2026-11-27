// Pure game rules for Dots and Boxes. No React / React Native imports:
// this file is shared with the future online server to validate moves.

// Square board sizes offered in the menus (game.ts itself supports any rows x cols).
export const BOARD_SIZES = [4, 6, 8, 12];

export type Player = 0 | 1;
export type Cell = Player | null;

// 'h' = horizontal line, 'v' = vertical line.
export type Move = { kind: 'h' | 'v'; r: number; c: number };

export interface GameState {
  rows: number; // number of boxes vertically
  cols: number; // number of boxes horizontally
  h: Cell[][]; // (rows + 1) x cols, who drew each horizontal line
  v: Cell[][]; // rows x (cols + 1), who drew each vertical line
  owner: Cell[][]; // rows x cols, who captured each box
  current: Player; // player to move
  scores: [number, number];
  history: Move[]; // every move played, in order
}

const grid = (n: number, m: number): Cell[][] =>
  Array.from({ length: n }, () => Array<Cell>(m).fill(null));

export function newGame(rows: number, cols: number = rows): GameState {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || cols < 1) {
    throw new Error('Board must be at least 1x1');
  }
  return {
    rows,
    cols,
    h: grid(rows + 1, cols),
    v: grid(rows, cols + 1),
    owner: grid(rows, cols),
    current: 0,
    scores: [0, 0],
    history: [],
  };
}

export function isLegal(s: GameState, m: Move): boolean {
  if (isOver(s)) return false;
  if (!Number.isInteger(m.r) || !Number.isInteger(m.c)) return false;
  const lines = m.kind === 'h' ? s.h : m.kind === 'v' ? s.v : null;
  if (!lines) return false;
  if (m.r < 0 || m.r >= lines.length) return false;
  if (m.c < 0 || m.c >= lines[m.r].length) return false;
  return lines[m.r][m.c] === null;
}

// Number of drawn sides of box (r, c).
export function boxSides(s: GameState, r: number, c: number): number {
  return (
    (s.h[r][c] !== null ? 1 : 0) +
    (s.h[r + 1][c] !== null ? 1 : 0) +
    (s.v[r][c] !== null ? 1 : 0) +
    (s.v[r][c + 1] !== null ? 1 : 0)
  );
}

// Boxes that touch a line (one or two).
export function adjacentBoxes(s: GameState, m: Move): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (m.kind === 'h') {
    if (m.r > 0) out.push([m.r - 1, m.c]);
    if (m.r < s.rows) out.push([m.r, m.c]);
  } else {
    if (m.c > 0) out.push([m.r, m.c - 1]);
    if (m.c < s.cols) out.push([m.r, m.c]);
  }
  return out;
}

// Lines that would close at least one box right now (a box with 3 sides has
// exactly one free edge). A line that closes two boxes appears twice.
export function closingMoves(s: GameState): Move[] {
  const out: Move[] = [];
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      if (boxSides(s, r, c) !== 3) continue;
      if (s.h[r][c] === null) out.push({ kind: 'h', r, c });
      else if (s.h[r + 1][c] === null) out.push({ kind: 'h', r: r + 1, c });
      else if (s.v[r][c] === null) out.push({ kind: 'v', r, c });
      else out.push({ kind: 'v', r, c: c + 1 });
    }
  }
  return out;
}

// Returns a new state; the input is never mutated. Throws on an illegal move.
export function applyMove(s: GameState, m: Move): GameState {
  if (!isLegal(s, m)) throw new Error('Illegal move');
  const p = s.current;
  const h = s.h.map((row) => row.slice());
  const v = s.v.map((row) => row.slice());
  const owner = s.owner.map((row) => row.slice());
  (m.kind === 'h' ? h : v)[m.r][m.c] = p;

  const next: GameState = { ...s, h, v, owner, scores: [s.scores[0], s.scores[1]] };
  let captured = 0;
  for (const [r, c] of adjacentBoxes(s, m)) {
    if (owner[r][c] === null && boxSides(next, r, c) === 4) {
      owner[r][c] = p;
      captured++;
    }
  }
  next.scores[p] += captured;
  // Capturing a box earns another turn.
  next.current = captured > 0 ? p : ((1 - p) as Player);
  next.history = [...s.history, { kind: m.kind, r: m.r, c: m.c }];
  return next;
}

export function isOver(s: GameState): boolean {
  return s.scores[0] + s.scores[1] === s.rows * s.cols;
}

// Winning player, 'draw' on a tie, or null while the game is running.
export function winner(s: GameState): Player | 'draw' | null {
  if (!isOver(s)) return null;
  if (s.scores[0] === s.scores[1]) return 'draw';
  return s.scores[0] > s.scores[1] ? 0 : 1;
}

// Undo the last move by replaying the history from an empty board.
export function undo(s: GameState): GameState {
  if (s.history.length === 0) return s;
  let g = newGame(s.rows, s.cols);
  for (const m of s.history.slice(0, -1)) g = applyMove(g, m);
  return g;
}

// Undo moves until it is `p`'s turn again (at least one move, unless the
// history is empty). Used to take back a move in a game against the computer.
export function undoTo(s: GameState, p: Player): GameState {
  let g = undo(s);
  while (g.history.length > 0 && g.current !== p) g = undo(g);
  return g;
}

// How many moves `p` has made so far, found by replaying the game.
export function movesBy(s: GameState, p: Player): number {
  let g = newGame(s.rows, s.cols);
  let n = 0;
  for (const m of s.history) {
    if (g.current === p) n++;
    g = applyMove(g, m);
  }
  return n;
}

// All lines still free, in a stable order.
export function legalMoves(s: GameState): Move[] {
  const out: Move[] = [];
  if (isOver(s)) return out;
  s.h.forEach((row, r) => row.forEach((x, c) => x === null && out.push({ kind: 'h', r, c })));
  s.v.forEach((row, r) => row.forEach((x, c) => x === null && out.push({ kind: 'v', r, c })));
  return out;
}
