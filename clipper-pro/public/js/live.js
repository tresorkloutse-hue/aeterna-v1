// Chaîne audio de l'aperçu, analyse par lecture (secours) et export en temps réel (secours).
import { S, $, wait, once, pct } from './state.js';
import { Renderer } from './render.js';
import { QUALITY } from './export.js';
import { centerAt } from './track.js';

export const A = { ac: null, gain: null, vgain: null, an: null, dest: null, lim: null, musicSrc: null };

export function initAudio(v) {
  if (A.ac) return;
  const ac = A.ac = new (window.AudioContext || window.webkitAudioContext)();
  const src = ac.createMediaElementSource(v);
  A.gain = ac.createGain(); A.an = ac.createAnalyser(); A.an.fftSize = 2048;
  A.vgain = ac.createGain(); A.dest = ac.createMediaStreamDestination();
  A.lim = ac.createDynamicsCompressor(); A.lim.threshold.value = -4; A.lim.knee.value = 2; A.lim.ratio.value = 20; A.lim.attack.value = .003; A.lim.release.value = .25;
  const out = ac.createGain(); out.gain.value = .9;
  src.connect(A.an); src.connect(A.gain); A.gain.connect(ac.destination);
  src.connect(A.vgain); A.vgain.connect(A.lim); A.lim.connect(out); out.connect(A.dest);
}

export function startMusic(toExport, dur) {
  stopMusic(); const buf = S.music.buffer; if (!buf || !A.ac) return;
  const g = A.ac.createGain(), vol = +S.ui.musicVol / 100, t = A.ac.currentTime;
  g.gain.value = vol;
  if (dur && !S.ui.loopOn) { g.gain.setValueAtTime(vol, t + Math.max(0, dur - 1.5)); g.gain.linearRampToValueAtTime(0, t + dur); }
  A.musicSrc = A.ac.createBufferSource(); A.musicSrc.buffer = buf; A.musicSrc.loop = true;
  A.musicSrc.connect(g); g.connect(toExport ? A.lim : A.ac.destination); A.musicSrc.start();
}
export function stopMusic() { if (A.musicSrc) { try { A.musicSrc.stop(); } catch (e) {} A.musicSrc = null; } }

// Analyse en lisant la vidéo (pour les formats que l'analyse rapide ne sait pas lire).
export async function playbackAnalyze(v, dur, rate, onProgress, isAborted) {
  await A.ac.resume(); A.gain.gain.value = 0; v.pause();
  const n = Math.ceil(dur) + 1, Aa = new Float32Array(n), Mm = new Float32Array(n), C = new Uint16Array(n);
  const tiny = document.createElement('canvas'); tiny.width = 32; tiny.height = 18; const tx = tiny.getContext('2d', { willReadFrequently: true });
  const buf = new Float32Array(2048); let prev = null;
  const grab = (i, rms) => {
    tx.drawImage(v, 0, 0, 32, 18); const d = tx.getImageData(0, 0, 32, 18).data; let df = 0;
    if (prev) { for (let k = 0; k < d.length; k += 4) df += Math.abs(d[k] + d[k + 1] + d[k + 2] - prev[k] - prev[k + 1] - prev[k + 2]); df /= 576 * 765; }
    prev = d; if (i >= 0 && i < n) { Aa[i] += rms; Mm[i] += df; C[i]++; }
  };
  try {
    if (rate >= 24) {
      const step = rate / 10;
      for (let t = 0; t < dur - 1 && !isAborted(); t += step) { v.currentTime = t; await Promise.race([once(v, 'seeked'), wait(2000)]); grab(Math.floor(t), 0); onProgress(t / dur); }
    } else {
      v.playbackRate = rate; if (v.currentTime > .1) { v.currentTime = 0; await once(v, 'seeked'); }
      await v.play();
      await new Promise(res => { const id = setInterval(() => {
        if (isAborted() || v.ended || v.currentTime >= dur - .3) { clearInterval(id); res(); return; }
        A.an.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x;
        grab(Math.floor(v.currentTime), Math.sqrt(s / buf.length)); onProgress(v.currentTime / dur);
      }, 100); });
      v.pause(); v.playbackRate = 1;
    }
  } finally { A.gain.gain.value = 1; }
  for (let i = 0; i < n; i++) { if (C[i]) { Aa[i] /= C[i]; Mm[i] /= C[i]; } else if (i) { Aa[i] = Aa[i - 1]; Mm[i] = Mm[i - 1]; } }
  return { A: Aa, M: Mm, has: Math.max(...Aa) > .002 && rate < 24, method: 'play' };
}

// Export en temps réel : la vidéo est rejouée et enregistrée image par image.
export function exportLive(v, clip, ui, subs, track, onProgress, isAborted) {
  return new Promise(async (resolve, reject) => {
    const q = QUALITY[ui.quality] || QUALITY.tiktok, cv = document.createElement('canvas'); cv.width = q.W; cv.height = q.H;
    const R = new Renderer(cv), RV = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const webmT = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    const mp4T = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
    const mime = (ui.fmt === 'webm' ? webmT : mp4T) || webmT || mp4T || '';
    let alive = true, started = false, rec, wd, warm = null, recMs = 0, seg = 0, first = true;
    const dur = clip.e - clip.s;
    const draw = () => { const t = v.currentTime - clip.s; R.frame(v, v.videoWidth, v.videoHeight, { t, dur, clip, ui, cx: track ? centerAt(track, v.currentTime) : null, subs, capture: first && started }); if (started) first = false; };
    const fail = err => { alive = false; clearInterval(wd); try { v.pause(); if (warm && warm.state !== 'inactive') warm.stop(); if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); } } catch (x) {} A.gain.gain.value = 1; stopMusic(); reject(err); };
    try {
      await A.ac.resume(); v.pause(); A.gain.gain.value = 0;
      const pre = RV ? Math.min(mime.indexOf('mp4') > -1 ? 1.8 : 1, clip.s) : 0;
      v.currentTime = clip.s - pre; await Promise.race([once(v, 'seeked'), wait(6000)]);
      const cs = RV ? cv.captureStream(0) : cv.captureStream(30), track0 = cs.getVideoTracks()[0];
      A.vgain.gain.value = +ui.filmVol / 100;
      rec = new MediaRecorder(new MediaStream([track0, ...A.dest.stream.getAudioTracks()]), { mimeType: mime, videoBitsPerSecond: q.br, audioBitsPerSecond: 160000 });
      const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      rec.onstop = async () => { alive = false; clearInterval(wd); recMs += performance.now() - seg; A.gain.gain.value = 1; stopMusic(); let b = new Blob(chunks, { type: rec.mimeType || mime }); b = await fixWebm(b, recMs); resolve(b); };
      if (RV) {
        const onFrame = () => { if (!alive) return; draw(); if (started && rec.state === 'recording') track0.requestFrame(); if (warm && warm.state === 'recording') warm.__t.requestFrame(); v.requestVideoFrameCallback(onFrame); };
        v.requestVideoFrameCallback(onFrame);
        if (mime.indexOf('mp4') > -1 && pre > .5) { const ws = cv.captureStream(0); warm = new MediaRecorder(ws, { mimeType: mime }); warm.__t = ws.getVideoTracks()[0]; warm.ondataavailable = () => {}; warm.start(); }
        await v.play();
        await new Promise(r => { const chk = (n, md) => { if (!alive || isAborted() || md.mediaTime >= clip.s - .001 || v.ended) r(); else v.requestVideoFrameCallback(chk); }; v.requestVideoFrameCallback(chk); setTimeout(r, (pre + 4) * 1000); });
        if (warm && warm.state !== 'inactive') warm.stop();
      } else { await v.play(); const iv = setInterval(() => { if (!alive) clearInterval(iv); else draw(); }, 33); }
      if (isAborted()) return fail(new Error('arrêté'));
      rec.start(500); seg = performance.now(); started = true; draw(); if (RV) track0.requestFrame();
      startMusic(true, dur);
      let last = v.currentTime, still = 0;
      wd = setInterval(() => {
        if (!alive) return clearInterval(wd);
        onProgress(Math.min(1, (v.currentTime - clip.s) / dur));
        if (isAborted() || v.currentTime >= clip.e || v.ended) { alive = false; v.pause(); rec.stop(); return; }
        if (document.hidden) { still = 0; return; }
        if (Math.abs(v.currentTime - last) < .01) still++; else { still = 0; last = v.currentTime; }
        if (still >= 80) fail(new Error('Le film ne progresse plus.'));
      }, 250);
    } catch (e) { fail(e); }
  });
}

let fixLoad = null;
async function fixWebm(blob, ms) {
  if (blob.type.indexOf('webm') < 0) return blob;
  try {
    fixLoad = fixLoad || new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/fix-webm-duration@1.0.6/fix-webm-duration.js'; s.integrity = 'sha384-4/EZwV/7CHkXWbuglEX8ZrHWLx6dTRQ65h3IXJ/P6v4RbwxvHIGP/Dbppchnxf/a'; s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = rej; document.head.append(s); });
    await fixLoad;
    return await Promise.race([window.ysFixWebmDuration(blob, Math.round(ms), { logger: false }), wait(15000).then(() => blob)]);
  } catch (e) { return blob; }
}
