import WebSocket from 'ws';
const URL = process.env.URL || 'ws://localhost:8080';
const client = (name) => new Promise((res) => {
  const ws = new WebSocket(URL), c = { ws, msgs: [] };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'auth', token: 'dev:' + name })));
  ws.on('message', (d) => { const m = JSON.parse(d); c.msgs.push(m); if (m.t === 'welcome') { c.me = m; res(c); } });
});
const a = await client('alice'), b = await client('bob');
const eye = (p) => [p[0], p[1] + 1.6, p[2]];
const o = eye(b.me.p), t = eye(a.me.p);
b.ws.send(JSON.stringify({ t: 'fire', o, d: t.map((v, i) => v - o[i]) }));
setTimeout(() => {
  console.log('alice:', JSON.stringify(a.msgs.filter((m) => m.t === 'dmg' || m.t === 'kill')));
  console.log('bob:', JSON.stringify(b.msgs.filter((m) => m.t === 'hit' || m.t === 'kill')));
  process.exit(0);
}, 600);
