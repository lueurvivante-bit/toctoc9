// Toc Toc 9 — connexion directe au serveur « croupier » (WebSocket).
// Expose la même petite API que Firebase pour que l'interface reste identique.
// Le joueur ne reçoit jamais les cartes des autres : le serveur filtre tout.
(function () {
  const params = new URLSearchParams(location.search);
  const profile = params.get('profil') || 'principal';
  const SERVER = (window.TOCTOC_SERVER || location.origin).replace(/^http/, 'ws');
  let identity = localStorage.getItem('toc9-uid:' + profile);
  if (!identity) { identity = crypto.randomUUID(); localStorage.setItem('toc9-uid:' + profile, identity); }
  let secret = localStorage.getItem('toc9-token:' + profile);
  if (!secret) { secret = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem('toc9-token:' + profile, secret); }

  let tree = {};
  const listeners = new Set();
  const rooms = new Map();
  let notifyQueued = false, nextId = 1, waitTimer = null;
  const isActive=()=>document.visibilityState!=='hidden';
  function signalPresence(resume=false){for(const r of rooms.values()){if(resume&&isActive()){restart(r,'resume');continue;}if(r.ok&&r.ws?.readyState===1)r.ws.send(JSON.stringify({t:'presence',active:isActive()}));}}
  document.addEventListener?.('visibilitychange',()=>signalPresence(isActive()));
  window.addEventListener?.('pagehide',()=>{for(const r of rooms.values())if(r.ok&&r.ws?.readyState===1)r.ws.send(JSON.stringify({t:'presence',active:false}));});
  window.addEventListener?.('pageshow',e=>{if(e.persisted)signalPresence(true);});
  // Délais réseau. Une prise WebSocket peut rester « ouverte » sans plus rien
  // transmettre (téléphone en veille, changement de réseau) : on la remplace.
  const ACK_MS = 8000, IDLE_MS = 15000, PONG_MS = 5000;

  // Bounded local diagnostics: no names, hands, tokens or room codes.
  const diagnosticKey='toc9-bugs-v1';
  function recordBug(kind, action) {
    try { const log=JSON.parse(localStorage.getItem(diagnosticKey)||'[]');
      log.push({at:new Date().toISOString(),kind,action:action||'network'});
      localStorage.setItem(diagnosticKey,JSON.stringify(log.slice(-100)));
    } catch (_) {}
  }
  function networkFailure(kind, action) {
    recordBug(kind,action);endWait();setStatusSafe('Action non confirmée · réessaie','err');
    try { if(typeof toast==='function')toast('Le serveur n’a pas confirmé. Vérifie la connexion puis réessaie.','bad'); } catch (_) {}
  }
  window.addEventListener?.('error',()=>recordBug('client-error'));
  window.addEventListener?.('unhandledrejection',()=>recordBug('unhandled-rejection'));
  window.tocBugJournal=()=>{try{return JSON.parse(localStorage.getItem(diagnosticKey)||'[]');}catch(_){return [];}};
  const clone = (v) => (v === undefined || v === null ? null : structuredClone(v));
  const keysOf = (path) => String(path).split('/').filter(Boolean);
  const at = (path) => keysOf(path).reduce((v, k) => (v == null ? null : v[k]), tree) ?? null;
  const snapshot = (path) => ({
    key: keysOf(path).pop(), val: () => clone(at(path)), exists: () => at(path) != null,
    forEach: (fn) => Object.keys(at(path) || {}).forEach((k) => fn(snapshot(path + '/' + k))),
  });
  function stamp(v) {
    if (v && typeof v === 'object') {
      if (v['.sv'] === 'timestamp') return Date.now();
      if (Array.isArray(v)) return v.map(stamp);
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, stamp(x)]));
    }
    return v;
  }
  function put(target, path, value) {
    const keys = keysOf(path);
    let t = target;
    for (const k of keys.slice(0, -1)) { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; t = t[k]; }
    if (value == null) delete t[keys[keys.length - 1]]; else t[keys[keys.length - 1]] = structuredClone(value);
  }
  function apply(target, w) {
    if (w.op === 'update') for (const [k, v] of Object.entries(w.value || {})) put(target, w.path + '/' + k, stamp(v));
    else put(target, w.path, w.op === 'remove' ? null : stamp(w.value));
  }
  function notify() {
    for (const l of [...listeners]) {
      if (!listeners.has(l)) continue;
      const r = rooms.get(l.room);
      if (r && !r.loaded) continue; // on attend la première vue du serveur
      const sig = JSON.stringify(at(l.path));
      if (sig !== l.sig) { l.sig = sig; try { l.fn(snapshot(l.path)); } catch (e) { console.error(e); } }
    }
  }
  function scheduleNotify() { if (notifyQueued) return; notifyQueued = true; queueMicrotask(() => { notifyQueued = false; notify(); }); }
  function rebuild() {
    tree = { games: {} };
    for (const [code, r] of rooms) {
      const g = structuredClone(r.server);
      for (const w of r.pending) if (!w.action) apply(g, w);
      tree.games[code] = g;
    }
    scheduleNotify();
  }
  function roomOf(path) { const k = keysOf(path); return k[0] === 'games' && k[1] ? k[1].toUpperCase() : null; }

  function connect(code) {
    let r = rooms.get(code);
    if (r && r.ws && r.ws.readyState <= 1) return r;
    if (!r) {
      r = { code, ws: null, loaded: false, server: {}, pending: [], waiting: new Map(), ready: null, readyFn: null, retry: 0, ok: false, live: null, pong: false };
      r.ready = new Promise((res) => { r.readyFn = res; });
      rooms.set(code, r);
    }
    const ws = new WebSocket(SERVER + '/ws?room=' + encodeURIComponent(code));
    r.ws = ws;r.syncing=true;
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', uid: identity, token: secret, active:isActive(), presence:true })); };
    ws.onmessage = (ev) => {
      if (r.ws !== ws) return; // message tardif d'une ancienne prise
      const m = JSON.parse(ev.data);
      if (r.pong) watch(r, ws);
      if (m.t === 'hello') {
        r.ok = true; r.retry = 0; setStatusSafe('connecté', 'ok');
        r.pong = !!m.pong; if (r.pong) watch(r, ws);
        for (const w of r.pending) ws.send(JSON.stringify(w.msg));
      } else if (m.t === 'view') {
        r.syncing=false;
        const d = m.d;
        for (const [k, v] of Object.entries(d)) {
          if (k === 'myHand') { r.server.hands = v == null ? {} : { [identity]: v }; }
          else if (k === 'myPrivate') { r.server.private = v == null ? {} : { [identity]: v }; }
          else if (v == null) delete r.server[k]; else r.server[k] = v;
        }
        if (!r.loaded) { r.loaded = true; r.readyFn(); }
        endWait();
        rebuild();
      } else if (m.t === 'ack') {
        const i = r.pending.findIndex((w) => w.msg.id === m.id);
        const w = i >= 0 ? r.pending.splice(i, 1)[0] : null;
        rebuild();
        if (w) { clearTimeout(w.timer);endWait();if (m.ok) w.resolve(); else {networkFailure('rejected',w.label);w.reject(new Error(m.error || 'refusé'));} }
      } else if (m.t === 'res') {
        const p = r.waiting.get(m.id); r.waiting.delete(m.id);
        if (p) { if (m.ok) p.resolve(m); else p.reject(new Error(m.error || 'refusé')); }
      } else if (m.t === 'error') {
        networkFailure('server-error');console.error('serveur', m.reason);restart(r);
      }
    };
    ws.onclose = () => lost(r, ws);
    return r;
  }

  // Fin d'une prise (fermée par le réseau ou abandonnée par nous) : une seule fois par prise.
  function lost(r, ws) {
    if (ws.dead) return;
    ws.dead = true;
    if (r.ws !== ws) return;
    clearTimeout(r.live); r.live = null;
    r.ok = false;
    for (const p of r.waiting.values()) p.reject(new Error('Connexion interrompue'));
    r.waiting.clear();
    // Les actions de jeu non confirmées ne sont pas renvoyées (pas de double coup).
    for (const w of r.pending.filter((x) => x.action)){clearTimeout(w.timer);networkFailure('disconnected',w.label);w.reject(new Error('Connexion interrompue'));}
    r.pending = r.pending.filter((x) => !x.action);
    rebuild();
    setStatusSafe('reconnexion…', 'err');
    const delay = Math.min(3000, 300 * Math.pow(2, r.retry++));
    setTimeout(() => connect(r.code), delay);
  }

  // Abandonne la prise courante sans attendre la fin du handshake de fermeture
  // (qui peut durer longtemps sur une connexion morte) et relance la reconnexion :
  // nouveau hello, vue complète du serveur, écritures hors action renvoyées.
  function restart(r, kind) {
    const ws = r.ws;
    if (!ws || ws.dead) return;
    if (kind) recordBug(kind);
    ws.onmessage = null; ws.onclose = null; ws.onerror = null;
    try { ws.close(4000, kind || 'restart'); } catch (_) {}
    lost(r, ws);
  }

  // Vigie applicative (si le serveur sait répondre « pong ») : après IDLE_MS sans
  // aucun message, on envoie un ping ; sans réponse en PONG_MS, la prise est remplacée.
  function watch(r, ws) {
    clearTimeout(r.live);
    r.live = setTimeout(() => {
      if (r.ws !== ws || ws.dead || !r.ok) return;
      try { ws.send(JSON.stringify({ t: 'ping' })); } catch (_) {}
      r.live = setTimeout(() => { if (r.ws === ws) restart(r, 'silent-socket'); }, PONG_MS);
    }, IDLE_MS);
  }

  function setStatusSafe(t, c) { try { if (typeof setStatus === 'function') setStatus(t, c); } catch (e) {} }

  // Retour immédiat au toucher : l'écran est verrouillé jusqu'à la réponse du serveur
  // (au plus 1,5 s), ce qui supprime les doubles envois.
  function startWait() {
    document.body.classList.add('net-wait');
    clearTimeout(waitTimer);
    waitTimer = setTimeout(endWait, 1500);
  }
  function endWait() { clearTimeout(waitTimer); document.body.classList.remove('net-wait'); }

  function sendWrite(path, op, value) {
    const code = roomOf(path);
    if (!code) return Promise.reject(new Error('chemin invalide'));
    const r = connect(code);
    const isAction = keysOf(path)[2] === 'actions';
    if(isAction&&r.loaded&&r.syncing)return Promise.reject(new Error('La partie se reconnecte. Réessaie dans un instant.'));
    const msg = { t: 'w', id: nextId++, path: 'games/' + code + '/' + keysOf(path).slice(2).join('/'), op, value: value === undefined ? null : structuredClone(value) };
    return new Promise((resolve, reject) => {
      const w = { msg, path: msg.path.slice(('games/' + code).length + 1), op, value: msg.value, resolve, reject, action: isAction };
      w.label=isAction?(value?.type||'action'):(keysOf(path)[3]==='peekDone'?'memorize':'write');
      const expire=()=>{
        const index=r.pending.indexOf(w);if(index<0)return;
        // Écriture idempotente hors action (mémorisation, profil…) : gardée et renvoyée
        // une fois sur une nouvelle prise, comme après une coupure ordinaire.
        if(!w.action&&!w.retried){w.retried=true;w.timer=setTimeout(expire,ACK_MS);restart(r,'ack-timeout-retry');return;}
        r.pending.splice(index,1);rebuild();networkFailure('ack-timeout',w.label);
        reject(new Error('Action non confirmée. Vérifie l’état de la partie avant de réessayer.'));
        // Prise probablement à moitié morte : on la remplace pour que les coups suivants passent.
        // L'action expirée n'est jamais rejouée automatiquement (pas de double coup).
        restart(r);
      };
      w.timer=setTimeout(expire,ACK_MS);
      r.pending.push(w);
      // Écriture appliquée localement tout de suite ; une action de jeu attend le serveur.
      if (isAction) startWait(); else rebuild();
      if (r.ws && r.ws.readyState === 1 && r.ok) r.ws.send(JSON.stringify(msg));
    });
  }

  class Ref {
    constructor(path) { this.path = String(path).replace(/^\/+|\/+$/g, ''); const c = roomOf(this.path); if (c) this.path = 'games/' + c + '/' + keysOf(this.path).slice(2).join('/'); this.path = this.path.replace(/\/$/, ''); }
    child(k) { return new Ref(this.path + '/' + k); }
    on(event, fn) {
      const room = roomOf(this.path);
      if (room) connect(room);
      listeners.add({ path: this.path, room, fn, sig: undefined });
      scheduleNotify();
      return fn;
    }
    off() { for (const l of [...listeners]) if (l.path === this.path || l.path.startsWith(this.path + '/')) listeners.delete(l); }
    async once(event, fn) {
      const room = roomOf(this.path);
      if (room) { const r = connect(room); await withTimeout(r.ready, 8000); }
      const s = snapshot(this.path); if (fn) fn(s); return s;
    }
    set(v) { return sendWrite(this.path, 'set', v); }
    update(v) { return sendWrite(this.path, 'update', v); }
    remove() { return sendWrite(this.path, 'remove', null); }
    onDisconnect() { return { remove: () => Promise.resolve(), cancel: () => Promise.resolve(), set: () => Promise.resolve() }; }
  }
  function withTimeout(p, ms) {
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{networkFailure('response-timeout');reject(new Error('Serveur injoignable, réessaie.'));},ms);p.then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});
  }

  window.firebase = {
    auth: () => ({
      signInAnonymously: () => Promise.resolve(),
      onAuthStateChanged: (fn) => { setTimeout(() => fn({ uid: identity }), 0); },
    }),
    database: Object.assign(() => ({ ref: (p) => new Ref(p) }), { ServerValue: { TIMESTAMP: { '.sv': 'timestamp' } } }),
  };
  window.profile = profile;
  window.sessionKey = 'toc9-session:' + profile;

  function request(room, payload) {
    const r = connect(room);
    return withTimeout(r.ready, 8000).then(() => {
      const id=nextId++;
      return withTimeout(new Promise((resolve,reject)=>{
        r.waiting.set(id,{resolve,reject});
        if(r.ws.readyState!==1||!r.ok){reject(new Error('Connexion interrompue'));return;}
        r.ws.send(JSON.stringify(Object.assign({id},payload)));
      }),8000).finally(()=>r.waiting.delete(id));
    });
  }
  window.cloudAvatarOptions = async function (room) {
    const r = connect(room.toUpperCase());
    await withTimeout(r.ready, 8000);
    const game = r.server || {};
    const avatars = { ...(game.identityReservations || (game.state && game.state.avatars) || {}) };
    for (const [id, p] of Object.entries(game.players || {})) if (p.avatar) avatars[id] = p.avatar;
    return { avatars: { ...avatars, ...((game.meta && game.meta.botAvatars) || {}) } };
  };
  window.cloudReserveIdentity = async function (room, playerId, name, avatar) {
    const res = await request(room.toUpperCase(), { t: 'identity', name, avatar });
    return { avatars: res.avatars, name: res.name };
  };
  window.cloudHeartbeat = async function (room) {
    const r = rooms.get(String(room).toUpperCase());
    if (!r || !r.ok) throw new Error('hors ligne');
    if(r.ws?.readyState===1)r.ws.send(JSON.stringify({t:'presence',active:isActive()}));
    return { seen: {} };
  };
})();
