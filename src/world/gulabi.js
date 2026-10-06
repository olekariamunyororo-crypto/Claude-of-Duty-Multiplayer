/**
 * WORLD - "Gulabi Bazaar": a Jaipur-inspired pink-city district (stage 1).
 *
 * A ~68 x 64 m sealed arena built only from the world assembler's own boxes
 * and palette: no external assets and none of the Gulabi game's shaders.
 * Level space: +x east, +z south. A main street runs north-south, a lane runs
 * east-west, and they meet in a central chowk with a shrine and market stalls.
 * Four-metre alleys branch off the main street between the shop blocks.
 * Layout and flavour are inspired by olekariamunyororo-crypto/gulabi-nagar
 * (a fork of karandesizn-crypto/gulabi-nagar); see that project's LICENSE.
 */
import * as THREE from 'three';
import { trs } from './util.js';
import { BOX, BOX_THIN } from './kit.js';

const HX = 34;   // inner half extent, x
const HZ = 32;   // inner half extent, z
const _m = new THREE.Matrix4();

const hs = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const sorted = (a, b) => (a < b ? [a, b] : [b, a]);
const FACADE = ['plaster_pink', 'plaster_pink', 'plaster_sand', 'plaster_pink', 'plaster_cream', 'plaster_pink'];
const SHUTTER = ['metal_blue', 'metal_rust', 'metal_dark'];
const AWNING = ['brick', 'plaster_white', 'plaster_blue'];

function makeBlocks() {
  // one quadrant in absolute coordinates [x0, x1, z0, z1]; mirrored into all four
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
        out.push({ x0, x1, z0, z1, h: 6.2 + hs(n + 1) * 2.6, key: FACADE[n % FACADE.length], n });
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

const face = (x, z) => Math.atan2(x, z); // yaw 0 looks north (-z), so this turns each spawn toward the chowk
export const GULABI_SPAWNS = [
  [0, -28, 'north street'],
  [0, 28, 'south street'],
  [-28, 0, 'west lane'],
  [28, 0, 'east lane'],
  [-28, -17.5, 'nw alley'],
  [28, -17.5, 'ne alley'],
  [-28, 17.5, 'sw alley'],
  [28, 17.5, 'se alley'],
  [0, -9.5, 'chowk north'],
  [0, 9.5, 'chowk south'],
].map(([x, z, tag]) => [x, z, face(x, z), tag]);

export function gulabiGroundY(_x, _z) { return 0; }

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
    const alongX = nz !== 0; // the wall runs along x when its normal is on z
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
      // ground floor: shutter, lintel, striped awning
      piece(SHUTTER[Math.floor(r * 3) % 3], pos, 1.25, 0.06, 2.2, 2.5, 0.12);
      piece('plaster_white', pos, 2.7, 0.08, 2.6, 0.2, 0.16);
      const aw = AWNING[Math.floor(r * 7) % 3];
      const ax = px(pos, 0.78), az = pz(pos, 0.78);
      if (alongX) trs(_m, ax, 3.05, az, 0, 2.7, 0.07, 1.5, nz > 0 ? 0.3 : -0.3, 0);
      else trs(_m, ax, 3.05, az, 0, 1.5, 0.07, 2.7, 0, nx > 0 ? -0.3 : 0.3);
      A.add(aw, THIN, _m);
      // upper floors: framed windows
      for (const y of [4.6, 6.9]) {
        if (y + 0.9 > b.h) continue;
        piece('plaster_white', pos, y, 0.05, 1.25, 1.75, 0.10);
        piece('metal_dark', pos, y, 0.07, 0.95, 1.45, 0.14);
      }
    }
  }
}

function crateCluster(A, BOXG, x, z, n) {
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
  const W = 2 * HX + 2.4, D = 2 * HZ + 2.4;

  // ground and chowk paving
  A.addBox('concrete', BIG, 0, -0.3, 0, 0, W, 0.6, D);
  A.box(A.surfaceOf('concrete'), 0, -0.3, 0, W, 0.6, D);
  A.addBox('plaster_sand', BIG, 0, -0.01, 0, 0, 22, 0.06, 22);

  // sealed perimeter
  const wallKey = 'plaster_sand';
  const walls = [
    [0, -(HZ + 0.6), W, 1.2],
    [0, HZ + 0.6, W, 1.2],
    [-(HX + 0.6), 0, 1.2, 2 * HZ],
    [HX + 0.6, 0, 1.2, 2 * HZ],
  ];
  for (const [x, z, sx, sz] of walls) {
    A.addBox(wallKey, BIG, x, 2.25, z, 0, sx, 4.5, sz);
    A.box(A.surfaceOf(wallKey), x, 2.25, z, sx, 4.5, sz);
  }

  // shop blocks, facades, roof caps and a few chhatris
  for (const b of BLOCKS) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    A.addBox(b.key, BIG, cx, b.h / 2, cz, 0, w, b.h, d);
    A.box(A.surfaceOf(b.key), cx, b.h / 2, cz, w, b.h, d);
    A.addBox(b.key === 'plaster_pink' ? 'plaster_cream' : 'plaster_white', BIG, cx, b.h + 0.15, cz, 0, w + 0.3, 0.3, d + 0.3);
    facade(A, b, THIN);
    if (hs(b.n * 3.1) > 0.55 && w > 8 && d > 8) {
      for (const [ox, oz] of [[-0.95, -0.95], [0.95, -0.95], [-0.95, 0.95], [0.95, 0.95]]) {
        A.addBox('plaster_cream', THIN, cx + ox, b.h + 1.25, cz + oz, 0, 0.22, 1.9, 0.22);
      }
      A.addBox('plaster_cream', THIN, cx, b.h + 2.3, cz, 0, 2.4, 0.2, 2.4);
      A.addBox('plaster_white', BIG, cx, b.h + 2.7, cz, 0, 1.4, 0.55, 1.4);
    }
  }

  // central shrine in the chowk
  A.addBox('concrete', BIG, 0, 0.3, 0, 0, 3.6, 0.6, 3.6);
  A.box(A.surfaceOf('concrete'), 0, 0.3, 0, 3.6, 0.6, 3.6);
  A.addBox('plaster_pink', BIG, 0, 1.7, 0, 0, 1.1, 2.2, 1.1);
  A.box(A.surfaceOf('plaster_pink'), 0, 1.7, 0, 1.1, 2.2, 1.1);
  A.addBox('plaster_cream', BIG, 0, 3.0, 0, 0, 1.7, 0.3, 1.7);

  // market stalls on the chowk diagonals
  let s = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * 7.5, z = sz * 7.5;
      A.addBox('plaster_sand', BIG, x, 0.5, z, 0, 2.4, 1.0, 1.0);
      A.box(A.surfaceOf('plaster_sand'), x, 0.5, z, 2.4, 1.0, 1.0);
      for (const [ox, oz] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) {
        A.addBox('metal_dark', THIN, x + ox, 1.25, z + oz, 0, 0.1, 2.5, 0.1);
      }
      A.addBox(AWNING[s % 3], THIN, x, 2.55, z, 0, 2.9, 0.08, 1.9);
      s++;
    }
  }

  // chai cart on the lane
  A.addBox('metal_blue', BIG, 14, 0.5, -2.5, 0, 1.8, 1.0, 0.9);
  A.box(A.surfaceOf('metal_blue'), 14, 0.5, -2.5, 1.8, 1.0, 0.9);
  A.addBox('plaster_white', THIN, 14, 2.1, -2.5, 0, 2.3, 0.07, 1.4);
  for (const ox of [-1.0, 1.0]) A.addBox('metal_dark', THIN, 14 + ox, 1.6, -2.5, 0, 0.08, 1.2, 0.08);

  // cover: crate clusters along the street, lane and alleys
  const clusters = [
    [-2.8, -21], [2.8, -24], [-2.8, 24], [2.8, 21],
    [-20, -1.5], [20, 1.5], [-26, 2], [26, -2],
    [9.5, -9.5], [-9.5, 9.5], [-22, -17.5], [22, 17.5],
  ];
  clusters.forEach(([x, z], i) => crateCluster(A, BIG, x, z, i));

  const ext = { minX: -HX, maxX: HX, minZ: -HZ, maxZ: HZ };
  return { spawns: GULABI_SPAWNS, bounds: ext, fans: [] };
}
