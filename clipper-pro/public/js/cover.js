// Images de couverture TikTok : choisit les 3 meilleures images d'un clip (nettes, bien exposées, colorées),
// leur applique le rendu de l'export (cadrage, netteté, couleurs, luminosité) et ajoute un grand titre lisible.
import { S, $, download, safeName, filmName, toast } from './state.js';
import { Renderer } from './render.js';
import { smallFrames } from './media.js';
import { centerAt } from './track.js';

const W = 1080, H = 1920, FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const css = document.createElement('style');
css.textContent = '.covers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}.covers figure{margin:0;display:flex;flex-direction:column;gap:6px}.covers img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:10px;border:1px solid rgba(127,127,127,.35)}#coverBox .row{flex-wrap:wrap}#coverBox select,#coverBox input{min-width:0;flex:1 1 180px}';
document.head.append(css);

const clipLabel = c => (c.k > 1 ? 'Moment ' + c.m + ', partie ' + c.j + '/' + c.k : 'Moment ' + c.m) + (c.ptitle ? ' : ' + c.ptitle : '');
function fillClips() {
  const sel = $('coverClip'); if (!sel) return;
  const prev = sel.value; sel.textContent = '';
  const list = S.clips.filter(c => c.on).length ? S.clips.filter(c => c.on) : S.clips;
  list.forEach(c => sel.append(new Option(clipLabel(c), c.key)));
  if (prev && list.some(c => c.key === prev)) sel.value = prev;
}

// Note d'une petite image : netteté (contours), exposition proche du milieu, couleurs ; les images noires sont écartées.
function scoreFrame(cv) {
  const w = cv.width, h = cv.height, d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h); let sum = 0, rg = 0, yb = 0, rg2 = 0, yb2 = 0;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = d[i], g = d[i + 1], b = d[i + 2], l = (r * .2126 + g * .7152 + b * .0722) / 255; L[p] = l; sum += l;
    const a = r - g, c = (r + g) / 2 - b; rg += a; yb += c; rg2 += a * a; yb2 += c * c;
  }
  const n = w * h, mean = sum / n;
  let sharp = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const p = y * w + x; sharp += Math.abs(4 * L[p] - L[p - 1] - L[p + 1] - L[p - w] - L[p + w]); }
  sharp /= (w - 2) * (h - 2);
  const colorful = Math.sqrt(rg2 / n - (rg / n) ** 2 + yb2 / n - (yb / n) ** 2) + .3 * Math.sqrt((rg / n) ** 2 + (yb / n) ** 2);
  if (mean < .08 || mean > .92) return 0;
  return sharp * (1 - Math.min(.9, 1.6 * Math.abs(mean - .45))) * (.6 + Math.min(1, colorful / 60));
}

async function makeCovers() {
  const out = $('coverOut'), btn = $('coverGen'), c = S.clips.find(x => x.key === $('coverClip').value);
  if (!S.film || !c) return;
  if (!S.film.mb) { out.textContent = 'Ce format de fichier ne permet pas de créer les couvertures : convertis le film en MP4 (H.264).'; return; }
  btn.disabled = true; out.textContent = 'Recherche des meilleures images…';
  try {
    const mb = S.film.mb, a = c.s + 1, b = Math.max(a + 1, c.e - 3), N = 16, times = [];
    for (let i = 0; i < N; i++) times.push(a + (b - a) * (i + .5) / N);
    const scores = []; let i = 0;
    for await (const cv of smallFrames(mb, times, 240)) { scores.push({ t: times[i], s: cv ? scoreFrame(cv) : 0 }); i++; }
    // 3 meilleures images, assez éloignées les unes des autres
    const picks = [];
    scores.map((x, k) => ({ ...x, k })).sort((p, q) => q.s - p.s).forEach(x => { if (picks.length < 3 && picks.every(p => Math.abs(p.k - x.k) >= 3)) picks.push(x); });
    picks.sort((p, q) => p.t - q.t);
    out.textContent = 'Création des couvertures…';
    const sink = new mb.M.CanvasSink(mb.vt, { poolSize: 1 }), imgs = [];
    const saved = S.per && S.per.tracks && S.per.tracks[c.key], track = saved && saved.cx ? { s: saved.s, step: saved.step, cx: Float32Array.from(saved.cx) } : null;
    const ui = { ...S.ui, title: '', showTitle: false, hook3: '', cta: '', outro: '', subsOn: false, loopOn: false, nextCard: false };
    const text = ($('coverText').value || '').trim() || (c.ptitle || '').trim() || filmName();
    for (const p of picks) {
      let fr = null; for await (const x of sink.canvasesAtTimestamps([p.t])) fr = x;
      if (!fr) continue;
      const cv = new OffscreenCanvas(W, H), R = new Renderer(cv);
      for (let k = 0; k < 2; k++) R.frame(fr.canvas, fr.canvas.width, fr.canvas.height, { t: 5, dur: 999, clip: { ...c, key: 'cover' }, ui, cx: track && S.ui.follow ? centerAt(track, p.t) : null });
      drawText(cv.getContext('2d'), text, c);
      imgs.push({ t: p.t, blob: await cv.convertToBlob({ type: 'image/jpeg', quality: .93 }) });
    }
    out.textContent = '';
    imgs.forEach((x, k) => {
      const f = document.createElement('figure'), img = document.createElement('img'), url = URL.createObjectURL(x.blob);
      img.src = url; img.alt = 'Couverture ' + (k + 1);
      const d = document.createElement('button'); d.type = 'button'; d.className = 'btn sm'; d.textContent = 'Télécharger';
      d.onclick = () => download(x.blob, safeName(filmName()) + '-moment' + c.m + '-partie' + c.j + '-couverture' + (k + 1) + '.jpg');
      f.append(img, d); out.append(f);
    });
    if (!imgs.length) out.textContent = 'Aucune image exploitable trouvée dans ce clip.';
  } catch (e) { out.textContent = 'Échec : ' + e.message; }
  btn.disabled = false;
}

// Grand titre au centre (zone visible dans la grille du profil TikTok), avec le numéro de partie en pastille.
function drawText(ctx, text, c) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const g = ctx.createLinearGradient(0, H * .26, 0, H * .62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, H * .26, W, H * .36);
  const words = text.toUpperCase().split(/\s+/).filter(Boolean), lines = []; let ln = '';
  let fs = 120; ctx.font = '900 ' + fs + 'px ' + FONT;
  const fit = () => { lines.length = 0; ln = ''; words.forEach(w => { const t = (ln + ' ' + w).trim(); if (ctx.measureText(t).width > W - 120 && ln) { lines.push(ln); ln = w; } else ln = t; }); if (ln) lines.push(ln); };
  fit(); while ((lines.length > 3 || lines.some(l => ctx.measureText(l).width > W - 120)) && fs > 56) { fs -= 6; ctx.font = '900 ' + fs + 'px ' + FONT; fit(); }
  const lh = fs * 1.08, y0 = H * .42 - (lines.length - 1) * lh / 2;
  ctx.lineWidth = fs * .16; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
  lines.forEach((l, i) => { ctx.strokeText(l, W / 2, y0 + i * lh); ctx.fillText(l, W / 2, y0 + i * lh); });
  if (c.k > 1) {
    const t = 'PARTIE ' + c.j + '/' + c.k; ctx.font = '900 64px ' + FONT;
    const bw = ctx.measureText(t).width + 70, by = y0 + (lines.length - 1) * lh + fs * .62 + 40;
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(W / 2 - bw / 2, by, bw, 96, 48); else ctx.rect(W / 2 - bw / 2, by, bw, 96); ctx.fill();
    ctx.fillStyle = '#000'; ctx.fillText(t, W / 2, by + 50);
  }
  ctx.restore();
}

function init() {
  if (!$('coverGen')) return;
  $('coverGen').onclick = makeCovers;
  // La liste des clips se met à jour quand les clips changent.
  const list = $('list'); if (list) new MutationObserver(() => fillClips()).observe(list, { childList: true });
  fillClips();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
