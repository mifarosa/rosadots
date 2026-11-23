import assert from 'node:assert/strict';
import {
  applyMove,
  isLegal,
  isOver,
  legalMoves,
  newGame,
  undo,
  winner,
  type GameState,
  type Move,
} from './game';

const H = (r: number, c: number): Move => ({ kind: 'h', r, c });
const V = (r: number, c: number): Move => ({ kind: 'v', r, c });
const play = (s: GameState, ...ms: Move[]) => ms.reduce(applyMove, s);

// Board shape and initial state.
{
  const s = newGame(3, 4);
  assert.equal(s.h.length, 4);
  assert.equal(s.h[0].length, 4);
  assert.equal(s.v.length, 3);
  assert.equal(s.v[0].length, 5);
  assert.equal(s.current, 0);
  assert.equal(legalMoves(s).length, 4 * 4 + 3 * 5);
}

// Turns alternate when no box is closed; illegal moves are rejected.
{
  let s = newGame(2);
  s = applyMove(s, H(0, 0));
  assert.equal(s.current, 1);
  assert.equal(s.h[0][0], 0);
  assert.equal(isLegal(s, H(0, 0)), false);
  assert.equal(isLegal(s, H(9, 0)), false);
  assert.equal(isLegal(s, V(0, 3)), false);
  assert.throws(() => applyMove(s, H(0, 0)));
}

// Immutability.
{
  const a = newGame(2);
  const b = applyMove(a, H(0, 0));
  assert.equal(a.h[0][0], null);
  assert.equal(a.history.length, 0);
  assert.notEqual(a, b);
}

// Closing a box gives ownership and a bonus move.
{
  // P0: top, P1: left, P0: right, P1: elsewhere, P0: bottom closes the box.
  let s = play(newGame(2), H(0, 0), V(0, 0), V(0, 1), H(2, 1));
  assert.equal(s.current, 0);
  s = applyMove(s, H(1, 0));
  assert.equal(s.owner[0][0], 0);
  assert.deepEqual(s.scores, [1, 0]);
  assert.equal(s.current, 0); // bonus move
}

// One line can close two boxes at once.
{
  // Fill every side of boxes (0,0) and (0,1) except the shared v(0,1).
  let s = newGame(2);
  const pre = [H(0, 0), H(1, 0), V(0, 0), H(0, 1), H(1, 1), V(0, 2)];
  s = play(s, ...pre);
  const mover = s.current;
  s = applyMove(s, V(0, 1));
  assert.equal(s.owner[0][0], mover);
  assert.equal(s.owner[0][1], mover);
  assert.equal(s.scores[mover], 2);
  assert.equal(s.current, mover);
}

// Undo restores earlier states, including score and turn.
{
  const s0 = newGame(2);
  const s1 = play(s0, H(0, 0), V(0, 0), V(0, 1), H(2, 1), H(1, 0));
  assert.equal(s1.scores[0], 1);
  const back = undo(s1);
  assert.equal(back.scores[0], 0);
  assert.equal(back.owner[0][0], null);
  assert.equal(back.current, 0);
  assert.equal(back.history.length, 4);
  assert.deepEqual(undo(s0), s0);
}

// Random full 12x12 game: terminates, all boxes owned, scores consistent.
{
  let s = newGame(12);
  let moves = 0;
  while (!isOver(s)) {
    const ms = legalMoves(s);
    assert.ok(ms.length > 0);
    s = applyMove(s, ms[Math.floor(Math.random() * ms.length)]);
    moves++;
  }
  assert.equal(moves, 13 * 12 * 2); // 312 lines
  assert.equal(s.scores[0] + s.scores[1], 144);
  assert.equal(s.owner.flat().filter((x) => x === null).length, 0);
  const w = winner(s);
  assert.ok(w === 'draw' || w === 0 || w === 1);
  assert.equal(isLegal(s, H(0, 0)), false);
  // Undo all the way back.
  let g = s;
  while (g.history.length > 200) g = undo(g);
  assert.equal(g.history.length, 200);
}

console.log('game.test.ts: all tests passed');
