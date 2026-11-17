// État partagé de l'application et petites fonctions utilitaires.
export const DEFAULT_UI = {
  // Analyse
  mtype: 'all', sens: '.75', limit: '999', minLen: '90', partLen: '120', maxMoment: '600', method: 'auto',
  // Habillage
  title: '', genre: 'Action / Thriller', hook3: 'Regarde jusqu’à la fin', cta: 'Abonne-toi pour 1 scène culte par jour !',
  outro: 'Clique sur + pour t’abonner et ne rien rater !', loopOn: true, nextCard: true, subAnim: true,
  // Sous-titres
  subsOn: true, subsStyle: 'pop', subsSize: 'm', subsLang: 'french', subsModel: 'auto', showTitle: true,
  // Cadrage
  mode: 'z60', follow: true, offset: '50', bgStyle: 'soft', bgBlur: '60',
  // Qualité et export
  quality: 'tiktok', colors: 'strong', sharp: 'strong', bright: 'auto', engine: 'auto', fmt: 'mp4',
  // Son
  filmVol: '100', musicVol: '35',
};

export const S = {
  ui: { ...DEFAULT_UI },
  film: null,        // { file, fp, name, size, dur, w, h, url, fps, hasAudio, mb: { input, vt, at, rotation } | null }
  data: null,        // { A, M, has, method }
  clips: [],         // { key, s, e, m, j, k, on, score, kind }
  per: null,         // état propre au film : { flags, subs, tracks, notes }
  music: { buffer: null, label: '', kind: null },
  curClip: null,
  busy: false, exporting: false, abort: false,
};

export const $ = id => document.getElementById(id);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const wait = ms => new Promise(r => setTimeout(r, ms));
export const once = (el, ev) => new Promise(r => el.addEventListener(ev, r, { once: true }));
export const clipKey = c => Math.round(c.s * 10) + '-' + Math.round(c.e * 10);
export const ts = t => { t = Math.max(0, t || 0); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
export const fmtBytes = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' Go' : Math.max(1, Math.round(b / 1e6)) + ' Mo';
export const pct = (arr, p) => { const s = Array.from(arr).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const filmName = () => { const t = (S.ui.title || '').trim(); return t.indexOf(':') > -1 ? t.split(':').slice(1).join(':').trim() : t; };

// Petit bus d'événements
const handlers = {};
export const on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
export const emit = (ev, ...a) => { (handlers[ev] || []).forEach(fn => { try { fn(...a); } catch (e) { console.error(e); } }); };

let toastTimer = null;
export function toast(msg, ms = 4500) {
  const t = $('toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export function logError(msg) {
  try { const l = JSON.parse(localStorage.getItem('errs') || '[]'); l.push(new Date().toISOString() + ' ' + msg); localStorage.setItem('errs', JSON.stringify(l.slice(-40))); } catch (e) {}
}

export function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

export const safeName = s => (s || 'clip').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'clip';
