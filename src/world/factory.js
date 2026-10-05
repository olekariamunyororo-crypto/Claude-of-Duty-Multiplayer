/**
 * WORLD — procedural factory combat arena (expanded).
 *
 * Outer perimeter fully sealed (no exits). Inner hall has doorways so the
 * yard can reach the interior — players are never trapped in a dead end.
 */

import * as THREE from 'three';
import { chamferBox, wallPanel, trs, weatherProp, fillMasks } from './util.js';
import { burntCar } from './props.js';

const HALL_W = 50;
const HALL_D = 40;
const WALL_H = 8;
const WALL_T = 0.45;
const CATWALK_Y = 3.55;
const CATWALK_W = 2.4;
const YARD = 12;

export const FACTORY_SPAWNS = [
  [0, 0, 0, 'centre'],
  [10, -8, Math.PI, 'east floor'],
  [-10, 8, 0, 'west floor'],
  [8, 12, -Math.PI / 2, 'ne floor'],
  [-8, -12, Math.PI / 2, 'sw floor'],
  [14, 4, Math.PI, 'east mid'],
  [-14, -4, 0, 'west mid'],
  [0, -14, 0, 'south floor'],
  [0, 14, Math.PI, 'north floor'],
  [6, -6, Math.PI * 0.75, 'se mid'],
  [-6, 6, -Math.PI * 0.25, 'nw mid'],
  [0, -22, 0, 'south approach'],
  [0, 22, Math.PI, 'north approach'],
  [22, 0, -Math.PI / 2, 'east approach'],
];

const _m = new THREE.Matrix4();

export function buildFactory(A, rng) {
  const fans = [];
  _registerExtraProtos(A, rng);
  _floor(A, rng);
  _perimeter(A, rng);
  _walls(A, rng);
  _rooms(A, rng);
  _pillars(A, rng);
  _catwalks(A, rng);
  _beams(A, rng);
  _machinery(A, rng);
  _crates(A, rng);
  _pipes(A, rng);
  _ceilingFans(A, rng, fans);
  _yardProps(A, rng);
  _lightAnchors(A);
  const extent = HALL_W / 2 + YARD + 2;
  return {
    spawns: FACTORY_SPAWNS,
    bounds: { minX: -extent, maxX: extent, minZ: -HALL_D / 2 - YARD - 2, maxZ: HALL_D / 2 + YARD + 2 },
    fans,
  };
}

export function factoryGroundY(_x, _z) { return 0; }

export function factoryIsOpen(x, z, margin = 0.4) {
  const e = HALL_W / 2 + YARD - margin;
  const d = HALL_D / 2 + YARD - margin;
  return Math.abs(x) < e && Math.abs(z) < d;
}

function _registerExtraProtos(A, rng) {
  if (!A.has('burnt_car')) {
    A.proto('burnt_car', { geo: burntCar(rng), key: 'metal_rust', tilt: 0.03, sink: 0.04, skirt: 1.1, chunk: false });
  }
  if (!A.has('ship_container')) {
    A.proto('ship_container', { geo: _shippingContainer(), key: 'metal_blue', tilt: 0, sink: 0, skirt: 1.4, chunk: false });
  }
  if (!A.has('ship_container_rust')) {
    A.proto('ship_container_rust', { geo: _shippingContainer(), key: 'metal_rust', tilt: 0.01, sink: 0.02, skirt: 1.4, chunk: false });
  }
  if (!A.has('fac_bike')) {
    A.proto('fac_bike', { geo: _bike(), key: 'metal_dark', tilt: 0.12, sink: 0.01, skirt: 0.35 });
  }
}

function _shippingContainer() {
  const shell = chamferBox(2.44, 2.59, 6.05, 0.04);
  weatherProp(shell, { base: 0.35, wear: 0.55, height: 2.59 });
  shell.translate(0, 2.59 / 2, 0);
  return shell;
}

function _bike() {
  const frame = chamferBox(0.08, 0.55, 1.55, 0.01);
  fillMasks(frame, 0.2, 0.25, 0.15);
  frame.translate(0, 0.35, 0);
  return frame;
}

function _floor(A, rng) {
  const hw = HALL_W / 2, hd = HALL_D / 2;
  const slab = chamferBox(HALL_W + 2, 0.28, HALL_D + 2, 0.01);
  weatherProp(slab, { base: 0.35, wear: 0.5, grime: 0.4, height: 0.3 });
  A.addOnce('floor_concrete', slab, trs(_m, 0, -0.14, 0));
  A.box('concrete', 0, -0.14, 0, HALL_W + 2, 0.28, HALL_D + 2);
  const yard = chamferBox(HALL_W + YARD * 2, 0.2, HALL_D + YARD * 2, 0.01);
  weatherProp(yard, { base: 0.25, wear: 0.35, grime: 0.3, height: 0.2 });
  A.addOnce('concrete_dark', yard, trs(_m, 0, -0.2, 0));
  A.box('concrete', 0, -0.2, 0, HALL_W + YARD * 2, 0.2, HALL_D + YARD * 2);
  for (const z of [-hd - 3, hd + 3]) {
    const sand = chamferBox(HALL_W + 8, 0.18, 8, 0.01);
    weatherProp(sand, { base: 0.2, wear: 0.3, grime: 0.2, height: 0.2 });
    A.addOnce('sand', sand, trs(_m, 0, -0.08, z));
    A.box('sand', 0, -0.08, z, HALL_W + 8, 0.18, 8);
  }
  for (let i = 0; i < 8; i++) {
    const x = rng.range(-hw + 4, hw - 4), z = rng.range(-hd + 4, hd - 4);
    const g = chamferBox(rng.range(2.5, 4.5), 0.04, rng.range(2.5, 4.5), 0.005);
    fillMasks(g, 0.15, 0.35, 0.2);
    A.addOnce('steel', g, trs(_m, x, 0.02, z));
  }
}

function _perimeter(A, rng) {
  const e = HALL_W / 2 + YARD, d = HALL_D / 2 + YARD, h = 3.6, t = 0.4;
  for (const [z, ry] of [[d, 0], [-d, Math.PI]]) {
    const panel = wallPanel(e * 2 + t, h, t, [], { bevel: 0.02, rng });
    A.addOnce('concrete_dark', panel, trs(_m, 0, 0, z, ry));
    A.box('concrete', 0, h / 2, z, e * 2 + t, h, t);
  }
  for (const side of [-1, 1]) {
    const x = side * e;
    const panel = wallPanel(d * 2 + t, h, t, [], { bevel: 0.02, rng });
    A.addOnce('concrete_dark', panel, trs(_m, x, 0, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2));
    A.box('concrete', x, h / 2, 0, t, h, d * 2 + t);
  }
  for (const x of [-e, e]) {
    for (const z of [-d, d]) {
      const post = chamferBox(0.7, h + 1.2, 0.7, 0.04);
      weatherProp(post, { base: 0.3, wear: 0.55, height: h });
      A.addOnce('concrete', post, trs(_m, x, (h + 1.2) / 2, z));
      A.box('concrete', x, (h + 1.2) / 2, z, 0.7, h + 1.2, 0.7);
    }
  }
  for (const z of [-d, d]) {
    const rail = chamferBox(e * 2, 0.08, 0.08, 0.005);
    fillMasks(rail, 0.2, 0.3, 0.15);
    A.addOnce('steel', rail, trs(_m, 0, h + 0.2, z));
  }
  for (const x of [-e, e]) {
    const rail = chamferBox(0.08, 0.08, d * 2, 0.005);
    fillMasks(rail, 0.2, 0.3, 0.15);
    A.addOnce('steel', rail, trs(_m, x, h + 0.2, 0));
  }
}

function _walls(A, rng) {
  // Hall shell with 3.2m doorways on each side — yard can reach interior.
  const hw = HALL_W / 2, hd = HALL_D / 2, t = WALL_T, h = WALL_H;
  const doorW = 3.2, doorH = 2.6;

  for (const side of [-1, 1]) {
    const x = side * (hw + t / 2);
    const half = HALL_D / 2;
    for (const s of [{ z0: -half, z1: -doorW / 2 }, { z0: doorW / 2, z1: half }]) {
      const len = s.z1 - s.z0;
      if (len < 0.1) continue;
      const cz = (s.z0 + s.z1) / 2;
      const panel = wallPanel(len, h, t, [], { bevel: 0.03, rng });
      A.addOnce('concrete_dark', panel, trs(_m, x, 0, cz, side > 0 ? -Math.PI / 2 : Math.PI / 2));
      A.box('concrete', x, h / 2, cz, t, h, len);
    }
    const headerH = h - doorH;
    if (headerH > 0.2) {
      const header = chamferBox(t, headerH, doorW + 0.4, 0.02);
      weatherProp(header, { base: 0.3, wear: 0.5, height: headerH });
      A.addOnce('concrete', header, trs(_m, x, doorH + headerH / 2, 0));
      A.box('concrete', x, doorH + headerH / 2, 0, t, headerH, doorW + 0.4);
    }
    for (const sz of [-1, 1]) {
      const post = chamferBox(t + 0.1, doorH, 0.25, 0.02);
      weatherProp(post, { base: 0.25, wear: 0.6, height: doorH });
      A.addOnce('concrete', post, trs(_m, x, doorH / 2, sz * (doorW / 2 + 0.1)));
      A.box('concrete', x, doorH / 2, sz * (doorW / 2 + 0.1), t + 0.1, doorH, 0.25);
    }
  }

  for (const side of [-1, 1]) {
    const z = side * (hd + t / 2);
    const half = HALL_W / 2;
    for (const s of [{ x0: -half, x1: -doorW / 2 }, { x0: doorW / 2, x1: half }]) {
      const len = s.x1 - s.x0;
      if (len < 0.1) continue;
      const cx = (s.x0 + s.x1) / 2;
      const panel = wallPanel(len, h, t, [], { bevel: 0.03, rng });
      A.addOnce('concrete_dark', panel, trs(_m, cx, 0, z, side > 0 ? Math.PI : 0));
      A.box('concrete', cx, h / 2, z, len, h, t);
    }
    const headerH = h - doorH;
    if (headerH > 0.2) {
      const header = chamferBox(doorW + 0.4, headerH, t, 0.02);
      weatherProp(header, { base: 0.3, wear: 0.5, height: headerH });
      A.addOnce('concrete', header, trs(_m, 0, doorH + headerH / 2, z));
      A.box('concrete', 0, doorH + headerH / 2, z, doorW + 0.4, headerH, t);
    }
    for (const sx of [-1, 1]) {
      const post = chamferBox(0.25, doorH, t + 0.1, 0.02);
      weatherProp(post, { base: 0.25, wear: 0.6, height: doorH });
      A.addOnce('concrete', post, trs(_m, sx * (doorW / 2 + 0.1), doorH / 2, z));
      A.box('concrete', sx * (doorW / 2 + 0.1), doorH / 2, z, 0.25, doorH, t + 0.1);
    }
  }

  for (const x of [-hw, hw]) {
    for (const z of [-hd, hd]) {
      const col = chamferBox(1.1, h + 0.5, 1.1, 0.04);
      weatherProp(col, { base: 0.4, wear: 0.6, height: h });
      A.addOnce('concrete', col, trs(_m, x, (h + 0.5) / 2 - 0.1, z));
      A.box('concrete', x, (h + 0.5) / 2 - 0.1, z, 1.1, h + 0.5, 1.1);
    }
  }
}

function _rooms(A, rng) {
  const hw = HALL_W / 2;
  const rooms = [
    { x: -hw + 3.5, z: -14, w: 6, d: 5, ry: 0 },
    { x: -hw + 3.5, z: 0, w: 6, d: 5, ry: 0 },
    { x: -hw + 3.5, z: 14, w: 6, d: 5, ry: 0 },
    { x: hw - 3.5, z: -14, w: 6, d: 5, ry: Math.PI },
    { x: hw - 3.5, z: 0, w: 6, d: 5, ry: Math.PI },
    { x: hw - 3.5, z: 14, w: 6, d: 5, ry: Math.PI },
  ];
  for (const r of rooms) _buildRoom(A, rng, r);
}

function _buildRoom(A, rng, r) {
  const h = 3.2, t = 0.25;
  const openToward = r.x > 0 ? -1 : 1;
  const backX = r.x - openToward * (r.w / 2);
  {
    const panel = wallPanel(r.d, h, t, [{ x: 0, y: 1.6, w: 1.2, h: 1.0 }], { bevel: 0.02, rng });
    A.addOnce('concrete', panel, trs(_m, backX, 0, r.z, openToward > 0 ? Math.PI / 2 : -Math.PI / 2));
    A.box('concrete', backX, h / 2, r.z, t, h, r.d);
  }
  for (const sz of [-1, 1]) {
    const z = r.z + sz * (r.d / 2);
    const panel = wallPanel(r.w, h, t, [], { bevel: 0.02, rng });
    A.addOnce('concrete', panel, trs(_m, r.x, 0, z, sz > 0 ? Math.PI : 0));
    A.box('concrete', r.x, h / 2, z, r.w, h, t);
  }
  const floor = chamferBox(r.w - 0.1, 0.08, r.d - 0.1, 0.005);
  fillMasks(floor, 0.1, 0.2, 0.15);
  A.addOnce('floor_concrete', floor, trs(_m, r.x, 0.04, r.z));
  const inward = openToward, deskX = r.x + inward * 0.5;
  if (A.has('table_small')) { A.put('table_small', deskX, 0, r.z, r.ry + Math.PI / 2); A.box('wood', deskX, 0.36, r.z, 0.9, 0.72, 0.7); }
  if (A.has('chair')) { A.put('chair', deskX + inward * 0.7, 0, r.z - 0.5, r.ry); A.put('chair', deskX + inward * 0.7, 0, r.z + 0.5, r.ry); }
  if (A.has('shelf')) { A.put('shelf', backX + inward * 0.4, 0, r.z - 1.2, r.ry + Math.PI / 2); A.box('wood', backX + inward * 0.4, 0.95, r.z - 1.2, 1.1, 1.9, 0.35); }
  if (A.has('cabinet')) { A.put('cabinet', backX + inward * 0.35, 0, r.z + 1.4, r.ry + Math.PI / 2); A.box('wood', backX + inward * 0.35, 0.57, r.z + 1.4, 0.9, 1.15, 0.44); }
  if (A.has('box_card_a')) {
    for (let i = 0; i < 3; i++) A.put('box_card_a', r.x + rng.range(-1.5, 1.5), 0, r.z + rng.range(-1.5, 1.5), rng.range(0, Math.PI));
  }
  A.interiorLights.push({ x: r.x, y: h - 0.3, z: r.z });
}

function _pillars(A, rng) {
  for (const [cx, cz] of [[-8, -6], [8, -6], [-8, 6], [8, 6], [0, -14], [0, 12]]) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const ox = rng.range(-1.8, 1.8), oz = rng.range(-1.8, 1.8);
      const ph = rng.range(4.5, 7.2), s = rng.range(0.55, 0.95);
      const col = chamferBox(s, ph, s, 0.03);
      weatherProp(col, { base: 0.35, wear: 0.55, height: ph });
      A.addOnce('concrete', col, trs(_m, cx + ox, ph / 2, cz + oz));
      A.box('concrete', cx + ox, ph / 2, cz + oz, s, ph, s);
    }
  }
}

function _catwalks(A, rng) {
  const hw = HALL_W / 2, y = CATWALK_Y, w = CATWALK_W;
  for (const side of [-1, 1]) {
    const x = side * (hw - w / 2 - 0.8);
    const deck = chamferBox(w, 0.12, HALL_D - 6, 0.01);
    fillMasks(deck, 0.2, 0.4, 0.25);
    A.addOnce('steel', deck, trs(_m, x, y, 0));
    A.box('metal', x, y, 0, w, 0.12, HALL_D - 6);
    for (let i = 0; i <= 10; i++) {
      const z = -((HALL_D - 6) / 2) + (i / 10) * (HALL_D - 6);
      const post = chamferBox(0.08, 1.1, 0.08, 0.005);
      fillMasks(post, 0.3, 0.2, 0.15);
      A.addOnce('steel', post, trs(_m, x - side * (w / 2 - 0.1), y + 0.55, z));
    }
    const rail = chamferBox(0.06, 0.06, HALL_D - 6, 0.005);
    fillMasks(rail, 0.25, 0.2, 0.1);
    A.addOnce('steel', rail, trs(_m, x - side * (w / 2 - 0.1), y + 1.05, 0));
    for (let i = 0; i < 6; i++) {
      const z = -((HALL_D - 8) / 2) + (i / 5) * (HALL_D - 8);
      const leg = chamferBox(0.15, y, 0.15, 0.01);
      weatherProp(leg, { base: 0.3, wear: 0.5, height: y });
      A.addOnce('metal_dark', leg, trs(_m, x, y / 2, z));
      A.box('metal', x, y / 2, z, 0.15, y, 0.15);
    }
  }
  for (const z of [-10, 0, 10]) {
    const bridge = chamferBox(HALL_W - 6, 0.12, 1.8, 0.01);
    fillMasks(bridge, 0.2, 0.35, 0.2);
    A.addOnce('steel', bridge, trs(_m, 0, y, z));
    A.box('metal', 0, y, z, HALL_W - 6, 0.12, 1.8);
  }
}

function _beams(A, rng) {
  const hw = HALL_W / 2, hd = HALL_D / 2, y = WALL_H - 0.4;
  for (let i = 0; i < 5; i++) {
    const x = -hw + 4 + (i / 4) * (HALL_W - 8);
    const beam = chamferBox(0.35, 0.5, HALL_D - 2, 0.02);
    weatherProp(beam, { base: 0.2, wear: 0.6, height: 0.5 });
    A.addOnce('metal_dark', beam, trs(_m, x, y, 0));
    A.box('metal', x, y, 0, 0.35, 0.5, HALL_D - 2);
  }
  for (let i = 0; i < 6; i++) {
    const z = -hd + 3 + (i / 5) * (HALL_D - 6);
    const beam = chamferBox(HALL_W - 2, 0.35, 0.35, 0.02);
    weatherProp(beam, { base: 0.2, wear: 0.55, height: 0.35 });
    A.addOnce('metal_dark', beam, trs(_m, 0, y - 0.15, z));
    A.box('metal', 0, y - 0.15, z, HALL_W - 2, 0.35, 0.35);
  }
}

function _machinery(A, rng) {
  for (const b of [
    { x: -14, z: 2, sx: 3.2, sy: 2.4, sz: 2.8 },
    { x: 14, z: -4, sx: 2.8, sy: 2.8, sz: 3.5 },
    { x: -4, z: -16, sx: 4.0, sy: 1.8, sz: 2.2 },
    { x: 5, z: 14, sx: 3.5, sy: 2.2, sz: 2.5 },
    { x: 12, z: 10, sx: 2.0, sy: 3.2, sz: 2.0 },
    { x: -12, z: -10, sx: 2.5, sy: 2.0, sz: 3.0 },
  ]) {
    const body = chamferBox(b.sx, b.sy, b.sz, 0.04);
    weatherProp(body, { base: 0.4, wear: 0.5, height: b.sy });
    A.addOnce('metal_rust', body, trs(_m, b.x, b.sy / 2, b.z));
    A.box('metal', b.x, b.sy / 2, b.z, b.sx, b.sy, b.sz);
  }
  for (let i = 0; i < 8; i++) {
    const x = rng.range(-18, 18), z = rng.range(-16, 16);
    if (Math.hypot(x, z) < 5) continue;
    const w = rng.range(2.0, 4.0), d = rng.range(0.35, 0.55), h = rng.range(1.1, 1.5), ry = rng.range(0, Math.PI);
    const wall = chamferBox(w, h, d, 0.02);
    weatherProp(wall, { base: 0.35, wear: 0.5, height: h });
    A.addOnce('concrete', wall, trs(_m, x, h / 2, z, ry));
    A.box('concrete', x, h / 2, z, w, h, d, ry);
  }
}

function _crates(A, rng) {
  A.jitter = { rng, yaw: 0.15, scale: 0.08 };
  A.skirts = true;
  for (const [sx, sz] of [[-16, -14], [16, 12], [-10, 16], [10, -18], [3, -3], [-15, 8], [18, -8]]) {
    const rows = rng.int(2, 4), cols = rng.int(2, 3);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const id = rng.float() < 0.5 ? 'crate_a' : 'crate_c';
      if (!A.has(id)) continue;
      A.put(id, sx + c * 1.15, 0, sz + r * 1.15, rng.range(0, 0.3), rng.range(0.9, 1.1));
      A.box('wood', sx + c * 1.15, 0.35, sz + r * 1.15, 0.7, 0.7, 0.7);
    }
  }
  for (let i = 0; i < 22; i++) {
    const x = rng.range(-20, 20), z = rng.range(-18, 18);
    if (Math.hypot(x, z) < 4) continue;
    const id = rng.float() < 0.5 ? 'barrel_rust' : 'barrel_blue';
    if (A.has(id)) { A.put(id, x, 0, z, rng.range(0, Math.PI)); A.box('metal', x, 0.45, z, 0.6, 0.9, 0.6); }
  }
  if (A.has('pallet')) for (let i = 0; i < 8; i++) A.put('pallet', rng.range(-18, 18), 0, rng.range(-16, 16), rng.range(0, Math.PI));
  if (A.has('tyre')) for (let i = 0; i < 12; i++) A.put('tyre', rng.range(-20, 20), 0, rng.range(-18, 18), rng.range(0, Math.PI));
  A.jitter = null;
}

function _pipes(A, rng) {
  const hw = HALL_W / 2;
  for (const side of [-1, 1]) {
    const x = side * (hw - 0.9);
    for (const y of [2.2, 5.5]) {
      const pipe = chamferBox(0.28, 0.28, HALL_D - 8, 0.02);
      fillMasks(pipe, 0.15, 0.4, 0.2);
      A.addOnce('metal_rust', pipe, trs(_m, x, y, 0));
    }
  }
}

function _ceilingFans(A, rng, fansOut) {
  for (const [fx, fz] of [[-10, -8], [10, -8], [-10, 8], [10, 8], [0, 0]]) {
    const y = WALL_H - 1.5;
    const hub = chamferBox(0.5, 0.35, 0.5, 0.02);
    fillMasks(hub, 0.2, 0.25, 0.15);
    A.addOnce('metal_dark', hub, trs(_m, fx, y, fz));
    fansOut.push({ x: fx, y, z: fz });
    for (let a = 0; a < 4; a++) {
      const blade = chamferBox(2.8, 0.06, 0.35, 0.01);
      fillMasks(blade, 0.15, 0.2, 0.1);
      A.addOnce('metal_dark', blade, trs(_m, fx, y - 0.1, fz, (a / 4) * Math.PI * 2));
    }
  }
}

function _yardProps(A, rng) {
  A.jitter = { rng, yaw: 0.08, scale: 0.04 };
  A.skirts = true;
  for (const c of [
    { x: -28, z: -8, ry: 0.1, rust: false }, { x: -28, z: -15, ry: 0.05, rust: true },
    { x: 28, z: 10, ry: Math.PI / 2 + 0.08, rust: false }, { x: 28, z: 3, ry: Math.PI / 2, rust: true },
    { x: -22, z: 22, ry: 0.2, rust: true }, { x: 18, z: -26, ry: -0.15, rust: false },
  ]) {
    const id = c.rust ? 'ship_container_rust' : 'ship_container';
    if (A.has(id)) { A.put(id, c.x, 0, c.z, c.ry); A.box('metal', c.x, 1.3, c.z, 2.44, 2.59, 6.05, c.ry); }
  }
  for (const c of [{ x: 24, z: -12, ry: 0.4 }, { x: -24, z: 8, ry: -1.1 }, { x: 10, z: 26, ry: 2.2 }, { x: -8, z: -28, ry: 0.7 }]) {
    if (A.has('burnt_car')) { A.put('burnt_car', c.x, 0, c.z, c.ry); A.box('metal', c.x, 0.7, c.z, 1.8, 1.4, 4.4, c.ry); }
  }
  if (A.has('fac_bike')) {
    for (let i = 0; i < 6; i++) {
      const side = rng.float() < 0.5 ? -1 : 1;
      A.put('fac_bike', side * (HALL_W / 2 + 2 + rng.range(0, 4)), 0, rng.range(-HALL_D / 2, HALL_D / 2), rng.range(0, Math.PI));
    }
  }
  A.jitter = null;
}

function _lightAnchors(A) {
  for (const [x, y, z] of [[-12, 6, -10], [12, 6, -10], [-12, 6, 10], [12, 6, 10], [0, 6.5, 0], [-6, 5.5, -16], [6, 5.5, 14], [-20, 4, 0], [20, 4, 0]]) {
    A.interiorLights.push({ x, y, z });
  }
}
