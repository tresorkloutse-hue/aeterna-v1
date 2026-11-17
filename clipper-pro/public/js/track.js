// Recadrage qui suit l'action : on repère où bouge l'image, puis on lisse le trajet du cadre.
import { smallFrames } from './media.js';

export async function computeTrack(mb, clip, isAborted = () => false) {
  const step = 1 / 3, times = [];
  for (let t = clip.s; t < clip.e; t += step) times.push(t);
  const cx = new Float32Array(times.length), wgt = new Float32Array(times.length);
  let prev = null, i = 0, w = 0, h = 0;
  for await (const c of smallFrames(mb, times, 96)) {
    if (isAborted()) throw new Error('arrêté');
    if (!c) { cx[i] = i ? cx[i - 1] : .5; i++; continue; }
    w = c.width; h = c.height;
    const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
    for (let p = 0, q = 0; p < d.length; p += 4, q++) g[q] = d[p] * .3 + d[p + 1] * .59 + d[p + 2] * .11;
    if (prev) {
      const col = new Float32Array(w); let tot = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.abs(g[y * w + x] - prev[y * w + x]); if (v > 12) { col[x] += v; tot += v; } }
      if (tot > w * h * .6) { let s = 0; for (let x = 0; x < w; x++) s += col[x] * (x + .5); cx[i] = s / tot / w; wgt[i] = Math.min(1, tot / (w * h * 6)); }
      else { cx[i] = i ? cx[i - 1] : .5; wgt[i] = 0; }
    } else cx[i] = .5;
    prev = g; i++;
  }
  // Lissage : moyenne pondérée sur une fenêtre de ~2 s, puis vitesse limitée pour un mouvement de caméra naturel.
  const n = cx.length, sm = new Float32Array(n), R = 6;
  for (let k = 0; k < n; k++) { let s = 0, ws = 0; for (let j = Math.max(0, k - R); j <= Math.min(n - 1, k + R); j++) { const wt = (wgt[j] + .05) * (1 - Math.abs(j - k) / (R + 1)); s += cx[j] * wt; ws += wt; } sm[k] = ws ? s / ws : .5; }
  const maxStep = .12 * step;
  for (let k = 1; k < n; k++) sm[k] = sm[k - 1] + Math.max(-maxStep, Math.min(maxStep, sm[k] - sm[k - 1]));
  for (let k = n - 2; k >= 0; k--) sm[k] = sm[k + 1] + Math.max(-maxStep, Math.min(maxStep, sm[k] - sm[k + 1]));
  for (let k = 0; k < n; k++) sm[k] = .5 + (sm[k] - .5) * .9;
  return { s: clip.s, step, cx: sm };
}

export function centerAt(track, absT) {
  if (!track || !track.cx.length) return null;
  const f = (absT - track.s) / track.step, i = Math.max(0, Math.min(track.cx.length - 1, Math.floor(f))), j = Math.min(track.cx.length - 1, i + 1), a = Math.max(0, Math.min(1, f - i));
  return track.cx[i] * (1 - a) + track.cx[j] * a;
}
