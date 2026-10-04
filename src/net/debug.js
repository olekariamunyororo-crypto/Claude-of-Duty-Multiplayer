// On-screen console for phones. ?debug=1 turns it on (remembered), ?debug=0 turns it off.
const q = new URLSearchParams(location.search);
let on = false;
try {
  const v = q.get('debug');
  if (v === '1') localStorage.setItem('cod2.debug', '1');
  if (v === '0') localStorage.removeItem('cod2.debug');
  on = localStorage.getItem('cod2.debug') === '1';
} catch { on = q.get('debug') === '1'; }
if (on) install();

function install() {
  const lines = [];
  const COLORS = { error: '#ff6b6b', warn: '#ffd166', info: '#8ecbff', log: '#ddd', debug: '#889', sys: '#7fe38a' };
  let open = false, errsOnly = false, errCount = 0, queued = false;
  let panel, logEl, badge;

  const fmt = (v) => {
    if (v instanceof Error) return v.message + (v.stack ? '\n' + String(v.stack).split('\n').slice(1, 4).join('\n') : '');
    if (typeof v === 'string') return v;
    if (v === undefined) return 'undefined';
    try { return JSON.stringify(v); } catch { return String(v); }
  };
  const draw = () => {
    queued = false;
    if (!open || !logEl) return;
    logEl.textContent = '';
    for (const l of lines) {
      if (errsOnly && l.lvl !== 'error' && l.lvl !== 'warn') continue;
      const d = document.createElement('div');
      d.style.color = COLORS[l.lvl] || '#ddd';
      d.textContent = l.t + ' ' + l.text;
      logEl.appendChild(d);
    }
    logEl.scrollTop = logEl.scrollHeight;
  };
  const push = (lvl, args) => {
    const text = Array.prototype.map.call(args, fmt).join(' ').slice(0, 1200);
    lines.push({ lvl, text, t: (performance.now() / 1000).toFixed(1) });
    if (lines.length > 500) lines.shift();
    if (lvl === 'error') { errCount++; if (badge) { badge.textContent = errCount; badge.style.display = 'inline'; } }
    if (open && !queued) { queued = true; requestAnimationFrame(draw); }
  };

  for (const lvl of ['log', 'info', 'warn', 'error', 'debug']) {
    const orig = console[lvl].bind(console);
    console[lvl] = (...a) => { try { push(lvl, a); } catch {} orig(...a); };
  }
  window.addEventListener('error', (e) => {
    const t = e.target;
    if (t && t !== window && (t.src || t.href)) push('error', ['load failed:', t.src || t.href]);
    else push('error', [e.message + ' @ ' + String(e.filename || '').split('/').pop() + ':' + e.lineno]);
  }, true);
  window.addEventListener('unhandledrejection', (e) => push('error', ['rejected:', e.reason]));

  const dump = () => {
    const out = (s) => push('sys', [s]);
    out('UA ' + navigator.userAgent);
    out('page ' + location.href + ' dpr ' + devicePixelRatio + ' ' + innerWidth + 'x' + innerHeight);
    const e = window.__ENGINE__;
    if (!e) return out('engine not ready (window.__ENGINE__ missing)');
    const ctx = e.ctx;
    try { out('quality ' + ctx.config.quality + ' mobile ' + ctx.config.mobile); } catch {}
    try {
      const r = ctx.peek('render')?.renderer ?? e.renderer;
      const gl = r.getContext();
      const x = gl.getExtension('WEBGL_debug_renderer_info');
      out('gl ' + (x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) + ' webgl2=' + !!r.capabilities?.isWebGL2);
      out('maxTex ' + gl.getParameter(gl.MAX_TEXTURE_SIZE) + ' units ' + gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) + ' textures in use ' + r.info?.memory?.textures);
    } catch (err) { out('gl info failed: ' + err.message); }
    try {
      const ai = ctx.peek('ai');
      if (!ai) out('ai: not registered');
      else {
        out('ai variants built: ' + [...ai._variants.keys()].join(', '));
        const m = ai.materials;
        for (const k of Object.keys(m || {})) {
          const v = m[k];
          if (v?.isTexture) out('  tex ' + k + ' ' + v.image?.width + 'x' + v.image?.height);
          else if (v?.isMaterial) out('  mat ' + k + ' map=' + (v.map ? v.map.image?.width + 'x' + v.map.image?.height : 'none'));
          else if (v && typeof v === 'object') out('  ' + k + ': {' + Object.keys(v).slice(0, 8).join(',') + '}');
        }
      }
    } catch (err) { out('ai info failed: ' + err.message); }
    try {
      const net = ctx.peek('net');
      out('net players: ' + (net ? net.remote.size : 'n/a'));
      for (const [id, r] of net?.remote ?? []) {
        if (!r.pup) { out('  #' + id + ' capsule (no soldier)'); continue; }
        const ms = [].concat(r.pup.mesh.material);
        out('  #' + id + ' soldier, ' + ms.length + ' materials');
        for (const mt of ms) out('    ' + (mt.name || mt.type) + ' map=' + (mt.map ? mt.map.image?.width + 'x' + mt.map.image?.height : 'NONE') + ' color=#' + mt.color?.getHexString() + ' vc=' + mt.vertexColors);
      }
    } catch (err) { out('net info failed: ' + err.message); }
  };

  const copy = async () => {
    const text = lines.map((l) => l.t + ' ' + l.lvl + ' ' + l.text).join('\n');
    try { await navigator.clipboard.writeText(text); push('sys', ['copied ' + lines.length + ' lines']); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); push('sys', ['copied (fallback)']); } catch { push('sys', ['copy failed']); }
      ta.remove();
    }
  };
  const toggle = () => { open = !open; panel.style.display = open ? 'flex' : 'none'; if (open) draw(); };

  const build = () => {
    const css = (el, s) => { el.style.cssText = s; return el; };
    const btn = css(document.createElement('button'), 'position:fixed;left:50%;bottom:6px;transform:translateX(-50%);z-index:30000;padding:6px 12px;border:0;border-radius:14px;background:rgba(0,0,0,.65);color:#fff;font:700 12px system-ui,sans-serif');
    btn.textContent = 'DBG';
    badge = css(document.createElement('span'), 'display:none;background:#e33;border-radius:8px;padding:0 6px;margin-left:6px');
    btn.appendChild(badge);
    panel = css(document.createElement('div'), 'display:none;position:fixed;left:0;right:0;top:0;height:58vh;z-index:30001;background:rgba(5,8,12,.93);color:#ddd;flex-direction:column');
    const bar = css(document.createElement('div'), 'display:flex;gap:6px;padding:6px;border-bottom:1px solid #333');
    logEl = css(document.createElement('div'), 'flex:1;overflow:auto;padding:6px;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;user-select:text;-webkit-user-select:text');
    const mk = (label, fn) => {
      const b = css(document.createElement('button'), 'flex:1;padding:8px 0;border:0;border-radius:6px;background:#2a3340;color:#fff;font:600 12px system-ui,sans-serif');
      b.textContent = label; b.onclick = fn; bar.appendChild(b); return b;
    };
    mk('Info', dump);
    const eb = mk('Errors', () => { errsOnly = !errsOnly; eb.style.background = errsOnly ? '#a33' : '#2a3340'; draw(); });
    mk('Copy', copy);
    mk('Clear', () => { lines.length = 0; errCount = 0; badge.style.display = 'none'; draw(); });
    mk('\u00d7', toggle);
    panel.append(bar, logEl);
    for (const el of [panel, btn]) for (const ev of ['touchstart', 'touchmove', 'pointerdown']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
    btn.onclick = toggle;
    document.body.append(btn, panel);
    push('sys', ['debug console on - tap Info for graphics and soldier details']);
  };
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
  window.__dbg = { push, dump };
}
