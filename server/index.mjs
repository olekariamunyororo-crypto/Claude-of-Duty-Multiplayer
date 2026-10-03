import http from 'node:http';
import { WebSocketServer } from 'ws';
import { MongoClient } from 'mongodb';
import { Game } from './game.mjs';
import { verify } from './auth.mjs';

const PORT = process.env.PORT || 8080;
const DEV = process.env.DEV_AUTH === '1';
const ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

let col = null;
if (process.env.MONGO_URL) {
  const mc = await new MongoClient(process.env.MONGO_URL).connect();
  col = mc.db(process.env.MONGO_DB || 'cod2').collection('players');
  console.log('[db] connected');
}
const bump = (id, f) => col?.updateOne({ _id: id }, { $inc: { [f]: 1 } }).catch(console.error);

const seed = Number(process.env.SEED) || (Math.random() * 2 ** 32) >>> 0;
const game = new Game(seed, { dev: DEV, onKill: (k, v) => { bump(k.sub, 'kills'); bump(v.sub, 'deaths'); } });
await game.start();
console.log('[game] seed', seed, DEV ? '(DEV AUTH ON)' : '');

const server = http.createServer((req, res) => res.end('ok'));
const wss = new WebSocketServer({ server, maxPayload: 4096,
  verifyClient: ({ origin }) => !ORIGINS.length || ORIGINS.includes(origin) });

wss.on('connection', (ws) => {
  let pl = null, authing = false;
  const timer = setTimeout(() => ws.close(4001, 'auth timeout'), 10000);
  ws.on('message', async (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!pl) {
      if (authing || m.t !== 'auth') return;
      authing = true;
      try {
        const u = await verify(m.token);
        clearTimeout(timer);
        for (const o of game.players.values()) if (o.sub === u.sub) o.ws.close(4002, 'signed in elsewhere');
        pl = game.add(ws, u);
        if (u.cred) ws.send(JSON.stringify({ t: 'cred', cred: u.cred }));
        col?.updateOne({ _id: u.sub }, { $set: { name: u.name, lastSeen: new Date() },
          $setOnInsert: { kills: 0, deaths: 0 } }, { upsert: true }).catch(console.error);
      } catch (e) { ws.close(4003, 'bad token'); }
      return;
    }
    if (m.t === 'in') game.onInput(pl, m);
    else if (m.t === 'fire') game.onFire(pl, m);
  });
  ws.on('close', () => { clearTimeout(timer); if (pl) game.remove(pl); });
});

setInterval(() => game.tick(), 50);
server.listen(PORT, () => console.log('[server] listening on', PORT));
