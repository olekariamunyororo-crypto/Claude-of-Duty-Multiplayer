/**
 * WORLD — procedural factory combat arena (expanded).
 *
 * Inspired by the Nik Lever factory shooter level, rebuilt with pure geometry.
 * Hall ~50 x 40 m plus outer yard, continuous perimeter, side rooms with office
 * furniture, shipping containers, wrecked cars, bikes and industrial clutter.
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

/** Spawn points in LEVEL space: [x, z, yaw, tag]. */
export const FACTORY_SPAWNS = [
  [17.7, -0.7, Math.PI, 'east bay'],
  [20.6, -18.3, Math.PI * 0.75, 'se corner'],
  [11.8, -23.2, Math.PI * 0.5, 'south wall'],
  [-3.1, -22.7, Math.PI * 0.25, 'sw bay'],
  [-13.8, -23.1, 0, 'west south'],
  [-20.5, -12.5, -Math.PI * 0.25, 'west wall'],
  [-18.2, -1.0, -Math.PI * 0.5, 'nw bay'],
  [-6.6, -12.3, Math.PI, 'mid west'],
  [0, 8, Math.PI, 'north entry'],
  [8, 5, -Math.PI * 0.5, 'ne platform'],
  [-8, 5, Math.PI * 0.5, 'nw platform'],
  [0, -8, 0, 'centre south'],
  [22, 14, -Math.PI * 0.5, 'ne yard'],
  [-22, -16, Math.PI * 0.5, 'sw yard'],
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
    bounds: {
      minX: -extent,
      maxX: extent,
      minZ: -HALL_D / 2 - YARD - 2,
      maxZ: HALL_D / 2 + YARD + 2,
    },
    fans,
  };
}

export function factoryGroundY(_x, _z) {
  return 0;
}

export function factoryIsOpen(x, z, margin = 0.4) {
  const e = HALL_W / 2 + YARD - margin;
  const d = HALL_D / 2 + YARD - margin;
  return Math.abs(x) < e && Math.abs(z) < d;
}

function _registerExtraProtos(A, rng) {
  if (!A.has('burnt_car')) {
    const g = burntCar(rng);
    A.proto('burnt_car', { geo: g, key: 'metal_rust', tilt: 0.03, sink: 0.04, skirt: 1.1, chunk: false });
  }
  if (!A.has('ship_container')) {
    A.proto('ship_container', {
      geo: _shippingContainer(),
      key: 'metal_blue',
      tilt: 0,
      sink: 0,
      skirt: 1.4,
      chunk: false,
    });
  }
  if (!A.has('ship_container_rust')) {
    A.proto('ship_container_rust', {
      geo: _shippingContainer(),
      key: 'metal_rust',
      tilt: 0.01,
      sink: 0.02,
      skirt: 1.4,
      chunk: false,
    });
  }
  if (!A.has('fac_bike')) {
    A.proto('fac_bike', {
      geo: _bike(),
      key: 'metal_dark',
      tilt: 0.12,
      sink: 0.01,
      skirt: 0.35,
    });
  }
}

function _shippingContainer() {
  const L = 6.05;
  const W = 2.44;
  const H = 2.59;
  const shell = chamferBox(W, H, L, 0.04);
  weatherProp(shell, { base: 0.35, wear: 0.55, height: H });
  shell.translate(0, H / 2, 0);
  return shell;
}

function _bike() {
  const frame = chamferBox(0.08, 0.55, 1.55, 0.01);
  fillMasks(frame, 0.2, 0.25, 0.15);
  frame.translate(0, 0.35, 0);
  return frame;
}

function _floor(A, rng) {
  const hw = HALL_W / 2;
  const hd = HALL_D / 2;

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
    const x = rng.range(-hw + 4, hw - 4);
    const z = rng.range(-hd + 4, hd - 4);
    const gw = rng.range(2.5, 4.5);
    const gd = rng.range(2.5, 4.5);
    const g = chamferBox(gw, 0.04, gd, 0.005);
    fillMasks(g, 0.15, 0.35, 0.2);
    A.addOnce('steel', g, trs(_m, x, 0.02, z));
  }
}

function _perimeter(A, rng) {
  const e = HALL_W / 2 + YARD;
  const d = HALL_D / 2 + YARD;
  const h = 3.2;
  const t = 0.35;
  const gateW = 6;

  for (const side of [-1, 1]) {
    const len = e - gateW / 2;
    const cx = side * (gateW / 2 + len / 2);
    const panel = wallPanel(len, h, t, [], { bevel: 0.02, rng });
    A.addOnce('concrete_dark', panel, trs(_m, cx, 0, d));
    A.box('concrete', cx, h / 2, d, len, h, t);
  }
  for (const side of [-1, 1]) {
    const len = e - gateW / 2;
    const cx = side * (gateW / 2 + len / 2);
    const panel = wallPanel(len, h, t, [], { bevel: 0.02, rng });
    A.addOnce('concrete_dark', panel, trs(_m, cx, 0, -d, Math.PI));
    A.box('concrete', cx, h / 2, -d, len, h, t);
  }
  for (const side of [-1, 1]) {
    const x = side * e;
    const panel = wallPanel(d * 2, h, t, [], { bevel: 0.02, rng });
    A.addOnce('concrete_dark', panel, trs(_m, x, 0, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2));
    A.box('concrete', x, h / 2, 0, t, h, d * 2);
  }

  for (const z of [-d, d]) {
    for (const x of [-gateW / 2, gateW / 2]) {
      const post = chamferBox(0.45, h + 0.8, 0.45, 0.03);
      weatherProp(post, { base: 0.3, wear: 0.6, height: h });
      A.addOnce('concrete', post, trs(_m, x, (h + 0.8) / 2, z));
      A.box('concrete', x, (h + 0.8) / 2, z, 0.45, h + 0.8, 0.45);
    }
  }

  for (const z of [-d, d]) {
    for (const side of [-1, 1]) {
      const len = e - gateW / 2;
      const cx = side * (gateW / 2 + len / 2);
      const rail = chamferBox(len, 0.06, 0.06, 0.005);
      fillMasks(rail, 0.2, 0.3, 0.15);
      A.addOnce('steel', rail, trs(_m, cx, h + 0.15, z));
    }
  }
}

function _walls(A, rng) {
  const hw = HALL_W / 2;
  const hd = HALL_D / 2;
  const t = WALL_T;
  const h = WALL_H;

  for (const side of [-1, 1]) {
    const x = side * (hw + t / 2);
    const segs = [
      { z0: -hd, z1: -8 },
      { z0: -4, z1: 4 },
      { z0: 8, z1: hd },
    ];
    for (const s of segs) {
      const len = s.z1 - s.z0;
      const cz = (s.z0 + s.z1) / 2;
      const panel = wallPanel(len, h, t, [], { bevel: 0.03, rng });
      A.addOnce('concrete_dark', panel, trs(_m, x, 0, cz, side > 0 ? -Math.PI / 2 : Math.PI / 2));
      A.box('concrete', x, h / 2, cz, t, h, len, side > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    for (const bz of [-6, 6]) {
      const lintel = chamferBox(t + 0.2, 0.5, 4.5, 0.02);
      weatherProp(lintel, { base: 0.3, wear: 0.7 });
      A.addOnce('concrete', lintel, trs(_m, x, h - 0.4, bz));
      A.box('concrete', x, h - 0.4, bz, t + 0.2, 0.5, 4.5);
    }
  }

  for (const side of [-1, 1]) {
    const z = side * (hd + t / 2);
    for (const sx of [-1, 1]) {
      const cx = sx * (hw / 2 + 4);
      const len = hw / 2 - 2;
      const panel = wallPanel(len, h * 0.7, t, [], { bevel: 0.03, rng, top: 'ragged', raggedAmp: 0.25 });
      A.addOnce('concrete_dark', panel, trs(_m, cx, 0, z, side > 0 ? Math.PI : 0));
      A.box('concrete', cx, (h * 0.7) / 2, z, len, h * 0.7, t, side > 0 ? Math.PI : 0);
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
  const h = 3.2;
  const t = 0.25;
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

  const inward = openToward;
  const deskX = r.x + inward * 0.5;
  if (A.has('table_small')) {
    A.put('table_small', deskX, 0, r.z, r.ry + Math.PI / 2);
    A.box('wood', deskX, 0.36, r.z, 0.9, 0.72, 0.7);
  }
  if (A.has('chair')) {
    A.put('chair', deskX + inward * 0.7, 0, r.z - 0.5, r.ry);
    A.put('chair', deskX + inward * 0.7, 0, r.z + 0.5, r.ry);
  }
  if (A.has('shelf')) {
    A.put('shelf', backX + inward * 0.4, 0, r.z - 1.2, r.ry + Math.PI / 2);
    A.box('wood', backX + inward * 0.4, 0.95, r.z - 1.2, 1.1, 1.9, 0.35);
  }
  if (A.has('cabinet')) {
    A.put('cabinet', backX + inward * 0.35, 0, r.z + 1.4, r.ry + Math.PI / 2);
    A.box('wood', backX + inward * 0.35, 0.57, r.z + 1.4, 0.9, 1.15, 0.44);
  }
  if (A.has('box_card_a')) {
    for (let i = 0; i < 3; i++) {
      A.put('box_card_a', r.x + rng.range(-1.5, 1.5), 0, r.z + rng.range(-1.5, 1.5), rng.range(0, Math.PI));
    }
  }
  A.interiorLights.push({ x: r.x, y: h - 0.3, z: r.z });
}

function _pillars(A, rng) {
  const clusters = [[-8, -6], [8, -6], [-8, 6], [8, 6], [0, -14], [0, 12]];
  for (const [cx, cz] of clusters) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const ox = rng.range(-1.8, 1.8);
      const oz = rng.range(-1.8, 1.8);
      const ph = rng.range(4.5, 7.2);
      const s = rng.range(0.55, 0.95);
      const col = chamferBox(s, ph, s, 0.03);
      weatherProp(col, { base: 0.35, wear: 0.55, height: ph });
      A.addOnce('concrete', col, trs(_m, cx + ox, ph / 2, cz + oz));
      A.box('concrete', cx + ox, ph / 2, cz + oz, s, ph, s);
    }
  }
}

function _catwalks(A, rng) {
  const hw = HALL_W / 2;
  const y = CATWALK_Y;
  const w = CATWALK_W;
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
  const hw = HALL_W / 2;
  const hd = HALL_D / 2;
  const y = WALL_H - 0.4;
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
  const blocks = [
    { x: -14, z: 2, sx: 3.2, sy: 2.4, sz: 2.8 },
    { x: 14, z: -4, sx: 2.8, sy: 2.8, sz: 3.5 },
    { x: -4, z: -16, sx: 4.0, sy: 1.8, sz: 2.2 },
    { x: 5, z: 14, sx: 3.5, sy: 2.2, sz: 2.5 },
    { x: 12, z: 10, sx: 2.0, sy: 3.2, sz: 2.0 },
    { x: -12, z: -10, sx: 2.5, sy: 2.0, sz: 3.0 },
  ];
  for (const b of blocks) {
    const body = chamferBox(b.sx, b.sy, b.sz, 0.04);
    weatherProp(body, { base: 0.4, wear: 0.5, height: b.sy });
    A.addOnce('metal_rust', body, trs(_m, b.x, b.sy / 2, b.z));
    A.box('metal', b.x, b.sy / 2, b.z, b.sx, b.sy, b.sz);
    if (rng.float() < 0.7) {
      const d = chamferBox(b.sx * 0.4, 0.5, b.sz * 0.3, 0.02);
      fillMasks(d, 0.2, 0.3, 0.2);
      A.addOnce('metal_dark', d, trs(_m, b.x + rng.range(-0.3, 0.3), b.sy + 0.25, b.z));
    }
  }
  for (let i = 0; i < 8; i++) {
    const x = rng.range(-18, 18);
    const z = rng.range(-16, 16);
    if (Math.hypot(x, z) < 5) continue;
    const w = rng.range(2.0, 4.0);
    const d = rng.range(0.35, 0.55);
    const h = rng.range(1.1, 1.5);
    const ry = rng.range(0, Math.PI);
    const wall = chamferBox(w, h, d, 0.02);
    weatherProp(wall, { base: 0.35, wear: 0.5, height: h });
    A.addOnce('concrete', wall, trs(_m, x, h / 2, z, ry));
    A.box('concrete', x, h / 2, z, w, h, d, ry);
  }
}

function _crates(A, rng) {
  A.jitter = { rng, yaw: 0.15, scale: 0.08 };
  A.skirts = true;

  const stacks = [[-16, -14], [16, 12], [-10, 16], [10, -18], [3, -3], [-15, 8], [18, -8]];
  for (const [sx, sz] of stacks) {
    const rows = rng.int(2, 4);
    const cols = rng.int(2, 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const h = rng.int(1, 3);
        for (let k = 0; k < h; k++) {
          const id = rng.float() < 0.5 ? 'crate_a' : 'crate_c';
          if (!A.has(id)) continue;
          const s = rng.range(0.9, 1.1);
          A.put(id, sx + c * 1.15, 0, sz + r * 1.15, rng.range(0, 0.3), s);
          A.box('wood', sx + c * 1.15, 0.35 * (k + 1), sz + r * 1.15, 0.7, 0.7, 0.7);
        }
      }
    }
  }

  for (let i = 0; i < 22; i++) {
    const x = rng.range(-20, 20);
    const z = rng.range(-18, 18);
    if (Math.hypot(x, z) < 4) continue;
    const id = rng.float() < 0.5 ? 'barrel_rust' : 'barrel_blue';
    if (A.has(id)) {
      A.put(id, x, 0, z, rng.range(0, Math.PI));
      A.box('metal', x, 0.45, z, 0.6, 0.9, 0.6);
    }
  }

  if (A.has('pallet')) {
    for (let i = 0; i < 8; i++) {
      A.put('pallet', rng.range(-18, 18), 0, rng.range(-16, 16), rng.range(0, Math.PI));
    }
  }
  if (A.has('tyre')) {
    for (let i = 0; i < 12; i++) {
      A.put('tyre', rng.range(-20, 20), 0, rng.range(-18, 18), rng.range(0, Math.PI));
    }
  }

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
      for (let i = 0; i < 3; i++) {
        const z = -12 + i * 12;
        const drop = chamferBox(0.22, y - 0.3, 0.22, 0.015);
        fillMasks(drop, 0.15, 0.35, 0.2);
        A.addOnce('metal_rust', drop, trs(_m, x, (y - 0.3) / 2 + 0.15, z));
      }
    }
  }
  for (let i = 0; i < 3; i++) {
    const z = -10 + i * 10;
    const conduit = chamferBox(HALL_W - 10, 0.2, 0.2, 0.01);
    fillMasks(conduit, 0.1, 0.3, 0.15);
    A.addOnce('metal_dark', conduit, trs(_m, 0, WALL_H - 1.2, z));
  }
}

function _ceilingFans(A, rng, fansOut) {
  const positions = [[-10, -8], [10, -8], [-10, 8], [10, 8], [0, 0]];
  for (const [fx, fz] of positions) {
    const y = WALL_H - 1.5;
    const hub = chamferBox(0.5, 0.35, 0.5, 0.02);
    fillMasks(hub, 0.2, 0.25, 0.15);
    A.addOnce('metal_dark', hub, trs(_m, fx, y, fz));
    fansOut.push({ x: fx, y, z: fz });
    for (let a = 0; a < 4; a++) {
      const ry = (a / 4) * Math.PI * 2;
      const blade = chamferBox(2.8, 0.06, 0.35, 0.01);
      fillMasks(blade, 0.15, 0.2, 0.1);
      A.addOnce('metal_dark', blade, trs(_m, fx, y - 0.1, fz, ry));
    }
  }
}

function _yardProps(A, rng) {
  A.jitter = { rng, yaw: 0.08, scale: 0.04 };
  A.skirts = true;

  const containers = [
    { x: -28, z: -8, ry: 0.1, rust: false },
    { x: -28, z: -15, ry: 0.05, rust: true },
    { x: 28, z: 10, ry: Math.PI / 2 + 0.08, rust: false },
    { x: 28, z: 3, ry: Math.PI / 2, rust: true },
    { x: -22, z: 22, ry: 0.2, rust: true },
    { x: 18, z: -26, ry: -0.15, rust: false },
  ];
  for (const c of containers) {
    const id = c.rust ? 'ship_container_rust' : 'ship_container';
    if (A.has(id)) {
      A.put(id, c.x, 0, c.z, c.ry);
      A.box('metal', c.x, 1.3, c.z, 2.44, 2.59, 6.05, c.ry);
    }
  }

  const cars = [
    { x: 24, z: -12, ry: 0.4 },
    { x: -24, z: 8, ry: -1.1 },
    { x: 10, z: 26, ry: 2.2 },
    { x: -8, z: -28, ry: 0.7 },
  ];
  for (const c of cars) {
    if (A.has('burnt_car')) {
      A.put('burnt_car', c.x, 0, c.z, c.ry);
      A.box('metal', c.x, 0.7, c.z, 1.8, 1.4, 4.4, c.ry);
    }
  }

  if (A.has('fac_bike')) {
    for (let i = 0; i < 6; i++) {
      const side = rng.float() < 0.5 ? -1 : 1;
      A.put(
        'fac_bike',
        side * (HALL_W / 2 + 2 + rng.range(0, 4)),
        0,
        rng.range(-HALL_D / 2, HALL_D / 2),
        rng.range(0, Math.PI)
      );
    }
  }

  if (A.has('jersey')) {
    for (const z of [-HALL_D / 2 - YARD + 2, HALL_D / 2 + YARD - 2]) {
      for (const x of [-5, 5]) {
        A.put('jersey', x, 0, z, 0);
        A.box('concrete', x, 0.45, z, 0.6, 0.9, 1.9);
      }
    }
  }

  for (let i = 0; i < 10; i++) {
    const x = rng.range(-30, 30);
    const z = rng.range(-28, 28);
    if (Math.abs(x) < 18 && Math.abs(z) < 16) continue;
    if (A.has('gas_bottle') && rng.float() < 0.4) A.put('gas_bottle', x, 0, z, rng.range(0, Math.PI));
    else if (A.has('jerry_can') && rng.float() < 0.5) A.put('jerry_can', x, 0, z, rng.range(0, Math.PI));
    else if (A.has('bucket')) A.put('bucket', x, 0, z, rng.range(0, Math.PI));
  }

  A.jitter = null;
}

function _lightAnchors(A) {
  const positions = [
    [-12, 6, -10],
    [12, 6, -10],
    [-12, 6, 10],
    [12, 6, 10],
    [0, 6.5, 0],
    [-6, 5.5, -16],
    [6, 5.5, 14],
    [-20, 4, 0],
    [20, 4, 0],
  ];
  for (const [x, y, z] of positions) {
    A.interiorLights.push({ x, y, z });
  }
}
