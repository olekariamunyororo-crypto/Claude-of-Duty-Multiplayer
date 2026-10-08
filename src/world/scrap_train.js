/**
 * Passenger coach parked on the open south street (broad-gauge, ICF-style):
 * blue body with cream stripes, barred side windows, vestibule doors with
 * steps and grab rails, curved roof with vents, two-axle bogies on real rails,
 * buffers and couplers, seated interior. Hollow: walk in through the side doors
 * or the open east gangway. Skipped safely if anything throws.
 *
 * Local frame: u = along the coach (world X), z = across, y = up.
 * Footprint is unchanged from the old derelict car (x +-6.6, z +-1.9 at z=-14).
 */
import * as THREE from 'three';
import { newTrs } from './util.js';

export function buildScrapTrain(A, BIG, THIN) {
  try {
    _buildCoach(A, BIG, THIN);
  } catch (e) {
    console.warn('[gulabi] train coach skipped:', e?.message || e);
  }
}

function _buildCoach(A, BIG, THIN) {
  const cx = 0;
  const cz = -14;

  const L = 12.0;
  const W = 2.6;
  const hw = W / 2;
  const RT = 0.16; // rail head height
  const FT = 1.01; // floor top
  const WALL_TOP = FT + 2.2;
  const APEX = WALL_TOP + 0.28;
  const SILL = FT + 0.85;
  const WIN_TOP = FT + 1.85;
  const DOOR_TOP = FT + 2.0;
  const SKIRT = 0.8;
  const DOOR_U = [-4.7, 4.7];
  const DOOR_W = 1.2;
  const WIN_U = [-3.25, -1.95, -0.65, 0.65, 1.95, 3.25];
  const WIN_W = 0.95;
  const WR = 0.38; // wheel radius

  const CYL = A.cache('coach:cyl', () => new THREE.CylinderGeometry(1, 1, 1, 18, 1));

  // ---- helpers (u,y,z are coach-local; cx/cz applied here) ----
  const box = (key, u, y, z, sx, sy, sz, surf = null) => {
    A.addBox(key, BIG, cx + u, y, cz + z, 0, sx, sy, sz);
    if (surf) A.box(surf, cx + u, y, cz + z, sx, sy, sz);
  };
  const thin = (key, u, y, z, sx, sy, sz) => A.addBox(key, THIN, cx + u, y, cz + z, 0, sx, sy, sz);
  const cylX = (key, u, y, z, r, len) => A.add(key, CYL, newTrs(cx + u, y, cz + z, 0, r, len, r, 0, Math.PI / 2));
  const cylZ = (key, u, y, z, r, len) => A.add(key, CYL, newTrs(cx + u, y, cz + z, 0, r, len, r, Math.PI / 2, 0));
  const cylY = (key, u, y, z, r, h) => A.add(key, CYL, newTrs(cx + u, y, cz + z, 0, r, h, r));

  // ---- track: ballast, sleepers, rails ----
  box('gravel', 0, 0.025, 0, L + 1.4, 0.05, W + 1.0, 'dirt');
  for (let u = -6.2; u <= 6.21; u += 0.62) thin('wood_dark', u, 0.075, 0, 0.24, 0.05, 2.3);
  for (const z of [-0.84, 0.84]) thin('steel', 0, 0.13, z, L + 1.0, 0.06, 0.08);

  // ---- bogies ----
  for (const bu of [-4.1, 4.1]) {
    for (const z of [-0.62, 0.62]) box('metal_dark', bu, 0.76, z, 2.6, 0.16, 0.12);
    box('metal_dark', bu, 0.78, 0, 0.3, 0.14, 1.3);
    for (const wu of [-1.05, 1.05]) {
      cylZ('steel', bu + wu, RT + WR, 0, 0.055, 1.9);
      for (const z of [-0.84, 0.84]) {
        cylZ('metal_dark', bu + wu, RT + WR, z, WR, 0.1);
        cylZ('steel', bu + wu, RT + WR, z + Math.sign(z) * 0.03, 0.13, 0.14);
      }
      for (const z of [-0.62, 0.62]) {
        box('metal_dark', bu + wu, 0.6, z, 0.22, 0.2, 0.16);
        cylY('steel', bu + wu, 0.72, z * 1.0, 0.07, 0.2);
      }
    }
  }

  // ---- underframe + equipment ----
  for (const z of [-0.75, 0.75]) box('metal_dark', 0, 0.86, z, L - 0.1, 0.14, 0.1);
  box('metal_dark', 0, 0.85, 0, L - 0.1, 0.12, 0.2);
  box('metal_dark', -1.7, 0.6, -0.55, 1.5, 0.36, 0.5);
  box('metal_dark', 1.9, 0.6, -0.55, 1.1, 0.36, 0.5);
  cylX('steel', 0.4, 0.64, 0.5, 0.26, 2.4);
  cylX('metal_dark', -1.9, 0.64, 0.45, 0.17, 0.8);
  cylX('steel', 0, 0.5, 0.1, 0.03, L - 3.4);
  A.box('metal', cx, (RT + 0.91) / 2, cz, L - 0.1, 0.91 - RT, 1.9);

  // ---- floor ----
  box('wood_dark', 0, FT - 0.05, 0, L - 0.1, 0.1, W - 0.1, 'metal');
  thin('rubber', 0, FT + 0.004, 0, L - 1.2, 0.008, 0.8);

  // ---- side walls (blue outside, cream lining inside, real openings) ----
  const seg = (sz, u0, u1, y0, y1) => {
    const len = u1 - u0;
    const h = y1 - y0;
    if (len < 0.02 || h < 0.02) return;
    const um = (u0 + u1) / 2;
    const ym = (y0 + y1) / 2;
    box('coach_blue', um, ym, sz * (hw - 0.05), len, h, 0.1);
    box('coach_cream', um, ym, sz * (hw - 0.12), len, h, 0.04);
    A.box('metal', cx + um, ym, cz + sz * (hw - 0.08), len, h, 0.16);
  };
  const winEdges = [-4.1];
  for (const u of WIN_U) winEdges.push(u - WIN_W / 2, u + WIN_W / 2);
  winEdges.push(4.1);

  for (const sz of [-1, 1]) {
    seg(sz, -L / 2, -5.3, SKIRT, WALL_TOP);
    seg(sz, 5.3, L / 2, SKIRT, WALL_TOP);
    for (const du of DOOR_U) {
      seg(sz, du - DOOR_W / 2, du + DOOR_W / 2, SKIRT, FT - 0.1);
      seg(sz, du - DOOR_W / 2, du + DOOR_W / 2, DOOR_TOP, WALL_TOP);
    }
    seg(sz, -4.1, 4.1, SKIRT, SILL);
    seg(sz, -4.1, 4.1, WIN_TOP, WALL_TOP);
    for (let i = 0; i < winEdges.length; i += 2) seg(sz, winEdges[i], winEdges[i + 1], SILL, WIN_TOP);

    // cream livery stripes
    for (const [a, b] of [[-L / 2, -5.3], [-4.1, 4.1], [5.3, L / 2]]) {
      thin('coach_cream', (a + b) / 2, 1.74, sz * (hw + 0.006), b - a, 0.08, 0.012);
      thin('coach_cream', (a + b) / 2, 2.93, sz * (hw + 0.006), b - a, 0.08, 0.012);
    }

    // windows: glass, frame, bars
    const wy = (SILL + WIN_TOP) / 2;
    const wh = WIN_TOP - SILL;
    for (const u of WIN_U) {
      thin('window_glass', u, wy, sz * (hw - 0.06), WIN_W, wh, 0.012);
      for (const s of [-1, 1]) thin('steel', u + s * (WIN_W / 2 + 0.02), wy, sz * (hw + 0.008), 0.04, wh + 0.08, 0.03);
      thin('steel', u, SILL - 0.02, sz * (hw + 0.008), WIN_W + 0.08, 0.04, 0.03);
      thin('steel', u, WIN_TOP + 0.02, sz * (hw + 0.008), WIN_W + 0.08, 0.04, 0.03);
      for (const k of [-0.28, 0, 0.28]) thin('metal_dark', u + k, wy, sz * (hw + 0.002), 0.025, wh, 0.02);
    }

    // doors: opened leaf, frame, grab rails, steps
    for (const du of DOOR_U) {
      const dir = Math.sign(du);
      const lu = du + dir * 0.95;
      thin('coach_blue', lu, FT + 1.0, sz * (hw + 0.045), 0.6, 2.0, 0.05);
      thin('metal_dark', lu, FT + 1.45, sz * (hw + 0.075), 0.3, 0.4, 0.02);
      thin('steel', du + dir * 0.62, FT + 1.0, sz * (hw + 0.045), 0.04, 2.0, 0.07);
      for (const s of [-1, 1]) {
        thin('steel', du + s * 0.62, FT + 1.0, sz * hw, 0.04, 2.0, 0.14);
        thin('steel', du + s * 0.7, 1.5, sz * (hw + 0.1), 0.035, 1.6, 0.035);
      }
      box('steel', du, FT - 0.005, sz * hw, DOOR_W, 0.03, 0.24);
      box('steel', du, 0.68 - 0.03, sz * (hw + 0.14), 1.0, 0.06, 0.28, 'metal');
      box('steel', du, 0.35 - 0.03, sz * (hw + 0.42), 1.0, 0.06, 0.28, 'metal');
      for (const s of [-1, 1]) thin('metal_dark', du + s * 0.5, 0.36, sz * (hw + 0.28), 0.04, 0.72, 0.6);
    }
  }

  // ---- end walls ----
  const endWall = (e, sz0, sz1) => {
    // full-height end panel between z=sz0..sz1
    const zc = (sz0 + sz1) / 2;
    const zw = sz1 - sz0;
    box('coach_blue', e * (L / 2 - 0.06), (SKIRT + WALL_TOP) / 2, zc, 0.1, WALL_TOP - SKIRT, zw);
    box('coach_cream', e * (L / 2 - 0.13), (SKIRT + WALL_TOP) / 2, zc, 0.04, WALL_TOP - SKIRT, zw);
    A.box('metal', cx + e * (L / 2 - 0.09), (SKIRT + WALL_TOP) / 2, cz + zc, 0.16, WALL_TOP - SKIRT, zw);
  };
  // west: closed, with vestibule door panel
  endWall(-1, -hw, hw);
  thin('metal_dark', -L / 2 - 0.005, FT + 1.0, 0, 0.02, 2.0, 0.9);
  thin('metal_dark', -L / 2 - 0.012, FT + 1.55, 0, 0.02, 0.4, 0.4);
  // east: open doorway 1.0 wide
  endWall(1, 0.5, hw);
  endWall(1, -hw, -0.5);
  {
    const u = L / 2 - 0.09;
    const y0 = DOOR_TOP;
    box('coach_blue', L / 2 - 0.06, (y0 + WALL_TOP) / 2, 0, 0.1, WALL_TOP - y0, 1.0);
    A.box('metal', cx + u, (y0 + WALL_TOP) / 2, cz, 0.16, WALL_TOP - y0, 1.0);
  }
  // rubber gangway frames
  for (const e of [-1, 1]) {
    const gu = e * (L / 2 + 0.2);
    for (const z of [-0.6, 0.6]) box('rubber', gu, FT + 1.05, z, 0.4, 2.2, 0.14);
    box('rubber', gu, FT + 2.1, 0, 0.4, 0.14, 1.34);
    box('rubber', gu, FT + 0.04, 0, 0.4, 0.08, 1.34);
  }

  // ---- buffers + couplers ----
  for (const e of [-1, 1]) {
    box('metal_dark', e * (L / 2 + 0.06), 0.82, 0, 0.14, 0.22, 2.3);
    for (const z of [-0.88, 0.88]) {
      cylX('coach_red', e * (L / 2 + 0.25), 0.82, z, 0.11, 0.26);
      cylX('steel', e * (L / 2 + 0.4), 0.82, z, 0.17, 0.05);
    }
    box('metal_dark', e * (L / 2 + 0.35), 0.78, 0, 0.5, 0.1, 0.14);
    box('metal_dark', e * (L / 2 + 0.6), 0.78, 0, 0.12, 0.18, 0.22);
  }

  // ---- roof: faceted arch, vents, gutters ----
  const SIDE_A = 0.38;
  const SIDE_S = 0.755;
  box('coach_roof', 0, APEX - 0.035, 0, L + 0.1, 0.07, 1.24);
  for (const sz of [-1, 1]) {
    A.add('coach_roof', BIG, newTrs(cx, APEX - 0.14 - 0.035, cz + sz * 0.97, 0, L + 0.1, 0.07, SIDE_S, sz * SIDE_A, 0));
    thin('steel', 0, WALL_TOP + 0.02, sz * (hw + 0.01), L + 0.1, 0.04, 0.04);
  }
  A.box('metal', cx, (WALL_TOP + APEX) / 2, cz, L + 0.1, APEX - WALL_TOP, W);
  for (const u of [-4.2, -2.1, 0, 2.1, 4.2]) {
    cylY('steel', u, APEX + 0.08, 0, 0.14, 0.16);
    cylY('coach_roof', u, APEX + 0.19, 0, 0.09, 0.06);
  }

  // ---- interior: ceiling, lights, seats ----
  box('coach_cream', 0, WALL_TOP - 0.03, 0, L - 0.2, 0.04, W - 0.3);
  for (const u of [-4.7, -3.3, 0, 3.3, 4.7]) thin('window_glow', u, WALL_TOP - 0.06, 0, 0.7, 0.02, 0.16);
  for (const sz of [-1, 1]) {
    const fab = sz > 0 ? 'fabric_teal' : 'fabric_red';
    for (const u of WIN_U) {
      box('metal_dark', u, FT + 0.2, sz * 0.88, 0.9, 0.4, 0.46, 'wood');
      box(fab, u, FT + 0.45, sz * 0.88, 0.95, 0.1, 0.52);
      box(fab, u, FT + 0.68, sz * (hw - 0.19), 0.95, 0.44, 0.1);
    }
  }

  console.info('[gulabi] passenger coach at', cx, cz);
}
