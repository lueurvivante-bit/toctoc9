// Toc Toc 9 — serveur « croupier ».
// Une salle = un Durable Object. Il garde le paquet et toutes les mains,
// exécute les règles, et n'envoie à chaque joueur QUE ce qu'il a le droit de voir.
import { DurableObject } from 'cloudflare:workers';
import { createRuntime } from './engine.gen.js';
import { Store, serverFirebase } from './store.js';
import { route, prefixLocation } from './route.js';

const ROOM_RE = /^[A-Z0-9]{4}$/;
const ICONS = ['fox', 'bear', 'panda', 'lion', 'tiger', 'koala', 'frog', 'owl', 'monkey', 'penguin', 'unicorn', 'octopus', 'cat', 'dog', 'rabbit', 'mouse', 'wolf', 'chick', 'dragon', 'robot'];
const ACTIONS = new Set(['launch', 'draw', 'discard', 'swap', 'snap', 'take', 'toc', 'fig_accept', 'fig_skip', 'fig_look', 'fig_swap', 'fig_done', 'newround', 'restart', 'kick', 'leave']);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const r = route(url.pathname);
    if (r.redirect) { url.pathname = r.redirect; return Response.redirect(url.href, 308); }
    url.pathname = r.path;
    if (url.pathname === '/ws') {
      const room = (url.searchParams.get('room') || '').toUpperCase();
      if (!ROOM_RE.test(room)) return new Response('Salle invalide', { status: 400 });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendu', { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    }
    const res = await env.ASSETS.fetch(new Request(url, request));
    const loc = res.headers.get('Location');
    if (!r.prefixed || !loc || prefixLocation(loc) === loc) return res;
    const out = new Response(res.body, res);
    out.headers.set('Location', prefixLocation(loc));
    return out;
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sockets = new Set();
    this.seen = {};
    this.tokens = {};
    this.born = Date.now();
    this.code = null;
    this.flushTimer = null;
    this.saveTimer = null;
    this.tick = null;
    this.store = new Store(() => this.changed());
    this.runtime = createRuntime({ firebase: serverFirebase(this.store), setTimeout, clearTimeout });
    this.attached = false;
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get('room');
      if (saved) { this.store.tree = saved.tree || {}; this.tokens = saved.tokens || {}; this.code = saved.code || null; }
    });
  }

  base() { return 'games/' + this.code; }
  game() { return this.store.get(this.base()) || {}; }

  ensureEngine() {
    const g = this.game();
    if (!g.meta || this.attached) return;
    this.runtime.attach(this.code, g.meta.host);
    this.attached = true;
    if (g.engine && g.meta.phase === 'playing' && g.state && g.state.phase !== 'over') this.runtime.restore(g.engine, g.meta.host);
  }

  async fetch(request) {
    const room = new URL(request.url).searchParams.get('room').toUpperCase();
    if (!this.code) this.code = room;
    this.ensureEngine();
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    const conn = { ws: server, uid: null, last: {}, acks: [] };
    server.addEventListener('message', (ev) => this.onMessage(conn, ev.data));
    const bye = () => { this.sockets.delete(conn); if (conn.uid) this.seen[conn.uid] = Date.now(); if (!this.sockets.size) this.stopTick(); };
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }

  send(conn, msg) { try { conn.ws.send(JSON.stringify(msg)); } catch (e) { /* fermé */ } }

  onMessage(conn, raw) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'hello') return this.hello(conn, m);
    if (!conn.uid) return this.send(conn, { t: 'error', reason: 'non identifié' });
    this.seen[conn.uid] = Date.now();
    if (m.t === 'w') return this.clientWrite(conn, m);
    if (m.t === 'identity') return this.identity(conn, m);
  }

  hello(conn, m) {
    const uid = String(m.uid || ''), token = String(m.token || '');
    if (!/^[\w-]{8,64}$/.test(uid) || token.length < 16) return this.send(conn, { t: 'error', reason: 'identité invalide' });
    // Un identifiant de joueur est lié à son jeton secret : personne ne peut se faire passer pour lui.
    if (this.tokens[uid] && this.tokens[uid] !== token) return this.send(conn, { t: 'error', reason: 'identité déjà utilisée' });
    this.tokens[uid] = token;
    conn.uid = uid;
    this.seen[uid] = Date.now();
    this.sockets.add(conn);
    this.startTick();
    this.send(conn, { t: 'hello', ok: true, now: Date.now() });
    this.flushConn(conn, true);
    this.persist();
  }

  // ---------- Écritures autorisées des joueurs ----------
  clientWrite(conn, m) {
    const uid = conn.uid, base = this.base(), path = String(m.path || '');
    let error = null;
    try {
      if (!path.startsWith(base + '/') && path !== base) throw new Error('hors salle');
      const rel = path.slice(base.length + 1).split('/').filter(Boolean);
      const g = this.game(), meta = g.meta;
      const isHost = meta && meta.host === uid;
      const op = m.op;
      if (rel[0] === 'meta' && rel.length === 1 && op === 'set') {
        const v = m.value || {};
        if (meta) throw new Error('Ce code de partie existe déjà.');
        if (v.host !== uid || v.phase !== 'lobby') throw new Error('création invalide');
        this.store.write(path, 'set', { host: uid, phase: 'lobby', level: String(v.level || 'normal'), cfg: v.cfg || {}, createdAt: Date.now() });
        this.ensureEngine();
        this.runtime.setHost(uid);
      } else if (rel[0] === 'meta' && op === 'update') {
        if (!isHost || meta.phase !== 'lobby') throw new Error('réservé à l’organisateur');
        const sub = rel.slice(1).join('/');
        const value = {};
        for (const [k, v] of Object.entries(m.value || {})) {
          const key = (sub ? sub + '/' : '') + k;
          if (!/^cfg(\/[A-Za-z]+)?$/.test(key)) throw new Error('champ interdit');
          value[key] = v;
        }
        this.store.write(base + '/meta', 'update', value);
      } else if (rel[0] === 'players' && rel[1]) {
        const target = rel[1];
        if (op === 'remove' && rel.length === 2) {
          if (target !== uid && !(isHost && meta.phase === 'lobby')) throw new Error('interdit');
          this.store.write(path, 'remove', null);
        } else if (target === uid && rel.length === 2 && (op === 'update' || op === 'set')) {
          const v = m.value || {}, cur = (g.players || {})[uid] || {};
          const next = { ...cur };
          if (typeof v.name === 'string' && v.name.trim() && v.name.length <= 14) next.name = v.name.trim();
          next.isHost = !!(meta && meta.host === uid);
          next.joinedAt = cur.joinedAt || Date.now();
          if (!next.name) throw new Error('pseudo requis');
          if (!cur.name && meta && meta.phase !== 'lobby') throw new Error('La partie a déjà commencé.');
          this.store.write(path, 'set', next);
        } else throw new Error('interdit');
      } else if (rel[0] === 'state' && rel[1] === 'peekDone' && rel[2] === uid && rel.length === 3 && op === 'set') {
        if (!g.state || g.state.phase !== 'peek') throw new Error('hors mémorisation');
        this.store.write(path, 'set', true);
      } else if (rel[0] === 'actions' && rel.length === 2 && op === 'set') {
        const a = Object.assign({}, m.value || {}, { by: uid, ts: Date.now() });
        if (!ACTIONS.has(a.type)) throw new Error('action inconnue');
        this.handleAction(a);
      } else {
        throw new Error('écriture interdite');
      }
    } catch (e) {
      error = e.message || 'refusé';
    }
    conn.acks.push({ t: 'ack', id: m.id, ok: !error, error });
    this.changed(true);
  }

  handleAction(a) {
    const g = this.game();
    if (!g.meta) return;
    if (a.type === 'launch') {
      if (a.by !== g.meta.host || g.meta.phase !== 'lobby') return;
      const players = Object.entries(g.players || {}).map(([uid, p]) => Object.assign({ uid }, p))
        .sort((x, y) => (x.joinedAt || 0) - (y.joinedAt || 0));
      const msg = this.runtime.launch(a.by, players, g.meta, g.identityReservations || {});
      if (msg) throw new Error(msg);
      return;
    }
    const G = this.runtime.G;
    if (a.type === 'leave' && G && a.by === G.hostId) {
      const next = this.runtime.hostLeave(a.by);
      if (next) this.store.write(this.base() + '/meta', 'update', { host: next });
      return;
    }
    this.runtime.action(a);
  }

  // ---------- Réservation du pseudo et du personnage (reprise de cloud-services.js) ----------
  identity(conn, m) {
    const uid = conn.uid, name = String(m.name || ''), avatar = m.avatar;
    const reply = (ok, extra) => { this.send(conn, Object.assign({ t: 'res', id: m.id, ok }, extra)); };
    const game = structuredClone(this.game());
    if (!game.meta) return reply(false, { error: 'Aucune partie avec ce code.' });
    if (!name.trim() || name.length > 14 || !ICONS.includes(avatar)) return reply(false, { error: 'Choisis un pseudo et un personnage.' });
    const players = game.players || {}, existing = players[uid], cfg = game.meta.cfg || {};
    const capacity = (cfg.nPlayers || 2) - (cfg.bots || 0) + (cfg.adminPlays === false ? 1 : 0);
    if (!existing && Object.keys(players).length >= capacity) return reply(false, { error: 'La salle est complète.' });
    if (!existing && game.meta.phase !== 'lobby') return reply(false, { error: 'La partie a déjà commencé.' });
    if (Object.entries(players).some(([id, p]) => id !== uid && (p.name || '').trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())) return reply(false, { error: 'Ce pseudo est déjà pris.' });
    const avatars = { ...(game.identityReservations || (game.state && game.state.avatars) || (game.engine && game.engine.avatars) || {}), ...(game.meta.botAvatars || {}) };
    for (const [id, p] of Object.entries(players)) if (p.avatar) avatars[id] = p.avatar;
    if (Object.entries(avatars).some(([id, a]) => id !== uid && a === avatar)) return reply(false, { error: 'Ce personnage vient d’être choisi. Choisis-en un autre.' });
    avatars[uid] = avatar;
    const roster = (game.engine && game.engine.roster) || [...Object.keys(players), ...Array.from({ length: cfg.bots || 0 }, (_, i) => 'bot_' + (i + 1))];
    if (!roster.includes(uid)) roster.push(uid);
    const used = new Set(Object.values(avatars));
    for (const id of roster) if (!avatars[id]) { const free = ICONS.find((i) => !used.has(i)); if (free) { avatars[id] = free; used.add(free); } }
    const base = this.base();
    const update = {
      identityReservations: avatars,
      ['players/' + uid]: { ...(existing || {}), name: name.trim(), avatar, isHost: game.meta.host === uid, joinedAt: (existing && existing.joinedAt) || Date.now() },
      'meta/botAvatars': Object.fromEntries(Object.entries(avatars).filter(([id]) => id.startsWith('bot_'))),
    };
    if (game.state) { update['state/avatars'] = avatars; update['state/names/' + uid] = name.trim(); }
    this.store.write(base, 'update', update);
    const G = this.runtime.G;
    if (G) { G.avatars = avatars; G.names = Object.assign({}, G.names, { [uid]: name.trim() }); }
    this.changed(true);
    reply(true, { avatars, name: name.trim() });
  }

  // ---------- Diffusion : chaque joueur reçoit sa vue filtrée ----------
  changed(soon) {
    this.persist();
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; this.flushAll(); }, 0);
  }

  view(uid) {
    const g = this.game();
    return {
      meta: g.meta || null,
      players: g.players || null,
      state: g.state || null,
      identityReservations: g.identityReservations || null,
      myHand: (g.hands && g.hands[uid]) || null,
      myPrivate: (g.private && g.private[uid]) || null,
    };
  }

  flushConn(conn, full) {
    const v = this.view(conn.uid), diff = {};
    let any = false;
    for (const [k, val] of Object.entries(v)) {
      const s = JSON.stringify(val);
      if (full || conn.last[k] !== s) { conn.last[k] = s; diff[k] = val; any = true; }
    }
    if (any) this.send(conn, { t: 'view', d: diff, full: !!full });
    for (const ack of conn.acks.splice(0)) this.send(conn, ack);
  }

  flushAll() { for (const c of this.sockets) this.flushConn(c, false); }

  persist() {
    if (this.saveTimer || !this.game().meta) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.ctx.storage.put('room', { tree: this.store.tree, tokens: this.tokens, code: this.code }).catch((e) => console.error('save', e));
    }, 1000);
  }

  // ---------- Présence : reprise automatique et organisateur de secours ----------
  startTick() {
    if (this.tick) return;
    this.tick = setInterval(() => this.presence(), 1000);
  }
  stopTick() { if (this.tick) { clearInterval(this.tick); this.tick = null; } }

  presence() {
    const now = Date.now();
    for (const c of this.sockets) if (c.uid) this.seen[c.uid] = now;
    const g = this.game(), meta = g.meta;
    if (!meta) return;
    if (now - this.born > 10000 && now - (this.seen[meta.host] || 0) > 10000) {
      const live = Object.keys(g.players || {}).filter((u) => now - (this.seen[u] || 0) < 3000).sort();
      if (live[0] && live[0] !== meta.host) {
        this.store.write(this.base() + '/meta', 'update', { host: live[0] });
        this.runtime.setHost(live[0]);
      }
    }
    try { this.runtime.presenceTick(this.seen); } catch (e) { console.error('presence', e); }
  }
}
