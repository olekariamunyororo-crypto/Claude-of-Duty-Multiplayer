import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const from = (...parts) => path.join(root, ...parts);
const to = (...parts) => path.join(dist, ...parts);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const name of ['src', 'assets', 'style.css']) {
  fs.cpSync(from(name), to(name), { recursive: true });
}

const html = fs.readFileSync(from('index.html'), 'utf8')
  .replace('./node_modules/three/build/three.module.js', './vendor/three.module.js')
  .replace('./node_modules/three/examples/jsm/', './vendor/addons/');
fs.writeFileSync(to('index.html'), html);

const vendor = [
  ['node_modules/three/build/three.module.js', 'vendor/three.module.js'],
  ['node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', 'vendor/addons/utils/BufferGeometryUtils.js'],
  ['node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js', 'vendor/addons/geometries/RoundedBoxGeometry.js'],
];
for (const [source, target] of vendor) {
  fs.mkdirSync(path.dirname(to(target)), { recursive: true });
  fs.copyFileSync(from(source), to(target));
}
console.log(`Built static site at ${dist}`);
