/**
 * Bright-blue derelict train car on the open south street.
 * Hollow — walk in through side doors. Safe to skip if props missing.
 */
export function buildScrapTrain(A, BIG, THIN) {
  try {
    _buildScrapTrain(A, BIG, THIN);
  } catch (e) {
    console.warn('[gulabi] scrap train skipped:', e?.message || e);
  }
}

function _buildScrapTrain(A, BIG, THIN) {
  // Open N-S street (x~0 is never inside a shop block). Visible from spawn (0,-5).
  const cx = 0;
  const cz = -14;
  const yaw = 0;

  // One car only, stays inside |x| < 7 open corridor
  const L = 12.0;
  const W = 2.6;
  const floorY = 0.9;
  const roofY = 3.3;
  const wallT = 0.12;
  const doorW = 1.6;
  const doorH = 2.0;
  const doorCenters = [-3.5, 0, 3.5];

  const bodyKey = 'metal_blue';
  const darkKey = 'metal_dark';
  const accentKey = 'plaster_blue';
  const endH = roofY - floorY;
  const endCy = (floorY + roofY) / 2;

  const put = (id, x, y, z, ry = 0, s = 1) => {
    try {
      if (A.has && A.has(id)) A.put(id, x, y, z, ry, s);
    } catch { /* prop missing */ }
  };

  // Rail bed under the car (helps visibility)
  A.addBox('concrete', BIG, cx, 0.08, cz, yaw, L + 2, 0.12, W + 1.2);
  A.box('concrete', cx, 0.08, cz, L + 2, 0.12, W + 1.2);

  // Floor (walkable)
  A.addBox('floor_concrete', BIG, cx, floorY, cz, yaw, L - 0.15, 0.1, W - 0.2);
  A.box('concrete', cx, floorY, cz, L - 0.15, 0.1, W - 0.2);

  // Underframe
  A.addBox(darkKey, BIG, cx, 0.45, cz, yaw, L + 0.2, 0.5, W + 0.08);
  A.box('metal', cx, 0.45, cz, L + 0.2, 0.5, W + 0.08);

  // Bogies + wheels
  for (const bx of [-3.8, 3.8]) {
    A.addBox(darkKey, BIG, cx + bx, 0.3, cz, yaw, 2.0, 0.3, W + 0.12);
    A.box('metal', cx + bx, 0.3, cz, 2.0, 0.3, W + 0.12);
    for (const wx of [-0.55, 0.55]) {
      for (const wz of [-1.05, 1.05]) {
        A.addBox(darkKey, THIN, cx + bx + wx, 0.32, cz + wz, yaw, 0.5, 0.65, 0.16);
      }
    }
  }

  // Bright blue roof
  A.addBox(bodyKey, BIG, cx, roofY + 0.08, cz, yaw, L + 0.12, 0.18, W + 0.18);
  A.box('metal', cx, roofY + 0.08, cz, L + 0.12, 0.18, W + 0.18);
  // Pantograph stump
  A.addBox(darkKey, THIN, cx + 2.0, roofY + 0.65, cz, yaw, 0.1, 1.0, 0.1);
  A.addBox(darkKey, THIN, cx + 2.0, roofY + 1.15, cz + 0.35, yaw, 0.08, 0.08, 0.9);

  // End walls — west solid (cab), east open
  for (const side of [-1, 1]) {
    const ex = cx + side * (L / 2 - wallT / 2);
    if (side === -1) {
      A.addBox(accentKey, BIG, ex, endCy, cz, yaw, wallT, endH, W);
      A.box('metal', ex, endCy, cz, wallT, endH, W);
      A.addBox(darkKey, THIN, ex + 0.08, floorY + 1.4, cz - 0.65, yaw, 0.1, 0.3, 0.4);
      A.addBox(darkKey, THIN, ex + 0.08, floorY + 1.4, cz + 0.65, yaw, 0.1, 0.3, 0.4);
    } else {
      const gap = 1.5;
      for (const sz of [-1, 1]) {
        const zw = (W - gap) / 4 + gap / 2;
        A.addBox(bodyKey, BIG, ex, endCy, cz + sz * (gap / 2 + zw / 2), yaw, wallT, endH, zw);
        A.box('metal', ex, endCy, cz + sz * (gap / 2 + zw / 2), wallT, endH, zw);
      }
      A.addBox(bodyKey, BIG, ex, roofY - 0.2, cz, yaw, wallT, 0.45, W);
      A.box('metal', ex, roofY - 0.2, cz, wallT, 0.45, W);
    }
  }

  // Long blue side walls with door openings
  for (const sz of [-1, 1]) {
    const zWall = cz + sz * (W / 2 - wallT / 2);
    const edges = [-L / 2 + 0.12];
    for (const d of doorCenters) {
      edges.push(d - doorW / 2);
      edges.push(d + doorW / 2);
    }
    edges.push(L / 2 - 0.12);
    for (let i = 0; i < edges.length - 1; i += 2) {
      const a0 = edges[i];
      const a1 = edges[i + 1];
      const len = a1 - a0;
      if (len < 0.25) continue;
      const mx = cx + (a0 + a1) / 2;
      A.addBox(bodyKey, BIG, mx, endCy, zWall, yaw, len, endH, wallT);
      A.box('metal', mx, endCy, zWall, len, endH, wallT);
    }
    for (const d of doorCenters) {
      const ly = floorY + doorH + (roofY - floorY - doorH) / 2;
      const lh = Math.max(0.3, roofY - floorY - doorH);
      A.addBox(bodyKey, BIG, cx + d, ly, zWall, yaw, doorW + 0.15, lh, wallT + 0.03);
      A.box('metal', cx + d, ly, zWall, doorW + 0.15, lh, wallT + 0.03);
      // hanging door leaf
      if (sz === -1) {
        A.addBox(darkKey, THIN, cx + d - doorW * 0.3, floorY + doorH / 2, zWall + sz * 0.07, yaw, 0.5, doorH - 0.1, 0.05);
      }
    }
    // window strips
    for (let i = 0; i < doorCenters.length - 1; i++) {
      const mid = (doorCenters[i] + doorCenters[i + 1]) / 2;
      A.addBox(darkKey, THIN, cx + mid, floorY + 1.7, zWall + sz * 0.02, yaw, 1.4, 0.65, 0.05);
    }
  }

  // Interior scrap
  put('crate_a', cx - 3.0, floorY + 0.05, cz + 0.35, 0.2, 0.9);
  put('barrel_rust', cx + 1.0, floorY + 0.05, cz + 0.5, 0.4, 1);
  put('jerry_can', cx + 2.5, floorY + 0.05, cz - 0.5, 0.8, 1);
  put('sandbag_a', cx - 0.5, floorY + 0.05, cz - 0.6, 0.3, 1);
  A.addBox('wood', BIG, cx - 1.2, floorY + 0.25, cz + 0.8, yaw, 2.8, 0.4, 0.35);
  A.box('wood', cx - 1.2, floorY + 0.25, cz + 0.8, 2.8, 0.4, 0.35);

  console.info('[gulabi] blue scrap train at', cx, cz);
}
