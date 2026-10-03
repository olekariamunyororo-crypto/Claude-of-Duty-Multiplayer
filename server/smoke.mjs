import * as THREE from 'three';
import { Registry, EventBus } from '../src/core/registry.js';
import { createConfig } from '../src/core/config.js';
import { Rng } from '../src/core/rng.js';
import { PhysicsSystem } from '../src/physics/index.js';
import { WorldSystem } from '../src/world/index.js';

class Mats {
  static id = 'materials'; static deps = [];
  init() {}
  get(name) { return new THREE.MeshBasicMaterial(); }
  setGroundLevel() {}
}

const registry = new Registry();
const config = createConfig({ quality: 'low', deterministic: true, mobile: false });
const ctx = {
  scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
  viewScene: new THREE.Scene(), viewCamera: new THREE.PerspectiveCamera(),
  canvas: null, config, events: new EventBus(), input: null,
  time: { elapsed: 0, raw: 0, dt: 0, fixed: 1 / 120, alpha: 0, scale: 1, frame: 0 },
  rng: new Rng(0x5eed1234),
  get: (id) => registry.get(id), peek: (id) => registry.peek(id), has: (id) => registry.has(id),
};
registry.add(new PhysicsSystem()).add(new Mats()).add(new WorldSystem());
const t0 = Date.now();
for (const s of registry.resolve()) await s.init?.(ctx);
console.log('init ms', Date.now() - t0);
const hit = registry.get('physics').raycast(0, 50, 0, 0, -1, 0, 200);
console.log('ground ray:', JSON.stringify(hit));
