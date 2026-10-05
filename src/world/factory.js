/**
 * WORLD — procedural factory combat arena.
 *
 * Inspired by the Nik Lever threejs-games-course factory shooter level
 * (factory2.glb + navmesh waypoints), rebuilt entirely from code so it
 * obeys the Claude-of-Duty hard rule: no external models, textures or HDRIs.
 *
 * Layout (LEVEL space, metres):
 *   Hall interior ~50 x 40 m, floor at y=0, walls ~8 m high.
 *   Open ends on +Z / -Z with sand aprons; solid walls on ±X with loading bays.
 *   Four central pillar clusters + catwalks at y≈3.6 for vertical cover.
 *   Machinery blocks, crate stacks, pipe runs and ceiling fans.
 *
 * Spawns form a ring matching the original waypoint scale so multiplayer
 * and AI both have natural fight positions.
 */

import * as THREE from 'three';
import { chamferBox, wallPanel, trs, weatherProp, fillMasks } from './util.js';

const HALL_W = 50;
const HALL_D = 40;
const WALL_H = 8;
const WALL_T = 0.45;
const CATWALK_Y = 3.55;
const CATWALK_W = 2.4;

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
];

const _m = new THREE.Matrix4();

/**
 * Build the entire factory into the Assembler.
 * @returns {{ spawns, bounds, fans }}
 */
export function buildFactory(A, rng) {
  const fans = [];
  _floor(A, rng);
  _walls(A, rng);
  _pillars(A, rng);
  _catwalks(A, rng);
  _beams(A, rng);
  _machinery(A, rng);
  _crates(A, rng);
  _pipes(A, rng);
  _ceilingFans(A, rng, fans);
  _lightAnchors(A);
  return {
    spawns: FACTORY_SPAWNS,
    bounds: { minX: -HALL_W / 2 - 4, maxX: HALL_W / 2 + 4, minZ: -HALL_D / 2 - 6, maxZ: HALL_D / 2 + 6 },
    fans,
  };
}

export function factoryGroundY(_x, _z) {
  return 0;
}

export function factoryIsOpen(x, z, margin = 0.4) {
  const hw = HALL_W / 2 - margin;
  const hd = HALL_D / 2 - margin;
  return Math.abs(x) < hw + 4 && Math.abs(z) < hd + 6;
}

function _floor(A, rng) {
  const hw = HALL_W / 2;
  const hd = HALL_D / 2;
  const slab = chamferBox(HALL_W + 2, 0.28, HALL_D + 2, 0.01);
  weatherProp(slab, { base: 0.35, wear: 0.5, grime: 0.4, height: 0.3 });
  A.addOnce('floor_concrete', slab, trs(_m, 0, -0.14, 0));
  A.box('concrete', 0, -0.14, 0, HALL_W + 2, 0.28, HALL_D + 2);
  for (const z of [-hd - 3, hd + 3]) {
    const sand = chamferBox(HALL_W + 8, 0.18, 8, 0.01);
    weatherProp(sand, { base: 0.2, wear: 0.3, grime: 0.2, height: 0.2 });
    A.addOnce('sand', sand, trs(_m, 0, -0.08, z));
    A.box('sand', 0, -0.08, z, HALL_W + 8, 0.18, 8);
  }
  for (let i = 0; i < 6; i++) {
    const x = rng.range(-hw + 4, hw - 4);
    const z = rng.range(-hd + 4, hd - 4);
    const gw = rng.range(2.5, 4.5);
    const gd = rng.range(2.5, 4.5);
    const g = chamferBox(gw, 0.04, gd, 0.005);
    fillMasks(g, 0.15, 0.35, 0.2);
    A.addOnce('steel', g, trs(_m, x, 0.02, z));
  }
}

function _walls(A, rng) {
  const hw = HALL_W / 2;
  const hd = HALL_D / 2;
  const t = WALL_T;
  const h = WALL_H;
  for (const side of [-1, 1]) {
    const x = side * (hw + t / 2);
    const segs = [{ z0: -hd, z1: -8 }, { z0: -4, z1: 4 }, { z0: 8, z1: hd }];
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
  if (!A.has('fac_crate')) {
    const c = chamferBox(1, 1, 1, 0.025);
    weatherProp(c, { base: 0.3, wear: 0.55, height: 1 });
    A.proto('fac_crate', { geo: c, key: 'wood_prop', tilt: 0.04, sink: 0.02, skirt: 0.55 });
  }
  if (!A.has('fac_barrel')) {
    const b = chamferBox(0.7, 1.05, 0.7, 0.03);
    weatherProp(b, { base: 0.25, wear: 0.6, height: 1.05 });
    A.proto('fac_barrel', { geo: b, key: 'metal_rust_prop', tilt: 0.06, sink: 0.02, skirt: 0.4 });
  }
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
          const s = rng.range(0.85, 1.15);
          A.put('fac_crate', sx + c * 1.15, k * s + s / 2, sz + r * 1.15, rng.range(0, 0.3), s);
          A.box('wood', sx + c * 1.15, k * s + s / 2, sz + r * 1.15, s, s, s);
        }
      }
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = rng.range(-20, 20);
    const z = rng.range(-18, 18);
    if (Math.hypot(x, z) < 4) continue;
    A.put('fac_barrel', x, 0.52, z, rng.range(0, Math.PI));
    A.box('metal', x, 0.52, z, 0.7, 1.05, 0.7);
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

/** Register practical light anchors only — WorldSystem._addLights creates the PointLights. */
function _lightAnchors(A) {
  const positions = [
    [-12, 6, -10], [12, 6, -10], [-12, 6, 10], [12, 6, 10],
    [0, 6.5, 0], [-6, 5.5, -16], [6, 5.5, 14],
  ];
  for (const [x, y, z] of positions) {
    A.interiorLights.push({ x, y, z });
  }
}
