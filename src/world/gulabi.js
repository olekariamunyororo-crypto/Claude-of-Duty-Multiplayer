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
  [0, 0, Math.PI, 'chowk centre'],
  [0, -12, face(0, -12), 'north street'],
  [0, 12, face(0, 12), 'south street'],
  [-12, 0, face(-12, 0), 'west lane'],
  [12, 0, face(12, 0), 'east lane'],
  [0, -8, face(0, -8), 'chowk north'],
  [0, 8, face(0, 8), 'chowk south'],
  [8, 0, face(8, 0), 'chowk east'],
  [-8, 0, face(-8, 0), 'chowk west'],
  [4, -10, face(4, -10), 'north mid'],
  [-4, 10, face(-4, 10), 'south mid'],
  [10, 4, face(10, 4), 'east mid'],
];

export function gulabiGroundY(_x, _z) {
  return 0;
}

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

function dressShop(A, b, rng) {
  const { x0, x1, z0, z1, n } = b;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const m = WALL_T + 0.55;
  const ix0 = x0 + m, ix1 = x1 - m, iz0 = z0 + m, iz1 = z1 - m;
  if (ix1 - ix0 < 2.2 || iz1 - iz0 < 2.2) return;

  const put = (id, x, y, z, ry = 0, s = 1) => {
    if (A.has(id)) A.put(id, x, y, z, ry, s);
  };

  const alongX = w >= d;
  if (alongX) {
    for (const [zz, ry] of [[iz0 + 0.15, 0], [iz1 - 0.15, Math.PI]]) {
      for (const x of [ix0 + 0.8, cx, ix1 - 0.8]) {
        if (x < ix0 + 0.4 || x > ix1 - 0.4) continue;
        put('shelf', x, 0, zz, ry + Math.PI / 2, rng.range(0.9, 1.1));
        A.box('wood', x, 0.95, zz, 1.05, 1.85, 0.38, ry + Math.PI / 2);
        put('box_card_a', x + rng.range(-0.25, 0.25), 0, zz + (ry === 0 ? 0.55 : -0.55), rng.range(0, 0.4), rng.range(0.85, 1.05));
        put('bottle', x + rng.range(-0.3, 0.3), 1.55, zz + (ry === 0 ? 0.2 : -0.2), rng.range(0, 6), 1);
        put('can', x + rng.range(-0.2, 0.2), 1.55, zz + (ry === 0 ? 0.25 : -0.25), rng.range(0, 6), 1);
      }
    }
  } else {
    for (const [xx, ry] of [[ix0 + 0.15, Math.PI / 2], [ix1 - 0.15, -Math.PI / 2]]) {
      for (const z of [iz0 + 0.8, cz, iz1 - 0.8]) {
        if (z < iz0 + 0.4 || z > iz1 - 0.4) continue;
        put('shelf', xx, 0, z, ry + Math.PI / 2, rng.range(0.9, 1.1));
        A.box('wood', xx, 0.95, z, 0.38, 1.85, 1.05, ry + Math.PI / 2);
        put('box_card_b', xx + (ry > 0 ? 0.55 : -0.55), 0, z + rng.range(-0.2, 0.2), rng.range(0, 0.5), rng.range(0.85, 1.05));
        put('bottle', xx + (ry > 0 ? 0.2 : -0.2), 1.55, z, rng.range(0, 6), 1);
      }
    }
  }

  if (Math.abs(cx) > Math.abs(cz)) {
    const side = cx > 0 ? -1 : 1;
    const tx = cx + side * (w * 0.15);
    put('table_small', tx, 0, cz, Math.PI / 2, 1);
    A.box('wood', tx, 0.36, cz, 0.7, 0.72, 0.9);
    put('chair', tx + side * 0.75, 0, cz - 0.45, Math.PI / 2);
    put('chair', tx + side * 0.75, 0, cz + 0.45, Math.PI / 2);
    put('cabinet', cx - side * (w * 0.28), 0, iz0 + 0.5, 0, 1);
    A.box('wood', cx - side * (w * 0.28), 0.55, iz0 + 0.5, 0.85, 1.1, 0.42);
  } else {
    const side = cz > 0 ? -1 : 1;
    const tz = cz + side * (d * 0.15);
    put('table_small', cx, 0, tz, 0, 1);
    A.box('wood', cx, 0.36, tz, 0.9, 0.72, 0.7);
    put('chair', cx - 0.45, 0, tz + side * 0.75, side > 0 ? Math.PI : 0);
    put('chair', cx + 0.45, 0, tz + side * 0.75, side > 0 ? Math.PI : 0);
    put('cabinet', ix0 + 0.5, 0, cz - side * (d * 0.28), Math.PI / 2, 1);
    A.box('wood', ix0 + 0.5, 0.55, cz - side * (d * 0.28), 0.42, 1.1, 0.85);
  }

  const floorN = 4 + (n % 4);
  for (let i = 0; i < floorN; i++) {
    const x = rng.range(ix0 + 0.6, ix1 - 0.6);
    const z = rng.range(iz0 + 0.6, iz1 - 0.6);
    if (Math.abs(x - cx) < 0.9 && Math.abs(z - cz) < 0.9) continue;
    const roll = hs(n * 11.3 + i * 3.7);
    if (roll < 0.28) {
      const id = roll < 0.14 ? 'crate_a' : 'crate_c';
      put(id, x, 0, z, rng.range(0, 0.5), rng.range(0.9, 1.1));
      A.box('wood', x, 0.4, z, 0.9, 0.8, 0.9);
    } else if (roll < 0.45) {
      const id = hs(i + n) < 0.5 ? 'box_card_a' : 'box_card_b';
      put(id, x, 0, z, rng.range(0, Math.PI), rng.range(0.85, 1.15));
    } else if (roll < 0.6) {
      const id = hs(i * 2.1 + n) < 0.5 ? 'barrel_rust' : 'barrel_blue';
      put(id, x, 0, z, rng.range(0, Math.PI), 1);
      A.box('metal', x, 0.45, z, 0.55, 0.9, 0.55);
    } else if (roll < 0.72) {
      put('pallet', x, 0, z, rng.range(0, Math.PI / 2), 1);
      put('crate_flat', x, 0.12, z, rng.range(0, 0.3), 1);
    } else if (roll < 0.85) {
      put('jerry_can', x, 0, z, rng.range(0, Math.PI), 1);
      put('bucket', x + 0.4, 0, z, rng.range(0, 1), 1);
    } else {
      put('sandbag_a', x, 0, z, rng.range(0, Math.PI), 1);
      put('gas_bottle', x + 0.35, 0, z, rng.range(0, 1), 1);
    }
  }

  for (let i = 0; i < 5; i++) {
    const x = rng.range(ix0 + 0.4, ix1 - 0.4);
    const z = rng.range(iz0 + 0.4, iz1 - 0.4);
    const r = hs(n * 5.1 + i * 9.3);
    if (r < 0.4) put('bottle', x, 0, z, rng.range(0, 6), 1);
    else if (r < 0.7) put('can', x, 0, z, rng.range(0, 6), 1);
    else put('litter', x, 0.01, z, rng.range(0, 6), 1);
  }

  if (w > 10 && d > 8) {
    put('cabinet', ix1 - 0.55, 0, iz1 - 0.7, Math.PI, 1);
    A.box('wood', ix1 - 0.55, 0.55, iz1 - 0.7, 0.85, 1.1, 0.42);
    if (hs(n + 2.2) > 0.55) put('mattress', cx + rng.range(-1, 1), 0, cz + rng.range(-1, 1), rng.range(0, 1), 1);
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

  for (const b of BLOCKS) {
    buildShell(A, BIG, THIN, b);
    dressShop(A, b, rng);
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
      if (A.has('crate_a')) A.put('crate_a', x - 0.6, 1.0, z, 0.1, 0.85);
      if (A.has('box_card_a')) A.put('box_card_a', x + 0.5, 1.0, z, 0.2, 0.9);
      if (A.has('bucket')) A.put('bucket', x + 0.9, 1.0, z - 0.3, 0.4, 1);
      if (A.has('bottle')) {
        A.put('bottle', x - 0.2, 1.05, z + 0.3, 0, 1);
        A.put('bottle', x + 0.1, 1.05, z + 0.35, 1.2, 1);
      }
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
