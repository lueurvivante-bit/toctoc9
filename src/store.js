// Mini base temps réel en mémoire, compatible avec l'API Firebase utilisée par le moteur.
// Elle vit dans le serveur de la salle : le moteur lit et écrit ici comme avant dans Firebase.
const clone = (v) => (v === undefined ? null : structuredClone(v));

function stamp(v) {
  if (v && typeof v === 'object') {
    if (v['.sv'] === 'timestamp') return Date.now();
    if (Array.isArray(v)) return v.map(stamp);
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = stamp(x);
    return o;
  }
  return v;
}

export class Store {
  constructor(onChange) {
    this.tree = {};
    this.listeners = new Set();
    this.onChange = onChange;
    this.notifyQueued = false;
  }
  keys(path) { return String(path).split('/').filter(Boolean); }
  get(path) {
    let v = this.tree;
    for (const k of this.keys(path)) { if (v == null || typeof v !== 'object') return null; v = v[k]; }
    return v === undefined ? null : v;
  }
  put(path, value) {
    const keys = this.keys(path);
    if (!keys.length) { this.tree = value || {}; return; }
    let t = this.tree;
    for (const k of keys.slice(0, -1)) { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; t = t[k]; }
    const last = keys[keys.length - 1];
    if (value == null) delete t[last]; else t[last] = stamp(clone(value));
  }
  write(path, op, value) {
    if (op === 'update') for (const [k, v] of Object.entries(value || {})) this.put(path + '/' + k, v);
    else this.put(path, op === 'remove' ? null : value);
    this.scheduleNotify();
    this.onChange && this.onChange();
  }
  scheduleNotify() {
    if (this.notifyQueued) return;
    this.notifyQueued = true;
    queueMicrotask(() => { this.notifyQueued = false; this.notify(); });
  }
  notify() {
    for (const l of [...this.listeners]) {
      if (!this.listeners.has(l)) continue;
      const sig = JSON.stringify(this.get(l.path));
      if (sig !== l.sig) { l.sig = sig; try { l.fn(this.snapshot(l.path)); } catch (e) { console.error('listener', e); } }
    }
  }
  snapshot(path) {
    const self = this;
    return {
      key: this.keys(path).pop(),
      val: () => clone(self.get(path)),
      exists: () => self.get(path) != null,
      forEach: (fn) => Object.keys(self.get(path) || {}).forEach((k) => fn(self.snapshot(path + '/' + k))),
    };
  }
  ref(path) { return new Ref(this, String(path).replace(/^\/+|\/+$/g, '')); }
}

class Ref {
  constructor(store, path) { this.store = store; this.path = path; }
  child(k) { return new Ref(this.store, this.path + '/' + k); }
  on(event, fn) { const l = { path: this.path, fn, sig: undefined }; this.store.listeners.add(l); this.store.scheduleNotify(); return fn; }
  off() { for (const l of [...this.store.listeners]) if (l.path === this.path || l.path.startsWith(this.path + '/')) this.store.listeners.delete(l); }
  once(event, fn) { const s = this.store.snapshot(this.path); if (fn) fn(s); return Promise.resolve(s); }
  set(v) { this.store.write(this.path, 'set', v); return Promise.resolve(); }
  update(v) { this.store.write(this.path, 'update', v); return Promise.resolve(); }
  remove() { this.store.write(this.path, 'remove', null); return Promise.resolve(); }
  onDisconnect() { return { remove: () => Promise.resolve(), cancel: () => Promise.resolve(), set: () => Promise.resolve() }; }
}

export function serverFirebase(store) {
  const database = () => ({ ref: (p) => store.ref(p) });
  database.ServerValue = { TIMESTAMP: { '.sv': 'timestamp' } };
  const auth = () => ({ signInAnonymously: () => Promise.resolve(), onAuthStateChanged() {} });
  return { database, auth, initializeApp() {} };
}
