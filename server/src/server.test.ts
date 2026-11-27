// End-to-end: starts the real server process and plays through real WebSockets.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { ServerMsg } from '../../protocol';

const PORT = 20000 + (process.pid % 20000);
const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

class Client {
  msgs: ServerMsg[] = [];
  ws: WebSocket;
  constructor() {
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    this.ws.onmessage = (e) => this.msgs.push(JSON.parse(String(e.data)));
  }
  open = () => new Promise<void>((ok) => (this.ws.onopen = () => ok()));
  send = (m: object) => this.ws.send(JSON.stringify(m));
  async next<T extends ServerMsg['t']>(t: T, from = 0): Promise<Extract<ServerMsg, { t: T }>> {
    for (let i = 0; i < 100; i++) {
      const m = this.msgs.slice(from).find((x) => x.t === t);
      if (m) return m as Extract<ServerMsg, { t: T }>;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`timed out waiting for ${t}`);
  }
}

async function main() {
  await new Promise<void>((ok) => child.stdout!.on('data', (d) => String(d).includes('listening') && ok()));

  const a = new Client();
  const b = new Client();
  await Promise.all([a.open(), b.open()]);

  a.send({ t: 'create', size: 4, turnSeconds: 0, color: 'pembe' });
  const joined = await a.next('joined');
  b.send({ t: 'join', code: joined.code, color: 'mavi' });
  assert.equal((await b.next('joined')).seat, 1);
  assert.equal((await a.next('game')).moves.length, 0);

  const seen = b.msgs.length;
  a.send({ t: 'move', move: { kind: 'h', r: 0, c: 0 } });
  assert.equal((await b.next('game', seen)).moves.length, 1);

  // Junk is rejected and the connection survives it.
  const beforeJunk = b.msgs.length;
  b.send({ t: 'move', move: 'nope' });
  assert.equal((await b.next('error', beforeJunk)).reason, 'bad_message');

  // Drop a's connection, then come back with the token on a new one.
  const beforeDrop = b.msgs.length;
  a.ws.close();
  assert.equal((await b.next('room', beforeDrop)).seats[0]?.connected, false);
  const a2 = new Client();
  await a2.open();
  a2.send({ t: 'resume', code: joined.code, token: joined.token });
  assert.equal((await a2.next('joined')).seat, 0);
  assert.equal((await a2.next('game')).moves.length, 1);

  // Flooding gets the connection closed.
  const spam = new Client();
  await spam.open();
  const closed = new Promise<void>((ok) => (spam.ws.onclose = () => ok()));
  for (let i = 0; i < 60; i++) spam.send({ t: 'cancelQuick' });
  await closed;

  console.log('server.test.ts: all tests passed');
}

main()
  .then(() => (child.kill(), process.exit(0)))
  .catch((e) => {
    console.error(e);
    child.kill();
    process.exit(1);
  });
