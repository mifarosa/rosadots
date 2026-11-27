// The phone-side OnlineSession against the real server process.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { OnlineSession, OnlineSnapshot, RoomStorage, SavedRoom } from '../../online/session';

const PORT = 21000 + (process.pid % 20000);
const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

const memoryStorage = (): RoomStorage & { value: SavedRoom | null } => ({
  value: null,
  async load() { return this.value; },
  async save(r) { this.value = r; },
});

async function until(s: OnlineSession, ok: (x: OnlineSnapshot) => boolean, what: string) {
  for (let i = 0; i < 150; i++) {
    if (ok(s.getSnapshot())) return s.getSnapshot();
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`timed out: ${what}`);
}

async function main() {
  await new Promise<void>((ok) => child.stdout!.on('data', (d) => String(d).includes('listening') && ok()));
  const url = `ws://127.0.0.1:${PORT}`;

  const storeA = memoryStorage();
  const a = new OnlineSession(url, storeA);
  const b = new OnlineSession(url, memoryStorage());
  await Promise.all([a.open(), b.open()]);
  await Promise.all([until(a, (s) => s.link === 'online', 'a online'), until(b, (s) => s.link === 'online', 'b online')]);

  // Create and join: both end up with a game, a is seat 0.
  a.create(4, 0, 'pembe');
  const created = await until(a, (s) => s.room !== null, 'a room');
  assert.equal(created.game, null, 'no game until the guest joins');
  b.join(created.room!.code.toLowerCase(), 'mavi');
  await until(b, (s) => s.game !== null, 'b game');
  const ga = await until(a, (s) => s.game !== null, 'a game');
  assert.equal(ga.room!.seat, 0);
  assert.equal(b.getSnapshot().room!.seat, 1);
  assert.deepEqual(ga.room!.seats[1], { color: 'mavi', connected: true });
  assert.equal(storeA.value?.code, created.room!.code, 'the room is saved for rejoining');

  // A move travels through the server to the other phone.
  a.move({ kind: 'h', r: 0, c: 0 });
  await until(b, (s) => s.game!.history.length === 1, 'b sees the move');
  await until(a, (s) => s.game!.history.length === 1, 'a sees its own move');
  assert.equal(b.getSnapshot().game!.current, 1);

  // The socket dies: the session reconnects and rejoins by itself.
  (a as unknown as { ws: WebSocket }).ws.close();
  await until(b, (s) => s.room!.seats[0]!.connected === false, 'b sees a offline');
  await until(a, (s) => s.link === 'online' && s.game !== null && s.game.history.length === 1, 'a rejoined');
  await until(b, (s) => s.room!.seats[0]!.connected === true, 'b sees a back');

  // A new app start (new session object, same storage) lands in the same game.
  a.close();
  const a2 = new OnlineSession(url, storeA);
  await a2.open();
  const back = await until(a2, (s) => s.game !== null, 'a2 resumed from storage');
  assert.equal(back.room!.code, created.room!.code);
  assert.equal(back.game!.history.length, 1);

  // Taking a move back needs the other player's yes.
  b.move({ kind: 'h', r: 3, c: 3 });
  await until(a2, (s) => s.game!.history.length === 2, 'a2 sees b move');
  a2.askUndo();
  await until(b, (s) => s.undo === 'incoming', 'b gets the request');
  b.answerUndo(true);
  await until(a2, (s) => s.game!.history.length === 0 && s.undo === 'none', 'undo applied');

  // Leaving tells the other side and forgets the room.
  b.leave();
  await until(a2, (s) => s.opponentLeft, 'a2 told that b left');
  assert.equal(b.getSnapshot().room, null);

  // Quick match pairs two strangers.
  const c = new OnlineSession(url, memoryStorage());
  const d = new OnlineSession(url, memoryStorage());
  await Promise.all([c.open(), d.open()]);
  await Promise.all([until(c, (s) => s.link === 'online', 'c'), until(d, (s) => s.link === 'online', 'd')]);
  c.quick(6, 'pembe');
  await until(c, (s) => s.queued, 'c queued');
  d.quick(6, 'mavi');
  await until(c, (s) => s.game !== null && !s.queued, 'c matched');
  await until(d, (s) => s.game !== null, 'd matched');
  assert.equal(c.getSnapshot().room!.turnSeconds, 40);

  // A room that does not exist is reported.
  const e = new OnlineSession(url, memoryStorage());
  await e.open();
  await until(e, (s) => s.link === 'online', 'e');
  e.join('ZZZZZ', 'pembe');
  assert.equal((await until(e, (s) => s.error !== null, 'e error')).error, 'not_found');

  for (const s of [a2, b, c, d, e]) s.close();
  console.log('session.test.ts: all tests passed');
}

main()
  .then(() => (child.kill(), process.exit(0)))
  .catch((e) => {
    console.error(e);
    child.kill();
    process.exit(1);
  });
