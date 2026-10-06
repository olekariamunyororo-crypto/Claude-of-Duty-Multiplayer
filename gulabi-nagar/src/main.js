// Bootstrap: renderer, sky, context, module build, batching, main loop, HUD.
import * as THREE from 'three';
import * as L from './world/layout.js';
import { createContext } from './core/ctx.js';
import { createRenderPipeline } from './core/renderer.js';
import { createSky } from './core/sky.js';
import { Player } from './core/player.js';
import { batchStatic } from './core/batch.js';
import { batchStatic as batchStatic2 } from './core/batch2.js';
import { createAudio } from './core/audio.js';
import { createSoundscape } from './core/soundscape.js';

export const MODULES = [
  'environment', 'street', 'poles', 'railway', 'station', 'plaza', 'shopsA', 'shopsB', 'houses',
  'sakura', 'trains', 'crossing', 'props', 'vehicles', 'characters', ...(/[?&]nopetals/.test(location.search) ? [] : ['petals']), 'jaipur',
];

const params = new URLSearchParams(location.search);
const SHOT = params.has('shot');
const ONLY = params.get('only') ? params.get('only').split(',').map(s => s.trim()).filter(Boolean) : null;
const $ = (id) => document.getElementById(id);

const isTouch = matchMedia('(pointer: coarse)').matches;
const QUALITY = {
  high: { name: 'high', pixelRatio: Math.min(devicePixelRatio, 1.5), msaa: 4, shadowMap: 4096, shadowSize: 75, petals: 1.0 },
  medium: { name: 'medium', pixelRatio: Math.min(devicePixelRatio, 1.0), msaa: 4, shadowMap: 2048, shadowSize: 60, petals: 0.6 },
  low: { name: 'low', pixelRatio: Math.min(devicePixelRatio, 0.75), msaa: 0, shadowMap: 2048, shadowSize: 45, petals: 0.35 },
};
let qName = params.get('q') || (() => { try { return localStorage.getItem('gulabi.q'); } catch (e) { return null; } })() || (isTouch ? 'medium' : 'high');
if (!QUALITY[qName]) qName = 'high';
const quality = { ...QUALITY[qName] };
if (SHOT) { quality.pixelRatio = 1; }

// ------------------------------------------------------------------ renderer & scene
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: SHOT });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 2500);
const sunDir = new THREE.Vector3(...L.SUN_DIR).normalize();
const sky = createSky(scene, sunDir, quality);
const pipeline = createRenderPipeline(renderer, quality);
const audio = createAudio({ ambience: false });
const soundscape = createSoundscape(audio);
const ctx = createContext({ scene, camera, renderer, audio, quality, sunDir });
ctx.sky = sky;
ctx.soundscape = soundscape;
window.__ctx = ctx; window.THREE = THREE;

function resize() {
  const w = SHOT ? Number(params.get('w') || 1280) : innerWidth, h = SHOT ? Number(params.get('h') || 720) : innerHeight;
  renderer.setSize(w, h, !SHOT);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  pipeline.setSize(w, h, quality.pixelRatio);
  ctx.wires.setResolution(pipeline.size.x, pipeline.size.y);
}
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ fonts
async function loadFonts() {
  if (!document.fonts || !document.fonts.load) return;
  const faces = ['700 32px "Noto Sans Devanagari"', '400 32px "Noto Sans Devanagari"', '900 32px "Noto Sans Devanagari"', '700 32px "Noto Sans Devanagari"',
    '700 32px "Noto Sans Devanagari"', '400 32px "Noto Sans Devanagari"', '400 32px "Noto Sans Devanagari"'];
  const sample = 'गुलाबी नगर स्टेशन जयपुर चाय फूल किताबें Gulabi Nagar MITHAI STOP';
  await Promise.race([Promise.all(faces.map(f => document.fonts.load(f, sample).catch(() => null))), new Promise(r => setTimeout(r, 6000))]);
}

// ------------------------------------------------------------------ build
const errors = []; window.__errors = errors;
const stats = { modules: {} }; window.__stats = stats;
function setProgress(frac, label) {
  const bar = $('bar'); if (bar) bar.style.transform = `scaleX(${frac})`;
  const lab = $('loadlabel'); if (lab && label) lab.textContent = label;
}
const LABELS = {
  environment: 'Aravalli landscape', street: 'Bazaar streets', poles: 'Overhead wires', railway: 'Railway tracks', station: 'Gulabi Nagar station', plaza: 'Station chowk',
  shopsA: 'Chai, flowers & books', shopsB: 'Mithai & neighbourhood shops', houses: 'Pink city houses', sakura: 'Gulmohar avenue', trains: 'Local trains',
  crossing: 'Railway crossing', props: 'Street details', vehicles: 'Cycles & taxis', characters: 'People of Gulabi Nagar', petals: 'Drifting blossoms', jaipur: 'Havelis, rickshaws & the chai cart',
};

async function build() {
  await loadFonts();
  const list = ONLY ? MODULES.filter(m => ONLY.includes(m)).concat(ONLY.filter(m => !MODULES.includes(m))) : MODULES;
  let i = 0;
  for (const name of list) {
    setProgress(i / (list.length + 1), `Loading ${LABELS[name] || name}…`);
    await new Promise(r => setTimeout(r, 0));
    const t0 = performance.now();
    try {
      const mod = await import(`./world/${name}.js`);
      const before = ctx.staticRoot.children.length + ctx.dynamicRoot.children.length;
      if (typeof mod.build !== 'function') throw new Error('module has no build(ctx) export');
      await mod.build(ctx);
      stats.modules[name] = { ms: Math.round(performance.now() - t0), objects: ctx.staticRoot.children.length + ctx.dynamicRoot.children.length - before };
    } catch (e) {
      console.error(`[module ${name}]`, e);
      errors.push({ module: name, message: String(e && e.stack || e) });
    }
    i++;
  }
  setProgress(list.length / (list.length + 1), 'Finishing the neighbourhood…');
  await new Promise(r => setTimeout(r, 0));
  const wm = ctx.wires.build(); if (wm) { scene.add(wm); ctx.wires.setResolution(pipeline.size.x, pipeline.size.y); }
  const b = params.get('batch') === '1' ? batchStatic(ctx.staticRoot) : batchStatic2(ctx.staticRoot, { mat: ctx.mat });
  stats.batch = b;
  try { renderer.compile(scene, camera); } catch (e) { console.warn(e); }
  setProgress(1, '');
}

// ------------------------------------------------------------------ player / camera
const player = new Player(camera, canvas, ctx.physics, L.WORLD.play);
ctx.playerObj = player;
function parseCam(s) {
  const v = s.split(',').map(Number);
  if (v.length === 4) player.setPose(v[0], v[1], v[2], v[3]);
  else if (v.length >= 5) player.setPose(v[0], v[2], v[3], v[4], v[1]);
}
window.__setCam = (x, y, z, yaw, pitch) => { if (y === null || y === undefined) player.setPose(x, z, yaw, pitch); else player.setPose(x, z, yaw, pitch, y); };

const VIEWS = {
  Digit1: { ...L.HERO, label: 'Gulabi Bazaar' },
  Digit2: { x: 9.5, z: -9.0, yaw: 12, pitch: 6, label: 'Station Chowk' },
  Digit3: { x: 20.0, z: -37.6, yaw: 95, pitch: 0, label: 'Platform 1' },
  Digit4: { x: -12.8, z: -31.5, yaw: -8, pitch: 3, label: 'Level Crossing' },
  Digit5: { x: -20.0, z: -92.8, yaw: 160, pitch: -2, label: 'Promenade' },
};

// ------------------------------------------------------------------ simulation
let simT = params.has('t') ? Number(params.get('t')) : 14; // default: a train is about to reach the crossing
function stepUpdates(dt, t) {
  ctx.time = t; ctx.shared.uTime.value = t;
  ctx.shared.uGust.value = 0.5 + 0.28 * Math.sin(t * 0.37) + 0.14 * Math.sin(t * 1.13 + 1.7) + 0.08 * Math.sin(t * 2.9 + 0.4);
  ctx.player.position.copy(player.pos);
  for (const fn of ctx._updates) { try { fn(dt, t); } catch (e) { if (!fn.__err) { fn.__err = 1; console.error('update error', e); errors.push({ module: 'update', message: String(e && e.stack || e) }); } } }
}
/** GPU benchmark: renders n frames back-to-back (forcing sync) and returns ms/frame + counts. */
window.__bench = (n = 30) => {
  const gl = renderer.getContext(); const px = new Uint8Array(4);
  pipeline.render(scene, camera, sunDir, simT); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const t0 = performance.now();
  for (let i = 0; i < n; i++) { renderer.info.reset(); sky.update(simT, camera); pipeline.render(scene, camera, sunDir, simT); }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const ms = (performance.now() - t0) / n;
  return { ms: +ms.toFixed(2), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs?.length };
};
/** Draw-call diagnostics: mesh counts by root / material kind (for performance work). */
window.__diag = () => {
  const out = { static: {}, dynamic: {}, other: {} };
  const kind = (o) => {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    let k = o.isInstancedMesh ? 'inst:' : '';
    k += m.type.replace('Material', '');
    if (m.map) k += '+map'; if (m.transparent) k += '+transp'; if (m.alphaTest > 0) k += '+atest'; if (m.vertexColors) k += '+vc';
    return k;
  };
  const walk = (root, bucket) => root.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) { const k = kind(o); bucket[k] = (bucket[k] || 0) + 1; } });
  walk(ctx.staticRoot, out.static); walk(ctx.dynamicRoot, out.dynamic);
  scene.children.forEach((c) => { if (c !== ctx.staticRoot && c !== ctx.dynamicRoot) walk(c, out.other); });
  // dynamic by top-level child name
  out.dynamicTop = {}; ctx.dynamicRoot.children.forEach((c) => { let n = 0; c.traverse((o) => { if (o.isMesh) n++; }); const k = c.name || c.type; out.dynamicTop[k] = (out.dynamicTop[k] || 0) + n; });
  out.textures = new Set(); ctx.staticRoot.traverse((o) => { if (o.material && o.material.map) out.textures.add(o.material.map.uuid); }); out.textures = out.textures.size;
  return out;
};
window.__sim = (target) => { let t = 0; const dt = 1 / 30; while (t < target) { stepUpdates(dt, t); t += dt; } simT = target; stepUpdates(0, simT); };

// ------------------------------------------------------------------ HUD
let areaName = '';
function areaAt(x, z) { for (const a of L.AREAS) if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) return a.name; return ''; }
let toastTimer = 0;
function showToast(name) {
  const el = $('toast'); if (!el) return;
  el.querySelector('.t-name').textContent = name;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3800);
}
function hudTick(t) {
  const n = areaAt(player.pos.x, player.pos.z);
  if (n && n !== areaName) { areaName = n; if (started) showToast(n); }
  const clock = $('clock');
  if (clock) { const m = 2 + Math.floor(t / 60); clock.textContent = `16:${String(Math.min(59, m)).padStart(2, '0')}`; }
}

// ------------------------------------------------------------------ main loop
let started = false, last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (SHOT) dt = 0;
  simT += dt;
  if (!SHOT) player.update(dt);
  ctx.physics.refreshDynamic();
  stepUpdates(dt, simT);
  soundscape.update(player.pos, dt);
  try { audio.update(camera, dt); } catch (e) { if (!audio.__err) { audio.__err = 1; console.error('audio', e); } }
  sky.update(simT, camera);
  renderer.info.reset();
  pipeline.render(scene, camera, sunDir, simT);
  if (!SHOT) hudTick(simT);
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; const s = $('stats'); if (s && !s.hidden) s.textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1e6).toFixed(2)}M tris`; }
  stats.fps = fps; stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
}

function start() {
  if (started) { player.requestLock(); return; }
  started = true;
  player.enabled = true;
  document.body.classList.add('playing');
  player.requestLock();
  try { audio.start(); } catch (e) { console.warn(e); }
  showToast(areaAt(player.pos.x, player.pos.z) || L.NAMES.shoppingStreet);
}

async function main() {
  await build();
  if (params.get('cam')) parseCam(params.get('cam')); else player.setPose(L.HERO.x, L.HERO.z, L.HERO.yaw, L.HERO.pitch);
  if (params.has('fly')) player.fly = true;
  if (simT > 0) window.__sim(simT); else stepUpdates(0, 0);
  sky.update(simT, camera);
  requestAnimationFrame(frame);
  if (SHOT) {
    document.body.classList.add('shot');
    // give textures/shaders a few frames, then signal readiness
    let n = 0; const wait = () => { if (++n > 6) { window.__ready = true; } else requestAnimationFrame(wait); }; requestAnimationFrame(wait);
    return;
  }
  document.body.classList.add('loaded');
  $('loadlabel').textContent = errors.length ? 'Some scenery could not load. Reload to retry.' : 'The street is ready.';
  const go = $('go'); if (go) { go.disabled = false; go.focus(); go.addEventListener('click', start); }
  canvas.addEventListener('click', () => { if (started) player.requestLock(); });
  document.addEventListener('pointerlockchange', () => { document.body.classList.toggle('locked', document.pointerLockElement === canvas); });
  addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && !started) start();
    if (!started) return;
    if (e.code === 'KeyH') document.body.classList.toggle('noui');
    if (e.code === 'KeyM') { audio.muted = !audio.muted; const b = $('mute'); if (b) b.setAttribute('aria-pressed', String(audio.muted)); }
    if (e.code === 'KeyR') player.setPose(L.HERO.x, L.HERO.z, L.HERO.yaw, L.HERO.pitch);
    if (e.code === 'Backquote') { const s = $('stats'); if (s) s.hidden = !s.hidden; }
    const v = VIEWS[e.code]; if (v) { player.fly = false; player.setPose(v.x, v.z, v.yaw, v.pitch); }
  });
  document.querySelectorAll('[data-place]').forEach(button => button.addEventListener('click', () => {
    const v = VIEWS['Digit' + button.dataset.place];
    if (!v) return;
    player.fly = false; player.setPose(v.x, v.z, v.yaw, v.pitch);
    showToast(v.label);
  }));
  const q = $('quality');
  if (q) { q.value = qName; q.addEventListener('change', () => { try { localStorage.setItem('gulabi.q', q.value); } catch (e) {} location.reload(); }); }
  const mute = $('mute'); if (mute) mute.addEventListener('click', () => { audio.muted = !audio.muted; mute.setAttribute('aria-pressed', String(audio.muted)); });
  if (params.has('stats')) $('stats').hidden = false;
  window.__ready = true;
  if (errors.length) console.warn('module errors', errors);
}
main().catch(e => { console.error(e); $('loadlabel').textContent = 'Unable to load the scene. Please reload to try again.'; });
