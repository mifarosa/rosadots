// WebSocket front door of the Rosadots online server. All game logic is in
// rooms.ts; this file only moves bytes, keeps connections alive and limits abuse.

import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { Lobby } from './rooms';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '127.0.0.1'; // Caddy (TLS) sits in front of this
const MAX_MESSAGE_BYTES = 1024;
const HEARTBEAT_MS = 25_000; // dead phones are noticed within two beats
const MAX_MSGS_PER_SECOND = 20;

const sockets = new Map<string, WebSocket>();

const lobby = new Lobby({
  send: (conn, msg) => {
    const ws = sockets.get(conn);
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  },
  close: (conn) => sockets.get(conn)?.close(4000, 'replaced'),
  scheduler: {
    now: () => Date.now(),
    after: (ms, fn) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
  },
});

const wss = new WebSocketServer({ host: HOST, port: PORT, maxPayload: MAX_MESSAGE_BYTES });

wss.on('connection', (ws) => {
  const id = randomUUID();
  sockets.set(id, ws);
  let alive = true;
  let windowStart = Date.now();
  let count = 0;

  ws.on('pong', () => (alive = true));
  ws.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart > 1000) [windowStart, count] = [now, 0];
    if (++count > MAX_MSGS_PER_SECOND) {
      ws.send(JSON.stringify({ t: 'error', reason: 'rate_limited' }));
      return ws.close(1008, 'rate limited');
    }
    lobby.receive(id, data.toString());
  });
  ws.on('close', () => {
    sockets.delete(id);
    lobby.disconnect(id);
  });
  ws.on('error', () => ws.terminate());

  const beat = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, HEARTBEAT_MS);
  ws.on('close', () => clearInterval(beat));
});

const sweeper = setInterval(() => lobby.sweep(), 60_000);

const log = setInterval(() => console.log('stats', JSON.stringify(lobby.stats())), 10 * 60_000);

wss.on('listening', () => console.log(`rosadots server listening on ${HOST}:${PORT}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(sweeper);
    clearInterval(log);
    wss.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
