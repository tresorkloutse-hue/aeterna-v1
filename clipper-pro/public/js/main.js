// Clipper Pro : interface principale (film, analyse, clips, habillage, export).
import { S, DEFAULT_UI, $, wait, once, ts, fmtBytes, clamp, esc, toast, logError, on, emit, filmName, pct, download, safeName } from './state.js';
import { kv, films, meta, clipsDb, blobs, migrate, askPersist } from './db.js';
import { openInput, fastAnalyze, webcodecs, loadMB, smallFrames } from './media.js';
import { detect } from './detect.js';
import { Renderer } from './render.js';
import { A, initAudio, startMusic, stopMusic, playbackAnalyze, exportLive } from './live.js';
import { exportFast, fastSupported, QUALITY } from './export.js';
import { initMusic, stopMusicPreview } from './music.js';
import { transcribeClip, retime } from './subs.js';
import { computeTrack, centerAt } from './track.js';
import { scoreClip, scoreClass, firstSecondsCheck } from './viral.js';
import { GENRES, hooksFor, buildCaption, pickQuote } from './captions.js';
import { initPanels, capOptions, refreshLibCount } from './panels.js';

window.addEventListener('error', e => { logError(e.message); });
window.addEventListener('unhandledrejection', e => { logError(String(e.reason)); });

const v = $('v'), cv = $('cv'), R = new Renderer(cv), tl = $('tl');
const tracks = {};       // suivis de cadrage calculés (mémoire)
let smooth = null, previewing = false, previewEnd = 0, dirty = true, lastIdle = 0;

/* ---------- Réglages : formulaire <-> S.ui ---------- */
const UI_IDS = Object.keys(DEFAULT_UI);
function fillForm() {
  UI_IDS.forEach(id => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = !!S.ui[id]; else el.value = S.ui[id]; });
}
let saveT = null;
function readForm(e) {
  const el = e && e.target; if (!el || !el.id || !(el.id in DEFAULT_UI)) return;
  S.ui[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  dirty = true;
  clearTimeout(saveT); saveT = setTimeout(() => { kv.set('ui2', S.ui).catch(() => {}); if (S.film && (el.id === 'title' || el.id === 'genre')) savePer(); }, 400);
  if (['mtype', 'sens', 'limit', 'minLen', 'partLen', 'maxMoment'].includes(el.id)) runDetect();
  if (el.id === 'nextCard') S.clips.forEach(c => { c.nonext = !S.ui.nextCard || !!(S.per && S.per.nonext && S.per.nonext[c.key]); });
  if (['hook3', 'loopOn', 'subsOn', 'quality', 'mode', 'follow', 'showTitle', 'nextCard'].includes(el.id)) renderClips();
  if (el.id === 'mode') syncFraming();
  if (el.id === 'engine' || el.id === 'quality' || el.id === 'fmt') updateEstimate();
}
function syncFraming() {
  const z = S.ui.mode === 'fill';
  $('bgStyle').disabled = $('bgBlur').disabled = z;
  $('bgStyle').closest('label').style.opacity = $('bgBlur').closest('label').style.opacity = z ? .45 : 1;
}

// Attente limitée : si la mémoire du navigateur ne répond pas (ancien onglet ouvert), le site continue sans elle.
const soft = (p, ms = 6000) => Promise.race([Promise.resolve(p).catch(() => undefined), wait(ms)]);

/* ---------- Film ---------- */
async function fingerprint(f) { return f.name + '|' + f.size; }

async function loadFilm(file, opts = {}) {
  if (!file) return;
  stopPreview(); stopMusicPreview();
  if (S.film && S.film.url) URL.revokeObjectURL(S.film.url);
  const fp = await fingerprint(file), url = URL.createObjectURL(file);
  S.film = { file, fp, name: file.name, size: file.size, url, dur: 0, w: 0, h: 0, mb: null };
  S.data = null; S.clips = []; S.curClip = null; smooth = null;
  for (const k in tracks) delete tracks[k];
  v.src = url;
  $('drop').hidden = true; $('recent').hidden = true; $('vbox').hidden = false; $('s2').hidden = false; $('s3').hidden = true; $('s4').hidden = true;
  $('tl').hidden = true; $('tlcap').hidden = true; $('list').textContent = '';
  $('analyse').disabled = true; $('status').textContent = 'Ouverture du film…';
  await Promise.race([once(v, 'loadedmetadata'), once(v, 'error'), wait(15000)]);
  initAudio(v);
  S.film.dur = v.duration || 0; S.film.w = v.videoWidth; S.film.h = v.videoHeight;
  $('status').textContent = 'Préparation…';
  S.film.mb = await openInput(file);
  if (S.film.mb) { S.film.w = S.film.mb.w || S.film.w; S.film.h = S.film.mb.h || S.film.h; S.film.dur = S.film.mb.dur || S.film.dur; S.film.fps = S.film.mb.fps; }
  S.film.hasAudio = S.film.mb ? !!S.film.mb.at : true;
  if (!S.film.mb && !(v.readyState >= 1 && v.duration)) {
    $('status').textContent = 'Ce fichier ne peut pas être lu par ton navigateur. Convertis-le en MP4 (H.264 + AAC), par exemple avec HandBrake, puis réessaie.';
    $('vinfo').textContent = fmtBytes(file.size); logError('film illisible ' + file.name); return;
  }
  const per = (await soft(kv.get('f2:' + fp))) || { flags: {}, subs: {}, notes: {}, caps: {}, exported: [] };
  per.flags = per.flags || {}; per.subs = per.subs || {}; per.notes = per.notes || {}; per.caps = per.caps || {}; per.exported = per.exported || [];
  S.per = per;
  if (per.title !== undefined) { S.ui.title = per.title; S.ui.genre = per.genre || S.ui.genre; }
  else S.ui.title = 'Film : ' + file.name.replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ').trim();
  fillForm();
  const m = (await soft(meta.get(fp))) || { fp, name: file.name, size: file.size, added: Date.now() };
  Object.assign(m, { lastOpen: Date.now(), dur: S.film.dur, w: S.film.w, h: S.film.h });
  const keep = (await soft(kv.get('keepFilm'))) !== false;
  if (keep && !opts.fromStore) {
    try { const had = await soft(films.get(fp)); if (!had) { await Promise.race([films.put(fp, { name: file.name, type: file.type, blob: file }), wait(60000)]); askPersist(); } m.stored = true; }
    catch (e) { m.stored = false; toast('Ce film est trop volumineux pour être gardé en mémoire : il faudra le choisir à nouveau la prochaine fois. Ton analyse et tes clips seront retrouvés.'); }
  }
  if (opts.fromStore) m.stored = true;
  await soft(meta.put(m)); await soft(kv.set('last', fp));
  showFilmInfo();
  if (per.A) {
    S.data = { A: per.A, M: per.M, has: per.has, method: per.method };
    runDetect(); $('status').textContent = 'Analyse retrouvée : tu peux continuer sans la refaire.';
  } else $('status').textContent = S.film.mb ? 'Prêt. L’analyse rapide prend environ une minute pour un film de 2 heures.' : 'Ce format ne permet pas l’analyse rapide : l’analyse se fera en lisant le film.';
  $('analyse').disabled = false; S.film.ready = true;
  document.body.classList.add('has-film'); emit('film');
  dirty = true; updateStepper();
}

function showFilmInfo() {
  const f = S.film, res = f.w && f.h ? f.w + ' × ' + f.h : '';
  $('vinfo').textContent = [ts(f.dur), res, fmtBytes(f.size), f.mb ? 'export rapide disponible' : 'export en temps réel'].filter(Boolean).join(' · ');
  const short = Math.min(f.w, f.h);
  $('qwarn').hidden = !(short && short < 1080);
  $('qwarn').textContent = short < 720 ? 'Source en basse définition (' + short + 'p) : l’image sera floue sur TikTok. Utilise une version 1080p du film si possible.' : 'Source en ' + short + 'p : correct, mais une version 1080p donnera une image plus nette sur TikTok.';
}

async function savePer() {
  if (!S.film || !S.per) return;
  const p = S.per;
  if (S.data) { p.A = S.data.A; p.M = S.data.M; p.has = S.data.has; p.method = S.data.method; }
  p.title = S.ui.title; p.genre = S.ui.genre;
  await kv.set('f2:' + S.film.fp, p).catch(() => {});
}
export const persistFilmState = savePer;

/* ---------- Analyse ---------- */
async function analyse() {
  if (S.busy || !S.film || !S.film.ready) return;
  S.busy = true; S.abort = false;
  $('analyse').disabled = true; $('stopAn').hidden = false; $('bar').classList.add('on'); $('barFill').style.width = '0';
  const prog = p => { $('barFill').style.width = (p * 100).toFixed(1) + '%'; };
  const t0 = performance.now();
  try {
    const meth = S.ui.method;
    let data = null;
    if ((meth === 'auto' || meth === 'fast') && S.film.mb) {
      $('status').textContent = 'Analyse rapide en cours…';
      data = await fastAnalyze(S.film.mb, S.film.dur, prog, () => S.abort);
    } else {
      const rate = meth === 'auto' || meth === 'fast' ? 16 : +meth.replace(/\D/g, '');
      $('status').textContent = 'Analyse en lisant le film (' + rate + 'x)…';
      data = await playbackAnalyze(v, S.film.dur, rate, prog, () => S.abort);
    }
    if (S.abort) throw new Error('arrêté');
    S.data = data; await savePer();
    const m = await soft(meta.get(S.film.fp)); if (m) { m.analyzed = true; await soft(meta.put(m)); }
    runDetect();
    $('status').textContent = 'Analyse terminée en ' + Math.max(1, Math.round((performance.now() - t0) / 1000)) + ' s. Change les réglages : la détection se recalcule instantanément.';
  } catch (e) {
    $('status').textContent = e.message === 'arrêté' ? 'Analyse arrêtée.' : 'L’analyse a échoué : ' + e.message;
    logError('analyse ' + e.message);
  } finally {
    S.busy = false; $('analyse').disabled = false; $('stopAn').hidden = true; $('bar').classList.remove('on');
  }
}

function runDetect() {
  if (!S.data || !S.film) return;
  const r = detect(S.data, S.ui, S.film.dur);
  smooth = r.smooth;
  S.clips = r.clips;
  S.clips.forEach(c => {
    if (S.per.flags[c.key] !== undefined) c.on = S.per.flags[c.key];
    c.s0 = c.s; c.e0 = c.e;
    const tr = S.per.trims && S.per.trims[c.key]; if (tr) { c.s = tr.s; c.e = tr.e; }
    c.ptitle = (S.per.ptitles && S.per.ptitles[c.key]) || '';
    c.notitle = !!(S.per.notitle && S.per.notitle[c.key]);
    c.nonext = !S.ui.nextCard || !!(S.per.nonext && S.per.nonext[c.key]);
    c.quote = pickQuote(S.per.subs[c.key]);
  });
  renderClips(); drawTimeline(); updateStepper(); warmTracks();
  $('s3').hidden = $('s4').hidden = !S.clips.length;
  if (!S.clips.length) $('status').textContent = 'Aucun moment trouvé avec ces réglages : essaie une sélectivité « Large » ou une durée minimale plus courte.';
}

function drawTimeline() {
  if (!smooth || !S.film) return;
  tl.hidden = false; $('tlcap').hidden = false;
  const x = tl.getContext('2d'), w = tl.width, h = tl.height, n = smooth.length, mx = Math.max(...smooth) || 1, cs = getComputedStyle(document.documentElement);
  const acc = cs.getPropertyValue('--accent').trim() || '#6d8bff', bar = cs.getPropertyValue('--line2').trim() || '#444', dur = S.film.dur;
  x.clearRect(0, 0, w, h);
  S.clips.forEach(c => { x.fillStyle = acc + (c.on ? '40' : '18'); x.fillRect(c.s / dur * w, 0, (c.e - c.s) / dur * w, h); });
  x.fillStyle = bar; for (let px = 0; px < w; px++) { const i = Math.min(n - 1, Math.floor(px / w * n)), bh = smooth[i] / mx * (h - 14); x.fillRect(px, h - 6 - bh, 1, bh); }
  x.fillStyle = acc; S.clips.forEach(c => { if (!c.on) return; x.fillRect(c.s / dur * w, h - 5, Math.max(2, (c.e - c.s) / dur * w), 5); if (c.j > 1) { x.fillStyle = '#fff'; x.fillRect(c.s / dur * w, 0, 1, h); x.fillStyle = acc; } });
}
tl.addEventListener('click', e => { if (!S.film) return; const r = tl.getBoundingClientRect(); v.currentTime = (e.clientX - r.left) / r.width * S.film.dur; });

/* ---------- Clips ---------- */
function clipScore(c) { return scoreClip(c, S.data, S.ui, S.per && S.per.subs[c.key], null, Math.min(S.film.w, S.film.h)); }

function renderClips() {
  updateEstimate();
  const box = $('list'); if (!box || !S.film) return;
  box.textContent = '';
  const ms = Array.from(new Set(S.clips.map(c => c.m))), on = S.clips.filter(c => c.on), tot = on.reduce((a, c) => a + c.e - c.s, 0);
  $('stats').textContent = ms.length + ' moment(s), ' + S.clips.length + ' clip(s). Cochés : ' + on.length + ' (' + ts(tot) + ' de vidéo). Chaque clip commence par une réplique ou directement par de l’action.';
  const exported = new Set(S.per.exported || []);
  ms.forEach(m => {
    const parts = S.clips.filter(c => c.m === m), all = parts.every(c => c.on), some = parts.some(c => c.on);
    const h = document.createElement('label'); h.className = 'mh';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = all; cb.indeterminate = some && !all;
    cb.onchange = () => { parts.forEach(c => setOn(c, cb.checked)); renderClips(); drawTimeline(); };
    h.append(cb, ' Moment ' + m + (parts.length > 1 ? ' : ' + parts.length + ' parties' : '') + ' · intensité ' + parts[0].score + '/100');
    box.append(h);
    parts.forEach(c => {
      const sc = clipScore(c), row = document.createElement('div'); row.className = 'clip' + (S.curClip === c ? ' cur' : '');
      const k = document.createElement('input'); k.type = 'checkbox'; k.checked = c.on; k.setAttribute('aria-label', 'Inclure ce clip'); k.onchange = () => { setOn(c, k.checked); renderClips(); drawTimeline(); };
      const info = document.createElement('div'); info.className = 'grow';
      const t1 = document.createElement('div'); t1.className = 'clip-t';
      t1.textContent = (c.notitle || S.ui.showTitle === false ? 'Sans titre · ' : c.ptitle ? '« ' + c.ptitle + ' » · ' : c.k > 1 ? 'Partie ' + c.j + '/' + c.k + ' · ' : '') + ts(c.s) + ' à ' + ts(c.e) + ' (' + Math.round(c.e - c.s) + ' s)' + (S.per.trims && S.per.trims[c.key] ? ' · découpé' : '');
      const t2 = document.createElement('div'); t2.className = 'clip-s';
      const subs = S.per.subs[c.key];
      t2.textContent = 'Début : ' + (c.kind === 'action' ? 'action' : 'réplique ou son') + (subs ? ' · sous-titres prêts' : '') + (exported.has(c.key) ? ' · déjà exporté' : '') + (c.k > 1 && c.j < c.k && c.nonext ? ' · sans écran « La suite »' : '');
      info.append(t1, t2);
      const badge = document.createElement('button'); badge.type = 'button'; badge.className = 'score ' + scoreClass(sc.score); badge.textContent = sc.score; badge.title = 'Score de viralité : détails';
      const det = document.createElement('div'); det.className = 'clip-detail'; det.hidden = true;
      badge.onclick = () => { det.hidden = !det.hidden; openDetail = det.hidden ? null : c.key; if (!det.hidden) fillDetail(det, c, sc); };
      const b1 = btn('Début', () => playClip(c, 3, true)), b2 = btn('Voir', () => playClip(c));
      const b3 = btn(subs ? 'Sous-titres ✓' : 'Sous-titres', () => { det.hidden = false; openDetail = c.key; fillDetail(det, c, sc, 'subs'); });
      const b4 = btn('Titre et découpe', () => { det.hidden = false; openDetail = c.key; fillDetail(det, c, sc, 'trim'); });
      if (openDetail === c.key) { det.hidden = false; fillDetail(det, c, sc); }
      row.append(k, info, badge, b1, b2, b4, b3);
      const wrap = document.createElement('div'); wrap.className = 'clip-wrap'; wrap.append(row, det); box.append(wrap);
    });
  });
}
const btn = (t, f, cls = 'btn sm') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = t; b.onclick = f; return b; };
let openDetail = null;
const tsd = t => { t = Math.max(0, t || 0); const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
const parseT = str => { const p = String(str).trim().replace(',', '.').split(':').map(Number); if (p.some(isNaN) || !p.length) return null; return p.reduce((a, x) => a * 60 + x, 0); };
// Nouvelles limites d'un clip : les sous-titres sont recalés, le cadrage et l'export sont refaits.
function setTrim(c, s, e) {
  const dur = S.film.dur || c.e;
  s = clamp(s, 0, Math.max(0, dur - 5)); e = clamp(e, s + 5, dur);
  const d = s - c.s, w = S.per.subs[c.key];
  if (w && w.length) S.per.subs[c.key] = w.map(x => ({ ...x, s: x.s - d, e: x.e - d })).filter(x => x.e > 0 && x.s < e - s);
  c.s = s; c.e = e;
  S.per.trims = S.per.trims || {};
  if (Math.abs(s - c.s0) < .05 && Math.abs(e - c.e0) < .05) delete S.per.trims[c.key]; else S.per.trims[c.key] = { s, e };
  delete tracks[c.key]; if (S.per.tracks) delete S.per.tracks[c.key];
  S.per.exported = (S.per.exported || []).filter(k => k !== c.key);
  c.quote = pickQuote(S.per.subs[c.key]);
  savePer(); warmTracks(); dirty = true;
  renderClips(); drawTimeline();
}
function playAt(c, from, to) {
  if (S.exporting) return;
  S.curClip = c; previewing = true; previewEnd = to;
  if (A.ac) { A.ac.resume(); A.gain.gain.value = 1; }
  v.currentTime = from; stopMusicPreview(); v.play().catch(() => {}); dirty = true;
}
function trimBlock(c) {
  const box = document.createElement('div');
  const th = document.createElement('div'); th.className = 'det-h'; th.textContent = 'Titre de cette partie';
  const ti = document.createElement('input'); ti.type = 'text'; ti.className = 'note-in'; ti.maxLength = 80;
  const auto = ((S.ui.title || '').trim() || 'Film') + (c.k > 1 ? '  ·  Partie ' + c.j + '/' + c.k : '');
  ti.placeholder = 'Titre automatique : ' + auto; ti.value = c.ptitle || '';
  ti.oninput = () => { c.ptitle = ti.value; S.per.ptitles = S.per.ptitles || {}; if (ti.value.trim()) S.per.ptitles[c.key] = ti.value; else delete S.per.ptitles[c.key]; dirty = true; };
  ti.onchange = () => { S.per.exported = (S.per.exported || []).filter(k => k !== c.key); savePer(); renderClips(); };
  const tn = document.createElement('div'); tn.className = 'clip-s'; tn.textContent = 'Affiché en haut de la vidéo à la place du titre du film et du numéro de partie. Laisse vide pour garder le titre automatique.';
  const nl = document.createElement('label'); nl.className = 'check'; const nc = document.createElement('input'); nc.type = 'checkbox'; nc.checked = !!c.notitle;
  nc.onchange = () => { c.notitle = nc.checked; S.per.notitle = S.per.notitle || {}; if (nc.checked) S.per.notitle[c.key] = true; else delete S.per.notitle[c.key]; ti.disabled = nc.checked; S.per.exported = (S.per.exported || []).filter(k => k !== c.key); savePer(); dirty = true; renderClips(); };
  nl.append(nc, ' Aucun titre sur cette partie'); ti.disabled = nc.checked || S.ui.showTitle === false;
  if (S.ui.showTitle === false) tn.textContent = 'Les titres sont désactivés pour toutes les vidéos (réglage « Afficher un titre » dans Habillage).';
  const dh = document.createElement('div'); dh.className = 'det-h'; dh.textContent = 'Découpe : garde seulement le meilleur';
  const mkLine = (label, which) => {
    const r = document.createElement('div'); r.className = 'row trim';
    const l = document.createElement('b'); l.textContent = label;
    const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'ni'; inp.value = tsd(c[which]); inp.setAttribute('aria-label', label + ' (minutes:secondes)');
    const apply = t => { if (t == null) { inp.value = tsd(c[which]); return; } which === 's' ? setTrim(c, t, c.e) : setTrim(c, c.s, t); };
    inp.onchange = () => apply(parseT(inp.value));
    r.append(l, inp,
      btn('− 1 s', () => apply(c[which] - 1)), btn('+ 1 s', () => apply(c[which] + 1)),
      btn('− 5 s', () => apply(c[which] - 5)), btn('+ 5 s', () => apply(c[which] + 5)),
      btn('Position du lecteur', () => apply(v.currentTime)),
      btn(which === 's' ? 'Voir le début' : 'Voir la fin', () => which === 's' ? playAt(c, c.s, Math.min(c.e, c.s + 5)) : playAt(c, Math.max(c.s, c.e - 5), c.e)));
    return r;
  };
  const info = document.createElement('div'); info.className = 'row';
  const trimmed = !!(S.per.trims && S.per.trims[c.key]);
  const it = document.createElement('span'); it.className = 'clip-s'; it.textContent = 'Durée : ' + Math.round(c.e - c.s) + ' s' + (trimmed ? ' (découpage automatique : ' + Math.round(c.e0 - c.s0) + ' s, de ' + ts(c.s0) + ' à ' + ts(c.e0) + ')' : '') + (c.e - c.s < 60 ? '. Moins d’une minute : TikTok ne rémunère que les vidéos d’au moins 1 minute.' : '');
  info.append(it);
  if (trimmed) info.append(btn('Revenir au découpage automatique', () => setTrim(c, c.s0, c.e0)));
  const hint = document.createElement('div'); hint.className = 'clip-s'; hint.textContent = 'Astuce : place le lecteur vidéo au bon moment, puis clique sur « Position du lecteur ». Après une découpe, le cadrage se recalcule tout seul. Si tu as allongé le clip, régénère ses sous-titres.';
  let nxl = null;
  if (c.k > 1 && c.j < c.k) {
    nxl = document.createElement('label'); nxl.className = 'check'; const xc = document.createElement('input'); xc.type = 'checkbox';
    xc.checked = !(S.per.nonext && S.per.nonext[c.key]); xc.disabled = !S.ui.nextCard;
    xc.onchange = () => { S.per.nonext = S.per.nonext || {}; if (xc.checked) delete S.per.nonext[c.key]; else S.per.nonext[c.key] = true; c.nonext = !S.ui.nextCard || !xc.checked; S.per.exported = (S.per.exported || []).filter(k => k !== c.key); savePer(); dirty = true; renderClips(); };
    nxl.append(xc, S.ui.nextCard ? ' Écran « La suite ➜ partie ' + (c.j + 1) + ' sur mon profil » à la fin de cette partie (décoche si tu ne publies pas la suite)' : ' Écran « La suite » désactivé pour toutes les vidéos (réglage dans Habillage)');
  }
  box.append(th, ti, nl, tn, ...(nxl ? [nxl] : []), dh, mkLine('Début', 's'), mkLine('Fin', 'e'), info, hint);
  return { box, ti };
}
function setOn(c, val) { c.on = val; S.per.flags[c.key] = val; savePer(); if (val) warmTracks(); }

function fillDetail(det, c, sc, focus) {
  det.textContent = '';
  const tb = trimBlock(c);
  const h = document.createElement('div'); h.className = 'det-h'; h.textContent = 'Score de viralité : ' + sc.score + '/100 (liste de contrôle des bonnes pratiques, pas une garantie)';
  const ul = document.createElement('ul'); ul.className = 'checks';
  sc.items.forEach(it => { const li = document.createElement('li'); li.className = it.ok ? 'ok' : 'ko'; li.textContent = it.label + ' : ' + it.pts + '/' + it.max + (it.ok || !it.tip ? '' : '. ' + it.tip); ul.append(li); });
  const chk = btn('Contrôler les 3 premières secondes', async () => {
    playClip(c, 3, true);
    await wait(250);
    let br = null;
    try { const t = document.createElement('canvas'); t.width = 16; t.height = 9; const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(v, 0, 0, 16, 9); const d = x.getImageData(0, 0, 16, 9).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; br = s / (d.length / 4); } catch (e) {}
    const res = firstSecondsCheck(c, S.data, S.ui, br), u2 = document.createElement('ul'); u2.className = 'checks';
    res.forEach(r => { const li = document.createElement('li'); li.className = r.ok ? 'ok' : 'ko'; li.textContent = r.t; u2.append(li); });
    out3.textContent = ''; out3.append(u2);
  });
  const out3 = document.createElement('div');
  // Sous-titres du clip
  const sh = document.createElement('div'); sh.className = 'det-h'; sh.textContent = 'Sous-titres de ce clip';
  const ta = document.createElement('textarea'); ta.rows = 3; ta.placeholder = S.film.mb ? 'Clique sur « Générer » : la reconnaissance vocale se fait dans ton navigateur.' : 'Ce format de fichier ne permet pas la génération automatique : écris le texte toi-même.';
  const words = S.per.subs[c.key] || [];
  ta.value = words.map(w => w.w).join(' ');
  ta.onchange = () => { S.per.subs[c.key] = retime(S.per.subs[c.key] || [], ta.value); c.quote = pickQuote(S.per.subs[c.key]); savePer(); dirty = true; };
  const st = document.createElement('span'); st.className = 'muted';
  const gen = btn(words.length ? 'Régénérer' : 'Générer', async () => {
    gen.disabled = true;
    try { await genSubs(c, m => { st.textContent = m; }); ta.value = (S.per.subs[c.key] || []).map(w => w.w).join(' '); st.textContent = 'Sous-titres prêts. Corrige le texte si besoin.'; renderClipsLater(); }
    catch (e) { st.textContent = 'Échec : ' + e.message; }
    gen.disabled = false;
  });
  gen.disabled = !S.film.mb;
  const r1 = document.createElement('div'); r1.className = 'row'; r1.append(chk);
  const r2 = document.createElement('div'); r2.className = 'row'; r2.append(gen, st);
  det.append(tb.box, h, ul, r1, out3, sh, ta, r2);
  if (focus === 'subs') ta.focus(); else if (focus === 'trim') tb.ti.focus();
}
let rcT = null; const renderClipsLater = () => { clearTimeout(rcT); rcT = setTimeout(renderClips, 300); };

const LANG_LABEL = { french: 'français', english: 'anglais', spanish: 'espagnol', italian: 'italien', german: 'allemand', portuguese: 'portugais', auto: 'détection automatique' };
async function genSubs(c, onMsg) {
  if (!S.film.mb) throw new Error('format non pris en charge');
  onMsg('Préparation de la reconnaissance vocale (le premier usage télécharge le modèle une seule fois)…');
  const r = await transcribeClip(S.film.mb, c, S.ui.subsLang, S.ui.subsModel, p => { if (p.status === 'fallback') onMsg('Carte graphique insuffisante : passage au modèle « Haute précision »…'); else if (p.status === 'progress' && p.progress) onMsg('Téléchargement du modèle (une seule fois) : ' + Math.round(p.progress) + ' %'); else if (p.status === 'ready') onMsg('Transcription en cours (' + (LANG_LABEL[S.ui.subsLang] || S.ui.subsLang) + ')…'); });
  S.per.subs[c.key] = r.words; c.quote = pickQuote(r.words); await savePer(); dirty = true;
  return r;
}

async function subsAll() {
  if (S.busy) return;
  const todo = S.clips.filter(c => c.on && !(S.per.subs[c.key] || []).length);
  if (!todo.length) { $('subsStatus').textContent = 'Tous les clips cochés ont déjà leurs sous-titres.'; return; }
  S.busy = true; S.abort = false; $('subsAll').disabled = true;
  try {
    for (let i = 0; i < todo.length && !S.abort; i++) await genSubs(todo[i], m => { $('subsStatus').textContent = 'Clip ' + (i + 1) + ' sur ' + todo.length + ' : ' + m; });
    $('subsStatus').textContent = S.abort ? 'Arrêté.' : 'Sous-titres prêts pour ' + todo.length + ' clip(s). Ouvre le détail d’un clip pour corriger le texte.';
  } catch (e) { $('subsStatus').textContent = 'Échec : ' + e.message; }
  S.busy = false; $('subsAll').disabled = false; renderClips();
}

// Trois images de la scène (début, milieu, fin) pour que Claude décrive précisément ce qu'on voit.
async function clipFrames(c) {
  if (!S.film || !S.film.mb) return [];
  const d = c.e - c.s, times = [c.s + Math.min(2, d * .1), c.s + d * .5, c.s + d * .85], out = [];
  try {
    for await (const cv0 of smallFrames(S.film.mb, times, 640)) {
      if (!cv0) continue;
      const cnv = document.createElement('canvas'); cnv.width = cv0.width; cnv.height = cv0.height; cnv.getContext('2d').drawImage(cv0, 0, 0);
      out.push(cnv.toDataURL('image/jpeg', .82));
    }
  } catch (e) { logError('images fiche ' + e.message); }
  return out;
}

/* ---------- Aperçu ---------- */
async function getTrack(c, isAborted) {
  if (!S.film.mb || S.ui.mode === 'fit') return null;
  if (tracks[c.key]) return tracks[c.key];
  const saved = S.per && S.per.tracks && S.per.tracks[c.key];
  if (saved && saved.cx && saved.cx.length) return (tracks[c.key] = { s: saved.s, step: saved.step, cx: Float32Array.from(saved.cx) });
  try { tracks[c.key] = await computeTrack(S.film.mb, c, isAborted || (() => S.abort && S.exporting)); } catch (e) { return null; }
  if (S.per) { S.per.tracks = S.per.tracks || {}; S.per.tracks[c.key] = tracks[c.key]; savePer(); }
  return tracks[c.key];
}
// Le suivi du cadre des clips cochés est préparé en arrière-plan : l'export démarre ensuite sans attente.
let warmT = null, warming = false;
function warmTracks() {
  clearTimeout(warmT);
  warmT = setTimeout(async () => {
    if (warming || !S.film || !S.film.mb || !S.ui.follow || S.ui.mode === 'fit') return;
    warming = true;
    try {
      for (const c of S.clips.filter(x => x.on)) {
        if (S.busy || S.exporting || previewing) break;
        if (tracks[c.key] || (S.per.tracks && S.per.tracks[c.key])) continue;
        await getTrack(c, () => S.busy || S.exporting);
      }
    } finally { warming = false; }
  }, 1500);
}
async function playClip(c, maxDur, fromStart) {
  if (S.exporting) return;
  S.curClip = c; previewEnd = maxDur ? Math.min(c.e, c.s + maxDur) : c.e; previewing = true;
  if (A.ac) { await A.ac.resume(); A.gain.gain.value = 1; }
  v.currentTime = c.s; stopMusicPreview(); startMusic(false);
  v.play().catch(() => {});
  renderClips(); dirty = true;
  if (S.ui.follow) getTrack(c).then(() => { dirty = true; });
}
function stopPreview() { if (previewing) { previewing = false; v.pause(); stopMusic(); } }
v.addEventListener('pause', () => { if (!S.exporting) stopMusic(); });

function loop() {
  const now = performance.now(), active = !v.paused || previewing || v.seeking;
  if (!S.exporting && (active || dirty || now - lastIdle > 800)) {
    dirty = false; lastIdle = now;
    try {
      if (v.readyState >= 2 && v.videoWidth) {
        const c = S.curClip, live = c && v.currentTime >= c.s - .5 && v.currentTime <= c.e + .5;
        const cc = live ? c : (S.clips.find(x => x.on) || null);
        const t = live ? v.currentTime - c.s : 99;
        R.frame(v, v.videoWidth, v.videoHeight, { t, dur: live ? c.e - c.s : 999, clip: cc ? { ...cc, key: live ? c.key : 'idle' } : { j: 1, k: 1, key: 'idle' }, ui: S.ui, cx: live && tracks[c.key] ? centerAt(tracks[c.key], v.currentTime) : null, subs: live && S.per ? S.per.subs[c.key] : null });
      } else R.empty(S.ui, matchMedia('(prefers-color-scheme: light)').matches);
    } catch (e) { }
  }
  if (previewing && v.currentTime >= previewEnd) { stopPreview(); }
  requestAnimationFrame(loop);
}
['seeked', 'loadeddata', 'play', 'pause'].forEach(ev => v.addEventListener(ev, () => { dirty = true; }));

/* ---------- Export ---------- */
let estT = null;
async function updateEstimate() {
  clearTimeout(estT); estT = setTimeout(async () => {
    if (!S.film) return;
    const on = S.clips.filter(c => c.on), tot = on.reduce((a, c) => a + c.e - c.s, 0), q = QUALITY[S.ui.quality] || QUALITY.tiktok;
    const fast = S.ui.engine !== 'live' && await fastSupported(S.film, S.ui);
    const size = q.br * (tot / Math.max(1, on.length)) / 8;
    $('estim').textContent = on.length ? (fast ? 'Export rapide hors temps réel : aucune image perdue, et tu peux changer d’onglet pendant l’export.' : 'Export en temps réel : ' + ts(tot) + ' au total. Garde l’onglet visible.') + ' Taille moyenne d’un clip : environ ' + fmtBytes(size) + ' (' + q.label + ').' + (size > 250e6 ? ' Fichier lourd : TikTok risque de le recompresser, choisis plutôt « TikTok 1080p ».' : '') : '';
  }, 150);
}

async function runExport() {
  if (S.busy || !S.film) return;
  const todo0 = S.clips.filter(c => c.on);
  if (!todo0.length) { $('status2').textContent = 'Coche au moins un clip.'; return; }
  const done = new Set(S.per.exported || []), todo = $('redoAll').checked ? todo0 : todo0.filter(c => !done.has(c.key)), skipped = todo0.length - todo.length;
  if (!todo.length) { $('status2').textContent = 'Tous les clips cochés sont déjà exportés : ils sont dans la bibliothèque. Coche « Refaire aussi les clips déjà exportés » pour les refaire.'; return; }
  let fast = S.ui.engine !== 'live' && await fastSupported(S.film, S.ui);
  if (S.ui.engine === 'fast' && !fast) toast('L’export rapide n’est pas disponible pour ce film ou ce navigateur : passage en temps réel.');
  if (!fast && typeof MediaRecorder === 'undefined') { $('status2').textContent = 'Ce navigateur ne sait pas enregistrer de vidéo. Utilise Chrome ou Edge récents.'; return; }
  S.busy = true; S.exporting = true; S.abort = false; stopPreview(); stopMusicPreview();
  $('export').disabled = true; $('stopExp').hidden = false; $('dStop').hidden = false; $('bar2').classList.add('on');
  let ok = 0, fail = 0; const t0 = performance.now(); let doneDur = 0; const totDur = todo.reduce((a, c) => a + c.e - c.s, 0);
  for (let i = 0; i < todo.length && !S.abort; i++) {
    const c = todo[i], cd = c.e - c.s, label = 'Clip ' + (i + 1) + ' sur ' + todo.length + (skipped ? ' (' + skipped + ' déjà exporté(s) ignoré(s))' : '');
    const status = (m, p) => {
      const g = (doneDur + (p || 0) * cd) / totDur, el = (performance.now() - t0) / 1000, eta = g > .02 ? el / g - el : null;
      $('barFill2').style.width = (g * 100).toFixed(1) + '%';
      $('status2').textContent = label + ' : ' + m + (eta != null ? ' · temps restant estimé ' + ts(eta) : '');
    };
    try {
      let subs = null;
      if (S.ui.subsOn && S.film.mb && !(S.per.subs[c.key] || []).length) { try { await genSubs(c, m => status('sous-titres. ' + m, 0)); } catch (e) { toast('Sous-titres impossibles pour ce clip : export sans sous-titres.'); } }
      if (S.ui.subsOn) subs = S.per.subs[c.key] || null;
      let track = null;
      if (S.ui.follow && S.ui.mode !== 'fit' && S.film.mb) { status('repérage de l’action…', 0); track = await getTrack(c); }
      let blob = null;
      for (let attempt = 0; attempt < 2 && !blob && !S.abort; attempt++) {
        try {
          if (fast) blob = await exportFast(S.film, c, S.ui, S.music.buffer, subs, track, (p, m) => status(m || (fast ? 'export rapide' : 'export'), p), () => S.abort);
          else blob = await exportLive(v, c, S.ui, subs, track, p => status('export en temps réel (garde l’onglet visible)', p), () => S.abort);
        } catch (e) { if (S.abort) break; logError('export ' + e.message); if (fast && attempt === 0) { fast = false; toast('Export rapide en échec, nouvel essai en temps réel.'); } }
      }
      if (S.abort) break;
      if (!blob) { fail++; continue; }
      try { await saveToLibrary(c, blob); }
      catch (e) { download(blob, safeName(filmName()) + '-moment' + c.m + '-partie' + c.j + (blob.type.indexOf('webm') > -1 ? '.webm' : '.mp4')); toast('La mémoire du site est indisponible : le clip a été téléchargé directement.'); }
      S.per.exported = Array.from(new Set([...(S.per.exported || []), c.key])); await savePer();
      ok++; doneDur += cd;
    } catch (e) { fail++; logError('export ' + e.message); }
  }
  S.busy = false; S.exporting = false;
  $('bar2').classList.remove('on'); $('export').disabled = false; $('stopExp').hidden = true; $('dStop').hidden = true;
  $('status2').textContent = S.abort ? 'Export arrêté. Les clips terminés sont dans la bibliothèque ; relance pour faire seulement ceux qui manquent.' : ok + ' clip(s) exporté(s) en ' + ts((performance.now() - t0) / 1000) + ' et rangé(s) dans la bibliothèque' + (fail ? ', ' + fail + ' en échec : relance l’export, seuls les manquants seront refaits.' : '.');
  if (A.ac) A.gain.gain.value = 1;
  renderClips(); refreshLibCount(); dirty = true;
  if (ok) toast(ok + ' clip(s) prêt(s) dans la bibliothèque.');
}

async function saveToLibrary(c, blob) {
  const o = capOptions(), saved = S.per.caps[c.key];
  const base = { clip: c, name: filmName(), genre: S.ui.genre, tone: o.tone, emo: o.emo, nh: o.nh, cast: o.cast, kw: o.kw, note: S.per.notes[c.key] || '', quote: c.quote };
  let hookA, hookB, caption, variant = 'A';
  if (saved && saved.text) { caption = saved.text; hookA = saved.hookA; hookB = saved.hookB; variant = saved.variant || 'A'; }
  else { [hookA, hookB] = hooksFor(base, 2); caption = buildCaption(base, hookA); S.per.caps[c.key] = { hookA, hookB, variant: 'A', text: caption }; }
  const sc = scoreClip(c, S.data, S.ui, S.per.subs[c.key], caption, Math.min(S.film.w, S.film.h));
  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  await blobs.put(id, blob);
  await clipsDb.put({ id, fp: S.film.fp, film: S.ui.title, genre: S.ui.genre, m: c.m, j: c.j, k: c.k, s: c.s, e: c.e, d: Math.round(c.e - c.s), key: c.key, created: Date.now(), status: 'todo', plan: '', time: '', caption, hookA, hookB, variant, score: sc.score, type: blob.type, size: blob.size });
  askPersist();
}

/* ---------- Progression, démarrage ---------- */
function updateStepper() {
  const cur = !S.film ? 1 : !S.data ? 2 : S.exporting ? 4 : 3;
  document.querySelectorAll('#stepper span').forEach(s => { const n = +s.dataset.s; s.className = n < cur ? 'done' : n === cur ? 'on' : ''; });
}

async function renderRecent() {
  const box = $('recent'), list = (await meta.all()).sort((a, b) => (b.lastOpen || 0) - (a.lastOpen || 0)).slice(0, 4);
  box.textContent = ''; box.hidden = !list.length || !!S.film;
  if (!list.length) return;
  const h = document.createElement('div'); h.className = 'det-h'; h.textContent = 'Reprendre un film'; box.append(h);
  list.forEach(m => box.append(filmRow(m)));
}
export function filmRow(m) {
  const row = document.createElement('div'); row.className = 'row-item';
  const sp = document.createElement('div'); sp.className = 'grow';
  sp.innerHTML = '<div class="clip-t">' + esc(m.name) + '</div><div class="clip-s">' + [m.dur ? ts(m.dur) : '', m.w ? m.w + ' × ' + m.h : '', m.analyzed ? 'analysé' : 'pas encore analysé', m.stored ? 'gardé en mémoire' : 'à choisir à nouveau'].filter(Boolean).join(' · ') + '</div>';
  row.append(sp, btn('Ouvrir', () => openFilm(m)));
  return row;
}
export async function openFilm(m) {
  const rec = m.stored ? await films.get(m.fp) : null;
  if (rec && rec.blob) { emit('closePanels'); await loadFilm(new File([rec.blob], rec.name, { type: rec.type }), { fromStore: true }); }
  else { toast('Choisis à nouveau le fichier « ' + m.name + ' » : ton analyse et tes clips seront retrouvés.'); $('file').click(); }
}

async function init() {
  try { await Promise.race([migrate(), wait(8000)]); } catch (e) { logError('migration ' + e.message); }
  const ui = await soft(kv.get('ui2')); if (ui) S.ui = { ...DEFAULT_UI, ...ui };
  const g = $('genre'); GENRES.forEach(x => g.append(new Option(x, x)));
  fillForm(); syncFraming();
  document.addEventListener('input', readForm); document.addEventListener('change', readForm);
  const drop = $('drop');
  drop.onclick = () => $('file').click();
  drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('file').click(); } };
  $('file').onchange = e => loadFilm(e.target.files[0]);
  ['dragover', 'dragenter'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => loadFilm(e.dataTransfer.files[0]));
  $('other').onclick = () => { stopPreview(); v.removeAttribute('src'); v.load(); S.film = null; S.data = null; S.clips = []; $('vbox').hidden = true; ['s2', 's3', 's4'].forEach(i => $(i).hidden = true); drop.hidden = false; $('file').value = ''; document.body.classList.remove('has-film'); renderRecent(); updateStepper(); dirty = true; };
  $('analyse').onclick = analyse;
  $('stopAn').onclick = () => { S.abort = true; };
  $('allOn').onclick = () => { S.clips.forEach(c => setOn(c, true)); renderClips(); drawTimeline(); };
  $('allOff').onclick = () => { S.clips.forEach(c => setOn(c, false)); renderClips(); drawTimeline(); };
  $('best').onclick = () => { const sc = S.clips.map(c => clipScore(c).score), th = pct(sc, .5); S.clips.forEach((c, i) => setOn(c, sc[i] >= th)); renderClips(); drawTimeline(); };
  $('subsAll').onclick = subsAll;
  $('export').onclick = runExport;
  const stop = () => { if (S.exporting) { S.abort = true; $('stopExp').disabled = $('dStop').disabled = true; setTimeout(() => { $('stopExp').disabled = $('dStop').disabled = false; }, 3000); } };
  $('stopExp').onclick = stop; $('dStop').onclick = stop;
  $('endPrev').onclick = () => { const c = S.clips.find(x => x.on); if (!c) return; S.curClip = c; previewing = true; previewEnd = c.e; v.currentTime = Math.max(c.s, c.e - 5); startMusic(false); v.play().catch(() => {}); };
  on('dirty', () => { dirty = true; });
  on('clips-changed', () => renderClips());
  document.addEventListener('visibilitychange', () => { dirty = true; });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { dirty = true; drawTimeline(); });
  setInterval(updateStepper, 700);
  requestAnimationFrame(loop);
  await initMusic();
  initPanels({ loadFilm, openFilm, filmRow, renderClips: () => renderClips(), savePer, clipFrames, genSubs });
  renderRecent();
  updateEstimate(); document.addEventListener('change', updateEstimate);
  // Reprise automatique du dernier film gardé en mémoire
  const last = await soft(kv.get('last'));
  if (last) { const m = await soft(meta.get(last)); if (m && m.stored) { const rec = await soft(films.get(last), 15000); if (rec && rec.blob) await loadFilm(new File([rec.blob], rec.name, { type: rec.type }), { fromStore: true }); } }
  if (!webcodecs()) toast('Ton navigateur ne permet pas l’export rapide : utilise Chrome ou Edge récents pour la meilleure qualité.', 8000);
  loadMB().catch(() => {});
}
init();
