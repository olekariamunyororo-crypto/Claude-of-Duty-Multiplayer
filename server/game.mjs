import { boot } from './boot.mjs';
import { HEALTH } from '../src/player/tuning.js';

const SPAWN_R = Number(process.env.SPAWN_RANGE) || 40;
const MAX_HP = 100, RADIUS = 0.4, HEIGHT = 1.8, EYE = 1.6;
const FIRE_GAP = 60, DMG = 25, RESPAWN_MS = 3000;
// --- movement validation -------------------------------------------------
// Distance is paid from a "bank" that fills with REAL elapsed time only, so
// flooding `in` messages can no longer inflate the speed cap.
const SPEED_LIMIT = 14, VSPEED = 30, BANK_S = 1, SLACK = 0.75;
const WALLCHECK = process.env.WALLCHECK !== '0';
// --- health regen: mirrors the client (src/player/tuning.js HEALTH) -------
const REGEN_DELAY = HEALTH.regenDelay * 1000, REGEN_RAMP = HEALTH.regenRamp * 1000, REGEN_RATE = HEALTH.regenRate;
const SPAWN_PROTECT_MS = Number(process.env.SPAWN_PROTECT_MS ?? 2000);
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
    this.map = 'gulabi';
  }
  async start() {
    const b = await boot(this.seed);
    this.physics = b.physics; this.world = b.world; this.map = b.map;
  }

  /** Spawn at the map's own spawn point that is farthest from every living player. */
  spawn(exclude) {
    if (this.dev) return [...this.devSpawns[this.nextDev++ % this.devSpawns.length]];
    const pts = this.world?.spawnPoints;
    if (pts?.length) {
      const others = [...this.players.values()].filter((p) => p !== exclude && p.alive);
      const scored = pts.map((s) => {
        let d = 1e9;
        for (const o of others) d = Math.min(d, Math.hypot(o.p[0] - s.position.x, o.p[2] - s.position.z));
        return { s, d };
      }).sort((a, b) => b.d - a.d);
      const pick = scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
      return [pick.position.x, pick.position.y, pick.position.z];
    }
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
    const id = ++this.nextId, now = performance.now();
    const pl = { id, ws, sub: u.sub, name: u.name, p: null, yaw: 0, pitch: 0, hp: MAX_HP,
      alive: true, lastIn: now, lastFire: 0, kills: 0, deaths: 0, respawnAt: 0,
      lastDmg: -1e9, protectUntil: now + SPAWN_PROTECT_MS, bankH: SPEED_LIMIT * 0.5, bankV: VSPEED * 0.5 };
    pl.p = this.spawn(pl);
    this.players.set(id, pl);
    this.send(pl, { t: 'welcome', id, name: pl.name, seed: this.seed, map: this.map, p: pl.p });
    return pl;
  }
  remove(pl) { this.players.delete(pl.id); }

  /** True when the straight move a->b passes through level geometry (chest height). */
  blocked(a, b, dh) {
    if (!WALLCHECK || dh < 0.15) return false;
    const dx = (b[0] - a[0]) / dh, dz = (b[2] - a[2]) / dh;
    const r = this.physics.raycast(a[0], a[1] + 1.0, a[2], dx, 0, dz, dh - 0.1);
    return !!r.hit;
  }
  outOfBounds(p) {
    const bb = this.world?.bounds;
    if (!bb) return false;
    const m = 2;
    return p[0] < bb.min.x - m || p[0] > bb.max.x + m || p[2] < bb.min.z - m || p[2] > bb.max.z + m ||
      p[1] < bb.min.y - 5 || p[1] > bb.max.y + m;
  }

  onInput(pl, m) {
    if (!pl.alive || !fin(m.p)) return;
    const now = performance.now();
    const dt = Math.min((now - pl.lastIn) / 1000, BANK_S);   // real time only: no lower clamp
    pl.lastIn = now;
    pl.bankH = Math.min(pl.bankH + SPEED_LIMIT * dt, SPEED_LIMIT * BANK_S);
    pl.bankV = Math.min(pl.bankV + VSPEED * dt, VSPEED * BANK_S);
    const dh = Math.hypot(m.p[0] - pl.p[0], m.p[2] - pl.p[2]);
    const dv = Math.abs(m.p[1] - pl.p[1]);
    if (dh > pl.bankH + SLACK || dv > pl.bankV + SLACK || this.outOfBounds(m.p) || this.blocked(pl.p, m.p, dh)) {
      this.send(pl, { t: 'fix', p: pl.p });
      return;
    }
    pl.bankH = Math.max(0, pl.bankH - dh);
    pl.bankV = Math.max(0, pl.bankV - dv);
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
    const eye = [pl.p[0], pl.p[1] + EYE, pl.p[2]];
    const gap = Math.hypot(o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]);
    if (gap > 3) return;
    // The muzzle must be reachable from the eye: no shooting from the far side of a wall.
    if (gap > 0.2) {
      const c = this.physics.raycast(eye[0], eye[1], eye[2], (o[0] - eye[0]) / gap, (o[1] - eye[1]) / gap, (o[2] - eye[2]) / gap, gap - 0.05);
      if (c.hit) return;
    }
    for (const t of this.players.values()) if (t !== pl) this.send(t, { t: 'shot', id: pl.id, o, d });
    const w = this.physics.raycast(o[0], o[1], o[2], d[0], d[1], d[2], 300);
    const maxT = w.hit ? w.distance : 300;
    let best = null;
    for (const t of this.players.values()) {
      if (t === pl || !t.alive) continue;
      const h = rayCylinder(o, d, t.p);
      if (h !== null && h < maxT && (!best || h < best.t)) best = { t: h, target: t };
    }
    if (!best) return;
    if (now < best.target.protectUntil) return;               // spawn protection
    const head = o[1] + best.t * d[1] > best.target.p[1] + 1.45;
    this.damage(pl, best.target, head ? DMG * 2 : DMG, head);
  }

  damage(from, to, amount, head) {
    to.hp = Math.max(0, to.hp - amount);
    to.lastDmg = performance.now();
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
    const tdt = Math.min(0.25, (now - (this.lastTick ?? now - 50)) / 1000); this.lastTick = now;
    for (const p of this.players.values()) {
      if (!p.alive) {
        if (now >= p.respawnAt) {
          p.alive = true; p.hp = MAX_HP; p.p = this.spawn(p); p.lastIn = now; p.lastDmg = -1e9;
          p.bankH = SPEED_LIMIT * 0.5; p.bankV = VSPEED * 0.5; p.protectUntil = now + SPAWN_PROTECT_MS;
          this.send(p, { t: 'respawn', p: p.p });
        }
        continue;
      }
      // Same curve as the client's Health.update(): delay, ramp-in, then regenRate/s.
      const since = now - p.lastDmg;
      if (p.hp < MAX_HP && since > REGEN_DELAY) {
        const ramp = Math.min(1, (since - REGEN_DELAY) / REGEN_RAMP);
        p.hp = Math.min(MAX_HP, p.hp + REGEN_RATE * ramp * tdt);
      }
    }
    this.all({ t: 'snap', players: [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, av: p.av, p: p.p, yaw: p.yaw, pitch: p.pitch, hp: p.hp, alive: p.alive, k: p.kills, d: p.deaths })) });
  }
}
