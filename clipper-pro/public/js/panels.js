// Panneaux : Mes films, Titres et hashtags, Bibliothèque, Publier, Résultats.
import { S, $, ts, fmtBytes, esc, toast, download, safeName, filmName, on, emit } from './state.js';
import { kv, films, meta, clipsDb, blobs, storageInfo, askPersist, clearAll } from './db.js';
import { TONES, hooksFor, buildCaption, aiPrompt, captionChecks } from './captions.js';
import { scoreClass } from './viral.js';

let API = null;
const mkBtn = (t, f, cls = 'btn sm') => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = t; b.onclick = f; return b; };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
async function copy(text, okMsg = 'Copié.') { try { await navigator.clipboard.writeText(text); toast(okMsg); } catch (e) { toast('Copie impossible ici : sélectionne le texte et copie-le.'); } }

/* ---------- Ouverture et fermeture des panneaux ---------- */
const PANELS = { films: renderFilms, caps: renderCaps, lib: renderLib, pub: renderPub, stats: renderStats };
function openPanel(name) {
  document.querySelectorAll('.drawer').forEach(d => d.classList.remove('on'));
  const d = $('p-' + name); if (!d) return;
  d.classList.add('on'); PANELS[name]();
}
function closePanels() { document.querySelectorAll('.drawer').forEach(d => d.classList.remove('on')); }

/* ---------- Options des légendes ---------- */
let opts = { cast: '', kw: '', tone: 'Direct', nh: '8', emo: true };
export function capOptions() {
  const list = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);
  return { cast: list(opts.cast), kw: list(opts.kw), tone: opts.tone, nh: +opts.nh, emo: !!opts.emo };
}

/* ---------- Mes films ---------- */
async function renderFilms() {
  const box = $('filmsList'); box.textContent = '';
  const list = (await meta.all()).sort((a, b) => (b.lastOpen || 0) - (a.lastOpen || 0)), all = await clipsDb.all();
  if (!list.length) { box.append(el('p', 'empty', 'Aucun film pour l’instant. Choisis un film à l’étape 1 : il apparaîtra ici.')); }
  list.forEach(m => {
    const mine = all.filter(c => c.fp === m.fp), pub = mine.filter(c => c.status === 'done').length;
    const card = el('div', 'blk' + (S.film && S.film.fp === m.fp ? ' cur' : ''));
    card.append(el('h3', '', m.name));
    card.append(el('div', 'clip-s', [m.dur ? ts(m.dur) : '', m.w ? m.w + ' × ' + m.h : '', m.size ? fmtBytes(m.size) : '', m.analyzed ? 'analysé' : 'pas encore analysé', mine.length + ' clip(s) exporté(s), ' + pub + ' publié(s)', m.stored ? 'gardé en mémoire' : 'à choisir à nouveau'].filter(Boolean).join(' · ')));
    const r = el('div', 'row');
    r.append(mkBtn(S.film && S.film.fp === m.fp ? 'Ouvert' : 'Ouvrir', () => API.openFilm(m)),
      mkBtn('Retirer', async () => {
        if (!confirm('Retirer « ' + m.name + ' » de tes films ? Son analyse et sa copie en mémoire seront effacées. Les clips déjà exportés restent dans la bibliothèque.')) return;
        await films.del(m.fp).catch(() => {}); await kv.del('f2:' + m.fp).catch(() => {}); await meta.del(m.fp); renderFilms(); storageLine('filmsStore');
      }));
    card.append(r); box.append(card);
  });
  const kf = $('keepFilm'); kf.checked = (await kv.get('keepFilm')) !== false;
  storageLine('filmsStore');
}
async function storageLine(id) {
  const e = $(id); if (!e) return;
  const s = await storageInfo(); if (!s) { e.textContent = ''; return; }
  const r = s.usage / s.quota;
  e.textContent = 'Espace utilisé : ' + fmtBytes(s.usage) + (s.persisted ? ' (stockage durable)' : '') + (r > .8 ? '. Presque plein : supprime des clips déjà publiés ou des films.' : '');
  e.classList.toggle('bad', r > .8);
}

/* ---------- Titres et hashtags ---------- */
function capBase(c) {
  const o = capOptions();
  return { clip: c, name: filmName(), genre: S.ui.genre, tone: o.tone, emo: o.emo, nh: o.nh, cast: o.cast, kw: o.kw, note: (S.per && S.per.notes[c.key]) || '', quote: c.quote };
}
function generateFor(c, keepHooks) {
  const base = capBase(c), prev = S.per.caps[c.key] || {};
  let hookA = prev.hookA, hookB = prev.hookB;
  if (!keepHooks || !hookA) [hookA, hookB] = hooksFor(base, 2);
  const variant = prev.variant || 'A';
  S.per.caps[c.key] = { hookA, hookB, variant, text: buildCaption(base, variant === 'B' ? hookB : hookA) };
}
function renderCaps() {
  ['cast', 'kw', 'nh'].forEach(k => { $('cap_' + k).value = opts[k]; });
  $('cap_tone').value = opts.tone; $('cap_emo').checked = !!opts.emo;
  const out = $('capsOut'); out.textContent = '';
  if (!S.film || !S.clips.length) { out.append(el('p', 'empty', 'Analyse d’abord un film (étape 2) et garde des clips cochés, puis reviens ici.')); return; }
  const todo = S.clips.filter(c => c.on);
  if (!todo.length) { out.append(el('p', 'empty', 'Coche au moins un clip à l’étape 3.')); return; }
  todo.forEach(c => {
    if (!S.per.caps[c.key]) generateFor(c);
    const st = S.per.caps[c.key], b = el('div', 'blk');
    b.append(el('h3', '', 'Moment ' + c.m + (c.k > 1 ? ', partie ' + c.j + '/' + c.k : '') + ' (' + Math.round(c.e - c.s) + ' s)'));
    if (st.src === 'claude') b.append(el('span', 'badge', 'Rédigée par Claude'));
    const ni = el('input', 'note-in'); ni.placeholder = 'Ce qui se passe dans cette scène (facultatif). Ex. : le héros affronte le dragon'; ni.value = S.per.notes[c.key] || '';
    ni.oninput = () => { S.per.notes[c.key] = ni.value; };
    ni.onchange = () => { generateFor(c, true); API.savePer(); renderCaps(); };
    b.append(ni);
    if (c.quote) {
      const q = el('div', 'quote'); q.append(el('span', 'grow', 'Réplique repérée dans les sous-titres : « ' + c.quote + ' »'));
      q.append(mkBtn('En faire l’accroche A', () => { st.hookA = '« ' + c.quote + ' »' + (c.k > 1 ? ' (partie ' + c.j + '/' + c.k + ')' : ''); st.variant = 'A'; st.text = buildCaption(capBase(c), st.hookA); API.savePer(); renderCaps(); }));
      b.append(q);
    }
    const ab = el('div', 'ab');
    ['A', 'B'].forEach(V => {
      const lab = el('label', 'ab-row'), r = el('input'); r.type = 'radio'; r.name = 'v' + c.key; r.checked = st.variant === V;
      const inp = el('input'); inp.value = V === 'A' ? st.hookA : st.hookB; inp.setAttribute('aria-label', 'Accroche ' + V);
      r.onchange = () => { const old = st.variant === 'A' ? st.hookA : st.hookB; st.variant = V; const nw = V === 'A' ? st.hookA : st.hookB; st.text = st.text.indexOf(old) === 0 ? nw + st.text.slice(old.length) : buildCaption(capBase(c), nw); API.savePer(); renderCaps(); };
      inp.onchange = () => { const old = V === 'A' ? st.hookA : st.hookB; if (V === 'A') st.hookA = inp.value; else st.hookB = inp.value; if (st.variant === V && st.text.indexOf(old) === 0) st.text = inp.value + st.text.slice(old.length); API.savePer(); renderCaps(); };
      lab.append(r, el('b', '', V), inp); ab.append(lab);
    });
    b.append(el('div', 'clip-s', 'Accroches A et B : publie l’une, note ses résultats, puis compare dans « Résultats ».'), ab);
    const ta = el('textarea'); ta.value = st.text; ta.rows = 7; ta.oninput = () => { st.text = ta.value; }; ta.onchange = () => API.savePer();
    const ck = captionChecks(st.text), hint = el('div', 'clip-s', (ck.question ? '✓ question' : '✗ pas de question') + ' · ' + (ck.cta ? '✓ appel à s’abonner' : '✗ pas d’appel à s’abonner') + ' · ' + ck.tags + ' hashtags' + (ck.tagsOk ? ' ✓' : ' (vise 5 à 12)'));
    const r = el('div', 'row');
    r.append(mkBtn('Copier', () => copy(ta.value, 'Légende copiée.')), mkBtn('Autre version', () => { generateFor(c, false); API.savePer(); renderCaps(); }));
    b.append(ta, hint, r); out.append(b);
  });
  API.savePer();
}
function capsCopyAll() {
  const todo = S.clips.filter(c => c.on && S.per.caps[c.key]);
  copy(todo.map(c => 'Moment ' + c.m + (c.k > 1 ? ', partie ' + c.j + '/' + c.k : '') + '\n' + S.per.caps[c.key].text).join('\n\n-----\n\n'), 'Toutes les légendes sont copiées.');
}

/* ---------- Légendes rédigées par Claude : fiche et import ---------- */
async function exportFiche() {
  const st = $('capClaudeStatus');
  if (!S.film || !S.clips.length) return toast('Analyse d’abord un film et coche des clips.');
  const todo = S.clips.filter(c => c.on);
  if (!todo.length) return toast('Coche au moins un clip à l’étape 3.');
  const btn = $('capExport'); btn.disabled = true;
  try {
    if (S.ui.subsOn && S.film.mb) {
      for (let i = 0; i < todo.length; i++) {
        const c = todo[i]; if ((S.per.subs[c.key] || []).length) continue;
        try { await API.genSubs(c, m => { st.textContent = 'Sous-titres du clip ' + (i + 1) + ' sur ' + todo.length + ' : ' + m; }); } catch (e) { /* on continue sans */ }
      }
    }
    const o = capOptions(), clips = [];
    for (let i = 0; i < todo.length; i++) {
      const c = todo[i]; st.textContent = 'Images du clip ' + (i + 1) + ' sur ' + todo.length + '…';
      clips.push({ key: c.key, m: c.m, j: c.j, k: c.k, debut: ts(c.s), duree: Math.round(c.e - c.s), commence_par: c.kind === 'action' ? 'action' : 'réplique ou son', note: S.per.notes[c.key] || '', sous_titres: (S.per.subs[c.key] || []).map(w => w.w).join(' '), replique: c.quote || '', images: await API.clipFrames(c) });
    }
    const fiche = { app: 'clipper-pro', type: 'fiche', v: 1, cree: new Date().toISOString(), fp: S.film.fp, film: { titre: filmName(), genre: S.ui.genre, acteurs: o.cast, mots_cles: o.kw, ton: o.tone, emojis: o.emo, nb_hashtags: o.nh, accroche_ecran: S.ui.hook3 }, clips };
    download(new Blob([JSON.stringify(fiche)], { type: 'application/json' }), 'fiche-claude-' + safeName(filmName()) + '.json');
    st.textContent = 'Fiche téléchargée (' + clips.length + ' clip(s)). Dépose-la dans ton outil « Légendes Clipper ».';
  } catch (e) { st.textContent = 'Échec : ' + e.message; }
  btn.disabled = false;
}
async function importClaude(file) {
  const st = $('capClaudeStatus');
  try {
    const r = JSON.parse(await file.text());
    if (!r || r.type !== 'legendes' || !Array.isArray(r.clips)) throw new Error('ce fichier ne vient pas de l’outil « Légendes Clipper »');
    const fp = r.fp; let nPer = 0, nLib = 0;
    const per = S.film && S.film.fp === fp ? S.per : await kv.get('f2:' + fp);
    if (per) {
      per.caps = per.caps || {};
      r.clips.forEach(x => { if (!x.key || !x.caption) return; per.caps[x.key] = { hookA: x.hookA || '', hookB: x.hookB || x.hookA || '', variant: 'A', text: x.caption, src: 'claude' }; nPer++; });
      if (S.film && S.film.fp === fp) await API.savePer(); else await kv.set('f2:' + fp, per);
    }
    const lib = await clipsDb.all();
    for (const it of lib) {
      if (it.fp !== fp || it.status === 'done') continue;
      const x = r.clips.find(y => y.key === it.key); if (!x || !x.caption) continue;
      Object.assign(it, { caption: x.caption, hookA: x.hookA || it.hookA, hookB: x.hookB || it.hookB, variant: 'A', src: 'claude' }); await clipsDb.put(it); nLib++;
    }
    st.textContent = 'Légendes de Claude importées : ' + nPer + ' clip(s) mis à jour' + (nLib ? ', dont ' + nLib + ' déjà dans la bibliothèque.' : '.');
    toast('Légendes de Claude importées.');
    renderCaps();
  } catch (e) { st.textContent = 'Import impossible : ' + e.message; }
}

/* ---------- Bibliothèque ---------- */
let tab = 'todo', filmFilter = 'all';
const selG = new Set();
export async function refreshLibCount() {
  const n = (await clipsDb.all()).filter(i => i.status === 'todo').length;
  $('dLib').textContent = n ? String(n) : '';
}
async function dl(it) { const b = await blobs.get(it.id); if (!b) return toast('Fichier introuvable.'); download(b, safeName(it.film) + '-moment' + it.m + '-partie' + it.j + (it.type && it.type.indexOf('webm') > -1 ? '.webm' : '.mp4')); }
async function renderLib() {
  const box = $('libList'); box.textContent = '';
  const all = await clipsDb.all(), metas = await meta.all();
  const fsel = $('libFilm'); const cur = filmFilter; fsel.textContent = ''; fsel.append(new Option('Tous les films', 'all'));
  Array.from(new Set(all.map(i => i.fp || i.film))).forEach(fp => { const m = metas.find(x => x.fp === fp); fsel.append(new Option(m ? m.name : (all.find(i => (i.fp || i.film) === fp) || {}).film || 'Film', fp)); });
  fsel.value = Array.from(fsel.options).some(o => o.value === cur) ? cur : 'all';
  const items = all.filter(i => (tab === 'all' || i.status === tab) && (filmFilter === 'all' || (i.fp || i.film) === filmFilter));
  const groups = {}; items.forEach(i => { const k = (i.fp || i.film) + '|' + i.m; (groups[k] = groups[k] || []).push(i); });
  const first = k => groups[k].map(i => (i.plan || '9999') + (i.time || '')).sort()[0];
  const keys = Object.keys(groups).sort((a, b) => first(a) < first(b) ? -1 : first(a) > first(b) ? 1 : groups[a][0].created - groups[b][0].created);
  if (!keys.length) { box.append(el('p', 'empty', 'Rien ici pour l’instant. Chaque clip exporté arrive ici avec sa légende, même si tu fermes ou actualises la page.')); storageLine('libStore'); refreshLibCount(); return; }
  const put = it => clipsDb.put(it);
  const chosen = () => keys.filter(k => selG.has(k)).flatMap(k => groups[k]);
  const bulk = fn => async () => { const l = chosen(); if (!l.length) return toast('Coche au moins un moment.'); await fn(l); renderLib(); };
  const tb = el('div', 'blk tool');
  const all1 = el('label', 'check'), ca = el('input'); ca.type = 'checkbox'; ca.checked = keys.every(k => selG.has(k)); ca.onchange = () => { keys.forEach(k => ca.checked ? selG.add(k) : selG.delete(k)); renderLib(); };
  all1.append(ca, ' Tout sélectionner (' + keys.filter(k => selG.has(k)).length + ' clip(s) sélectionné(s))');
  const di = el('input'); di.type = 'date'; const ti = el('input'); ti.type = 'time';
  const tr = el('div', 'row');
  tr.append(di, ti,
    mkBtn('Planifier', bulk(async l => { for (const it of l) { it.plan = di.value; it.time = ti.value; await put(it); } })),
    mkBtn('Marquer publié', bulk(async l => { for (const it of l) { it.status = 'done'; it.publishedAt = it.publishedAt || Date.now(); await put(it); } })),
    mkBtn('Remettre à publier', bulk(async l => { for (const it of l) { it.status = 'todo'; await put(it); } })),
    mkBtn('Télécharger', bulk(async l => { for (const it of l) { await dl(it); await new Promise(r => setTimeout(r, 700)); } })),
    mkBtn('Copier les légendes', async () => { const l = chosen(); if (!l.length) return toast('Coche au moins un moment.'); copy(l.map(it => 'Moment ' + it.m + (it.k > 1 ? ', partie ' + it.j + '/' + it.k : '') + '\n' + it.caption).join('\n\n-----\n\n'), 'Légendes copiées.'); }),
    mkBtn('Supprimer', bulk(async l => { if (!confirm('Supprimer ' + l.length + ' clip(s) de la bibliothèque ?')) return; for (const it of l) { await clipsDb.del(it.id); await blobs.del(it.id); } })));
  tb.append(all1, tr); box.append(tb);
  keys.forEach(k => {
    const g = groups[k].sort((a, b) => a.j - b.j), it0 = g[0];
    const gh = el('label', 'mh'), gc = el('input'); gc.type = 'checkbox'; gc.checked = selG.has(k); gc.onchange = () => { gc.checked ? selG.add(k) : selG.delete(k); renderLib(); };
    gh.append(gc, ' ' + (it0.film || 'Film') + ' · moment ' + it0.m + (it0.k > 1 ? ' (' + g.length + '/' + it0.k + ' parties)' : '') + (it0.plan ? ' · prévu le ' + it0.plan + (it0.time ? ' à ' + it0.time : '') : ''));
    box.append(gh);
    g.forEach(it => box.append(libCard(it)));
  });
  storageLine('libStore'); refreshLibCount();
}
function libCard(it) {
  const upd = async p => { Object.assign(it, p); await clipsDb.put(it); refreshLibCount(); };
  const card = el('div', 'blk');
  const h = el('div', 'row head');
  h.append(el('h3', 'grow', (it.k > 1 ? 'Partie ' + it.j + '/' + it.k : 'Clip unique') + ' (' + it.d + ' s)'));
  if (it.score != null) { const s = el('span', 'score ' + scoreClass(it.score), String(it.score)); s.title = 'Score de viralité'; h.append(s); }
  card.append(h);
  if (it.src === 'claude') card.append(el('span', 'badge', 'Légende rédigée par Claude'));
  card.append(el('div', 'clip-s', 'Exporté le ' + new Date(it.created).toLocaleDateString('fr-FR') + (it.size ? ' · ' + fmtBytes(it.size) : '') + (it.status === 'done' ? ' · publié' : ' · à publier')));
  const row = el('div', 'row');
  const lab = el('label', 'inline', 'Publier le '); const dt = el('input'); dt.type = 'date'; dt.value = it.plan || ''; dt.onchange = () => upd({ plan: dt.value });
  const tm = el('input'); tm.type = 'time'; tm.value = it.time || ''; tm.onchange = () => upd({ time: tm.value });
  lab.append(dt, tm); row.append(lab);
  const vbox = el('div');
  row.append(mkBtn('Voir', async () => { if (vbox.firstChild) { vbox.textContent = ''; return; } const b = await blobs.get(it.id); if (!b) return; const vd = el('video', 'lib-video'); vd.src = URL.createObjectURL(b); vd.controls = true; vd.playsInline = true; vbox.append(vd); }),
    mkBtn('Télécharger', () => dl(it)),
    mkBtn(it.status === 'done' ? 'Remettre à publier' : 'Marquer publié', async () => { await upd({ status: it.status === 'done' ? 'todo' : 'done', publishedAt: it.publishedAt || Date.now() }); renderLib(); }));
  card.append(row, vbox);
  if (it.hookA && it.hookB) {
    const ab = el('div', 'row');
    ab.append(el('span', 'clip-s', 'Accroche utilisée :'));
    ['A', 'B'].forEach(V => ab.append(mkBtn(V + (it.variant === V ? ' ✓' : ''), async () => {
      if (it.variant === V) return; const old = it.variant === 'B' ? it.hookB : it.hookA, nw = V === 'B' ? it.hookB : it.hookA;
      await upd({ variant: V, caption: it.caption.indexOf(old) === 0 ? nw + it.caption.slice(old.length) : nw + '\n\n' + it.caption }); renderLib();
    }, 'btn sm' + (it.variant === V ? ' on' : ''))));
    card.append(ab);
  }
  const ta = el('textarea'); ta.value = it.caption || ''; ta.rows = 5; ta.onchange = () => upd({ caption: ta.value });
  const r2 = el('div', 'row'); r2.append(mkBtn('Copier la légende', () => copy(ta.value, 'Légende copiée.')));
  card.append(ta, r2);
  if (it.status === 'done') {
    const res = el('div', 'results-in');
    res.append(el('div', 'clip-s', 'Résultats sur TikTok (à remplir quelques jours après la publication) :'));
    const g = el('div', 'res-grid');
    [['views', 'Vues'], ['likes', 'J’aime'], ['comments', 'Commentaires'], ['shares', 'Partages'], ['follows', 'Nouveaux abonnés']].forEach(([k, l]) => {
      const lb = el('label', '', l), inp = el('input'); inp.type = 'number'; inp.min = 0; inp.value = it[k] ?? ''; inp.onchange = () => upd({ [k]: inp.value === '' ? null : +inp.value }); lb.append(inp); g.append(lb);
    });
    res.append(g); card.append(res);
  }
  const del = el('div', 'row end');
  del.append(mkBtn('Supprimer', async () => { if (!confirm('Supprimer ce clip de la bibliothèque ?')) return; await clipsDb.del(it.id); await blobs.del(it.id); renderLib(); }, 'btn sm ghost'));
  card.append(del);
  return card;
}

/* ---------- Publier ---------- */
function bestHours(all) {
  const done = all.filter(i => i.status === 'done' && i.views != null && i.time);
  const by = {}; done.forEach(i => { const h = +i.time.split(':')[0], b = h < 9 ? '6h-9h' : h < 12 ? '9h-12h' : h < 15 ? '12h-15h' : h < 18 ? '15h-18h' : h < 21 ? '18h-21h' : '21h-24h'; (by[b] = by[b] || []).push(i.views); });
  const rows = Object.entries(by).filter(([, l]) => l.length >= 3).map(([b, l]) => [b, l.reduce((a, x) => a + x, 0) / l.length]).sort((a, b) => b[1] - a[1]);
  return rows.length ? 'D’après tes résultats, ta meilleure tranche horaire est ' + rows[0][0] + ' (' + Math.round(rows[0][1]).toLocaleString('fr-FR') + ' vues en moyenne).' : 'Repères généraux souvent cités : en semaine vers 12h-14h et 18h-22h. Ce ne sont que des points de départ : note l’heure et les vues de chaque publication, et le site te dira ce qui marche pour ton public.';
}
async function renderPub() {
  const box = $('pubList'); box.textContent = '';
  const today = new Date().toLocaleDateString('sv-SE'), all = await clipsDb.all();
  const items = all.filter(i => i.status === 'todo').sort((a, b) => { const x = (a.plan || '9999') + (a.time || ''), y = (b.plan || '9999') + (b.time || ''); return x < y ? -1 : x > y ? 1 : a.created - b.created; });
  const due = items.filter(i => i.plan && i.plan <= today).length;
  $('pubInfo').textContent = items.length ? items.length + ' clip(s) à publier, dont ' + due + ' prévu(s) aujourd’hui ou en retard.' : 'Rien à publier pour l’instant. Exporte des clips : ils arrivent ici avec leur légende.';
  $('pubHours').textContent = bestHours(all);
  items.forEach(it => {
    const card = el('div', 'blk');
    const badge = el('span', 'badge' + (it.plan && it.plan < today ? ' late' : it.plan === today ? ' now' : ''), it.plan ? (it.plan < today ? 'En retard : prévu le ' + it.plan : it.plan === today ? 'À publier aujourd’hui' + (it.time ? ' à ' + it.time : '') : 'Prévu le ' + it.plan + (it.time ? ' à ' + it.time : '')) : 'Pas de date prévue');
    card.append(badge, el('h3', '', (it.film || 'Film') + ' · moment ' + it.m + (it.k > 1 ? ', partie ' + it.j + '/' + it.k : '')));
    card.append(el('div', 'pcap', it.caption || '(pas de légende : ouvre la bibliothèque pour en écrire une)'));
    const fname = safeName(it.film) + '-moment' + it.m + '-partie' + it.j + (it.type && it.type.indexOf('webm') > -1 ? '.webm' : '.mp4');
    const row = el('div', 'row');
    row.append(mkBtn('Préparer et ouvrir TikTok', async () => {
      navigator.clipboard.writeText(it.caption || '').catch(() => {});
      await dl(it);
      toast('Vidéo téléchargée et légende copiée. Dans TikTok Studio : importe la vidéo, puis colle la légende (Ctrl+V).', 7000);
      window.open('https://www.tiktok.com/tiktokstudio/upload', S.exporting ? 'tiktokstudio' : '_blank', S.exporting ? 'popup,width=1100,height=800' : 'noopener');
    }, 'btn sm primary'));
    if (navigator.canShare) row.append(mkBtn('Partager vers l’application', async () => {
      try { navigator.clipboard.writeText(it.caption || '').catch(() => {}); const b = await blobs.get(it.id), f = new File([b], fname, { type: b.type }); if (navigator.canShare({ files: [f] })) await navigator.share({ files: [f], text: it.caption || '' }); else toast('Ton appareil ne peut pas partager ce fichier : utilise le bouton de gauche.'); }
      catch (e) { if (e && e.name !== 'AbortError') toast('Partage impossible ici.'); }
    }));
    row.append(mkBtn('J’ai publié', async () => { const now = new Date(); it.status = 'done'; it.publishedAt = now.getTime(); if (!it.time) it.time = now.toTimeString().slice(0, 5); if (!it.plan) it.plan = now.toLocaleDateString('sv-SE'); await clipsDb.put(it); refreshLibCount(); renderPub(); toast('Pense à noter ses résultats dans la bibliothèque dans quelques jours.'); }));
    card.append(row); box.append(card);
  });
}

/* ---------- Résultats ---------- */
async function renderStats() {
  const box = $('statsBody'); box.textContent = '';
  const all = await clipsDb.all(), done = all.filter(i => i.status === 'done'), withV = done.filter(i => i.views != null);
  const sum = (l, k) => l.reduce((a, i) => a + (+i[k] || 0), 0), avg = (l, k) => l.length ? sum(l, k) / l.length : 0, n = x => Math.round(x).toLocaleString('fr-FR');
  const kpis = el('div', 'kpis');
  [['Clips publiés', done.length], ['Vues au total', n(sum(withV, 'views'))], ['Vues moyennes', n(avg(withV, 'views'))], ['Nouveaux abonnés', n(sum(withV, 'follows'))]].forEach(([l, v]) => { const k = el('div', 'kpi'); k.append(el('div', 'kpi-v', String(v)), el('div', 'kpi-l', l)); kpis.append(k); });
  box.append(kpis);
  if (withV.length < 3) {
    box.append(el('p', 'empty', 'Note les résultats d’au moins 3 clips publiés (dans la bibliothèque, onglet « Publiés ») pour voir ce qui marche le mieux : genres, durées, heures, accroches A ou B et score de viralité.'));
    return;
  }
  const table = (title, groups, hint) => {
    const rows = Object.entries(groups).filter(([, l]) => l.length).map(([k, l]) => ({ k, c: l.length, v: avg(l, 'views'), f: avg(l, 'follows') })).sort((a, b) => b.v - a.v);
    if (!rows.length) return;
    const b = el('div', 'blk'); b.append(el('h3', '', title));
    const max = Math.max(...rows.map(r => r.v)) || 1;
    rows.forEach(r => { const row = el('div', 'bar-row'), tr = el('span', 'bar-t'), fill = el('i'); fill.style.width = (r.v / max * 100).toFixed(0) + '%'; tr.append(fill); row.append(el('span', 'bar-k', r.k), tr, el('span', 'bar-v', n(r.v) + ' vues · ' + r.c + ' clip(s)')); b.append(row); });
    const best = rows[0]; if (best && best.c >= 2) b.append(el('div', 'clip-s', hint(best)));
    box.append(b);
  };
  const grp = f => { const g = {}; withV.forEach(i => { const k = f(i); if (k) (g[k] = g[k] || []).push(i); }); return g; };
  table('Par genre', grp(i => i.genre), r => 'Ton public répond le mieux à : ' + r.k + '.');
  table('Par durée', grp(i => i.d < 60 ? 'moins d’1 min' : i.d < 90 ? '1 min à 1 min 30' : i.d < 120 ? '1 min 30 à 2 min' : 'plus de 2 min'), r => 'Durée la plus efficace : ' + r.k + '.');
  table('Par heure de publication', grp(i => { if (!i.time) return null; const h = +i.time.split(':')[0]; return h < 9 ? '6h-9h' : h < 12 ? '9h-12h' : h < 15 ? '12h-15h' : h < 18 ? '15h-18h' : h < 21 ? '18h-21h' : '21h-24h'; }), r => 'Meilleure tranche horaire : ' + r.k + '.');
  table('Accroche A ou B', grp(i => i.hookA ? 'Accroche ' + (i.variant || 'A') : null), r => 'Les accroches ' + r.k.slice(-1) + ' marchent mieux pour l’instant : continue le test sur plus de clips pour confirmer.');
  table('Par score de viralité', grp(i => i.score == null ? null : i.score >= 80 ? '80 et plus' : i.score >= 60 ? '60 à 79' : 'moins de 60'), r => r.k === '80 et plus' ? 'Les clips bien notés font plus de vues : vise un score de 80.' : 'Le score ne prédit pas encore bien ton public : fie-toi surtout à tes résultats.');
}

/* ---------- Initialisation ---------- */
export async function initPanels(api) {
  API = api;
  const saved = await kv.get('capopts'); if (saved) opts = { ...opts, ...saved };
  const t = $('cap_tone'); TONES.forEach(x => t.append(new Option(x, x)));
  const saveOpts = () => kv.set('capopts', opts).catch(() => {});
  ['cast', 'kw', 'nh', 'tone'].forEach(k => $('cap_' + k).addEventListener('change', e => { opts[k] = e.target.value; saveOpts(); }));
  $('cap_emo').addEventListener('change', e => { opts.emo = e.target.checked; saveOpts(); });
  $('capGen').onclick = () => { if (!S.per) return; S.clips.filter(c => c.on).forEach(c => generateFor(c, false)); API.savePer(); renderCaps(); };
  $('capCopy').onclick = capsCopyAll;
  $('capExport').onclick = exportFiche;
  $('capImport').onclick = () => $('capImportFile').click();
  $('capImportFile').onchange = e => { const f = e.target.files[0]; if (f) importClaude(f); e.target.value = ''; };
  $('capAi').onclick = () => { if (!S.clips.length) return; const o = { ...capOptions(), name: filmName(), genre: S.ui.genre }; copy(aiPrompt(o, S.clips.filter(c => c.on), S.per.notes), 'Demande copiée : colle-la dans l’IA de ton choix.'); };
  document.querySelectorAll('#dock [data-panel]').forEach(b => b.onclick = () => { const d = $('p-' + b.dataset.panel); if (d.classList.contains('on')) closePanels(); else openPanel(b.dataset.panel); });
  document.querySelectorAll('.drawer .close').forEach(b => b.onclick = closePanels);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });
  on('closePanels', closePanels);
  document.querySelectorAll('#libTabs .chip').forEach(b => b.onclick = () => { tab = b.dataset.t; document.querySelectorAll('#libTabs .chip').forEach(x => x.classList.toggle('on', x === b)); renderLib(); });
  $('libFilm').onchange = e => { filmFilter = e.target.value; renderLib(); };
  $('keepFilm').onchange = e => kv.set('keepFilm', e.target.checked);
  $('errs').onclick = () => copy(localStorage.getItem('errs') || 'Aucun problème enregistré.', 'Rapport copié : envoie-le pour que le problème soit corrigé.');
  $('wipe').onclick = async () => { if (!confirm('Effacer toutes les données enregistrées sur cet appareil (clips, films, analyses, réglages) ?')) return; await clearAll(); localStorage.clear(); location.reload(); };
  refreshLibCount();
}
