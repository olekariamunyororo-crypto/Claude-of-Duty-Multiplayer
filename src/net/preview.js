// 3D soldier preview for the lobby. Self-contained and fully disposed before the game starts.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SoldierMaterials } from '../ai/textures.js';
import { buildSoldier, VARIANTS } from '../ai/soldier.js';
import { RIG } from '../ai/rig.js';
import { Animator } from '../ai/animator.js';
import { Rng as Rng } from '../core/rng.js';

const SEED = 0xc0d2;
const warn = (...a) => console.warn('[preview]', ...a);

export function createPreview(host, ids, initial, onPick) {
  const w = Math.max(200, host.clientWidth || 320);
  const h = Math.max(160, host.clientHeight || 220);
  host.style.background = 'radial-gradient(ellipse at 50% 70%, #26303b 0%, #12161b 70%)';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h, false);
  console.info('[preview] renderer ready, webgl2=' + renderer.capabilities.isWebGL2 + ' size ' + w + 'x' + h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.1, 50);
  cam.position.set(0, 1.0, 4.4);
  cam.lookAt(0, 0.92, 0);
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.7;
    pm.dispose();
  } catch (e) { warn('environment light unavailable:', e?.message ?? e); }
  scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x6a5a45, 0.5));
  const key = new THREE.DirectionalLight(0xffe6c0, 2.0); key.position.set(2.5, 3.5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9ab8ff, 0.9); rim.position.set(-3, 2, -2); scene.add(rim);

  const pivot = new THREE.Group();
  scene.add(pivot);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.002; scene.add(disc);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.76, 48), new THREE.MeshBasicMaterial({ color: 0xe0a030 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.004; scene.add(ring);

  const label = document.createElement('div');
  label.style.cssText = 'position:absolute;left:0;right:0;bottom:1.2vh;text-align:center;font:600 clamp(13px,2.8vw,26px) system-ui,sans-serif;color:#f1d9a8;text-shadow:0 1px 3px #000;pointer-events:none';
  host.appendChild(label);

  let dead = false, cur = null, curId = initial, raf = 0, rotY = 0.6, idleUntil = 0, dragging = false, lastX = 0, building = 0;
  const cache = new Map();
  const mats = new Map();
  const aim = new THREE.Vector3(0, 1.5, 10);

  function build(id) {
    const name = VARIANTS[id] ? id : 'vanguard';
    const camo = VARIANTS[name].camo;
    let sm = mats.get(camo);
    if (!sm) {
      sm = new SoldierMaterials(new Rng(SEED + 1), { size: 256, anisotropy: 1, camo: [camo] });
      mats.set(camo, sm);
    }
    const v = buildSoldier(name, { rng: new Rng(SEED), materials: sm });
    const scale = VARIANTS[name].scale ?? 1;
    const { bones, skeleton, root } = RIG.createSkeleton();
    const mesh = new THREE.SkinnedMesh(v.geometry, v.materials);
    mesh.frustumCulled = false;
    const group = new THREE.Group();
    group.add(root);
    group.add(mesh);
    mesh.bind(skeleton);
    group.scale.setScalar(scale);
    group.visible = false;
    pivot.add(group);
    group.updateMatrixWorld(true);
    let animator = null;
    try {
      animator = new Animator(RIG, bones, {
        weapon: v.weapon, rng: new Rng(SEED + 2), scale,
        probe: (x, z, fromY, out) => { if (out) { out.x = x; out.y = 0; out.z = z; out.hit = true; } return out || null; },
      });
    } catch (e) { warn('animator unavailable, static pose:', e?.message ?? e); }
    return { name, camo, group, skeleton, bones, animator, v, checked: false };
  }

  function show(id) {
    if (dead) return;
    curId = id;
    const token = ++building;
    label.textContent = 'Loading camo...';
    setTimeout(() => {
      if (dead || token !== building) return;
      try {
        let e = cache.get(id);
        if (!e) { e = build(id); cache.set(id, e); }
        if (cur) cur.group.visible = false;
        e.group.visible = true;
        cur = e;
        label.textContent = id.charAt(0).toUpperCase() + id.slice(1) + ' - ' + e.camo + ' camo';
      } catch (err) {
        warn('build failed:', err?.message ?? err, String(err?.stack || '').split('\n')[1] || '');
        label.textContent = 'Preview error: ' + (err?.message ?? err);
        label.style.color = '#ff8080';
        label.style.fontSize = '11px';
      }
    }, 40);
  }

  function step(dir) {
    const i = Math.max(0, ids.indexOf(curId));
    const n = ids[(i + dir + ids.length) % ids.length];
    show(n);
    if (onPick) onPick(n);
  }
  const arrow = (txt, side, dir) => {
    const b = document.createElement('button');
    b.textContent = txt;
    b.style.cssText = 'position:absolute;top:50%;' + side + ':6px;transform:translateY(-50%);width:clamp(36px,7vw,72px);height:clamp(48px,10vw,100px);border:0;border-radius:10px;background:rgba(0,0,0,.35);color:#fff;font:700 clamp(22px,4.4vw,44px) system-ui,sans-serif';
    b.onclick = () => step(dir);
    host.appendChild(b);
  };
  arrow('<', 'left', -1);
  arrow('>', 'right', 1);

  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; try { canvas.setPointerCapture(e.pointerId); } catch {} });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; rotY += (e.clientX - lastX) * 0.012; lastX = e.clientX; });
  const up = () => { dragging = false; idleUntil = performance.now() + 2500; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  const onResize = () => {
    if (dead) return;
    const nw = Math.max(200, host.clientWidth), nh = Math.max(160, host.clientHeight);
    renderer.setSize(nw, nh, false);
    cam.aspect = nw / nh;
    cam.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  let last = performance.now();
  function frame(now) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!dragging && now > idleUntil) rotY += dt * 0.55;
    pivot.rotation.y = rotY;
    if (cur && cur.animator) {
      try {
        cur.animator.setState({ clip: 'idle', speed: 0, aimTarget: aim, aimWeight: 0 });
        cur.animator.update(dt, now / 1000);
        if (!cur.checked) {
          cur.checked = true;
          const bad = Array.from(cur.bones).some((b) => !(Number.isFinite(b.position.x + b.position.y + b.position.z) && Number.isFinite(b.quaternion.w)));
          if (bad) { warn('animator produced invalid bones, static pose'); cur.animator = null; cur.skeleton.pose(); }
        }
      } catch (e) { warn('animator error, static pose:', e?.message ?? e); cur.animator = null; try { cur.skeleton.pose(); } catch {} }
    }
    renderer.render(scene, cam);
  }
  raf = requestAnimationFrame(frame);

  function dispose() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    for (const e of cache.values()) {
      try {
        e.group.removeFromParent();
        e.skeleton.dispose?.();
        e.v.geometry?.dispose?.();
        for (const m of e.v.materials) m.dispose?.();
      } catch {}
    }
    for (const sm of mats.values()) {
      try { if (sm.dispose) sm.dispose(); else (sm._disposables || []).forEach((t) => t?.dispose?.()); } catch {}
    }
    try { scene.environment?.dispose?.(); } catch {}
    try { renderer.dispose(); renderer.forceContextLoss?.(); } catch {}
    canvas.remove();
    label.remove();
  }

  requestAnimationFrame(onResize);
  show(initial);
  return { set: show, dispose };
}
