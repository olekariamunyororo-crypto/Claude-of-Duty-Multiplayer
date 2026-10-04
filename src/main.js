import { Engine } from './core/engine.js';
import { createConfig } from './core/config.js';
import { detectMobile, applyMobileProfile } from './core/mobileProfile.js';

import { RenderSystem } from './render/index.js';
import { MaterialSystem } from './materials/index.js';
import { SkySystem } from './sky/index.js';
import { WorldSystem } from './world/index.js';
import { PhysicsSystem } from './physics/index.js';
import { PlayerSystem } from './player/index.js';
import { WeaponSystem } from './weapons/index.js';
import { FxSystem } from './fx/index.js';
import { AiSystem } from './ai/index.js';
import { UiSystem } from './ui/index.js';
import { AudioSystem } from './audio/index.js';
import { NetSystem } from './net/index.js';
import { joinLobby } from './net/lobby.js';

import { installShotApi } from './dev/shots.js';
import { prewarm } from './core/prewarm.js';

const params = new URLSearchParams(location.search);
const capture = params.get('capture') === '1';
const lockstep = capture && params.get('lockstep') === '1';

const isMobile = detectMobile(params);

const defaultQuality = isMobile ? 'low' : 'medium';
const config = createConfig({
  quality: params.get('q') ?? defaultQuality,
  deterministic: capture,
  mobile: isMobile,
});
if (isMobile) applyMobileProfile(config);
window.__MOBILE__ = isMobile;
console.info(
  '[boot] quality=%s mobile=%s moveScale=%s timeScale=%s sens=%s',
  config.quality, isMobile, config.moveSpeedScale ?? 1, config.timeScale ?? 1, config.sensitivity,
);

const canvas = document.getElementById('game');

// ---- AI debug panel: open the game with ?aidebug=1 ----
if (new URLSearchParams(location.search).get('aidebug') === '1') {
  const lines = [];
  const fmt = (args) => {
    try {
      return Array.prototype.map.call(args, (x) => {
        if (x instanceof Error) return x.message + ' @ ' + String(x.stack || '').split('\n')[1];
        return typeof x === 'object' ? JSON.stringify(x) : String(x);
      }).join(' ');
    } catch (e) { return '(unprintable)'; }
  };
  const add = (t) => { lines.push(String(t).slice(0, 200)); if (lines.length > 28) lines.shift(); };
  for (const lvl of ['info', 'warn', 'error']) {
    const orig = console[lvl].bind(console);
    console[lvl] = (...a) => {
      const t = fmt(a);
      if (lvl !== 'info' || t.indexOf('[ai]') >= 0 || t.indexOf('[boot]') >= 0) {
        add((lvl === 'info' ? '' : lvl.toUpperCase() + ' ') + t);
      }
      orig(...a);
    };
  }
  window.addEventListener('error', (e) => add('ERROR ' + e.message));
  window.addEventListener('unhandledrejection', (e) => add('REJECT ' + ((e.reason && e.reason.message) || e.reason)));
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:0;top:0;right:0;max-height:55vh;overflow:hidden;margin:0;padding:4px;' +
    'font:9px/1.25 monospace;color:#0f0;background:rgba(0,0,0,.72);z-index:99999;pointer-events:none;white-space:pre-wrap';
  document.body.appendChild(box);
  setInterval(() => {
    let st;
    try {
      const ai = engine.ctx.peek('ai');
      const c = engine.ctx.camera.position;
      const f = (v) => [v.x, v.y, v.z].map((n) => n.toFixed(1)).join(',');
      st = 'agents=' + ai.agents.length + ' navPending=' + ai._navPending +
        ' grid=' + (ai.grid ? ai.grid.walkableCount : 'none') + ' mobile=' + !!engine.ctx.config.mobile +
        ' cam=' + f(c) + (ai.agents[0] ? ' first=' + f(ai.agents[0].position) : '');
    } catch (e) { st = 'status n/a: ' + e.message; }
    box.textContent = 'AIDEBUG ' + st + '\n' + lines.join('\n');
  }, 500);
}

const lobby = await joinLobby();
class SeededWorld extends WorldSystem {
  async init(ctx) { ctx.rng.seed(lobby.seed); return super.init(ctx); }
}
const engine = new Engine({ canvas, config });
if (config.timeScale != null) engine.time.scale = config.timeScale;

engine
  .add(RenderSystem)
  .add(MaterialSystem)
  .add(SkySystem)
  .add(SeededWorld)
  .add(PhysicsSystem)
  .add(PlayerSystem)
  .add(WeaponSystem)
  .add(FxSystem)
  .add(AiSystem)
  .add(UiSystem)
  .add(AudioSystem)
  .add(NetSystem, lobby);

try {
  await engine.init();
} catch (err) {
  console.error('[boot] init failed', err);
  document.body.insertAdjacentHTML(
    'beforeend',
    `<pre style="position:fixed;inset:0;padding:2rem;color:#f66;background:#000;
       font:12px/1.5 ui-monospace,monospace;overflow:auto;z-index:9999;white-space:pre-wrap">
BOOT FAILURE\n\n${err.stack ?? err.message}</pre>`
  );
  throw err;
}

const shotApi = installShotApi(engine, { capture, lockstep });

const skipWarm =
  params.get('prewarm') === '0' ||
  (isMobile && config.skipPrewarm !== false && params.get('prewarm') !== '1');
const warmup = skipWarm
  ? { ok: false, reason: isMobile ? 'skipped on mobile (set ?prewarm=1 to force)' : 'disabled by ?prewarm=0' }
  : await prewarm(engine);
console.info('[boot] prewarm', warmup);
window.__PREWARM__ = warmup;

engine.start();

{
  let softTries = 0;
  const forceGarrisonSoft = () => {
    softTries++;
    const ai = engine.ctx?.peek?.('ai');
    if (!ai) { if (softTries < 50) setTimeout(forceGarrisonSoft, 200); return; }
    window.__AI__ = ai;
    if (ai.agents?.length > 0) { console.info('[boot] agents already:', ai.agents.length); return; }
    try {
      ai.forcePopulate = true;
      ai._populated = false;
      ai._populateTries = 0;
      const n = ai.populate({ force: true, frontDist: 5, squads: 1, perSquad: 2 });
      console.info('[boot] softGarrison', n, 'agents', ai.agents?.length);
      if ((!n || !ai.agents?.length) && softTries < 50) setTimeout(forceGarrisonSoft, 400);
    } catch (e) {
      console.error('[boot] softGarrison error', e);
      if (softTries < 50) setTimeout(forceGarrisonSoft, 500);
    }
  };
  // multiplayer: no local AI garrison
}




{
  const boot = document.getElementById('boot');
  const hide = () => {
    if (!boot || boot.classList.contains('hidden')) return;
    boot.classList.add('hidden');
    setTimeout(() => boot.remove(), 500);
  };
  if (lockstep) hide();
  else {
    let n = 0;
    const tick = () => { if (++n >= 2) hide(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
}

const BOOT_FRAMES = 3;
if (lockstep) {
  await shotApi.pump(BOOT_FRAMES);
  window.__READY__ = true;
} else {
  let warm = 0;
  const readyProbe = () => {
    if (++warm >= BOOT_FRAMES) {
      window.__READY__ = true;
      return;
    }
    requestAnimationFrame(readyProbe);
  };
  requestAnimationFrame(readyProbe);
}

window.__ENGINE__ = engine;

if (import.meta.hot) {
  import.meta.hot.dispose(() => engine.dispose());
}
