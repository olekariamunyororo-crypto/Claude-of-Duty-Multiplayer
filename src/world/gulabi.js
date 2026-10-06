/**
 * WORLD — Gulabi Bazaar (Jaipur-inspired pink city) for Claude-of-Duty.
 *
 * Hollow shop shells with street doorways so the whole compound is tourable.
 * Sealed outer perimeter. Select: ?map=gulabi (default on this fork).
 */
import * as THREE from 'three';
import { BOX, BOX_THIN } from './kit.js';

const HX = 34;
const HZ = 32;

const hs = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const sorted = (a, b) => (a < b ? [a, b] : [b, a]);

const FACADE = ['plaster_pink', 'plaster_pink', 'plaster_sand', 'plaster_pink', 'plaster_cream', 'plaster_pink'];
const SHUTTER = ['metal_blue', 'metal_rust', 'metal_dark'];
const AWNING = ['brick', 'plaster_white', 'plaster_blue'];

const WALL_T = 0.45;
const DOOR_W = 3.0;
const DOOR_H = 2.7;

function makeBlocks() {
  const base = [
    [12, 34, 20, 32],
    [12, 34, 6, 16],
    [7, 12, 20, 32],
    [7, 12, 11, 16],
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
          h: 6.0 + hs(n + 1) * 2.4,
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

const inBlockFootprint = (x, z, pad = 0) =>
  BLOCKS.some((b) => x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad);

const inside = (x, z) => Math.abs(x) < HX && Math.abs(z) < HZ;
const exposed = (x, z) => inside(x, z) && !inBlockFootprint(x, z);

const face = (x, z) => Math.atan2(x, z);

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

/** Whole compound is walkable (buildings are hollow shells with doors). */
export function gulabiIsOpen(x, z, margin = 0.4) {
  return Math.abs(x) <= HX - margin && Math.abs(z) <= HZ - margin;
}

function wallWithDoor(A, BIG, key, alongX, fixed, a0, a1, y0, y1) {
  const mid = (a0 + a1) / 2;
  const half = DOOR_W / 2;
  const segs = [
    [a0, mid - half],
    [mid + half, a1],
  ];
  const thick = WALL_T;
  const h = y1 - y0;
  const cy = (y0 + y1) / 2;

  for (const [s0, s1] of segs) {
    const len = s1 - s0;
    if (len < 0.35) continue;
    const c = (s0 + s1) / 2;
    if (alongX) {
      A.addBox(key, BIG, c, cy, fixed, 0, len, h, thick);
      A.box('concrete', c, cy, fixed, len, h, thick);
    } else {
      A.addBox(key, BIG, fixed, cy, c, 0, thick, h, len);
      A.box('concrete', fixed, cy, c, thick, h, len);
    }
  }

  const lintH = Math.max(0.35, y1 - DOOR_H);
  if (lintH > 0.2 && y1 > DOOR_H) {
    const ly = DOOR_H + lintH / 2;
    if (alongX) {
      A.addBox(key, BIG, mid, ly, fixed, 0, DOOR_W + 0.3, lintH, thick + 0.05);
      A.box('concrete', mid, ly, fixed, DOOR_W + 0.3, lintH, thick + 0.05);
    } else {
      A.addBox(key, BIG, fixed, ly, mid, 0, thick + 0.05, lintH, DOOR_W + 0.3);
      A.box('concrete', fixed, ly, mid, thick + 0.05, lintH, DOOR_W + 0.3);
    }
  }

  for (const side of [-1, 1]) {
    const p = mid + side * (half + 0.12);
    if (alongX) {
      A.addBox('plaster_white', BIG, p, DOOR_H / 2, fixed, 0, 0.24, DOOR_H, thick + 0.08);
      A.box('concrete', p, DOOR_H / 2, fixed, 0.24, DOOR_H, thick + 0.08);
    } else {
      A.addBox('plaster_white', BIG, fixed, DOOR_H / 2, p, 0, thick + 0.08, DOOR_H, 0.24);
      A.box('concrete', fixed, DOOR_H / 2, p, thick + 0.08, DOOR_H, 0.24);
    }
  }
}

function buildShell(A, BIG, THIN, b) {
  const { x0, x1, z0, z1, h, key } = b;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;

  A.addBox('floor_concrete', BIG, cx, 0.04, cz, 0, w - WALL_T * 2, 0.08, d - WALL_T * 2);
  A.box('concrete', cx, 0.04, cz, w - WALL_T * 2, 0.08, d - WALL_T * 2);

  wallWithDoor(A, BIG, key, true, z0 + WALL_T / 2, x0, x1, 0, h);
  wallWithDoor(A, BIG, key, true, z1 - WALL_T / 2, x0, x1, 0, h);
  wallWithDoor(A, BIG, key, false, x0 + WALL_T / 2, z0, z1, 0, h);
  wallWithDoor(A, BIG, key, false, x1 - WALL_T / 2, z0, z1, 0, h);

  A.addBox(key === 'plaster_pink' ? 'plaster_cream' : 'plaster_white', BIG, cx, h + 0.12, cz, 0, w + 0.2, 0.28, d + 0.2);

  for (const { nx, nz, fixed, alongX, a0, a1 } of [
    { nx: 0, nz: -1, fixed: z0, alongX: true, a0: x0, a1: x1 },
    { nx: 0, nz: 1, fixed: z1, alongX: true, a0: x0, a1: x1 },
    { nx: -1, nz: 0, fixed: x0, alongX: false, a0: z0, a1: z1 },
    { nx: 1, nz: 0, fixed: x1, alongX: false, a0: z0, a1: z1 },
  ]) {
    for (let pos = a0 + 2.0; pos < a1 - 1.5; pos += 3.2) {
      if (Math.abs(pos - (a0 + a1) / 2) < DOOR_W / 2 + 0.4) continue;
      const r = hs(b.n * 7.3 + pos);
      const y = 1.3;
      if (alongX) {
        A.addBox(SHUTTER[Math.floor(r * 3) % 3], THIN, pos, y, fixed + nz * 0.08, 0, 1.6, 2.0, 0.1);
        A.addBox(AWNING[Math.floor(r * 5) % 3], THIN, pos, 2.85, fixed + nz * 0.7, 0, 2.2, 0.08, 1.2);
      } else {
        A.addBox(SHUTTER[Math.floor(r * 3) % 3], THIN, fixed + nx * 0.08, y, pos, 0, 0.1, 2.0, 1.6);
        A.addBox(AWNING[Math.floor(r * 5) % 3], THIN, fixed + nx * 0.7, 2.85, pos, 0, 1.2, 0.08, 2.2);
      }
    }
  }

  if (hs(b.n * 3.1) > 0.5 && w > 9 && d > 9) {
    A.addBox('plaster_cream', THIN, cx, h + 2.2, cz, 0, 2.2, 0.18, 2.2);
    A.addBox('plaster_white', BIG, cx, h + 2.6, cz, 0, 1.2, 0.5, 1.2);
  }
}

function crateCluster(A, BOXG, x, z, n) {
  if (inBlockFootprint(x, z, 1.2)) return;
  const k1 = n % 2 ? 'metal_rust' : 'brick';
  const k2 = n % 2 ? 'brick' : 'metal_rust';
  A.addBox(k1, BOXG, x, 0.45, z, hs(n) * 0.6, 1.1, 0.9, 1.1);
  A.box(A.surfaceOf(k1), x, 0.45, z, 1.1, 0.9, 1.1, hs(n) * 0.6);
  A.addBox(k2, BOXG, x + 1.15, 0.35, z + 0.25, 0, 0.9, 0.7, 0.9);
  A.box(A.surfaceOf(k2), x + 1.15, 0.35, z + 0.25, 0.9, 0.7, 0.9);
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

  for (const b of BLOCKS) buildShell(A, BIG, THIN, b);

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

  const clusters = [
    [-2.8, -21], [2.8, -24], [-2.8, 24], [2.8, 21],
    [-20, -1.5], [20, 1.5], [-26, 2], [26, -2],
    [9.5, -9.5], [-9.5, 9.5], [0, -18], [0, 18], [-12, 0], [12, 0],
  ];
  clusters.forEach(([x, z], i) => crateCluster(A, BIG, x, z, i));

  for (const [x, y, z] of [
    [0, 5.5, 0], [0, 4.5, -18], [0, 4.5, 18], [-18, 4.5, 0], [18, 4.5, 0],
    [-10, 4, -10], [10, 4, -10], [-10, 4, 10], [10, 4, 10], [14, 3.2, -2.5],
  ]) {
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
