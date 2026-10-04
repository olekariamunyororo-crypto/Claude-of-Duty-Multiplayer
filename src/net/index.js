import * as THREE from 'three';

const SEND_MS = 50;
const COLORS = [0xe0503a, 0x3a8fe0, 0x58c46a, 0xe0b43a, 0xb05ae0, 0x3ae0d0];

function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(text, 128, 32);
  g.fillStyle = '#fff'; g.fillText(text, 128, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1); s.position.y = 1.25;
  return s;
}

export class NetSystem {
  static id = 'net';
  static deps = [];
  constructor({ ws, welcome, queue }) {
    this.ws = ws; this.me = welcome; this.queue = queue;
    this.remote = new Map(); this.names = new Map(); this._acc = 0; this._off = []; this._warned = new Set();
  }

  async init(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group(); this.group.name = 'net-players';
    ctx.scene.add(this.group);
    this.geo = new THREE.CapsuleGeometry(0.32, 1.1, 4, 10);
    for (const m of this.queue.splice(0)) this._onMsg(m);
    this.ws.onmessage = (e) => { try { this._onMsg(JSON.parse(e.data)); } catch (err) { console.warn('[net] bad msg', err); } };
    this.ws.onclose = (e) => this._closed(e);
    this._off.push(ctx.events.on('weapon:fire', (e) => this._sendFire(e)));
    console.info('[net] joined as', this.me.name, 'id', this.me.id, 'seed', this.me.seed);
    this._tp(this.me.p);
    this.hud = document.createElement('div');
    this.hud.style.cssText = 'position:fixed;right:12px;top:112px;z-index:9000;pointer-events:none;font:600 13px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000';
    document.body.appendChild(this.hud);
  }

  _onMsg(m) {
    switch (m.t) {
      case 'snap': return this._snap(m.players);
      case 'fix': return this._tp(m.p);
      case 'respawn': return this._respawn(m);
      case 'dmg': return this._hurt(m);
      case 'hit': return this._hitMarker(m);
      case 'kill': return this._kill(m);
    }
  }

  _snap(list) {
    const seen = new Set();
    for (const s of list) {
      this.names.set(s.id, s.name);
      if (s.id === this.me.id) continue;
      seen.add(s.id);
      const r = this.remote.get(s.id) || this._spawn(s);
      r.tgt.set(s.p[0], s.p[1], s.p[2]);
      r.mesh.visible = s.alive;
    }
    for (const [id, r] of this.remote) {
      if (seen.has(id)) continue;
      this.group.remove(r.mesh);
      r.mesh.material.dispose(); r.tag.material.map.dispose(); r.tag.material.dispose();
      this.remote.delete(id);
    }
  }

  _spawn(s) {
    const mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color: COLORS[s.id % COLORS.length] }));
    const tag = nameTag(s.name); mesh.add(tag);
    mesh.position.set(s.p[0], s.p[1] + 0.9, s.p[2]);
    this.group.add(mesh);
    const r = { mesh, tag, cur: new THREE.Vector3(s.p[0], s.p[1], s.p[2]), tgt: new THREE.Vector3() };
    this.remote.set(s.id, r);
    return r;
  }

  _player() { return this.ctx.peek('player'); }

  _tp(p) {
    const pl = this._player();
    if (!pl || !Array.isArray(p)) return;
    try { pl.movement.teleport(p[0], p[1], p[2]); } catch (e) { console.warn('[net] teleport failed', e); }
  }

  _hurt(m) {
    const pl = this._player();
    if (!pl || pl.health.dead) return;
    const src = this.remote.get(m.from);
    const from = src ? src.mesh.position : null;
    pl.applyDamage(m.amount, from, { type: 'bullet' });
    if (m.hp > 0) { pl.health.value = m.hp; pl.health._emitState?.(true); }
    else if (!pl.health.dead) pl.applyDamage(1e4, from, { type: 'bullet' });
  }

  _respawn(m) {
    const pl = this._player();
    if (!pl) return;
    this._tp(m.p);
    pl.health.reset(true);
  }

  _hitMarker(m) {
    const d = document.createElement('div');
    d.textContent = '\u2715';
    d.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);font:bold 30px system-ui;pointer-events:none;z-index:9000;color:' + (m.head ? '#ff4040' : '#fff');
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 150);
  }

  _kill(m) {
    const n = (id) => (id === this.me.id ? 'you' : this.names.get(id) || 'player');
    this._toast(n(m.killer) + (m.head ? ' headshot ' : ' killed ') + n(m.victim));
  }

  _toast(text) {
    let box = this._toastBox;
    if (!box) {
      box = this._toastBox = document.createElement('div');
      box.style.cssText = 'position:fixed;left:50%;top:96px;transform:translateX(-50%);z-index:9000;pointer-events:none;font:600 15px system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;text-align:center';
      document.body.appendChild(box);
    }
    box.textContent = text;
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { box.textContent = ''; }, 3000);
  }

  _sendFire(e) {
    if (e.actor || this.ws.readyState !== 1 || !e.origin || !e.dir) return;
    const o = e.origin, d = e.dir;
    this.ws.send(JSON.stringify({ t: 'fire', o: [o.x, o.y, o.z], d: [d.x, d.y, d.z] }));
  }

  update(dt, ctx) {
    const pl = ctx.peek('player');
    if (pl && this.ws.readyState === 1 && (this._acc += dt * 1000) >= SEND_MS) {
      this._acc = 0;
      const p = pl.position;
      this.ws.send(JSON.stringify({ t: 'in', p: [p.x, p.y, p.z], yaw: pl.yaw, pitch: pl.pitch }));
    }
    this._hudT = (this._hudT || 0) + dt;
    if (this._hudT > 0.25) {
      this._hudT = 0;
      let near = Infinity;
      if (pl) for (const r of this.remote.values()) near = Math.min(near, pl.position.distanceTo(r.cur));
      this.hud.textContent = 'online ' + (this.remote.size + 1) + (isFinite(near) ? ' \u00b7 nearest ' + Math.round(near) + ' m' : '');
    }
    const k = 1 - Math.exp(-dt * 14);
    for (const r of this.remote.values()) {
      r.cur.lerp(r.tgt, k);
      r.mesh.position.set(r.cur.x, r.cur.y + 0.9, r.cur.z);
    }
  }

  _closed(e) {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:14px;background:rgba(0,0,0,.8);color:#fff;font:18px system-ui,sans-serif';
    d.innerHTML = '<div>' + (e.code === 4002 ? 'Signed in on another device' : 'Disconnected from server') +
      '</div><button style="padding:12px 24px;font-size:16px;border-radius:8px;border:0">Reconnect</button>';
    d.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(d);
  }

  dispose() {
    for (const off of this._off) off?.();
    try { this.ws.close(); } catch {}
    this.group?.removeFromParent();
  }
}
