// Musiques sans voix générées dans le navigateur, musique importée, mémorisation.
import { S, $, kv, toast } from './shared.js';

const MIN_C = [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], MAJ_C = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
export const LIB = {
  'Action / Thriller': { q: 'cinematic action instrumental', t: [
    { n: 'Poursuite', bpm: 150, root: 45, ch: MIN_C, pad: ['sawtooth', 800, .08], arp: ['sawtooth', .25, 12, .05, [0, 1, 2, 1]], bass: [.25, 1], kick: 1, hat: 1, snare: 1 },
    { n: 'Tension montante', bpm: 90, root: 43, ch: MIN_C, pad: ['sawtooth', 600, .09], arp: ['triangle', .5, 12, .06, [0, 2, 1, 2]], bass: [.22, 2], kick: 1 }] },
  'Humour / Comédie': { q: 'funny quirky playful instrumental', t: [
    { n: 'Pizzicato malin', bpm: 120, root: 55, ch: MAJ_C, pad: ['triangle', 1200, .04], arp: ['triangle', .5, 12, .12, [0, 2, 1, 2, 0, 1]], bass: [.2, 1], hat: 1 },
    { n: 'Petite fanfare', bpm: 135, root: 53, ch: MAJ_C, pad: ['square', 900, .03], arp: ['square', .5, 12, .05, [0, 1, 2, 1]], bass: [.18, 1], kick: 1, hat: 1 }] },
  'Amour / Romance': { q: 'romantic piano emotional instrumental', t: [
    { n: 'Piano doux', bpm: 75, root: 48, ch: MAJ_C, pad: ['sine', 2000, .1], arp: ['sine', 1, 12, .14, [0, 1, 2, 1]] },
    { n: 'Cordes tendres', bpm: 60, root: 48, ch: MAJ_C, pad: ['sawtooth', 500, .1], arp: ['triangle', 2, 12, .08, [0, 2, 1]] }] },
  'Horreur / Frisson': { q: 'dark ambient horror suspense instrumental', t: [
    { n: 'Drone noir', bpm: 60, root: 36, ch: [[0, 1, 6], [0, 3, 6], [0, 1, 7], [0, 6, 10]], pad: ['sawtooth', 350, .1], drone: 1 },
    { n: 'Battement sourd', bpm: 60, root: 40, ch: [[0, 3, 6], [1, 4, 7], [0, 3, 6], [0, 1, 6]], pad: ['sawtooth', 300, .07], arp: ['sine', 4, 24, .1, [0, 1, 2]], kick: 1, drone: 1 }] },
  'Science-fiction': { q: 'sci-fi synthwave ambient instrumental', t: [
    { n: 'Néon', bpm: 105, root: 45, ch: MIN_C, pad: ['sawtooth', 1500, .07], arp: ['square', .25, 12, .04, [0, 2, 1, 2]], bass: [.22, 1], kick: 1, hat: 1 },
    { n: 'Espace profond', bpm: 60, root: 43, ch: MIN_C, pad: ['triangle', 1200, .1], arp: ['sine', 1, 24, .08, [0, 1, 2]], drone: 1 }] },
  'Science / Documentaire': { q: 'documentary curious light instrumental', t: [
    { n: 'Curiosité', bpm: 105, root: 50, ch: MAJ_C, pad: ['triangle', 1500, .06], arp: ['triangle', .5, 12, .09, [0, 1, 2, 1]], bass: [.18, 1], hat: 1 },
    { n: 'Lumineux', bpm: 90, root: 52, ch: MAJ_C, pad: ['triangle', 1800, .07], arp: ['sine', .5, 12, .08, [0, 2, 1, 2]], kick: 1 }] },
};

async function synthRaw(p) {
  const sr = 32000, len = 32, beat = 60 / p.bpm, o = new OfflineAudioContext(2, sr * len, sr), m = o.createGain();
  m.gain.value = .6; m.connect(o.destination);
  const bus = o.createBiquadFilter(); bus.type = 'lowpass'; bus.frequency.value = 3000; bus.connect(m);
  const f = n => 440 * Math.pow(2, (n - 69) / 12);
  const burst = (dur, kind) => { const n = Math.round(sr * dur), b = o.createBuffer(1, n, sr), d = b.getChannelData(0); let p1 = 0, lp = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; let s; if (kind === 'hat') { s = w - p1; p1 = w; } else { lp += .35 * (w - lp); s = w - lp; } d[i] = s * Math.exp(-i / (n * .22)); } return b; };
  const kickBuf = (() => { const n = Math.round(sr * .25), b = o.createBuffer(1, n, sr), d = b.getChannelData(0); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr, fr = 130 * Math.pow(40 / 130, Math.min(1, t / .15)); ph += 2 * Math.PI * fr / sr; d[i] = Math.sin(ph) * .5 * Math.pow(.002, t / .2); } return b; })();
  const hat = burst(.05, 'hat'), snare = burst(.15, 'snare');
  const play = (buf, t, vol) => { const s = o.createBufferSource(), g = o.createGain(); s.buffer = buf; g.gain.value = vol; s.connect(g); g.connect(m); s.start(t); };
  const note = (type, fr, t, dur, vol) => { const os = o.createOscillator(), g = o.createGain(); os.type = type; os.frequency.value = fr; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + dur); os.connect(g); g.connect(bus); os.start(t); os.stop(t + dur + .05); };
  p.ch.forEach((ch, ci) => {
    const t = ci * 8;
    if (p.pad) { const lp = o.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.pad[1]; lp.connect(m); ch.forEach(iv => { const os = o.createOscillator(), g = o.createGain(); os.type = p.pad[0]; os.frequency.value = f(p.root + 12 + iv); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p.pad[2], t + 2); g.gain.setValueAtTime(p.pad[2], t + 6); g.gain.linearRampToValueAtTime(0, t + 8.2); os.connect(g); g.connect(lp); os.start(t); os.stop(t + 8.3); }); }
    if (p.bass) for (let k = 0; k * beat * p.bass[1] < 8; k++) note('triangle', f(p.root - 12 + ch[0]), t + k * beat * p.bass[1], beat * p.bass[1] * .9, p.bass[0]);
    if (p.arp) { const [ty, dv, oc, vol, pat] = p.arp; for (let k = 0; k * beat * dv < 8; k++) note(ty, f(p.root + 12 + oc + ch[pat[k % pat.length] % ch.length]), t + k * beat * dv, Math.max(.15, beat * dv * .9), vol); }
    for (let k = 0; k * beat < 8; k++) { const tt = t + k * beat; if (p.kick) play(kickBuf, tt, 1); if (p.hat) { play(hat, tt, .06); play(hat, tt + beat / 2, .04); } if (p.snare && k % 2 === 1) play(snare, tt, .18); }
  });
  if (p.drone) { const nb = o.createBuffer(1, sr, sr), nd = nb.getChannelData(0); for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1; const s = o.createBufferSource(), g = o.createGain(), fl = o.createBiquadFilter(); s.buffer = nb; s.loop = true; fl.type = 'lowpass'; fl.frequency.value = 220; g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(.12, 2); g.gain.setValueAtTime(.12, len - 2); g.gain.linearRampToValueAtTime(0, len); s.connect(fl); fl.connect(g); g.connect(m); s.start(0); s.stop(len); }
  return o.startRendering();
}

const memo = {};
export function synth(p) {
  if (memo[p.n]) return memo[p.n];
  memo[p.n] = (async () => {
    try { const c = await kv.get('mus2:' + p.n); if (c && c.ch) { const b = new AudioBuffer({ length: c.l, numberOfChannels: c.ch.length, sampleRate: c.sr }); c.ch.forEach((d, i) => b.copyToChannel(d, i)); return b; } } catch (e) {}
    const b = await synthRaw(p);
    kv.set('mus2:' + p.n, { l: b.length, sr: b.sampleRate, ch: Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i)) }).catch(() => {});
    return b;
  })();
  memo[p.n].catch(() => { delete memo[p.n]; });
  return memo[p.n];
}

let curCat = Object.keys(LIB)[0], previewSrc = null, previewCtx = null, playing = null;
function stopPreview() { if (previewSrc) { try { previewSrc.stop(); } catch (e) {} previewSrc = null; } playing = null; }
export const stopMusicPreview = () => { if (playing) { stopPreview(); renderMusicLib(); } };

function setMusic(buffer, label, kind, save) {
  S.music = { buffer, label, kind };
  $('musicName').textContent = buffer ? label : 'Aucune musique choisie';
  $('musicRemove').hidden = !buffer;
  if (save !== undefined) save ? kv.set('music', save).catch(() => {}) : kv.del('music').catch(() => {});
}

export function renderMusicLib() {
  const cats = $('cats'), tr = $('tracks'); cats.textContent = ''; tr.textContent = '';
  Object.keys(LIB).forEach(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (c === curCat ? ' on' : ''); b.textContent = c; b.onclick = () => { curCat = c; stopPreview(); renderMusicLib(); warm(); }; cats.append(b); });
  $('moreMusic').href = 'https://pixabay.com/music/search/' + encodeURIComponent(LIB[curCat].q) + '/';
  LIB[curCat].t.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'row-item';
    const sp = document.createElement('span'); sp.className = 'grow'; sp.textContent = p.n;
    const pl = document.createElement('button'); pl.type = 'button'; pl.className = 'btn sm'; pl.textContent = playing === p.n ? 'Arrêter' : 'Écouter';
    pl.onclick = async () => {
      if (playing === p.n) { stopPreview(); renderMusicLib(); return; }
      stopPreview(); pl.textContent = 'Préparation…'; pl.disabled = true;
      const buf = await synth(p);
      previewCtx = previewCtx || new AudioContext(); await previewCtx.resume();
      previewSrc = previewCtx.createBufferSource(); previewSrc.buffer = buf; previewSrc.loop = true; previewSrc.connect(previewCtx.destination); previewSrc.start(); playing = p.n; renderMusicLib();
    };
    const ch = document.createElement('button'); ch.type = 'button'; ch.className = 'btn sm'; ch.textContent = S.music.label === 'Musique : ' + p.n ? 'Choisie' : 'Choisir';
    ch.onclick = async () => { ch.textContent = 'Préparation…'; const buf = await synth(p); setMusic(buf, 'Musique : ' + p.n, 'lib', { kind: 'lib', cat: curCat, i }); renderMusicLib(); };
    row.append(sp, pl, ch); tr.append(row);
  });
}

function warm() { setTimeout(() => { if (S.busy || S.exporting) return; LIB[curCat].t.reduce((pr, p) => pr.then(() => synth(p)).catch(() => {}), Promise.resolve()); }, 80); }

export async function initMusic() {
  renderMusicLib();
  $('musicFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await f.arrayBuffer()); setMusic(buf, 'Musique : ' + f.name, 'file', { kind: 'file', name: f.name, blob: f }); renderMusicLib(); }
    catch (x) { toast('Fichier audio illisible : essaie un MP3 ou un M4A.'); }
  });
  $('musicRemove').onclick = () => { setMusic(null, '', null, null); $('musicFile').value = ''; renderMusicLib(); };
  try {
    const s = await kv.get('music');
    if (s && s.kind === 'lib' && LIB[s.cat] && LIB[s.cat].t[s.i]) { const p = LIB[s.cat].t[s.i]; curCat = s.cat; setMusic(await synth(p), 'Musique : ' + p.n, 'lib'); }
    else if (s && s.kind === 'file' && s.blob) { const buf = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await s.blob.arrayBuffer()); setMusic(buf, 'Musique : ' + s.name, 'file'); }
  } catch (e) {}
  renderMusicLib();
  setTimeout(warm, 3000);
}
