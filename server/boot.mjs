import * as THREE from 'three';
import { Registry, EventBus } from '../src/core/registry.js';
import { createConfig } from '../src/core/config.js';
import { Rng } from '../src/core/rng.js';
import { PhysicsSystem } from '../src/physics/index.js';
import { WorldSystem } from '../src/world/index.js';
class Mats { static id='materials'; static deps=[]; init(){} get(){return new THREE.MeshBasicMaterial()} setGroundLevel(){} }
export async function boot(seed) {
  const registry = new Registry();
  const ctx = {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(),
    viewScene: new THREE.Scene(), viewCamera: new THREE.PerspectiveCamera(),
    canvas: null, config: createConfig({ quality: process.env.Q || 'low', deterministic: false, mobile: false }),
    events: new EventBus(), input: null,
    time: { elapsed: 0, raw: 0, dt: 0, fixed: 1/120, alpha: 0, scale: 1, frame: 0 },
    rng: new Rng(seed),
    get: (i) => registry.get(i), peek: (i) => registry.peek(i), has: (i) => registry.has(i),
  };
  registry.add(new PhysicsSystem()).add(new Mats()).add(new WorldSystem());
  for (const s of registry.resolve()) await s.init?.(ctx);
  return { ctx, physics: registry.get('physics') };
}
