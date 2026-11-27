import assert from 'node:assert/strict';
import { chooseMove, Level, Rng, sacrificeCost } from './ai';
import {
  adjacentBoxes,
  applyMove,
  boxSides,
  closingMoves,
  GameState,
  isOver,
  legalMoves,
  Move,
  newGame,
  undoTo,
  winner,
} from './game';

// Small deterministic random generator so the tests never flake.
function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const H = (r: number, c: number): Move => ({ kind: 'h', r, c });
const V = (r: number, c: number): Move => ({ kind: 'v', r, c });
const play = (s: GameState, ...ms: Move[]) => ms.reduce(applyMove, s);
const gives = (s: GameState, m: Move) =>
  adjacentBoxes(s, m).some(([r, c]) => boxSides(s, r, c) === 2);

// closingMoves: a box with three sides reports its single free edge.
{
  const s = play(newGame(2), H(0, 0), V(0, 0), V(0, 1));
  assert.deepEqual(closingMoves(s), [H(1, 0)]);
  assert.deepEqual(closingMoves(newGame(2)), []);
}

// Both levels always take a box when one can be closed.
for (const level of ['easy', 'medium'] as Level[]) {
  const s = play(newGame(3), H(0, 0), V(0, 0), V(0, 1)); // box (0,0) needs H(1,0)
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(chooseMove(s, level, seeded(i)), H(1, 0));
  }
}

// Medium never gives a box away while a safe line exists.
{
  const rng = seeded(7);
  for (let game = 0; game < 40; game++) {
    let s = newGame(6);
    while (!isOver(s)) {
      const m = chooseMove(s, 'medium', rng);
      const hasSafe = legalMoves(s).some((x) => !gives(s, x));
      if (closingMoves(s).length === 0 && hasSafe) assert.equal(gives(s, m), false);
      s = applyMove(s, m);
    }
  }
}

// When every line gives something, medium picks a line with the smallest cost.
{
  const rng = seeded(11);
  let checked = 0;
  for (let game = 0; game < 40; game++) {
    let s = newGame(5);
    while (!isOver(s)) {
      const m = chooseMove(s, 'medium', rng);
      const moves = legalMoves(s);
      if (closingMoves(s).length === 0 && moves.every((x) => gives(s, x))) {
        const best = Math.min(...moves.map((x) => sacrificeCost(s, x)));
        assert.equal(sacrificeCost(s, m), best);
        checked++;
      }
      s = applyMove(s, m);
    }
  }
  assert.ok(checked > 0, 'no forced-sacrifice position was ever reached');
}

// Medium clearly beats easy over full games (both colors, fixed seeds).
{
  let mediumWins = 0;
  let easyWins = 0;
  const rng = seeded(42);
  for (let game = 0; game < 120; game++) {
    const mediumPlays = game % 2 as 0 | 1; // alternate who starts
    let s = newGame(6);
    while (!isOver(s)) {
      s = applyMove(s, chooseMove(s, s.current === mediumPlays ? 'medium' : 'easy', rng));
    }
    const w = winner(s);
    if (w === mediumPlays) mediumWins++;
    else if (w !== 'draw') easyWins++;
  }
  assert.ok(mediumWins > easyWins * 2, `medium ${mediumWins} vs easy ${easyWins}`);
}

// undoTo goes back to the requested player's turn.
{
  // Human (0) plays, computer (1) plays, human is to move again.
  let s = play(newGame(3), H(0, 0), V(0, 0));
  assert.equal(s.current, 0);
  assert.equal(undoTo(s, 0).history.length, 0);
  // Human closes a box (keeps the turn), then undo removes just that move.
  s = play(newGame(2), H(0, 0), V(0, 0), V(0, 1), H(2, 1), H(1, 0));
  assert.equal(s.current, 0);
  assert.equal(undoTo(s, 0).history.length, 4);
}

console.log('ai.test.ts: all tests passed');
