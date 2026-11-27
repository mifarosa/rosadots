import assert from 'node:assert/strict';
import { applyMove, newGame } from './game';
import { pickMove } from './pickMove';

const cell = 50;
const s = newGame(3);

// Taps near each edge of box (1,1) pick that edge.
assert.deepEqual(pickMove(s, 75, 53, cell), { kind: 'h', r: 1, c: 1 }); // top
assert.deepEqual(pickMove(s, 75, 97, cell), { kind: 'h', r: 2, c: 1 }); // bottom
assert.deepEqual(pickMove(s, 53, 75, cell), { kind: 'v', r: 1, c: 1 }); // left
assert.deepEqual(pickMove(s, 97, 75, cell), { kind: 'v', r: 1, c: 2 }); // right

// The middle of a big box selects nothing instead of guessing.
assert.equal(pickMove(s, 75, 75, cell), null);

// Outside the board selects nothing.
assert.equal(pickMove(s, -5, 20, cell), null);
assert.equal(pickMove(s, 20, 500, cell), null);

// A taken edge is skipped: the next nearest free edge of the box wins.
{
  const g = applyMove(s, { kind: 'h', r: 1, c: 1 });
  assert.deepEqual(pickMove(g, 75, 53, cell), { kind: 'v', r: 1, c: 1 }); // left is next closest
}

// Small boxes (hard to hit on 12x12) always pick the nearest edge, even in the middle.
assert.notEqual(pickMove(s, 15, 15, 30), null);

console.log('pickMove.test.ts: all tests passed');
