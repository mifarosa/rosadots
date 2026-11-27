// Computer opponent. Pure TypeScript on top of game.ts, no React / RN imports.

import {
  adjacentBoxes,
  applyMove,
  boxSides,
  closingMoves,
  GameState,
  legalMoves,
  Move,
} from './game';

export type Level = 'easy' | 'medium';
export type Rng = () => number; // returns a number in [0, 1)

const pick = <T>(xs: T[], rng: Rng): T => xs[Math.floor(rng() * xs.length)];

// A line is safe when it does not give the opponent a box: none of the boxes
// it touches would end up with three sides.
function isSafe(s: GameState, m: Move): boolean {
  return adjacentBoxes(s, m).every(([r, c]) => boxSides(s, r, c) < 2);
}

// How many boxes the opponent collects if they greedily take everything
// after we play `m` (exported for tests).
export function sacrificeCost(s: GameState, m: Move): number {
  const opponent = 1 - s.current;
  let g = applyMove(s, m);
  for (let next = closingMoves(g); next.length > 0; next = closingMoves(g)) {
    g = applyMove(g, next[0]);
  }
  return g.scores[opponent] - s.scores[opponent];
}

// Picks a move for the player whose turn it is.
//  easy:   take a box if possible, otherwise play anything.
//  medium: take a box if possible, otherwise avoid giving the third side;
//          when every line gives something, give away as little as possible.
export function chooseMove(s: GameState, level: Level, rng: Rng = Math.random): Move {
  const closing = closingMoves(s);
  if (closing.length > 0) return pick(closing, rng);

  const moves = legalMoves(s);
  if (moves.length === 0) throw new Error('No legal moves');
  if (level === 'easy') return pick(moves, rng);

  const safe = moves.filter((m) => isSafe(s, m));
  if (safe.length > 0) return pick(safe, rng);

  const costs = moves.map((m) => sacrificeCost(s, m));
  const cheapest = Math.min(...costs);
  return pick(
    moves.filter((_, i) => costs[i] === cheapest),
    rng,
  );
}
