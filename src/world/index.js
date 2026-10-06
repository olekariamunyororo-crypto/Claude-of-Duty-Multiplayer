import * as THREE from 'three';
import { Assembler } from './builder.js';
import { BUILDINGS, STREET, SET_PIECES, GATE } from './layout.js';
import { buildGround } from './ground.js';
import { buildBuilding, collapseRoof } from './buildings.js';
import { registerProps } from './props.js';
import {
  registerDressingProps,
  dressStreet,
  dressBuildings,
  scatterDebris,
  buildGate,
  buildPerimeter,
  groundY,
  isOpen,
} from './dressing.js';
import { buildFactory, factoryGroundY, factoryIsOpen } from './factory.js';
import { buildGulabi, gulabiGroundY, gulabiIsOpen } from './gulabi.js';

/**
 * WORLD — level geometry, modular kit, props, dressing, collision.
 * Maps: gulabi (default), factory, city. ?map=gulabi|factory|city
 */

const LEVEL_YAW = 0.5877;
const LEVEL_TX = 0.9;
const LEVEL_TZ = 1.34;
const FACTORY_YAW = 0;
const FACTORY_TX = 0;
const FACTORY_TZ = 0;
const LIGHT_SLOTS = 20;

const CITY_SPAWNS = [
  [0.4, 22.5, Math.PI, 'north street'],
  [-2.4, 30.0, Math.PI, 'north plaza'],
  [3.6, 5.0, Math.PI, 'market'],
  [-3.4, -12.0, 0, 'mid street'],
  [2.6, -32.0, 0, 'south street'],
  [-1.0, -39.0, 0, 'gate'],
  [10.5, 4.6, -Math.PI / 2, 'east alley'],
  [-9.0, -10.2, Math.PI / 2, 'west alley'],
];

function resolveMap() {
  try {
    const p = new URLSearchParams(location.search).get('map');
    if (p === 'city') return 'city';
    if (p === 'factory') return 'factory';
    if (p === 'gulabi' || p === 'pink' || p === 'jaipur') return 'gulabi';
  } catch { /* server / headless */ }
  return 'gulabi';
}

export class WorldSystem {
  static id = 'world';
  static deps = ['materials', 'physics'];

  async init(ctx) {
    this.ctx = ctx;
    this.rng = ctx.rng.fork();
    const rng = this.rng;
    const materials = ctx.get('materials');
    const physics = ctx.peek('physics');
    const render = ctx.peek('render');
    this.mapId = resolveMap();

    this.root = new THREE.Group();
    this.root.name = 'world';
    this.root.matrixAutoUpdate = false;
    ctx.scene.add(this.root);

    materials.setGroundLevel?.(0);

    const t0 = performance.now();
    const A = new Assembler({ materials, rng, render });
    this.A = A;

    if (this.mapId === 'factory') {
      A.setTransform(FACTORY_YAW, FACTORY_TX, FACTORY_TZ);
      registerProps(A, rng);
      const fac = buildFactory(A, rng);
      this._factoryFans = fac.fans;
      this._addLights(A);
      A.finalize(this.root, physics);
      A.releaseCache();

      this._v = new THREE.Vector3();
      this._inv = new THREE.Matrix4().copy(A.xform).invert();
      this.spawnPoints = fac.spawns.map(([x, z, yaw, tag]) => ({
        position: A.toWorld(x, 0, z),
        yaw: yaw + FACTORY_YAW,
        tag,
      }));
      this.bounds = new THREE.Box3(
        new THREE.Vector3(fac.bounds.minX, -2, fac.bounds.minZ),
        new THREE.Vector3(fac.bounds.maxX, 12, fac.bounds.maxZ)
      ).applyMatrix4(A.xform);
      this._groundY = factoryGroundY;
      this._isOpen = factoryIsOpen;
    } else if (this.mapId === 'gulabi') {
      A.setTransform(0, 0, 0);
      registerProps(A, rng);
      const gul = buildGulabi(A, rng);
      this._factoryFans = gul.fans;
      this._addLights(A);
      A.finalize(this.root, physics);
      A.releaseCache();

      this._v = new THREE.Vector3();
      this._inv = new THREE.Matrix4().copy(A.xform).invert();
      this.spawnPoints = gul.spawns.map(([x, z, yaw, tag]) => ({
        position: A.toWorld(x, 0, z),
        yaw,
        tag,
      }));
      this.bounds = new THREE.Box3(
        new THREE.Vector3(gul.bounds.minX, -2, gul.bounds.minZ),
        new THREE.Vector3(gul.bounds.maxX, 12, gul.bounds.maxZ)
      ).applyMatrix4(A.xform);
      this._groundY = gulabiGroundY;
      this._isOpen = gulabiIsOpen;
    } else {
      A.setTransform(LEVEL_YAW, LEVEL_TX, LEVEL_TZ);
      registerProps(A, rng);
      registerDressingProps(A, rng);
      buildGround(A, rng);

      const infos = [];
      for (const spec of BUILDINGS) {
        const info = buildBuilding(A, rng, spec);
        infos.push(info);
        if (spec.collapse) {
          collapseRoof(A, rng, spec, info, {
            x: spec.x + rng.range(-2, 2),
            z: spec.z + rng.range(-2, 2),
          });
        }
      }
      this.buildings = infos;

      buildGate(A, rng);
      buildPerimeter(A, rng);
      dressStreet(A, rng);
      dressBuildings(A, rng, infos);
      scatterDebris(A, rng);

      this._addLights(A);
      A.finalize(this.root, physics);
      A.releaseCache();

      this._v = new THREE.Vector3();
      this._inv = new THREE.Matrix4().copy(A.xform).invert();
      this.spawnPoints = CITY_SPAWNS.map(([x, z, yaw, tag]) => ({
        position: A.toWorld(x, 0, z),
        yaw: yaw + LEVEL_YAW,
        tag,
      }));
      this.bounds = new THREE.Box3(
        new THREE.Vector3(-62, -2, -62),
        new THREE.Vector3(62, 26, 62)
      ).applyMatrix4(A.xform);
      this._groundY = groundY;
      this._isOpen = isOpen;
    }

    this.stats = A.stats;
    const ms = performance.now() - t0;
    console.info(
      `[world] map=${this.mapId} built in ${ms.toFixed(0)}ms — ${(A.stats.staticTris / 1000).toFixed(0)}k static tris, ` +
        `${(A.stats.instTris / 1000).toFixed(0)}k instanced tris in ${A.stats.instances} instances, ` +
        `${A.stats.drawCalls} draw calls, ${(A.stats.collideTris / 1000).toFixed(1)}k collision tris`
    );
  }

  _addLights(A) {
    this.bulbs = [];
    this.lamps = [];

    for (const b of A.interiorLights.slice(0, 20)) {
      const l = new THREE.PointLight(0xffc07a, 5, 13, 2);
      l.position.set(b.x, b.y, b.z);
      l.castShadow = false;
      A.light(l, { range: 13, priority: 2 });
      this.bulbs.push(l);
    }

    for (const p of A.lampAnchors) {
      const l = new THREE.PointLight(0xffb765, 0, 22, 2);
      l.position.set(p.x, p.y - 0.12, p.z);
      l.castShadow = false;
      A.light(l, { range: 22, priority: 3 });
      this.lamps.push(l);
    }
    this.lampLens = A.mat('lamp_lens');
    this._lampMix = -1;

    this._addBallast();
  }

  _addBallast() {
    this._ballast = [];
    for (let i = 0; i < LIGHT_SLOTS + 4; i++) {
      const l = new THREE.PointLight(0x000000, 0, 0.01, 2);
      l.name = `world_light_ballast_${i}`;
      l.castShadow = false;
      l.visible = false;
      l.userData.owBallast = true;
      l.position.set(0, -1000, 0);
      this.root.add(l);
      this._ballast.push(l);
    }
    this._pointLights = [];
    this._pointLightsFrame = -1e9;
    this._lightTarget = LIGHT_SLOTS;
    this._lightRanges = new Map();
    this._camPos = new THREE.Vector3();
    this._collectPointLight = (o) => {
      if (o.isPointLight === true && o.userData.owBallast !== true) this._pointLights.push(o);
    };
  }

  _stabiliseLightCount(ctx) {
    const list = this._pointLights;
    if (!list) return;
    const render = this._render ?? (this._render = ctx.peek('render'));
    if (ctx.time.frame - this._pointLightsFrame >= 90) {
      this._pointLightsFrame = ctx.time.frame;
      list.length = 0;
      ctx.scene.traverse(this._collectPointLight);
      this._lightRanges.clear();
      for (const e of render?.lights ?? []) {
        if (e.light?.isPointLight === true) this._lightRanges.set(e.light, e.range);
      }
    }

    ctx.camera.getWorldPosition(this._camPos);
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      const range = this._lightRanges.get(l);
      if (range === undefined) {
        if (l.visible === true) n++;
        continue;
      }
      const d = l.position.distanceTo(this._camPos);
      if (1 - THREE.MathUtils.smoothstep(d, range * 0.75, range * 1.15) > 0.002) n++;
    }

    if (n > this._lightTarget) this._lightTarget = n;
    const want = this._lightTarget - n;
    const pool = this._ballast;
    for (let i = 0; i < pool.length; i++) {
      const v = i < want;
      if (pool[i].visible !== v) pool[i].visible = v;
    }
  }

  update(dt, ctx) {
    this.A?.updateLod(ctx.camera);

    // Optional sky only — never ctx.get('day') (throws if unregistered).
    const sky = this._sky ?? (this._sky = ctx.peek('sky'));
    const alt = sky?.sunAltitude ?? 0.6;
    const mix = 1 - Math.min(1, Math.max(0, (alt + 0.05) / 0.16));
    if (Math.abs(mix - this._lampMix) > 0.01) {
      this._lampMix = mix;
      for (let i = 0; i < this.lamps.length; i++) this.lamps[i].intensity = 14 * mix;
      if (this.lampLens) this.lampLens.emissiveIntensity = 9 * mix;
      for (let i = 0; i < this.bulbs.length; i++) this.bulbs[i].intensity = 5 + 17 * mix;
    }
  }

  lateUpdate(dt, ctx) {
    this._stabiliseLightCount(ctx);
  }

  async prewarmMaterials(ctx = this.ctx) {
    const render = ctx.peek('render');
    const renderer = render?.renderer;
    if (!renderer) return { ok: false, reason: 'no renderer' };
    const scene = ctx.scene;
    const camera = ctx.camera;
    const before = renderer.info.programs?.length ?? 0;
    const t0 = performance.now();

    render.patchMaterials?.(this.root);
    this._stabiliseLightCount(ctx);

    const prevOverride = scene.overrideMaterial;
    try {
      await this._compile(renderer, scene, camera);
      for (const over of [render.csm?.depthMaterial, render.gbuffer?.material]) {
        if (!over) continue;
        scene.overrideMaterial = over;
        await this._compile(renderer, scene, camera);
      }
    } finally {
      scene.overrideMaterial = prevOverride;
    }

    return {
      ok: true,
      ms: Math.round(performance.now() - t0),
      compiled: (renderer.info.programs?.length ?? 0) - before,
      lightTarget: this._lightTarget,
    };
  }

  async _compile(renderer, scene, camera) {
    try {
      await renderer.compileAsync(scene, camera);
    } catch {
      try {
        renderer.compile(scene, camera);
      } catch {
        /* driver cannot pre-warm; boot continues */
      }
    }
  }

  spawn(i = 0) {
    const n = this.spawnPoints.length;
    return this.spawnPoints[((i % n) + n) % n];
  }

  levelToWorld(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyMatrix4(this.A.xform);
  }

  worldToLevel(x, y, z, out = new THREE.Vector3()) {
    return out.set(x, y, z).applyMatrix4(this._inv);
  }

  groundHeight(x, z) {
    const p = this.worldToLevel(x, 0, z, this._v);
    return this._groundY(p.x, p.z);
  }

  isOpen(x, z, margin = 0.4) {
    const p = this.worldToLevel(x, 0, z, this._v);
    return this._isOpen(p.x, p.z, margin);
  }

  dispose() {
    this.A?.dispose();
    this.root?.parent?.remove(this.root);
    for (const l of this._ballast ?? []) l.parent?.remove(l);
    this._ballast = null;
    this._pointLights = null;
    this.bulbs = null;
    this.lamps = null;
  }
}

export { BUILDINGS, STREET, SET_PIECES, GATE };
