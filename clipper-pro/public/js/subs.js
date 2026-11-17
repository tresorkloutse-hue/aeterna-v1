// Sous-titres automatiques : transcription des clips (modèle au choix), nettoyage, modification du texte.
import { pcm16k } from './media.js';

const MODELS = {
  base: { model: 'onnx-community/whisper-base_timestamped', dtype: 'q8', device: 'wasm' },
  small: { model: 'onnx-community/whisper-small_timestamped', dtype: 'q8', device: 'wasm' },
  turbo: { model: 'onnx-community/whisper-large-v3-turbo_timestamped', dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' }, device: 'webgpu' },
};
let worker = null, seq = 0, gpuOk = null;
const pending = {};

async function hasGpuF16() {
  if (gpuOk !== null) return gpuOk;
  try { const a = navigator.gpu && await navigator.gpu.requestAdapter(); gpuOk = !!(a && a.features.has('shader-f16')); } catch (e) { gpuOk = false; }
  return gpuOk;
}
async function pickModel(choice) {
  if (choice === 'base' || choice === 'small') return { ...MODELS[choice] };
  if (await hasGpuF16()) return { ...MODELS.turbo, fallback: MODELS.small };
  return { ...MODELS.small };
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./asr-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = e => {
    const m = e.data, p = pending[m.id]; if (!p) return;
    if (m.type === 'progress') p.onProgress && p.onProgress(m.p);
    else if (m.type === 'done') { delete pending[m.id]; p.resolve(m); }
    else if (m.type === 'error') { delete pending[m.id]; p.reject(new Error(m.error)); }
  };
  worker.onerror = e => { Object.values(pending).forEach(p => p.reject(new Error(e.message || 'Erreur du module de sous-titres'))); for (const k in pending) delete pending[k]; worker = null; };
  return worker;
}

// Voix mise en avant : coupe des graves et des aigus, compression, niveau normalisé.
export async function cleanVoice(pcm) {
  try {
    const oc = new OfflineAudioContext(1, pcm.length, 16000), b = oc.createBuffer(1, pcm.length, 16000); b.copyToChannel(pcm, 0);
    const src = oc.createBufferSource(); src.buffer = b;
    const hp = oc.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const lp = oc.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7600;
    const pk = oc.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 2500; pk.Q.value = .8; pk.gain.value = 3;
    const cp = oc.createDynamicsCompressor(); cp.threshold.value = -28; cp.ratio.value = 4; cp.attack.value = .005; cp.release.value = .2;
    src.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(cp); cp.connect(oc.destination); src.start();
    const out = (await oc.startRendering()).getChannelData(0);
    let peak = 0; for (let i = 0; i < out.length; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
    if (peak > 1e-4) { const g = .9 / peak; for (let i = 0; i < out.length; i++) out[i] *= g; }
    return out;
  } catch (e) { return pcm; }
}

const norm = w => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9']/g, '');
const JUNK = /sous-titr|amara\.org|merci d'avoir regard|abonnez-vous|sous titrage|transcrit par|www\.|\.com\b/i;

// Supprime ce que la reconnaissance invente : répétitions en boucle, mots sur du silence, mentions parasites.
export function cleanWords(words, pcm) {
  let w = (words || []).filter(x => x && x.w && x.w.trim() && x.e > x.s - .01);
  // Mentions parasites typiques de Whisper (génériques de sous-titrage).
  if (JUNK.test(w.map(x => x.w).join(' '))) {
    const keep = []; let sent = [];
    const flush = () => { if (!JUNK.test(sent.map(x => x.w).join(' '))) keep.push(...sent); sent = []; };
    for (const x of w) { sent.push(x); if (/[.!?…]$/.test(x.w)) flush(); }
    flush(); w = keep;
  }
  // Mots qui durent anormalement longtemps : souvent inventés sur de la musique.
  w = w.filter(x => x.e - x.s < 2.5);
  // Mots posés sur un passage très calme (aucune voix).
  if (pcm && pcm.length) {
    const rms = (a, b) => { a = Math.max(0, Math.floor(a * 16000)); b = Math.min(pcm.length, Math.ceil(b * 16000)); let s = 0; for (let i = a; i < b; i += 4) s += pcm[i] * pcm[i]; return b > a ? Math.sqrt(s / ((b - a) / 4)) : 0; };
    const levels = w.map(x => rms(x.s, Math.max(x.e, x.s + .15))), sorted = [...levels].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 0;
    w = w.filter((x, i) => levels[i] > med * .12);
  }
  // Répétitions : un même mot plus de 2 fois de suite, ou une même phrase répétée à l'identique.
  const out = [];
  for (const x of w) {
    const k = norm(x.w); let run = 0;
    for (let i = out.length - 1; i >= 0 && norm(out[i].w) === k; i--) run++;
    if (k && run >= 2) continue;
    out.push(x);
    for (let n = 2; n <= 10 && out.length >= 2 * n; n++) {
      const a = out.slice(-n).map(y => norm(y.w)).join(' '), b = out.slice(-2 * n, -n).map(y => norm(y.w)).join(' ');
      if (a && a === b) { out.splice(out.length - n, n); break; }
    }
  }
  return out;
}

// Transcrit un clip ; renvoie [{ w, s, e }] avec des temps relatifs au début du clip.
export async function transcribeClip(mb, clip, language, choice, onProgress) {
  const raw = await pcm16k(mb, clip.s, clip.e);
  if (!raw) return { words: [], text: '' };
  const pcm = await cleanVoice(raw), conf = await pickModel(choice || 'auto');
  const id = ++seq;
  const r = await new Promise((resolve, reject) => {
    pending[id] = { resolve, reject, onProgress };
    const copy = pcm.slice();
    getWorker().postMessage({ id, ...conf, language, pcm: copy }, [copy.buffer]);
  });
  r.words = cleanWords(r.words, raw);
  return r;
}

// Applique un texte modifié à la main en conservant au mieux les temps d'origine.
export function retime(words, text) {
  const nw = text.trim().split(/\s+/).filter(Boolean);
  if (!nw.length) return [];
  if (!words.length) return nw.map((w, i) => ({ w, s: i * .4, e: i * .4 + .38 }));
  if (nw.length === words.length) return words.map((w, i) => ({ ...w, w: nw[i] }));
  const s = words[0].s, e = words[words.length - 1].e, d = (e - s) / nw.length;
  return nw.map((w, i) => ({ w, s: s + i * d, e: s + (i + 1) * d - .02 }));
}
