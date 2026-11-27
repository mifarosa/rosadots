import assert from 'node:assert/strict';
import { COLOR_IDS, DEFAULT_SETTINGS, PALETTE, pickColor, textOn, tint } from './theme';

// Picking a free color changes only that player.
{
  const s = pickColor(DEFAULT_SETTINGS, 'p1', 'yesil');
  assert.deepEqual([s.p1, s.p2], ['yesil', 'mavi']);
}

// Picking the other player's color swaps the two, never duplicates.
{
  const s = pickColor(DEFAULT_SETTINGS, 'p1', 'mavi');
  assert.deepEqual([s.p1, s.p2], ['mavi', 'pembe']);
  const t = pickColor(s, 'p2', 'mavi');
  assert.deepEqual([t.p1, t.p2], ['pembe', 'mavi']);
}

// Every color exists in both themes and is a valid hex value.
for (const theme of ['light', 'dark'] as const) {
  for (const id of COLOR_IDS) assert.match(PALETTE[theme][id], /^#[0-9a-f]{6}$/);
}

// Helpers.
assert.equal(tint('#ff0000', 0.5), 'rgba(255,0,0,0.5)');
assert.equal(textOn('#000000'), '#ffffff');
assert.equal(textOn('#ffffff'), '#1b1b27');

console.log('theme.test.ts: all tests passed');
