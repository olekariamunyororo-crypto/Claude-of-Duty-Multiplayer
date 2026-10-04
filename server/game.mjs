import { boot } from './boot.mjs';
const SPAWN_R = Number(process.env.SPAWN_RANGE) || 40;
const MAX_HP = 100, RADIUS = 0.4, HEIGHT = 1.8, EYE = 1.6;
const SPEED_LIMIT = 14, FIRE_GAP = 60, DMG = 25, RESPAWN_MS = 3000;
const fin = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);

function rayCylinder(o, d, c) {
  const a = d[0] * d[0] + d[2] * d[2];
  if (a < 1e-9) return null;
  const ox = o[0] - c[0], oz = o[2] - c[2];
  const b = 2 * (ox * d[0] + oz * d[2]);
  const k = ox * ox + oz * oz - RADIUS * RADIUS;
  const disc = b * b - 4 * a * k;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  let t = (-b - s) / (2 * a);
  if (t < 0) { if ((-b + s) / (2 * a) < 0) return null; t = 0; }
  const y = o[1] + t * d[1];
  return y >= c[1] && y <= c[1] + HEIGHT ? t : null;
}

export class Game {
  constructor(seed, { dev = false, onKill } = {}) {
    this.seed = seed; this.dev = dev; this.onKill = onKill;
    this.players = new Map(); this.nextId = 0; this.nextDev = 0;
    this.devSpawns = [[0, 0, 0], [3, 0, 0]];
  }
  async start() { this.physics = (await boot(this.seed)).physics; }
  spawn() {
    if (this.dev) return [...this.devSpawns[this.nextDev++ % this.devSpawns.length]];
    for (let i = 0; i < 80; i++) {
      const x = (Math.random() * 2 - 1) * SPAWN_R, z = (Math.random() * 2 - 1) * SPAWN_R;
      const r = this.physics.raycast(x, 2, z, 0, -1, 0, 5);
      if (r.hit && r.distance > 1.9 && r.distance < 2.2) return [x, 2 - r.distance, z];
    }
    return [0, 0, 0];
  }
  send(p, m) { if (p.ws.readyState === 1) p.ws.send(JSON.stringify(m)); }
  all(m) { const s = JSON.stringify(m); for (const p of this.players.values()) if (p.ws.readyState === 1) p.ws.send(s); }
  add(ws, u) {
    const id = ++this.nextId;
    const pl = { id, ws, sub: u.sub, name: u.name, p: this.spawn(), yaw: 0, pitch: 0, hp: MAX_HP,
      alive: true, lastIn: performance.now(), lastFire: 0, kills: 0, deaths: 0, respawnAt: 0 };
    this.players.set(id, pl);
    this.send(pl, { t: 'welcome', id, name: pl.name, seed: this.seed, p: pl.p });
    return pl;
  }
  remove(pl) { this.players.delete(pl.id); }
  onInput(pl, m) {
    if (!pl.alive || !fin(m.p)) return;
    const now = performance.now();
    const dt = Math.min(Math.max((now - pl.lastIn) / 1000, 0.02), 1);
    pl.lastIn = now;
    const far = Math.hypot(m.p[0] - pl.p[0], m.p[2] - pl.p[2]) > SPEED_LIMIT * dt;
    if (far || Math.abs(m.p[1] - pl.p[1]) > 30 * dt) { this.send(pl, { t: 'fix', p: pl.p }); return; }
    pl.p = m.p;
    if (Number.isFinite(m.yaw)) pl.yaw = m.yaw;
    if (Number.isFinite(m.pitch)) pl.pitch = m.pitch;
  }
  onFire(pl, m) {
    if (!pl.alive || !fin(m.o) || !fin(m.d)) return;
    const now = performance.now();
    if (now - pl.lastFire < FIRE_GAP) return;
    pl.lastFire = now;
    const len = Math.hypot(...m.d);
    if (len < 1e-6) return;
    const d = m.d.map((v) => v / len), o = m.o;
    if (Math.hypot(o[0] - pl.p[0], o[1] - (pl.p[1] + EYE), o[2] - pl.p[2]) > 3) return;
    const w = this.physics.raycast(o[0], o[1], o[2], d[0], d[1], d[2], 300);
    const maxT = w.hit ? w.distance : 300;
    let best = null;
    for (const t of this.players.values()) {
      if (t === pl || !t.alive) continue;
      const h = rayCylinder(o, d, t.p);
      if (h !== null && h < maxT && (!best || h < best.t)) best = { t: h, target: t };
    }
    if (!best) return;
    const head = o[1] + best.t * d[1] > best.target.p[1] + 1.45;
    this.damage(pl, best.target, head ? DMG * 2 : DMG, head);
  }
  damage(from, to, amount, head) {
    to.hp = Math.max(0, to.hp - amount);
    this.send(from, { t: 'hit', victim: to.id, amount, head });
    this.send(to, { t: 'dmg', from: from.id, amount, hp: to.hp });
    if (to.hp > 0) return;
    to.alive = false; to.deaths++; from.kills++;
    to.respawnAt = performance.now() + RESPAWN_MS;
    this.all({ t: 'kill', killer: from.id, victim: to.id, head });
    this.onKill?.(from, to);
  }
  tick() {
    const now = performance.now();
    for (const p of this.players.values()) {
      if (!p.alive && now >= p.respawnAt) {
        p.alive = true; p.hp = MAX_HP; p.p = this.spawn(); p.lastIn = now;
        this.send(p, { t: 'respawn', p: p.p });
      }
    }
    this.all({ t: 'snap', players: [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, p: p.p, yaw: p.yaw, pitch: p.pitch, hp: p.hp, alive: p.alive, k: p.kills, d: p.deaths })) });
  }
}
