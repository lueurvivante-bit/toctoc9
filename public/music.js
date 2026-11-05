// music.js — Fond sonore de Toc Toc (décision de Jonathan, 5 novembre 2026).
// Même musique et mêmes règles que la Galaxie LueurVivante (Academy,
// docs/AMBIENT_MUSIC_SPEC.md) : aucune parole, volume modéré-bas par défaut,
// paliers et réglage partagés avec la Galaxie (même origine lueurvivante.fr).
// Toc Toc est un jeu, pas un travail : la musique joue partout, partie comprise.
// Fichier client uniquement : chargé avant le script principal, il n'entre pas
// dans le moteur serveur généré par build.mjs.
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

  const BASE = 'https://lawjphlxxkgvvcvuzgki.supabase.co/storage/v1/object/public/ambient-music/';
  const TRACKS = [
    { title: 'Prod 2', artist: 'Yellow Fifteen', file: 'prod-2.692d7cdc7e70.m4a' },
    { title: 'Prod 3', artist: 'Yellow Fifteen', file: 'prod-3.0fcf5f2cc004.m4a' },
  ];
  const LEVELS = [
    { label: 'Muet', gain: 0 }, { label: 'Murmure', gain: 0.015 }, { label: 'Très doux', gain: 0.04 },
    { label: 'Doux', gain: 0.06 }, { label: 'Moyen', gain: 0.1 }, { label: 'Fort', gain: 0.3 }, { label: 'Très fort', gain: 0.6 },
  ];
  const MAX = 6, DEFAULT = 3, CAP = 4, FADE_MS = 2000, STOP_MS = 300, TOAST_MS = 3000;
  const KEY = 'lueurvivante.ambient-music.v1';

  // ---- Préférences (format version 2 de la Galaxie) ------------------------
  const isLevel = (v) => Number.isInteger(v) && v >= 0 && v <= MAX;
  function readPrefs() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    const v = raw && typeof raw === 'object' ? { ...raw } : {};
    if (raw && v.version !== 2) {
      for (const k of ['level', 'lastAudibleLevel']) {
        const old = v[k];
        v[k] = Number.isInteger(old) && old >= 1 && old <= 5 ? old + 1 : old === 0 ? 0 : undefined;
      }
    }
    const loud = v.loudUnlocked === true, cap = loud ? MAX : CAP;
    const level = isLevel(v.level) ? Math.min(v.level, cap) : DEFAULT;
    const last = isLevel(v.lastAudibleLevel) && v.lastAudibleLevel > 0 ? Math.min(v.lastAudibleLevel, cap) : DEFAULT;
    return { version: 2, level, lastAudibleLevel: level > 0 ? level : last, loudUnlocked: loud, consentAsked: v.consentAsked === true };
  }
  let prefs = readPrefs();
  const cap = () => (prefs.loudUnlocked ? MAX : CAP);
  function savePrefs(next) {
    const level = Math.max(0, Math.min(cap(), next.level));
    prefs = { ...prefs, ...next, level, consentAsked: true, lastAudibleLevel: level > 0 ? level : prefs.lastAudibleLevel };
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* réglage gardé pour la session */ }
    reconcile();
    render();
  }

  // ---- Lecteur --------------------------------------------------------------
  try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* bouton silencieux par défaut */ }
  const audio = new Audio();
  audio.preload = 'auto';
  let gainNode = null, context = null;
  const volumeWritable = (() => { try { audio.volume = 0.5; const ok = Math.abs(audio.volume - 0.5) < 0.01; audio.volume = 1; return ok; } catch (e) { return false; } })();
  if (!volumeWritable) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      audio.crossOrigin = 'anonymous';
      context = new Ctx();
      gainNode = context.createGain();
      context.createMediaElementSource(audio).connect(gainNode).connect(context.destination);
    }
  }
  let gain = 0, playing = false, wantPlaying = false, userPaused = false, loaded = false, armed = false, fadeTimer = 0;
  let index = Math.floor(Math.random() * TRACKS.length);
  const setGain = (g) => { gain = g; if (gainNode) gainNode.gain.value = g; else audio.volume = Math.max(0, Math.min(1, g)); };
  function attempt() {
    if (!wantPlaying) return;
    if (context) context.resume().catch(() => {});
    audio.play().catch((e) => { if (e && e.name === 'NotAllowedError') arm(); });
  }
  function onGesture() {
    armed = false;
    for (const t of ['pointerdown', 'keydown', 'touchend']) document.removeEventListener(t, onGesture, true);
    attempt();
  }
  function arm() {
    if (armed) return;
    armed = true;
    for (const t of ['pointerdown', 'keydown', 'touchend']) document.addEventListener(t, onGesture, true);
  }
  function fadeTo(target, ms, done) {
    clearTimeout(fadeTimer);
    const from = gain, start = performance.now();
    const step = () => {
      const t = ms <= 0 ? 1 : Math.min(1, (performance.now() - start) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      setGain(from + (target - from) * e);
      if (t >= 1) { if (done) done(); render(); } else fadeTimer = setTimeout(step, 50);
    };
    step();
  }
  const wanted = () => prefs.consentAsked && prefs.level > 0 && !userPaused && document.visibilityState !== 'hidden';
  function load(i) { index = i; loaded = true; audio.src = BASE + TRACKS[i].file; audio.load(); }
  function start(i, ms) {
    load(i); setGain(0); wantPlaying = true; playing = true; attempt();
    fadeTo(LEVELS[prefs.level].gain, ms); showToast();
  }
  function reconcile() {
    const target = LEVELS[prefs.level].gain;
    if (wanted()) {
      if (!loaded) start(index, FADE_MS);
      else if (!playing) { wantPlaying = true; playing = true; attempt(); fadeTo(target, FADE_MS); }
      else fadeTo(target, gain < target * 0.5 ? FADE_MS : 250);
    } else if (playing) {
      fadeTo(0, document.visibilityState === 'hidden' ? FADE_MS : STOP_MS, () => { wantPlaying = false; audio.pause(); playing = false; });
    }
  }
  function change(i) {
    if (wanted()) start(i, STOP_MS);
    else { clearTimeout(fadeTimer); wantPlaying = false; audio.pause(); playing = false; load(i); showToast(); }
    render();
  }
  audio.addEventListener('ended', () => change((index + 1) % TRACKS.length));
  document.addEventListener('visibilitychange', reconcile);

  // ---- Interface : bouton ♪, panneau persistant, bandeau 3 s ---------------
  const style = document.createElement('style');
  style.textContent = `
  .musicbtn{position:fixed;top:max(12px,env(safe-area-inset-top));right:54px;z-index:41;width:34px;height:34px;padding:0;border-radius:50%;
    background:rgba(0,0,0,.32);border:1px solid var(--line);color:var(--paper);font-size:1rem;box-shadow:none;display:grid;place-items:center;line-height:1}
  .musicbtn[aria-expanded="true"]{border-color:var(--brass-soft)}
  .musicbtn.off::after{content:'';position:absolute;width:20px;height:2px;background:currentColor;transform:rotate(-45deg)}
  .musicpop{position:fixed;top:calc(max(12px,env(safe-area-inset-top)) + 42px);right:12px;z-index:61;width:min(300px,calc(100vw - 24px));
    background:var(--felt-deep,#102b23);color:var(--paper);border:1px solid var(--line);border-radius:14px;padding:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);font-size:.85rem}
  .musicpop .mrow{display:flex;align-items:center;justify-content:space-between;gap:6px}
  .musicpop .mtitle{min-width:0;flex:1}.musicpop .mtitle b,.musicpop .mtitle span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .musicpop .mtitle span{color:var(--muted);font-size:.76rem}
  .musicpop button{min-width:44px;min-height:44px;padding:0 10px;border-radius:22px;background:transparent;border:1px solid transparent;color:var(--paper);box-shadow:none;font-size:1rem}
  .musicpop button:disabled{opacity:.35}.musicpop .mcut{border-color:var(--line);font-size:.82rem}
  .musicpop .mbars{display:flex;align-items:flex-end;gap:3px;height:24px}.musicpop .mbars i{width:5px;border-radius:2px;background:var(--line)}
  .musicpop .mbars i.on{background:var(--brass-soft)}
  .musicpop.toast3{padding:6px 6px 6px 12px}
  .musicask p{margin:4px 0 10px;color:var(--muted);line-height:1.4}.musicask .mrow{justify-content:flex-start}
  .musicask button{border-color:var(--line);font-size:.85rem}
  @media(prefers-reduced-motion:reduce){.musicpop{transition:none}}`;
  const icon = (c) => c + '︎';
  let button = null, pop = null, panelOpen = false, toastVisible = false, toastTimer = 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function showToast() {
    if (panelOpen || !prefs.consentAsked) return;
    toastVisible = true; clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastVisible = false; render(); }, TOAST_MS);
    render();
  }
  function touchToast() { if (toastVisible) showToast(); }

  function controlsHtml() {
    const muted = prefs.level === 0, paused = !playing || userPaused || muted;
    const audible = muted ? prefs.lastAudibleLevel : prefs.level;
    return `<div class="mrow">
        <button type="button" data-m="prev" aria-label="Morceau précédent">${icon('⏮')}</button>
        <button type="button" data-m="play" aria-label="${paused ? 'Lecture' : 'Pause'}">${icon(paused ? '▶' : '⏸')}</button>
        <button type="button" data-m="next" aria-label="Morceau suivant">${icon('⏭')}</button>
      </div><div class="mrow">
        <button type="button" data-m="down" aria-label="Baisser le son" ${muted || audible <= 1 ? 'disabled' : ''}>−</button>
        <span class="mbars" role="img" aria-label="Volume ${esc(LEVELS[audible].label)}">${LEVELS.slice(1).map((_, i) =>
          `<i class="${!muted && i + 1 <= prefs.level ? 'on' : ''}" style="height:${9 + (i + 1) * 3}px;opacity:${i + 1 > cap() ? .3 : 1}"></i>`).join('')}</span>
        <button type="button" data-m="up" aria-label="Monter le son" ${muted || audible >= cap() ? 'disabled' : ''}>+</button>
        <button type="button" class="mcut" data-m="mute" role="switch" aria-checked="${!muted}">${muted ? 'Rétablir' : 'Couper'}</button>
      </div>`;
  }

  function render() {
    if (!button) return;
    const muted = prefs.level === 0;
    button.classList.toggle('off', muted);
    button.setAttribute('aria-expanded', String(panelOpen));
    button.setAttribute('aria-label', panelOpen ? 'Fermer le panneau musique' : 'Ouvrir le panneau musique');
    const track = TRACKS[index];
    let html = '';
    if (!prefs.consentAsked) {
      html = `<div class="musicpop musicask" role="dialog" aria-label="Musique"><b>♪ Musique pendant le jeu ?</b>
        <p>Une ambiance douce, sans paroles. Tu peux la couper à tout moment avec le bouton ♪.</p>
        <div class="mrow"><button type="button" data-m="yes">Oui</button><button type="button" data-m="no">Non merci</button></div></div>`;
    } else if (panelOpen) {
      html = `<div class="musicpop" role="dialog" aria-label="Panneau musique"><div class="mrow"><div class="mtitle"><b>${esc(track.title)}</b>
        <span>${muted ? 'Son coupé' : esc(track.artist) + ' · ' + esc(LEVELS[prefs.level].label)}</span></div>
        <button type="button" data-m="close" aria-label="Fermer le panneau musique">✕</button></div>${controlsHtml()}</div>`;
    } else if (toastVisible) {
      html = `<div class="musicpop toast3" aria-label="Musique : ${esc(track.title)}, ${esc(track.artist)}"><div class="mrow"><div class="mtitle"><b>♪ ${esc(track.title)}</b>
        <span>${esc(track.artist)}</span></div>
        <button type="button" data-m="prev" aria-label="Morceau précédent">${icon('⏮')}</button>
        <button type="button" data-m="play" aria-label="${!playing || userPaused || muted ? 'Lecture' : 'Pause'}">${icon(!playing || userPaused || muted ? '▶' : '⏸')}</button>
        <button type="button" data-m="next" aria-label="Morceau suivant">${icon('⏭')}</button>
        <button type="button" data-m="hide" aria-label="Fermer le lecteur">✕</button></div></div>`;
    }
    pop.innerHTML = html;
  }

  function act(m) {
    if (m === 'yes') savePrefs({ level: prefs.level || DEFAULT });
    else if (m === 'no') savePrefs({ level: 0 });
    else if (m === 'close') { panelOpen = false; render(); }
    else if (m === 'hide') { toastVisible = false; clearTimeout(toastTimer); render(); }
    else if (m === 'prev') { change((index - 1 + TRACKS.length) % TRACKS.length); touchToast(); }
    else if (m === 'next') { change((index + 1) % TRACKS.length); touchToast(); }
    else if (m === 'play') {
      if (prefs.level === 0) savePrefs({ level: prefs.lastAudibleLevel });
      else { userPaused = !userPaused; reconcile(); render(); }
      touchToast();
    } else if (m === 'down') savePrefs({ level: prefs.level - 1 });
    else if (m === 'up') savePrefs({ level: prefs.level + 1 });
    else if (m === 'mute') savePrefs({ level: prefs.level === 0 ? prefs.lastAudibleLevel : 0 });
  }

  function mount() {
    document.head.appendChild(style);
    button = document.createElement('button');
    button.type = 'button'; button.className = 'musicbtn'; button.textContent = '♪';
    button.onclick = () => { if (!prefs.consentAsked) return; panelOpen = !panelOpen; toastVisible = false; render(); };
    pop = document.createElement('div');
    pop.addEventListener('click', (e) => { const b = e.target.closest('button[data-m]'); if (b) act(b.dataset.m); });
    document.body.appendChild(button);
    document.body.appendChild(pop);
    render();
    reconcile();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
