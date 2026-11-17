// Lecture des fichiers vidéo avec Mediabunny (WebCodecs) : analyse rapide, décodage d'extraits, images.
const MB_URL = 'https://cdn.jsdelivr.net/npm/mediabunny@1.62.0/dist/bundles/mediabunny.min.mjs';
let mbp = null;
export const loadMB = () => mbp || (mbp = import(MB_URL));
export const webcodecs = () => typeof VideoDecoder !== 'undefined' && typeof VideoEncoder !== 'undefined' && typeof AudioDecoder !== 'undefined';

// Ouvre un fichier ; renvoie null si le format ou le codec n'est pas pris en charge.
export async function openInput(file) {
  if (!webcodecs()) return null;
  try {
    const M = await loadMB();
    const input = new M.Input({ formats: M.ALL_FORMATS, source: new M.BlobSource(file) });
    const vt = await input.getPrimaryVideoTrack();
    if (!vt || !(await vt.canDecode())) return null;
    let at = await input.getPrimaryAudioTrack();
    if (at && !(await at.canDecode())) at = null;
    const rotation = (await vt.getRotation()) || 0;
    const w = await vt.getDisplayWidth(), h = await vt.getDisplayHeight();
    const dur = await input.computeDuration();
    let fps = 0;
    try { const st = await vt.computePacketStats(120); fps = st.averagePacketRate || 0; } catch (e) {}
    return { M, input, vt, at, rotation, w, h, dur, fps };
  } catch (e) { return null; }
}

// Analyse rapide : le mouvement est estimé par la taille des images compressées (sans décodage),
// le son par le volume moyen de chaque seconde (décodage audio seul).
export async function fastAnalyze(mb, dur, onProgress, isAborted) {
  const { M, vt, at } = mb, n = Math.ceil(dur) + 1;
  const bytes = new Float64Array(n), frames = new Float64Array(n);
  const ps = new M.EncodedPacketSink(vt);
  let i = 0;
  for await (const p of ps.packets(undefined, undefined, { metadataOnly: true })) {
    const s = Math.floor(p.timestamp); if (s < 0 || s >= n) continue;
    if (p.type !== 'key') { bytes[s] += p.byteLength; frames[s]++; }
    if (++i % 4000 === 0) { onProgress(.15 * Math.min(1, p.timestamp / dur)); if (isAborted()) throw new Error('arrêté'); }
  }
  const Mv = new Float32Array(n);
  for (let k = 0; k < n; k++) Mv[k] = frames[k] ? bytes[k] / frames[k] : (k ? Mv[k - 1] : 0);
  const A = new Float32Array(n);
  let has = false;
  if (at) {
    const sum = new Float64Array(n), cnt = new Float64Array(n);
    const sink = new M.AudioBufferSink(at);
    let j = 0;
    for await (const { buffer, timestamp } of sink.buffers()) {
      const d = buffer.getChannelData(0), sr = buffer.sampleRate;
      for (let q = 0; q < d.length; q += 16) { const s = Math.floor(timestamp + q / sr); if (s >= 0 && s < n) { sum[s] += d[q] * d[q]; cnt[s]++; } }
      if (++j % 200 === 0) { onProgress(.15 + .85 * Math.min(1, timestamp / dur)); if (isAborted()) throw new Error('arrêté'); }
    }
    for (let k = 0; k < n; k++) A[k] = cnt[k] ? Math.sqrt(sum[k] / cnt[k]) : 0;
    has = Math.max(...A) > .002;
  }
  onProgress(1);
  return { A, M: Mv, has, method: 'fast' };
}

// Son d'un extrait [s, e) en AudioBuffer stéréo à la fréquence d'origine.
export async function decodeAudioSegment(mb, s, e) {
  if (!mb || !mb.at) return null;
  const sink = new mb.M.AudioBufferSink(mb.at);
  let sr = 0, chans = 2;
  const parts = [];
  for await (const { buffer, timestamp } of sink.buffers(Math.max(0, s - .1), e)) { sr = buffer.sampleRate; chans = Math.min(2, buffer.numberOfChannels); parts.push({ buffer, timestamp }); }
  if (!sr) return null;
  const len = Math.max(1, Math.round((e - s) * sr)), out = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: sr });
  for (const { buffer, timestamp } of parts) {
    const off = Math.round((timestamp - s) * sr);
    const lr = toStereo(buffer);
    for (let c = 0; c < 2; c++) {
      const src = lr[c], dst = out.getChannelData(c);
      const from = Math.max(0, -off), to = Math.min(src.length, len - off);
      if (to > from) dst.set(src.subarray(from, to), off + from);
    }
  }
  return out;
}

// Son 5.1 ou 7.1 des films : les dialogues sont sur la voie centrale (3e voie). On la mélange dans la gauche et la droite,
// sinon on n'entend que la musique et les bruitages.
function toStereo(b) {
  const n = b.numberOfChannels, ch = i => b.getChannelData(i);
  if (n === 1) return [ch(0), ch(0)];
  if (n < 3) return [ch(0), ch(1)];
  const L = ch(0), R = ch(1), C = ch(2), len = L.length, l = new Float32Array(len), r = new Float32Array(len);
  const Ls = n >= 5 ? ch(n >= 6 ? 4 : 3) : null, Rs = n >= 5 ? ch(n >= 6 ? 5 : 4) : null;
  for (let i = 0; i < len; i++) {
    l[i] = .55 * L[i] + .75 * C[i] + (Ls ? .3 * Ls[i] : 0);
    r[i] = .55 * R[i] + .75 * C[i] + (Rs ? .3 * Rs[i] : 0);
  }
  return [l, r];
}

// Son d'un extrait en mono 16 kHz (pour la reconnaissance vocale).
export async function pcm16k(mb, s, e) {
  const ab = await decodeAudioSegment(mb, s, e);
  if (!ab) return null;
  const len = Math.max(1, Math.ceil(ab.duration * 16000)), oc = new OfflineAudioContext(1, len, 16000);
  const src = oc.createBufferSource(); src.buffer = ab; src.connect(oc.destination); src.start();
  return (await oc.startRendering()).getChannelData(0);
}

// Parcourt les images d'un extrait. Chaque élément : { img, w, h, t, d, close }.
export async function* frames(mb, s, e) {
  const { M, vt, rotation } = mb;
  if (rotation) {
    const sink = new M.CanvasSink(vt, { poolSize: 3 });
    for await (const fr of sink.canvases(s, e)) yield { img: fr.canvas, w: fr.canvas.width, h: fr.canvas.height, t: fr.timestamp, d: fr.duration, close() {} };
  } else {
    const sink = new M.VideoSampleSink(vt);
    for await (const smp of sink.samples(s, e)) {
      const vf = smp.toVideoFrame();
      yield { img: vf, w: vf.displayWidth, h: vf.displayHeight, t: smp.timestamp, d: smp.duration, close() { vf.close(); smp.close(); } };
    }
  }
}

// Petites images régulièrement espacées (suivi de l'action, contrôles).
export async function* smallFrames(mb, times, width = 96) {
  const sink = new mb.M.CanvasSink(mb.vt, { width, poolSize: 2 });
  for await (const fr of sink.canvasesAtTimestamps(times)) yield fr ? fr.canvas : null;
}
