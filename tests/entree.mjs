// Entrée lueurvivante.fr/toctoc/ : le jeu doit tourner en premier plan (pas d'iframe tierce),
// sinon WebKit rend son localStorage éphémère et le joueur perd son identité.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import { route, prefixLocation } from '../src/route.js';

assert.deepEqual(route('/toctoc'), { redirect: '/toctoc/' });
assert.deepEqual(route('/toctoc/'), { path: '/', prefixed: true });
assert.deepEqual(route('/toctoc/net.js'), { path: '/net.js', prefixed: true });
assert.deepEqual(route('/toctoc/ws'), { path: '/ws', prefixed: true });
assert.deepEqual(route('/ws'), { path: '/ws', prefixed: false });
assert.deepEqual(route('/'), { path: '/', prefixed: false });
assert.deepEqual(route('/toctocx'), { origin: true });
assert.deepEqual(route('/toctoc-autre'), { origin: true });
const withQuery=new URL('https://lueurvivante.fr/toctoc?profil=a');
withQuery.pathname=route(withQuery.pathname).redirect;
assert.equal(withQuery.href,'https://lueurvivante.fr/toctoc/?profil=a');
assert.equal(prefixLocation('/'), '/toctoc/');
assert.equal(prefixLocation('https://x/'), 'https://x/');
assert.equal(prefixLocation('//evil/'), '//evil/');

const toml = readFileSync('wrangler.toml', 'utf8');
assert.match(toml, /pattern = "lueurvivante\.fr\/toctoc\*"/);
// Un asset public/toctoc/index.html serait servi avant le Worker et masquerait le jeu.
assert.ok(!existsSync('public/toctoc/index.html'), 'public/toctoc/index.html masquerait le jeu');
const html = readFileSync('public/index.html', 'utf8');
assert.ok(!/<iframe[^>]+src="https?:/i.test(html), 'iframe tierce dans le jeu');
assert.match(html, /<script src="net\.js"><\/script>/, 'net.js doit rester relatif');

// URL WebSocket déduite du dossier de la page.
function wsUrl(origin, pathname) {
  let opened = null;
  const ctx = { window: {}, location: { search: '', origin, pathname }, URLSearchParams, crypto: globalThis.crypto, structuredClone, console, queueMicrotask: () => {}, Map, Set, Promise, Date,
    localStorage: { getItem: () => null, setItem() {} }, setTimeout: () => 0, clearTimeout() {}, document: { body: { classList: { add() {}, remove() {} } } },
    WebSocket: class { constructor(u) { opened = u; } send() {} close() {} } };
  vm.runInNewContext(readFileSync('public/net.js', 'utf8'), ctx);
  ctx.window.firebase.database().ref('games/ABCD/state').on('value', () => {});
  return opened;
}
assert.equal(wsUrl('https://lueurvivante.fr', '/toctoc/'), 'wss://lueurvivante.fr/toctoc/ws?room=ABCD');
assert.equal(wsUrl('https://toctoc9.lueurvivante.workers.dev', '/'), 'wss://toctoc9.lueurvivante.workers.dev/ws?room=ABCD');
assert.equal(wsUrl('http://127.0.0.1:8787', '/'), 'ws://127.0.0.1:8787/ws?room=ABCD');
console.log('Entrée : jeu en premier plan sous /toctoc/, routage assets/ws et URL WebSocket OK');
