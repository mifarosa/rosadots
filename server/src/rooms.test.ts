import assert from 'node:assert/strict';
import { chooseMove } from '../../ai';
import { applyMove, GameState, isOver, newGame } from '../../game';
import { ServerMsg } from '../../protocol';
import { Lobby } from './rooms';

// A lobby with a fake clock and an inbox per connection.
function setup() {
  let time = 1_000;
  const timers: Array<{ at: number; fn: () => void; live: boolean }> = [];
  const inbox = new Map<string, ServerMsg[]>();
  const closed: string[] = [];
  const lobby = new Lobby({
    send: (c, m) => inbox.set(c, [...(inbox.get(c) ?? []), m]),
    close: (c) => closed.push(c),
    scheduler: {
      now: () => time,
      after: (ms, fn) => {
        const t = { at: time + ms, fn, live: true };
        timers.push(t);
        return () => (t.live = false);
      },
    },
  });
  const advance = (ms: number) => {
    time += ms;
    for (const t of timers) if (t.live && t.at <= time) ((t.live = false), t.fn());
  };
  const send = (c: string, m: object) => lobby.receive(c, JSON.stringify(m));
  const msgs = (c: string) => inbox.get(c) ?? [];
  const last = <T extends ServerMsg['t']>(c: string, t: T) =>
    [...msgs(c)].reverse().find((m) => m.t === t) as Extract<ServerMsg, { t: T }> | undefined;
  const clear = () => inbox.clear();
  return { lobby, advance, send, msgs, last, clear, closed };
}
type T = ReturnType<typeof setup>;

const stateOf = (t: T, c: string): GameState => {
  const g = t.last(c, 'game')!;
  return g.moves.reduce(applyMove, newGame(4));
};

// Two players in a fresh 4x4 room: a is seat 0, b is seat 1.
function pair(t: T, turnSeconds = 0) {
  t.send('a', { t: 'create', size: 4, turnSeconds, color: 'pembe' });
  const code = t.last('a', 'joined')!.code;
  t.send('b', { t: 'join', code, color: 'mavi' });
  return code;
}

// Plays easy moves for whoever's turn it is until the game ends.
function playOut(t: T, conns: [string, string]) {
  let s = stateOf(t, conns[0]);
  while (!isOver(s)) {
    t.send(conns[s.current], { t: 'move', move: chooseMove(s, 'easy') });
    s = stateOf(t, conns[0]);
  }
}

// Creating and joining a room.
{
  const t = setup();
  t.send('a', { t: 'create', size: 4, turnSeconds: 0, color: 'pembe' });
  const joined = t.last('a', 'joined')!;
  assert.equal(joined.seat, 0);
  assert.equal(joined.code.length, 5);
  assert.deepEqual(t.last('a', 'room')!.seats, [{ color: 'pembe', connected: true }, null]);
  assert.equal(t.last('a', 'game'), undefined, 'no game before a guest joins');

  t.send('b', { t: 'join', code: joined.code.toLowerCase(), color: 'mavi' });
  assert.equal(t.last('b', 'joined')!.seat, 1);
  assert.equal(t.last('a', 'game')!.seat, 0);
  assert.equal(t.last('b', 'game')!.seat, 1);
  assert.deepEqual(t.last('a', 'room')!.seats[1], { color: 'mavi', connected: true });

  t.send('c', { t: 'join', code: joined.code, color: 'yesil' });
  assert.equal((t.last('c', 'error') as { reason: string }).reason, 'full');
  t.send('d', { t: 'join', code: 'ZZZZZ', color: 'yesil' });
  assert.equal((t.last('d', 'error') as { reason: string }).reason, 'not_found');
  t.send('e', { t: 'nonsense' });
  assert.equal((t.last('e', 'error') as { reason: string }).reason, 'bad_message');
}

// Moves: turn order, illegal moves, bonus moves, and the server is the truth.
{
  const t = setup();
  pair(t);
  t.clear();
  t.send('b', { t: 'move', move: { kind: 'h', r: 0, c: 0 } });
  assert.equal((t.last('b', 'error') as { reason: string }).reason, 'not_your_turn');
  t.send('a', { t: 'move', move: { kind: 'h', r: 9, c: 0 } });
  assert.equal((t.last('a', 'error') as { reason: string }).reason, 'illegal_move');
  t.send('a', { t: 'move', move: { kind: 'h', r: 0, c: 0 } });
  assert.equal(t.last('a', 'game')!.moves.length, 1);
  assert.equal(t.last('b', 'game')!.moves.length, 1);
  t.send('a', { t: 'move', move: { kind: 'h', r: 1, c: 0 } });
  assert.equal((t.last('a', 'error') as { reason: string }).reason, 'not_your_turn');

  // Close a box: the capturing player keeps the turn.
  t.send('b', { t: 'move', move: { kind: 'v', r: 0, c: 0 } });
  t.send('a', { t: 'move', move: { kind: 'h', r: 3, c: 3 } });
  t.send('b', { t: 'move', move: { kind: 'v', r: 0, c: 1 } });
  t.send('a', { t: 'move', move: { kind: 'h', r: 3, c: 2 } });
  t.send('b', { t: 'move', move: { kind: 'h', r: 1, c: 0 } }); // b closes box (0,0)
  const s = stateOf(t, 'a');
  assert.deepEqual(s.scores, [0, 1]);
  assert.equal(s.current, 1);
  t.send('b', { t: 'move', move: { kind: 'h', r: 3, c: 1 } }); // b plays again
  assert.equal(stateOf(t, 'a').history.length, 7);
}

// Reconnecting: presence, resume with the token, bad token, stale socket.
{
  const t = setup();
  const code = pair(t);
  const token = t.last('a', 'joined')!.token;
  t.send('a', { t: 'move', move: { kind: 'h', r: 0, c: 0 } });
  t.lobby.disconnect('a');
  assert.deepEqual(t.last('b', 'room')!.seats[0], { color: 'pembe', connected: false });

  t.send('a2', { t: 'resume', code, token: 'wrong' });
  assert.equal((t.last('a2', 'error') as { reason: string }).reason, 'bad_token');
  t.send('a2', { t: 'resume', code, token });
  assert.equal(t.last('a2', 'joined')!.seat, 0);
  assert.equal(t.last('a2', 'game')!.moves.length, 1);
  assert.equal(t.last('b', 'room')!.seats[0]!.connected, true);

  // The same player shows up on yet another socket: the old one is closed.
  t.send('a3', { t: 'resume', code, token });
  assert.ok(t.closed.includes('a2'));
  t.send('a3', { t: 'move', move: { kind: 'h', r: 0, c: 1 } }); // b's turn, but a3 is seat 0
  assert.equal((t.last('a3', 'error') as { reason: string }).reason, 'not_your_turn');
}

// Quick match.
{
  const t = setup();
  t.send('a', { t: 'quick', size: 6, color: 'pembe' });
  assert.ok(t.last('a', 'queued'));
  t.send('b', { t: 'quick', size: 4, color: 'mavi' });
  assert.ok(t.last('b', 'queued'), 'different sizes do not match');
  t.send('c', { t: 'quick', size: 6, color: 'yesil' });
  assert.equal(t.last('a', 'joined')!.seat, 0);
  assert.equal(t.last('c', 'joined')!.seat, 1);
  assert.equal(t.last('a', 'joined')!.turnSeconds, 40);
  assert.ok(t.last('a', 'game') && t.last('c', 'game'));

  // A player who cancels or disconnects is no longer matched.
  t.send('d', { t: 'quick', size: 8, color: 'pembe' });
  t.send('d', { t: 'cancelQuick' });
  t.send('e', { t: 'quick', size: 8, color: 'mavi' });
  assert.ok(t.last('e', 'queued'));
  t.lobby.disconnect('e');
  t.send('f', { t: 'quick', size: 8, color: 'mavi' });
  assert.ok(t.last('f', 'queued'));
  assert.equal(t.lobby.stats().queued, 2, 'b (4x4) and f (8x8) are still waiting');
}

// Move clock: time runs out, the server plays for the slow player.
{
  const t = setup();
  pair(t, 20);
  const g = t.last('a', 'game')!;
  assert.equal(g.remainingMs, 20_000);
  t.advance(19_000);
  assert.equal(t.last('a', 'game')!.moves.length, 0);
  t.advance(1_500);
  const after = t.last('a', 'game')!;
  assert.equal(after.moves.length, 1);
  assert.equal(after.auto, 0);
  assert.equal(after.remainingMs, 20_000, 'the clock restarts for the next player');
  // A real move cancels the pending timeout.
  t.send('b', { t: 'move', move: { kind: 'h', r: 3, c: 3 } });
  t.advance(19_000);
  assert.equal(t.last('a', 'game')!.moves.length, 2);
}

// Taking a move back.
{
  const t = setup();
  pair(t);
  t.send('a', { t: 'undo' });
  assert.equal((t.last('a', 'error') as { reason: string }).reason, 'illegal_move', 'nothing to take back yet');
  t.send('a', { t: 'move', move: { kind: 'h', r: 0, c: 0 } });
  t.send('b', { t: 'move', move: { kind: 'h', r: 3, c: 3 } });

  t.send('a', { t: 'undo' }); // a asks to take back their move
  assert.ok(t.last('b', 'undoRequest'));
  t.send('b', { t: 'undoReply', accept: false });
  assert.equal(t.last('a', 'undoResult')!.accepted, false);
  assert.equal(stateOf(t, 'a').history.length, 2);

  t.send('a', { t: 'undo' });
  t.send('a', { t: 'undoReply', accept: true }); // the asker cannot answer for the other
  assert.equal((t.last('a', 'error') as { reason: string }).reason, 'bad_message');
  t.send('b', { t: 'undoReply', accept: true });
  assert.equal(t.last('a', 'undoResult')!.accepted, true);
  const s = stateOf(t, 'a');
  assert.equal(s.history.length, 0, 'back to the start of a is turn');
  assert.equal(s.current, 0);
}

// Rematch swaps sides.
{
  const t = setup();
  pair(t);
  t.send('a', { t: 'rematch' });
  assert.equal((t.last('a', 'error') as { reason: string }).reason, 'illegal_move', 'only after the game ends');
  playOut(t, ['a', 'b']);
  const tokenA = t.last('a', 'joined')!.token;
  const code = t.last('a', 'joined')!.code;
  t.clear();
  t.send('a', { t: 'rematch' });
  assert.ok(t.last('b', 'rematchOffer'));
  t.send('b', { t: 'rematch' });
  assert.equal(t.last('a', 'game')!.seat, 1);
  assert.equal(t.last('b', 'game')!.seat, 0);
  assert.equal(t.last('a', 'game')!.moves.length, 0);
  // b now starts, using the same connection.
  t.send('b', { t: 'move', move: { kind: 'h', r: 0, c: 0 } });
  assert.equal(t.last('a', 'game')!.moves.length, 1);
  // The old token of a now leads to a's new seat (1).
  t.lobby.disconnect('a');
  t.send('a2', { t: 'resume', code, token: tokenA });
  assert.equal(t.last('a2', 'joined')!.seat, 1);
}

// Leaving.
{
  const t = setup();
  const code = pair(t);
  const token = t.last('b', 'joined')!.token;
  t.send('a', { t: 'leave' });
  assert.ok(t.last('b', 'left'));
  t.send('c', { t: 'join', code, color: 'yesil' });
  assert.equal((t.last('c', 'error') as { reason: string }).reason, 'not_found');
  t.send('b2', { t: 'resume', code, token });
  assert.equal((t.last('b2', 'error') as { reason: string }).reason, 'not_found');

  // A waiting room disappears when its creator leaves.
  t.send('x', { t: 'create', size: 4, turnSeconds: 0, color: 'pembe' });
  const waiting = t.last('x', 'joined')!.code;
  t.send('x', { t: 'leave' });
  t.send('y', { t: 'join', code: waiting, color: 'mavi' });
  assert.equal((t.last('y', 'error') as { reason: string }).reason, 'not_found');
}

// Creating a new room leaves the old one.
{
  const t = setup();
  const code = pair(t);
  t.send('a', { t: 'create', size: 6, turnSeconds: 0, color: 'pembe' });
  assert.ok(t.last('b', 'left'));
  assert.notEqual(t.last('a', 'joined')!.code, code);
}

// Cleanup of abandoned rooms.
{
  const t = setup();
  const code = pair(t);
  const token = t.last('a', 'joined')!.token;
  t.lobby.disconnect('a');
  t.lobby.disconnect('b');
  t.advance(10 * 60_000);
  t.lobby.sweep();
  assert.equal(t.lobby.stats().rooms, 1, 'still resumable after 10 minutes');
  t.advance(10 * 60_000);
  t.lobby.sweep();
  assert.equal(t.lobby.stats().rooms, 0);
  t.send('a2', { t: 'resume', code, token });
  assert.equal((t.last('a2', 'error') as { reason: string }).reason, 'not_found');
}

console.log('rooms.test.ts: all tests passed');
