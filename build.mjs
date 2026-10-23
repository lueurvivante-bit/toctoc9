// Génère src/engine.gen.js à partir du script de public/index.html.
// Le serveur exécute EXACTEMENT le même code de règles que l'interface :
// aucune copie manuelle, donc aucune divergence possible entre client et serveur.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const html = readFileSync(new URL('./public/index.html', import.meta.url), 'utf8');
const match = html.match(/<script>([\s\S]*)<\/script>/);
if (!match) throw new Error('Script principal introuvable dans public/index.html');
const script = match[1];

const out = `// FICHIER GÉNÉRÉ par build.mjs — ne pas modifier à la main.
// Chaque salle reçoit sa propre copie isolée du moteur (variables propres à la salle).
export function createRuntime(host) {
  const __SERVER__ = true;
  const stub = () => new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()),
    set: () => true,
    apply: () => stub(),
  });
  const node = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild() {}, remove() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, textContent: '', innerHTML: '', firstElementChild: null });
  const document = { getElementById: () => node(), createElement: () => node(), querySelector: () => null,
    querySelectorAll: () => [], body: node(), documentElement: node(), addEventListener() {}, fonts: { ready: Promise.resolve() } };
  const window = { addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const navigator = {};
  const location = { search: '', href: 'https://toctoc.local/', origin: 'https://toctoc.local' };
  const history = { replaceState() {}, pushState() {} };
  const memory = new Map();
  const localStorage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
  const sessionStorage = localStorage;
  const firebase = host.firebase;
  const profile = 'serveur', sessionKey = 'toc-session:serveur';
  const setInterval = () => 0, clearInterval = () => {};
  const setTimeout = host.setTimeout, clearTimeout = host.clearTimeout;
  const requestAnimationFrame = undefined;
  const confirm = () => true, alert = () => {};
  const performance = { now: () => Date.now() };
  const cloudAvatarOptions = async () => ({ avatars: {} });
  const cloudReserveIdentity = async () => { throw new Error('serveur'); };
  const cloudHeartbeat = async () => ({ seen: {} });

${script}

  // ---------- Interface serveur (au-dessus du moteur d'origine) ----------
  let __lastToast = null;
  toast = function (m) { __lastToast = m; };
  dbError = function (e) { console.error('engine db', e); };
  scheduleRender = function () {};
  renderGame = function () {};
  playSfx = function () {};
  buzz = function () {};
  onStateFx = function () {};

  function attach(room, hostId) {
    code = room; uid = hostId; isHost = true;
    metaRef = db.ref('games/' + room + '/meta');
    stateRef = db.ref('games/' + room + '/state');
    // Réplique exacte de la partie « organisateur » d'enterGame, sans l'écran.
    stateRef.on('value', function (s) {
      gstate = s.val();
      if (G && gstate && gstate.avatars) { G.avatars = gstate.avatars; G.names = Object.assign({}, G.names, gstate.names); }
      if (!G || !gstate) return;
      hostMaybeAdvance(); maybeScheduleBot(); maybeScheduleTurnTimer();
    });
  }

  return {
    attach,
    setHost(hostId) { uid = hostId; if (G) G.hostId = hostId; },
    get G() { return G; },
    get gstate() { return gstate; },
    launch(by, players, meta, reservations) {
      __lastToast = null;
      uid = by; isHost = true; G = null;
      hostCfg = normalizeConfig(meta.cfg || {});
      roomLevel = meta.level || 'normal';
      roomAvatars = Object.assign({}, reservations || {});
      roomCreator = meta.creator || null;
      launchGame(players);
      return __lastToast;
    },
    restore(engine, hostId) {
      const e = structuredClone(engine);
      e.deck = toArr(e.deck); e.order = toArr(e.order); e.discard = toArr(e.discard); e.botIds = toArr(e.botIds);
      e.hands = e.hands || {}; Object.keys(e.hands).forEach(function (u) { e.hands[u] = toArr(e.hands[u]); });
      e.roster = toArr(e.roster); e.eliminated = toArr(e.eliminated); e.scores = e.scores || {}; e.names = e.names || {}; e.skip = e.skip || {};
      e.hostId = hostId; uid = hostId; G = e;
      try { hostMaybeAdvance(); maybeScheduleBot(); maybeScheduleTurnTimer(); } catch (err) { console.error(err); }
    },
    action(a) { processAction(a); },
    // L'organisateur quitte en cours de partie : même logique que quitGame() côté organisateur.
    hostLeave(by) {
      if (!G || by !== G.hostId) return null;
      const remaining = G.order.filter(function (u) { return u !== by; });
      const humans = remaining.filter(function (u) { return !isBotId(u); });
      if (remaining.length >= 2 && humans.length >= 1) {
        kickPlayer(by); saveEngine();
        G.hostId = humans[0]; uid = humans[0];
        return humans[0];
      }
      if (stateRef) stateRef.update({ phase: 'over', verdict: 'Partie terminée — pas assez de joueurs.', winner: null, pendingFigure: null });
      return null;
    },
    // Joueur absent : jamais joué par un bot. Voir hostPresenceTick dans public/index.html.
    presenceTick(seen) { hostPresenceTick(seen); },
  };
}
`;
const target = new URL('./src/engine.gen.js', import.meta.url);
// N'écrit que si le contenu change : évite une boucle de reconstruction en mode développement.
if (!existsSync(target) || readFileSync(target, 'utf8') !== out) writeFileSync(target, out);
console.log('src/engine.gen.js prêt (' + out.length + ' octets)');
