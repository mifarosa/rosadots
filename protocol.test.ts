import assert from 'node:assert/strict';
import { normalizeCode, parseClientMessage } from './protocol';

const parse = (x: unknown) => parseClientMessage(typeof x === 'string' ? x : JSON.stringify(x));

// Valid messages.
assert.deepEqual(parse({ t: 'create', size: 6, turnSeconds: 20, color: 'mavi' }), {
  t: 'create', size: 6, turnSeconds: 20, color: 'mavi',
});
assert.deepEqual(parse({ t: 'join', code: 'ab-c2d', color: 'pembe' }), { t: 'join', code: 'ABC2D', color: 'pembe' });
assert.deepEqual(parse({ t: 'move', move: { kind: 'v', r: 2, c: 3, extra: 'ignored' } }), {
  t: 'move', move: { kind: 'v', r: 2, c: 3 },
});
assert.deepEqual(parse({ t: 'undoReply', accept: false }), { t: 'undoReply', accept: false });
for (const t of ['cancelQuick', 'undo', 'rematch', 'leave']) assert.deepEqual(parse({ t }), { t });

// Anything malformed is refused.
for (const bad of [
  'not json',
  '[]',
  'null',
  { t: 42 },
  { t: 'unknown' },
  { t: 'create', size: 5, turnSeconds: 0, color: 'pembe' }, // size not offered
  { t: 'create', size: 6, turnSeconds: 7, color: 'pembe' }, // time limit not offered
  { t: 'create', size: 6, turnSeconds: 0, color: 'siyah' }, // unknown color
  { t: 'join', code: 'ABC', color: 'pembe' }, // too short
  { t: 'join', code: 12345, color: 'pembe' },
  { t: 'resume', code: 'ABCDE', token: 'x'.repeat(65) },
  { t: 'move', move: { kind: 'x', r: 0, c: 0 } },
  { t: 'move', move: { kind: 'h', r: 1.5, c: 0 } },
  { t: 'move', move: { kind: 'h', r: '1', c: 0 } },
  { t: 'undoReply', accept: 'yes' },
]) {
  assert.equal(parse(bad), null, JSON.stringify(bad));
}

// Room codes: letters that are easy to confuse are not part of the alphabet.
assert.equal(normalizeCode('o0 i1 l-abc'), 'LABC');

console.log('protocol.test.ts: all tests passed');
