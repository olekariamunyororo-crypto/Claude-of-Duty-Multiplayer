import { boot } from './boot.mjs';
const { physics } = await boot(Number(process.argv[2]) || 1);
let h = 0;
for (let x = -60; x <= 60; x += 5) for (let z = -60; z <= 60; z += 5) {
  const r = physics.raycast(x, 50, z, 0, -1, 0, 200);
  h = (h * 31 + Math.round((r.hit ? r.distance : -1) * 100)) | 0;
}
console.log('HASH', h);
