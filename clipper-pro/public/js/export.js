// Export rapide hors temps réel (WebCodecs + Mediabunny) : chaque image du film est décodée, habillée puis encodée.
// Aucune image perdue, durée exacte, son mixé hors ligne, possible en arrière-plan.
import { Renderer } from './render.js';
import { frames } from './media.js';
import { mixClipAudio } from './mix.js';
import { centerAt } from './track.js';
import { S } from './state.js';

// Le film a-t-il du son (voix, bruit) entre a et b d'après l'analyse ?
const soundAt = (a, b) => { const A = S.data && S.data.has && S.data.A; if (!A) return false; let m = 0; for (let i = Math.max(0, Math.floor(a)); i < Math.min(A.length, Math.ceil(b)); i++) m = Math.max(m, A[i]); return m > .01; };

// Débits élevés : TikTok recompresse toujours, un fichier propre au départ perd moins de qualité.
export const QUALITY = {
  tiktok: { W: 1440, H: 2560, br: 16e6, label: '2K 1440p' },
  high: { W: 1440, H: 2560, br: 24e6, label: '2K 1440p maximale' },
  uhd: { W: 2160, H: 3840, br: 40e6, label: '4K 2160p' },
  hd: { W: 1080, H: 1920, br: 12e6, label: 'Full HD 1080p' },
  light: { W: 720, H: 1280, br: 6e6, label: 'Légère 720p' },
};

let canCache = {};
export async function fastSupported(film, ui) {
  if (!film || !film.mb) return false;
  const q = QUALITY[ui.quality] || QUALITY.tiktok, M = film.mb.M, codec = ui.fmt === 'webm' ? 'vp9' : 'avc', k = codec + q.W + '-' + q.br;
  if (canCache[k] === undefined) { try { canCache[k] = await M.canEncodeVideo(codec, { width: q.W, height: q.H, bitrate: q.br }); } catch (e) { canCache[k] = false; } }
  return canCache[k];
}

// Export en arrière-plan : tant qu'un export tourne, l'onglet garde un verrou (Chrome évite alors de le geler),
// la page demande confirmation avant d'être fermée, le titre de l'onglet affiche l'avancement,
// et une notification prévient à la fin si tu es sur une autre page.
const BG = { lock: null, guard: null, title: null, endT: null };
function bgStart() {
  clearTimeout(BG.endT);
  if (BG.title == null) BG.title = document.title;
  if (!BG.guard) { BG.guard = e => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', BG.guard); }
  if (!BG.lock && navigator.locks) navigator.locks.request('clipper-export', () => new Promise(r => { BG.lock = r; })).catch(() => {});
  try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); } catch (e) { }
}
function bgEnd() {
  clearTimeout(BG.endT);
  // Fin du lot : aucun autre clip n'a démarré dans les secondes qui suivent.
  BG.endT = setTimeout(() => {
    if (BG.lock) { BG.lock(); BG.lock = null; }
    if (BG.guard) { removeEventListener('beforeunload', BG.guard); BG.guard = null; }
    if (BG.title != null) { document.title = BG.title; BG.title = null; }
    try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Clipper Pro', { body: 'Export terminé : tes clips sont dans la bibliothèque.' }); } catch (e) { }
  }, 4000);
}

export async function exportFast(film, clip, ui, music, subs, track, onProgress, isAborted) {
  bgStart();
  try { return await exportFastRun(film, clip, ui, music, subs, track, (p, m) => { const k = p == null ? null : Math.round(p * 100); if (k != null && k !== BG.pct) { BG.pct = k; document.title = k + ' % · Export clip ' + clip.m + '.' + clip.j + ' · Clipper Pro'; } onProgress(p, m); }, isAborted); }
  finally { bgEnd(); }
}

async function exportFastRun(film, clip, ui, music, subs, track, onProgress, isAborted) {
  const mb = film.mb, M = mb.M, q = QUALITY[ui.quality] || QUALITY.tiktok, webm = ui.fmt === 'webm';
  const cv = new OffscreenCanvas(q.W, q.H), R = new Renderer(cv);
  const out = new M.Output({ format: webm ? new M.WebMOutputFormat() : new M.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new M.BufferTarget() });
  // Encodage orienté qualité (pas de compromis temps réel), débit variable, priorité aux détails de l'image.
  const vs = new M.CanvasSource(cv, { codec: webm ? 'vp9' : 'avc', bitrate: q.br, keyFrameInterval: 2, latencyMode: 'quality', bitrateMode: 'variable', contentHint: 'detail' });
  out.addVideoTrack(vs);
  onProgress(0, 'Préparation du son…');
  const audio = await mixClipAudio(mb, clip.s, clip.e, ui, music);
  // Le film parle à ce moment mais aucun son n'a pu être décodé : on refuse d'exporter une vidéo muette (l'export repasse en temps réel).
  if (mb.at && +ui.filmVol > 0 && mixClipAudio.lastFilmRms < 1e-4 && soundAt(clip.s, clip.e)) throw new Error('son du film introuvable');
  let as = null;
  if (audio) { as = new M.AudioBufferSource({ codec: webm ? 'opus' : 'aac', bitrate: 160e3 }); out.addAudioTrack(as); }
  await out.start();
  if (as) await as.add(audio);
  const dur = clip.e - clip.s; let first = true, lastT = -1;
  try {
    for await (const fr of frames(mb, clip.s, clip.e)) {
      if (isAborted()) { fr.close(); throw new Error('arrêté'); }
      if (fr.t + fr.d <= clip.s + 1e-4) { fr.close(); continue; }
      const t = Math.max(0, fr.t - clip.s);
      if (t <= lastT) { fr.close(); continue; }
      R.frame(fr.img, fr.w, fr.h, { t, dur, clip, ui, cx: track ? centerAt(track, fr.t) : null, subs, capture: first });
      first = false; lastT = t;
      await vs.add(t, Math.min(fr.d, Math.max(.001, dur - t)));
      fr.close();
      onProgress(Math.min(1, t / dur));
    }
    await out.finalize();
  } catch (e) { try { await out.cancel(); } catch (x) {} throw e; }
  return new Blob([out.target.buffer], { type: webm ? 'video/webm' : 'video/mp4' });
}
