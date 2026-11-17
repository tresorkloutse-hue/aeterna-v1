// Reconnaissance vocale (Whisper) exécutée dans un fil séparé pour ne pas bloquer la page.
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1/+esm';

let asr = null, curKey = null;
async function load(m) {
  const key = m.model + '|' + m.device;
  if (asr && curKey === key) return;
  const progress_callback = p => self.postMessage({ type: 'progress', id: m.id, p: { status: p.status, file: p.file, progress: p.progress } });
  asr = await pipeline('automatic-speech-recognition', m.model, { dtype: m.dtype, device: m.device, progress_callback });
  curKey = key;
}
self.onmessage = async e => {
  const m = e.data;
  try {
    try { await load(m); }
    catch (err) {
      if (!m.fallback) throw err;
      // Carte graphique indisponible ou modèle trop lourd : on bascule sur le modèle de secours.
      self.postMessage({ type: 'progress', id: m.id, p: { status: 'fallback' } });
      Object.assign(m, m.fallback, { fallback: null }); await load(m);
    }
    const opts = { task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 };
    if (m.language && m.language !== 'auto') opts.language = m.language;
    const out = await asr(m.pcm, opts);
    const words = [];
    for (const c of out.chunks || []) {
      const raw = c.text || '', t = raw.trim(); if (!t) continue;
      const s = c.timestamp[0], en = c.timestamp[1];
      if (words.length && !/^\s/.test(raw)) { const w = words[words.length - 1]; w.w += t; if (en != null) w.e = en; }
      else words.push({ w: t, s: s ?? 0, e: en ?? (s ?? 0) + .3 });
    }
    self.postMessage({ type: 'done', id: m.id, words, text: (out.text || '').trim(), model: m.model });
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, error: String(err && err.message || err) });
  }
};
