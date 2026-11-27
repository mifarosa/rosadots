// Turns a tap on the board into a line. Pure TypeScript, no React / RN imports.

import { GameState, isLegal, Move } from './game';

// Pick the free edge of the tapped box that is closest to the tap point.
// (x, y) are in board coordinates with the dot padding already removed, and
// `cell` is the box size in the same unit. Returns null when nothing should be
// selected: outside the board, or in the middle of a big box where all four
// edges are about equally close and any choice would be a guess.
export function pickMove(s: GameState, x: number, y: number, cell: number): Move | null {
  const c = Math.floor(x / cell);
  const r = Math.floor(y / cell);
  if (r < 0 || c < 0 || r >= s.rows || c >= s.cols) return null;
  const dx = x - c * cell;
  const dy = y - r * cell;
  if (cell >= 40 && Math.min(dx, dy, cell - dx, cell - dy) > cell * 0.35) return null;

  const candidates: Array<[number, Move]> = [
    [dy, { kind: 'h', r, c }], // top
    [cell - dy, { kind: 'h', r: r + 1, c }], // bottom
    [dx, { kind: 'v', r, c }], // left
    [cell - dx, { kind: 'v', r, c: c + 1 }], // right
  ];
  let best: Move | null = null;
  let bestDist = Infinity;
  for (const [d, m] of candidates) {
    if (d < bestDist && isLegal(s, m)) {
      best = m;
      bestDist = d;
    }
  }
  return best;
}
