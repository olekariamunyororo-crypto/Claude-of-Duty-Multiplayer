/**
 * WORLD — Gulabi Bazaar (Jaipur-inspired pink city) for Claude-of-Duty.
 *
 * Built only with the Assembler (no gulabi-nagar shaders/assets).
 * ~68×64 m sealed arena: N–S main street, E–W lane, central chowk,
 * pink shop blocks, stalls, chai cart, crates, perimeter wall.
 *
 * Select: ?map=gulabi  (default on this fork)
 */
import * as THREE from 'three';
import { trs } from './util.js';
import { BOX, BOX_THIN } from './kit.js';

const HX = 34;
const HZ = 32;
const _m = new THREE.Matrix4();

const hs = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const sorted = (a, b) => (a < b ? [a, b] : [b, a]);

const FACADE = ['plaster_pink', 'plaster_pink', 'plaster_sand', 'plaster_pink', 'plaster_cream', 'plaster_pink'];
const SHUTTER = ['metal_blue', 'metal_rust', 'metal_dark'];
const AWNING = ['brick', 'plaster_white', 'plaster_blue'];

function makeBlocks() {
  const base = [
    [11, 34, 19, 32],
    [11, 34, 6, 15],
    [7, 11, 19, 32],
    [7, 11, 11, 15],
  ];
  const out = [];
  let n = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const [a0, a1, b0, b1] of base) {
        const [x0, x1] = sorted(sx * a0, sx * a1);
        const [z0, z1] = sorted(sz * b0, sz * b1);
        out.push({
          x0, x1, z0, z1,
          h: 6.2 + hs(n + 1) * 2.6,
          key: FACADE[n % FACADE.length],
          n,
        });
        n++;
      }
    }
  }
  return out;
}
const BLOCKS = makeBlocks();

const inBlock = (x, z, pad = 0) =>
  BLOCKS.some((b) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);

const inside = (x, z) => Math.abs(x) < HX && Math.abs(z) < HZ;
const exposed = (x, z) => inside(x, z) && !inBlock(x, z);

/** Yaw 0 looks toward −Z (north). face() turns spawn toward the chowk. */
const face = (x, z) => Math.atan2(x, z);

// Keep every spawn well inside the sealed wall (HX=34, HZ=32) and off solid blocks.
export const GULABI_SPAWNS = [
  [0, -18, face(0, -18), 'north street'],
  [0, 18, face(0, 18), 'south street'],
  [-18, 0, face(-18, 0), 'west lane'],
  [18, 0, face(18, 0), 'east lane'],
  [0, -10, face(0, -10), 'chowk north'],
  [0, 10, face(0, 10), 'chowk south'],
  [10, 0, face(10, 0), 'chowk east'],
  [-10, 0, face(-10, 0), 'chowk west'],
  [0, 0, Math.PI, 'chowk centre'],
  [3, -14, face(3, -14), 'north mid'],
  [-3, 14, face(-3, 14), 'south mid'],
  [14, 3, face(14, 3), 'east mid'],
];

export function gulabiGroundY(_x, _z) {
  return 0;
}

export function gulabiIsOpen(x, z, margin = 0.4) {
  if (Math.abs(x) > HX - margin || Math.abs(z) > HZ - margin) return false;
  return !inBlock(x, z, margin);
}

const SIDES = [
  { nx: 0, nz: -1 },
  { nx: 0, nz: 1 },
  { nx: -1, nz: 0 },
  { nx: 1, nz: 0 },
];

function facade(A, b, THIN) {
  for (const { nx, nz } of SIDES) {
    const alongX = nz !== 0;
    const plane = alongX ? (nz < 0 ? b.z0 : b.z1) : (nx < 0 ? b.x0 : b.x1);
    const s0 = alongX ? b.x0 : b.z0;
    const s1 = alongX ? b.x1 : b.z1;
    const px = (pos, off) => (alongX ? pos : plane + nx * off);
    const pz = (pos, off) => (alongX ? plane + nz * off : pos);
    const piece = (key, pos, y, off, wAlong, hh, thick) =>
      A.addBox(key, THIN, px(pos, off), y, pz(pos, off), 0,
        alongX ? wAlong : thick, hh, alongX ? thick : wAlong);

    for (let pos = s0 + 1.7; pos < s1 - 1.0; pos += 3.0) {
      if (!exposed(px(pos, 0.8), pz(pos, 0.8))) continue;
      const r = hs(b.n * 7.3 + pos);
      piece(SHUTTER[Math.floor(r * 3) % 3], pos, 1.25, 0.06, 2.2, 2.5, 0.12);
      piece('plaster_white', pos, 2.7, 0.08, 2.6, 0.2, 0.16);
      const ax = px(pos, 0.9);
      const az = pz(pos, 0.9);
      if (alongX) {
        A.addBox(AWNING[Math.floor(r * 7) % 3], THIN, ax, 3.05, az, 0, 2.7, 0.08, 1.4);
      } else {
        A.addBox(AWNING[Math.floor(r * 7) % 3], THIN, ax, 3.05, az, 0, 1.4, 0.08, 2.7);
      }
      for (const y of [4.6, 6.9]) {
        if (y + 0.9 > b.h) continue;
        piece('plaster_white', pos, y, 0.05, 1.25, 1.75, 0.1);
        piece('metal_dark', pos, y, 0.07, 0.95, 1.45, 0.14);
      }
    }
  }
}

function crateCluster(A, BOXG, x, z, n) {
  if (inBlock(x, z, 1.5)) return;
  const k1 = n % 2 ? 'metal_rust' : 'brick';
  const k2 = n % 2 ? 'brick' : 'metal_rust';
  A.addBox(k1, BOXG, x, 0.45, z, hs(n) * 0.6, 1.1, 0.9, 1.1);
  A.box(A.surfaceOf(k1), x, 0.45, z, 1.1, 0.9, 1.1, hs(n) * 0.6);
  A.addBox(k2, BOXG, x + 1.15, 0.35, z + 0.25, 0, 0.9, 0.7, 0.9);
  A.box(A.surfaceOf(k2), x + 1.15, 0.35, z + 0.25, 0.9, 0.7, 0.9);
  if (n % 3 === 0) {
    A.addBox(k2, BOXG, x + 0.1, 1.2, z, 0.4, 0.8, 0.6, 0.8);
    A.box(A.surfaceOf(k2), x + 0.1, 1.2, z, 0.8, 0.6, 0.8, 0.4);
  }
}

export function buildGulabi(A, rng) {
  const BIG = BOX(A);
  const THIN = BOX_THIN(A);

  const W = HX * 2 + 4;
  const D = HZ * 2 + 4;
  A.addBox('sand', BIG, 0, -0.35, 0, 0, W + 8, 0.5, D + 8);
  A.box('sand', 0, -0.35, 0, W + 8, 0.5, D + 8);
  A.addBox('floor_concrete', BIG, 0, -0.02, 0, 0, 14, 0.08, D - 4);
  A.box('concrete', 0, -0.02, 0, 14, 0.08, D - 4);
  A.addBox('floor_concrete', BIG, 0, -0.015, 0, 0, W - 4, 0.07, 10);
  A.box('concrete', 0, -0.015, 0, W - 4, 0.07, 10);
  A.addBox('plaster_sand', BIG, 0, 0.01, 0, 0, 18, 0.06, 18);
  A.box('concrete', 0, 0.01, 0, 18, 0.06, 18);

  // Thick sealed perimeter — outer face at ±HX / ±HZ
  const wallH = 5.5;
  const wallT = 1.2;
  for (const [x, z, sx, sz] of [
    [0, -HZ - wallT / 2, W + wallT * 2, wallT],
    [0, HZ + wallT / 2, W + wallT * 2, wallT],
    [-HX - wallT / 2, 0, wallT, D + wallT * 2],
    [HX + wallT / 2, 0, wallT, D + wallT * 2],
  ]) {
    A.addBox('plaster_pink', BIG, x, wallH / 2, z, 0, sx, wallH, sz);
    A.box('concrete', x, wallH / 2, z, sx, wallH, sz);
  }
  for (const x of [-HX - wallT / 2, HX + wallT / 2]) {
    for (const z of [-HZ - wallT / 2, HZ + wallT / 2]) {
      A.addBox('plaster_cream', BIG, x, wallH / 2 + 0.5, z, 0, 1.6, wallH + 1.0, 1.6);
      A.box('concrete', x, wallH / 2 + 0.5, z, 1.6, wallH + 1.0, 1.6);
    }
  }

  for (const b of BLOCKS) {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const cx = (b.x0 + b.x1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    A.addBox(b.key, BIG, cx, b.h / 2, cz, 0, w, b.h, d);
    A.box(A.surfaceOf(b.key), cx, b.h / 2, cz, w, b.h, d);
    A.addBox(b.key === 'plaster_pink' ? 'plaster_cream' : 'plaster_white', BIG, cx, b.h + 0.15, cz, 0, w + 0.3, 0.3, d + 0.3);
    facade(A, b, THIN);
    if (hs(b.n * 3.1) > 0.45 && w > 8 && d > 8) {
      for (const [ox, oz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
        A.addBox('plaster_cream', THIN, cx + ox * (w * 0.35), b.h + 1.25, cz + oz * (d * 0.35), 0, 0.22, 1.9, 0.22);
      }
      A.addBox('plaster_cream', THIN, cx, b.h + 2.3, cz, 0, 2.4, 0.2, 2.4);
      A.addBox('plaster_white', BIG, cx, b.h + 2.7, cz, 0, 1.4, 0.55, 1.4);
    }
  }

  A.addBox('concrete', BIG, 0, 0.3, 0, 0, 3.6, 0.6, 3.6);
  A.box('concrete', 0, 0.3, 0, 3.6, 0.6, 3.6);
  A.addBox('plaster_pink', BIG, 0, 1.7, 0, 0, 1.2, 2.4, 1.2);
  A.box('concrete', 0, 1.7, 0, 1.2, 2.4, 1.2);
  A.addBox('plaster_cream', BIG, 0, 3.15, 0, 0, 1.8, 0.35, 1.8);
  A.addBox('plaster_white', BIG, 0, 3.6, 0, 0, 0.9, 0.55, 0.9);

  let s = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * 7.5;
      const z = sz * 7.5;
      A.addBox('plaster_sand', BIG, x, 0.5, z, 0, 2.4, 1.0, 1.0);
      A.box('concrete', x, 0.5, z, 2.4, 1.0, 1.0);
      for (const [ox, oz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) {
        A.addBox('metal_dark', THIN, x + ox, 1.25, z + oz, 0, 0.1, 2.5, 0.1);
      }
      A.addBox(AWNING[s % 3], THIN, x, 2.55, z, 0, 2.9, 0.08, 1.9);
      s++;
    }
  }

  A.addBox('metal_blue', BIG, 14, 0.5, -2.5, 0, 1.8, 1.0, 0.9);
  A.box('metal', 14, 0.5, -2.5, 1.8, 1.0, 0.9);
  A.addBox('plaster_white', THIN, 14, 2.1, -2.5, 0, 2.3, 0.07, 1.4);
  for (const ox of [-1.0, 1.0]) {
    A.addBox('metal_dark', THIN, 14 + ox, 1.6, -2.5, 0, 0.08, 1.2, 0.08);
  }

  const clusters = [
    [-2.8, -21], [2.8, -24], [-2.8, 24], [2.8, 21],
    [-20, -1.5], [20, 1.5], [-26, 2], [26, -2],
    [9.5, -9.5], [-9.5, 9.5], [-22, -17.5], [22, 17.5],
    [0, -18], [0, 18], [-12, 0], [12, 0],
  ];
  clusters.forEach(([x, z], i) => crateCluster(A, BIG, x, z, i));

  if (A.has('barrel_rust') || A.has('barrel_blue')) {
    for (let i = 0; i < 14; i++) {
      const x = (hs(i * 3.1) - 0.5) * 40;
      const z = (hs(i * 5.7) - 0.5) * 36;
      if (!exposed(x, z)) continue;
      const id = i % 2 ? 'barrel_rust' : 'barrel_blue';
      if (A.has(id)) {
        A.put(id, x, 0, z, hs(i) * Math.PI);
        A.box('metal', x, 0.45, z, 0.55, 0.9, 0.55);
      }
    }
  }

  const lights = [
    [0, 5.5, 0],
    [0, 4.5, -18], [0, 4.5, 18],
    [-18, 4.5, 0], [18, 4.5, 0],
    [-10, 4, -10], [10, 4, -10],
    [-10, 4, 10], [10, 4, 10],
    [14, 3.2, -2.5],
    [-7.5, 3.5, -7.5], [7.5, 3.5, 7.5],
  ];
  for (const [x, y, z] of lights) {
    A.interiorLights.push({ x, y, z });
  }
  for (const [x, z] of [[0, -22], [0, 22], [-22, 0], [22, 0], [-12, -12], [12, 12]]) {
    A.lampAnchors.push({ x, y: 4.2, z });
    A.addBox('metal_dark', THIN, x, 2.1, z, 0, 0.12, 4.2, 0.12);
    A.addBox('plaster_cream', THIN, x, 4.3, z, 0, 0.45, 0.2, 0.45);
  }

  return {
    spawns: GULABI_SPAWNS,
    bounds: { minX: -HX + 1, maxX: HX - 1, minZ: -HZ + 1, maxZ: HZ - 1 },
    fans: [],
  };
}
