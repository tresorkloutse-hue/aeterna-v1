// Mixage hors temps réel : son du film + musique, voix mises en avant, volume identique d'un clip à l'autre
// (niveau conseillé pour TikTok, environ -14 LUFS), fondu de fin, limiteur (aucune saturation).
import { decodeAudioSegment } from './media.js';

const TARGET = -14;

export async function mixClipAudio(mb, s, e, ui, music) {
  let film = mb && mb.at ? await decodeAudioSegment(mb, s, e) : null;
  // Le décodeur audio peut renvoyer un extrait vide (souvent au premier export) : on redécode avant d'abandonner.
  for (let k = 0; k < 2 && mb && mb.at && rms(film) < 1e-4; k++) { await new Promise(r => setTimeout(r, 300)); film = await decodeAudioSegment(mb, s, e); }
  mixClipAudio.lastFilmRms = rms(film);
  if (!film && !music) return null;
  const sr = film ? film.sampleRate : 48000, dur = e - s, len = Math.max(1, Math.round(dur * sr));
  // 1) Mélange brut : film (voix légèrement mises en avant) + musique
  const oc = new OfflineAudioContext(2, len, sr);
  if (film) {
    const src = oc.createBufferSource(), g = oc.createGain(), voice = oc.createBiquadFilter();
    voice.type = 'peaking'; voice.frequency.value = 2500; voice.Q.value = .8; voice.gain.value = 2.5;
    src.buffer = film; g.gain.value = +ui.filmVol / 100; src.connect(voice); voice.connect(g); g.connect(oc.destination); src.start(0);
  }
  if (music) {
    const src = oc.createBufferSource(), g = oc.createGain(), vol = +ui.musicVol / 100;
    src.buffer = music; src.loop = true; g.gain.setValueAtTime(vol, 0);
    if (!ui.loopOn) { g.gain.setValueAtTime(vol, Math.max(0, dur - 1.5)); g.gain.linearRampToValueAtTime(0, dur); }
    src.connect(g); g.connect(oc.destination); src.start(0);
  }
  const raw = await oc.startRendering();
  // 2) Mesure du volume perçu, puis correction pour atteindre le niveau cible
  const lufs = await loudness(raw);
  const gainDb = lufs == null ? 0 : Math.max(-12, Math.min(12, TARGET - lufs));
  mixClipAudio.lastLufs = lufs; mixClipAudio.lastGainDb = gainDb;
  const oc2 = new OfflineAudioContext(2, len, sr);
  const src = oc2.createBufferSource(); src.buffer = raw;
  const g = oc2.createGain(); g.gain.value = Math.pow(10, gainDb / 20);
  const lim = oc2.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 1; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .2;
  const out = oc2.createGain(); out.gain.value = .9;
  src.connect(g); g.connect(lim); lim.connect(out); out.connect(oc2.destination); src.start(0);
  return oc2.startRendering();
}

// Volume perçu (LUFS intégré, norme EBU R128 simplifiée : pondération K, blocs de 400 ms, seuils de silence).
async function loudness(buf) {
  if (!buf || buf.length < buf.sampleRate * .4) return null;
  const oc = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate);
  const src = oc.createBufferSource(); src.buffer = buf;
  const shelf = oc.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 1500; shelf.gain.value = 4;
  const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = .5;
  src.connect(shelf); shelf.connect(hp); hp.connect(oc.destination); src.start(0);
  const k = await oc.startRendering(), n = Math.floor(k.sampleRate * .4), blocks = [];
  for (let i = 0; i + n <= k.length; i += n >> 1) {
    let z = 0;
    for (let c = 0; c < k.numberOfChannels; c++) { const d = k.getChannelData(c); let a = 0; for (let j = i; j < i + n; j += 2) a += d[j] * d[j]; z += a / (n / 2); }
    blocks.push(z);
  }
  const L = z => -0.691 + 10 * Math.log10(z || 1e-12);
  let g = blocks.filter(z => L(z) > -70); if (!g.length) return null;
  const rel = L(g.reduce((a, b) => a + b, 0) / g.length) - 10;
  g = g.filter(z => L(z) > rel); if (!g.length) return null;
  return L(g.reduce((a, b) => a + b, 0) / g.length);
}

function rms(b) {
  if (!b) return 0;
  const d = b.getChannelData(0); let a = 0, n = 0;
  for (let i = 0; i < d.length; i += 64) { a += d[i] * d[i]; n++; }
  return n ? Math.sqrt(a / n) : 0;
}
