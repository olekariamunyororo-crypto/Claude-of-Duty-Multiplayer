window.__MP__ = true;
const SERVER_URL = 'wss://cod2-server.onrender.com';
const params = new URLSearchParams(location.search);
const fresh = params.has('fresh'); // ?fresh=1 -> new guest each time (for 2 tabs)
const LS = { nick: 'cod2.nick', cred: 'cod2.cred', av: 'cod2.av' };
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

export function joinLobby() {
  const url = params.get('server') || SERVER_URL;
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;background:#0b0d10;color:#e8e8e8;font:16px system-ui,sans-serif';
    el.innerHTML = '<div style="width:min(86vw,340px);text-align:center">' +
      '<div style="font-size:26px;font-weight:700;letter-spacing:.06em;margin-bottom:18px">CLAUDE OF DUTY<br>MULTIPLAYER</div>' +
      '<input id="nick" maxlength="20" placeholder="Nickname" autocomplete="off" style="width:100%;box-sizing:border-box;padding:14px;font-size:16px;border-radius:8px;border:1px solid #444;background:#151a20;color:#fff;text-align:center">' +
      '<div id="avs" style="display:flex;gap:8px;margin-top:12px"></div>' +
      '<button id="go" style="width:100%;margin-top:12px;padding:14px;font-size:17px;font-weight:700;border:0;border-radius:8px;background:#e0a030;color:#111">PLAY</button>' +
      '<div id="msg" style="margin-top:14px;min-height:20px;font-size:14px;opacity:.8"></div></div>';
    document.body.appendChild(el);
    const nick = el.querySelector('#nick'), go = el.querySelector('#go'), msg = el.querySelector('#msg');
    nick.value = store.get(LS.nick) || '';
    const AVS = [['vanguard', 'Vanguard', '#c8a46a'], ['irregular', 'Irregular', '#6f8a4a'], ['breacher', 'Breacher', '#7d8ea6']];
    let av = store.get(LS.av);
    if (!AVS.some((a) => a[0] === av)) av = 'vanguard';
    const box = el.querySelector('#avs');
    const paint = () => {
      for (const b of box.children) {
        const on = b.dataset.id === av;
        b.style.borderColor = on ? '#e0a030' : '#444';
        b.style.background = on ? '#222a33' : '#151a20';
      }
    };
    for (const [id, label, col] of AVS) {
      const b = document.createElement('button');
      b.dataset.id = id;
      b.style.cssText = 'flex:1;padding:10px 4px;border-radius:8px;border:2px solid #444;color:#eee;font:600 12px system-ui,sans-serif';
      b.innerHTML = '<div style="width:26px;height:40px;border-radius:13px;margin:0 auto 6px;background:' + col + '"></div>' + label;
      b.onclick = () => { av = id; store.set(LS.av, id); paint(); };
      box.appendChild(b);
    }
    paint();

    const connect = (name, useCred) => {
      const cred = useCred && !fresh ? store.get(LS.cred) : null;
      const queue = [];
      let joined = false;
      msg.textContent = 'Connecting... (the free server can take up to a minute to wake)';
      const ws = new WebSocket(url);
      ws.onopen = () => ws.send(JSON.stringify({ t: 'auth', av,
        token: cred ? 'guest:cred:' + cred + ':' + name : 'guest:new:' + name }));
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'cred' && !fresh) store.set(LS.cred, m.cred);
        if (m.t === 'welcome' && !joined) {
          joined = true; store.set(LS.nick, name); el.remove();
          resolve({ ws, welcome: m, seed: m.seed >>> 0, queue });
          return;
        }
        if (!joined) return;
        if (m.t === 'snap') { const i = queue.findIndex((q) => q.t === 'snap'); if (i >= 0) queue.splice(i, 1); }
        queue.push(m); // NetSystem drains this once the engine is up
      };
      ws.onerror = () => {};
      ws.onclose = (e) => {
        if (joined) return;
        if (e.code === 4003 && cred) { store.set(LS.cred, null); connect(name, false); return; }
        go.disabled = false;
        msg.textContent = e.code === 4002 ? 'Signed in elsewhere.' : 'Could not connect. Try again.';
      };
    };
    const start = () => {
      const name = nick.value.trim();
      if (!name) { msg.textContent = 'Enter a nickname'; return; }
      go.disabled = true; connect(name, true);
    };
    go.onclick = start;
    nick.onkeydown = (e) => { if (e.key === 'Enter') start(); };
  });
}
