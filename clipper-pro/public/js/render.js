// Moteur de rendu vertical 9:16 : cadrage, fond, titre, accroche, sous-titres, bandeau, fin et boucle.
// Le même code sert à l'aperçu, à l'export en temps réel et à l'export rapide.
const ZOOM = { fit: 0, z35: .35, z60: .6, z80: .8, fill: 1 };
const BG = { soft: { dark: .28, f: '' }, strong: { dark: .38, f: '', extra: .35 }, cine: { dark: .62, f: 'saturate(.85)', vig: 1 }, vivid: { dark: .12, f: 'saturate(1.8) brightness(1.12)' }, glow: { dark: .05, f: 'saturate(1.4) brightness(1.35)', glow: 1 }, bw: { dark: .35, f: 'grayscale(1) contrast(1.1)' } };
const mk = (w, h) => typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

// Traitement de l'image par la carte graphique : netteté (masque flou borné, sans halo), clarté (contraste local),
// contraste en S et éclat des couleurs (renforce surtout les couleurs ternes, épargne les teintes déjà vives et la peau).
// Un seul contexte WebGL partagé ; en cas de souci, retour au dessin classique.
export const LEVELS = {
  sharp: { off: [0, 0], light: [.6, .06], medium: [1, .08], strong: [1.5, .11], max: [2.2, .15] },
  colors: { off: [0, 0, 0], light: [.12, .12, .2], medium: [.25, .22, .4], strong: [.38, .32, .6], max: [.52, .45, .85] },
  // Luminosité : courbe qui éclaircit surtout les tons sombres et moyens, sans brûler les blancs.
  bright: { d2: 1.25, d1: 1.12, n: 1, b1: .88, b2: .77, b3: .67 },
};
const lv = (kind, ui) => LEVELS[kind][ui[kind]] || LEVELS[kind][kind === 'sharp' ? (ui.sharpen === false ? 'off' : 'strong') : (ui.enhance === false ? 'off' : 'strong')];
const SH = { ok: null };
const VS = `#version 300 es
in vec2 c; uniform vec4 r; out vec2 uv;
void main() { uv = c; gl_Position = vec4(mix(r.xy, r.zw, c), 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
uniform sampler2D t; uniform vec2 px; uniform vec2 sk; uniform vec3 col; uniform float gam; in vec2 uv; out vec4 o;
vec3 tx(vec2 d) { return texture(t, uv + d * px).rgb; }
void main() {
  vec3 m = tx(vec2(0.));
  vec3 b1 = (tx(vec2(1., 0.)) + tx(vec2(-1., 0.)) + tx(vec2(0., 1.)) + tx(vec2(0., -1.))) * .25;
  vec3 b3 = (tx(vec2(3., 0.)) + tx(vec2(-3., 0.)) + tx(vec2(0., 3.)) + tx(vec2(0., -3.)) + tx(vec2(2.1, 2.1)) + tx(vec2(-2.1, 2.1)) + tx(vec2(2.1, -2.1)) + tx(vec2(-2.1, -2.1))) * .125;
  m += sk.x * clamp(m - b1, -sk.y, sk.y);
  m += col.y * clamp(m - b3, -.1, .1);
  m = clamp(m, 0., 1.);
  m = mix(m, m * m * (3. - 2. * m), col.x);
  m = pow(m, vec3(gam));
  float l = dot(m, vec3(.2126, .7152, .0722)), s = max(m.r, max(m.g, m.b)) - min(m.r, min(m.g, m.b));
  float skin = smoothstep(.12, .0, abs(m.r - m.g - .12)) * step(m.b, m.g);
  m = mix(vec3(l), m, 1. + col.z * (1. - s) * (1. - .6 * skin));
  o = vec4(clamp(m, 0., 1.), 1.);
}`;
function sharpInit() {
  if (SH.ok !== null) return SH.ok;
  try {
    const cv = mk(16, 16), gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('webgl2');
    const sh = (type, src) => { const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(p);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'c'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    Object.assign(SH, { cv, gl, r: gl.getUniformLocation(p, 'r'), px: gl.getUniformLocation(p, 'px'), sk: gl.getUniformLocation(p, 'sk'), col: gl.getUniformLocation(p, 'col'), gam: gl.getUniformLocation(p, 'gam'), ok: true });
  } catch (e) { SH.ok = false; }
  return SH.ok;
}
function gpuDraw(ctx, src, sw, sh, x, y, dw, dh, W, H, sc, sharp, col, gam) {
  if (!sharpInit()) return false;
  const { cv, gl } = SH;
  try {
    if (gl.isContextLost()) { SH.ok = false; return false; }
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.uniform4f(SH.r, x / W * 2 - 1, 1 - y / H * 2, (x + dw) / W * 2 - 1, 1 - (y + dh) / H * 2);
    gl.uniform2f(SH.px, 1 / sw, 1 / sh);
    gl.uniform2f(SH.sk, sharp[0] * (sc > 1.05 ? 1 : .6), sharp[1]);
    gl.uniform3f(SH.col, col[0], col[1], col[2]);
    gl.uniform1f(SH.gam, gam);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); SH.gen = (SH.gen || 0) + 1;
    if (gl.getError() !== gl.NO_ERROR) throw new Error('gl');
    ctx.drawImage(cv, 0, 0, W, H);
    return true;
  } catch (e) { SH.ok = false; return false; }
}

// Moments de l'animation d'abonnement : vers 30 % du clip (au plus tard à 12 s) puis vers 62 %, 3 s chacun.
function subPhase(t, dur) {
  const w1 = Math.max(4, Math.min(12, dur * .3)), w2 = dur * .62;
  for (const w of [w1, w2]) {
    if (w === w2 && (w2 < w1 + 6 || dur - w2 < 7)) continue;
    const lt = t - w;
    if (lt >= 0 && lt < 3) return { lt, a: lt < .3 ? lt / .3 : lt > 2.7 ? (3 - lt) / .3 : 1 };
  }
  return null;
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.sm = mk(56, 100); this.smx = this.sm.getContext('2d');
    this.one = mk(1, 1); this.onex = this.one.getContext('2d', { willReadFrequently: true });
    this.avg = null; this.first = null; this.firstFor = null;
  }
  get W() { return this.cv.width; }
  get H() { return this.cv.height; }

  empty(ui, light) {
    const { ctx, W, H } = this, sc = W / 720, g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, light ? '#2a2f3a' : '#1c1f27'); g.addColorStop(1, light ? '#14171c' : '#0b0c10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.arc(W / 2, H * .45, 46 * sc, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(W / 2 - 14 * sc, H * .45 - 20 * sc); ctx.lineTo(W / 2 + 22 * sc, H * .45); ctx.lineTo(W / 2 - 14 * sc, H * .45 + 20 * sc); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '500 ' + 28 * sc + 'px ' + FONT; ctx.textAlign = 'center'; ctx.fillText('Aperçu du clip', W / 2, H * .45 + 100 * sc); ctx.restore();
    this.overlays({ t: 99, dur: 999, clip: { j: 1, k: 2 }, ui, sample: true });
  }

  // src : image (vidéo, VideoFrame, canvas) ; o : { t, dur, clip, ui, cx (centre suivi 0..1 ou null), subs, capture }
  frame(src, sw, sh, o) {
    const { ctx, W, H } = this, ui = o.ui, z = ZOOM[ui.mode] ?? .6;
    const fit = Math.min(W / sw, H / sh), fill = Math.max(W / sw, H / sh), sc = fit + (fill - fit) * z, dw = sw * sc, dh = sh * sc;
    const center = o.cx != null && ui.follow ? o.cx : null, ox = +ui.offset / 100;
    let x;
    if (dw > W) x = center != null ? Math.max(W - dw, Math.min(0, W / 2 - center * dw)) : -(dw - W) * ox; else x = (W - dw) / 2;
    const y = dh >= H * .92 ? (H - dh) / 2 : Math.max(0, Math.min(H - dh, H * .47 - dh / 2));
    if (z < .99) this.background(src, sw, sh, center != null ? Math.max(0, Math.min(1, (W / 2 - x) / dw)) : null, ox, ui);
    if (z < .99 && ui.bgStyle !== 'black' && dh < H * .98) {
      const band = 42 * W / 720;
      let g = ctx.createLinearGradient(0, y - band, 0, y); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); ctx.fillStyle = g; ctx.fillRect(0, y - band, W, band);
      g = ctx.createLinearGradient(0, y + dh, 0, y + dh + band); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, y + dh, W, band);
    }
    // Rendu complet (netteté, couleurs, luminosité) par la carte graphique, à l'export comme dans l'aperçu.
    const t0 = performance.now(), playing = src.tagName === 'VIDEO' && !src.paused;
    const sharp = lv('sharp', ui), col = lv('colors', ui), gam = ui.bright === 'auto' ? this.autoGam(src, sw, sh, playing) : LEVELS.bright[ui.bright] || 1;
    if (!playing) this.slow = 0;
    let ok = false;
    if ((sharp[0] || col[2] || gam !== 1) && !(playing && this.slow >= 3)) {
      // Aperçu en lecture : traitement une seule fois par nouvelle image du film, sur une image réduite à la taille utile.
      const key = playing ? [src.currentTime, sharp, col, gam.toFixed(3), x | 0, y | 0, dw | 0, dh | 0, W, H].join() : null;
      if (key && key === this.glKey && this.glGen === SH.gen && SH.ok) { ctx.drawImage(SH.cv, 0, 0, W, H); ok = true; }
      else {
        let s2 = src, w2 = sw, h2 = sh;
        if (playing && dw < sw * .9) {
          w2 = Math.max(2, Math.round(dw)); h2 = Math.max(2, Math.round(dh));
          if (!this.stage) { this.stage = mk(w2, h2); this.stx = this.stage.getContext('2d'); }
          if (this.stage.width !== w2 || this.stage.height !== h2) { this.stage.width = w2; this.stage.height = h2; }
          this.stx.drawImage(src, 0, 0, w2, h2); s2 = this.stage;
        }
        ok = gpuDraw(ctx, s2, w2, h2, x, y, dw, dh, W, H, sc, sharp, col, gam);
        this.glKey = ok ? key : null; this.glGen = SH.gen;
      }
      // Si l'ordinateur ne suit pas pendant la lecture, l'aperçu repasse en version simplifiée (jamais l'export).
      if (playing) this.slow = performance.now() - t0 > 22 ? (this.slow || 0) + 1 : 0;
    }
    if (!ok) {
      if (col[2] || gam !== 1) ctx.filter = 'brightness(' + (1 + (1 - gam) * .7).toFixed(2) + ') contrast(' + (1 + col[0] * .45).toFixed(2) + ') saturate(' + (1 + col[2] * .6).toFixed(2) + ')';
      ctx.drawImage(src, x, y, dw, dh);
    }
    ctx.filter = 'none';
    this.overlays(o);
    // Boucle : on garde la première image du clip pour fondre la fin dessus.
    if (o.capture || (o.clip && this.firstFor !== o.clip.key && o.t >= 0 && o.t < .4)) { if (!this.first || this.first.width !== W) this.first = mk(W, H); this.first.getContext('2d').drawImage(this.cv, 0, 0); this.firstFor = o.clip && o.clip.key; }
    const left = o.dur - o.t;
    const nextCard = ui.nextCard && o.clip && !o.clip.nonext && o.clip.k > 1 && o.clip.j < o.clip.k;
    if (ui.loopOn && !nextCard && this.first && o.clip && this.firstFor === o.clip.key && left <= 1 && left >= 0) { ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, 1 - left)); ctx.drawImage(this.first, 0, 0, W, H); ctx.restore(); }
  }

  // Luminosité automatique : mesure la luminosité moyenne de l'image (lissée pour éviter tout clignotement)
  // et éclaircit seulement les scènes sombres ; les scènes déjà claires ne sont pas touchées.
  autoGam(src, sw, sh, playing) {
    const now = performance.now();
    // Pendant la lecture : une mesure toutes les 0,3 s au plus, et aucune si elle ralentit l'ordinateur.
    if (this.lum == null || (!playing ? now - (this.lumT || 0) > 100 : !this.lumSlow && now - (this.lumT || 0) > 300)) {
      this.lumT = now;
      try {
        if (!this.lumC) { this.lumC = mk(32, 18); this.lumX = this.lumC.getContext('2d', { willReadFrequently: true }); }
        this.lumX.drawImage(src, 0, 0, sw, sh, 0, 0, 32, 18);
        const d = this.lumX.getImageData(0, 0, 32, 18).data; let a = 0;
        for (let i = 0; i < d.length; i += 4) a += d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722;
        const l = a / (d.length / 4) / 255;
        this.lum = this.lum == null ? l : this.lum + (l - this.lum) * .35;
      } catch (e) { }
      if (playing && performance.now() - now > 15) this.lumSlow = true;
    }
    const l = Math.max(.02, this.lum == null ? .42 : this.lum);
    if (l >= .42) return 1;
    return Math.max(.65, 1 - (1 - Math.log(.42) / Math.log(l)) * .6);
  }

  background(src, sw, sh, center, ox, ui) {
    const { ctx, W, H } = this, st = ui.bgStyle;
    const fill = Math.max(W / sw, H / sh), cw = W / fill, ch = H / fill;
    const cx = center != null ? Math.max(0, Math.min(sw - cw, center * sw - cw / 2)) : (sw - cw) * ox, cy = (sh - ch) / 2;
    if (st === 'black') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
    if (st === 'color') {
      this.onex.drawImage(src, cx, cy, cw, ch, 0, 0, 1, 1); const p = this.onex.getImageData(0, 0, 1, 1).data;
      this.avg = this.avg ? this.avg.map((c, i) => c + (p[i] - c) * .08) : [p[0], p[1], p[2]];
      const [r, gg, b] = this.avg.map(Math.round), g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgb(${r * .75 | 0},${gg * .75 | 0},${b * .75 | 0})`); g.addColorStop(.5, `rgb(${r * .45 | 0},${gg * .45 | 0},${b * .45 | 0})`); g.addColorStop(1, `rgb(${r * .2 | 0},${gg * .2 | 0},${b * .2 | 0})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
    }
    const p = BG[st] || BG.soft, s = Math.min(1, +ui.bgBlur / 100 + (p.extra || 0));
    const w = Math.max(14, Math.round(140 - 122 * s)), h = Math.round(w * 16 / 9);
    if (this.sm.width !== w || this.sm.height !== h) { this.sm.width = w; this.sm.height = h; }
    this.smx.filter = 'blur(' + (0.6 + 1.6 * s).toFixed(2) + 'px)' + (p.f ? ' ' + p.f : '');
    this.smx.drawImage(src, cx, cy, cw, ch, -2, -2, w + 4, h + 4); this.smx.filter = 'none';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(this.sm, 0, 0, W, H);
    if (p.glow) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .35; ctx.drawImage(this.sm, -W * .1, -H * .1, W * 1.2, H * 1.2); ctx.restore(); }
    if (p.dark) { ctx.fillStyle = 'rgba(0,0,0,' + p.dark + ')'; ctx.fillRect(0, 0, W, H); }
    if (p.vig) { const g = ctx.createRadialGradient(W / 2, H / 2, H * .2, W / 2, H / 2, H * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }

  pill(x, y, w, h, fill) { const c = this.ctx; c.fillStyle = fill; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, h / 2); else c.rect(x, y, w, h); c.fill(); }

  wrap(text, max) { const ls = []; let ln = ''; text.split(/\s+/).forEach(w => { if ((ln + ' ' + w).trim().length > max && ln) { ls.push(ln); ln = w; } else ln = (ln + ' ' + w).trim(); }); if (ln) ls.push(ln); return ls; }

  overlays(o) {
    const { ctx, W, H } = this, ui = o.ui, c = o.clip || { j: 1, k: 1 }, sc = W / 720, t = o.t, left = o.dur - o.t;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    // Titre et partie sur une seule ligne, sous la zone des onglets de TikTok (rien si le titre est désactivé)
    const base = (ui.title || '').trim() || (o.sample ? 'Film : Titre du film' : '');
    const custom = (c.ptitle || '').trim();
    const line = (ui.showTitle === false || c.notitle) ? '' : custom || (base ? base + (c.k > 1 ? '  ·  Partie ' + c.j + '/' + c.k : '') : (c.k > 1 ? 'Partie ' + c.j + '/' + c.k : ''));
    if (line) { const g = ctx.createLinearGradient(0, 0, 0, H * .24); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * .24); }
    if (line) {
      let fs = 34 * sc; const maxW = W - 104 * sc; ctx.font = '800 ' + fs + 'px ' + FONT;
      while (ctx.measureText(line).width > maxW && fs > 16 * sc) { fs -= 1; ctx.font = '800 ' + fs + 'px ' + FONT; }
      ctx.lineWidth = 7 * sc; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff'; ctx.strokeText(line, W / 2, H * .125, maxW); ctx.fillText(line, W / 2, H * .125, maxW);
    }
    // Accroche des 3 premières secondes
    const hk = (ui.hook3 || '').trim();
    if (hk && t < 3 && !o.sample) {
      const a = t < 2.5 ? 1 : Math.max(0, (3 - t) / .5), ls = this.wrap(hk, 16);
      ctx.globalAlpha = a; ctx.font = '800 ' + 58 * sc + 'px ' + FONT; ctx.lineWidth = 12 * sc; ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
      ls.forEach((l, i) => { const yy = H * .33 + (i - (ls.length - 1) / 2) * 74 * sc; ctx.strokeText(l, W / 2, yy, W - 60 * sc); ctx.fillText(l, W / 2, yy, W - 60 * sc); });
      ctx.globalAlpha = 1;
    }
    // Sous-titres
    if (ui.subsOn && o.subs && o.subs.length) this.subtitles(o.subs, t, ui, sc);
    // Bandeau d'abonnement, décalé à gauche pour éviter les boutons de TikTok
    // Petite animation « abonne-toi » : deux fois par clip, le bandeau passe au rouge avec un léger rebond,
    // une icône + et deux ondes comme un appui du doigt, puis revient à la normale (jamais pendant l'accroche ni la fin).
    const cta = (ui.cta || '').trim(), sp = ui.subAnim !== false && !o.sample && o.dur < 900 ? subPhase(t, o.dur) : null;
    if (cta || sp) {
      const a = sp ? sp.a : 0, lt = sp ? sp.lt : 0, label = cta || 'Abonne-toi', h = 54 * sc, x0 = W * .05, y0 = H * .735;
      ctx.font = '700 ' + 27 * sc + 'px ' + FONT;
      const ic = 44 * sc * a, w = Math.min(W * .78, ctx.measureText(label).width + 48 * sc + ic);
      const s = 1 + a * (.05 + .03 * Math.sin(lt * Math.PI * 2.4)) + (lt < .35 ? .08 * Math.sin(lt / .35 * Math.PI) : 0);
      ctx.save(); ctx.translate(x0 + w / 2, y0 + h / 2); ctx.scale(s, s); ctx.translate(-(x0 + w / 2), -(y0 + h / 2));
      if (!cta) ctx.globalAlpha = a;
      this.pill(x0, y0, w, h, 'rgba(' + Math.round(254 * a) + ',' + Math.round(44 * a) + ',' + Math.round(85 * a) + ',' + (.62 + .3 * a).toFixed(3) + ')');
      if (a > .02) {
        const cx = x0 + 30 * sc, cy = y0 + h / 2, r = 15 * sc * a;
        [.5, 1.35].forEach(t0 => { const k = (lt - t0) / .8; if (k > 0 && k < 1) { ctx.save(); ctx.globalAlpha *= (1 - k) * .85; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3 * sc; ctx.beginPath(); ctx.arc(cx, cy, r + 26 * sc * k, 0, 7); ctx.stroke(); ctx.restore(); } });
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
        ctx.fillStyle = '#fe2c55'; ctx.fillRect(cx - 8 * sc * a, cy - 2 * sc * a, 16 * sc * a, 4 * sc * a); ctx.fillRect(cx - 2 * sc * a, cy - 8 * sc * a, 4 * sc * a, 16 * sc * a);
      }
      ctx.fillStyle = '#fff'; ctx.fillText(label, x0 + ic + (w - ic) / 2, y0 + h / 2, w - ic - 28 * sc);
      ctx.restore();
    }
    // Fin : écran « la suite » pour les parties, sinon texte de fin
    const next = ui.nextCard && !c.nonext && c.k > 1 && c.j < c.k;
    if (!o.sample && next && left <= 2.5 && left >= 0) {
      const a = Math.min(1, (2.5 - left) * 2);
      ctx.fillStyle = 'rgba(0,0,0,' + a * .7 + ')'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = a; ctx.fillStyle = '#fff';
      ctx.font = '800 ' + 72 * sc + 'px ' + FONT; ctx.fillText('La suite ➜', W / 2, H * .42);
      ctx.font = '700 ' + 40 * sc + 'px ' + FONT; ctx.fillText('Partie ' + (c.j + 1) + ' sur mon profil', W / 2, H * .42 + 86 * sc);
      ctx.globalAlpha = 1;
    } else {
      const outro = (ui.outro || '').trim();
      const end = ui.loopOn ? 1 : 0;
      if (!o.sample && outro && left <= 3 && left > end) {
        const a = Math.min(1, (3 - left) * 1.5) * (ui.loopOn ? Math.min(1, (left - end) / .6) : 1), ls = this.wrap(outro, 20);
        ctx.fillStyle = 'rgba(0,0,0,' + a * .65 + ')'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.font = '800 ' + 50 * sc + 'px ' + FONT;
        ls.forEach((l, i) => ctx.fillText(l, W / 2, H * .45 + (i - (ls.length - 1) / 2) * 66 * sc));
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  subtitles(words, t, ui, sc) {
    const { ctx, W, H } = this;
    if (!this._grp || this._grpSrc !== words) {
      const g = []; let cur = null;
      words.forEach(w => { if (!cur || cur.w.length >= 3 || (cur.txt + ' ' + w.w).length > 18 || w.s - cur.e > .7) { cur = { w: [], txt: '', s: w.s, e: w.e }; g.push(cur); } cur.w.push(w); cur.txt = (cur.txt + ' ' + w.w).trim(); cur.e = w.e; });
      g.forEach((x, i) => { x.until = Math.min(x.e + .35, g[i + 1] ? g[i + 1].s : x.e + .35); });
      this._grp = g; this._grpSrc = words;
    }
    const grp = this._grp.find(x => t >= x.s - .05 && t < x.until); if (!grp) return;
    const size = { s: 40, m: 50, l: 62 }[ui.subsSize] || 50, st = ui.subsStyle, up = st !== 'classic';
    ctx.font = '900 ' + size * sc + 'px ' + FONT; ctx.lineWidth = 10 * sc; ctx.strokeStyle = '#000';
    const parts = grp.w.map(w => up ? w.w.toUpperCase() : w.w), sp = ctx.measureText(' ').width, widths = parts.map(p => ctx.measureText(p).width);
    const total = widths.reduce((a, b) => a + b, 0) + sp * (parts.length - 1), y = H * .63;
    let x = W / 2 - total / 2;
    if (st === 'box') this.pill(x - 22 * sc, y - size * sc * .72, total + 44 * sc, size * sc * 1.44, 'rgba(0,0,0,.7)');
    ctx.textAlign = 'left';
    parts.forEach((p, i) => {
      const w = grp.w[i], active = t >= w.s && t < (grp.w[i + 1] ? grp.w[i + 1].s : grp.until);
      ctx.save();
      if (st === 'pop' && active) { ctx.translate(x + widths[i] / 2, y); ctx.scale(1.08, 1.08); ctx.translate(-(x + widths[i] / 2), -y); }
      if (st !== 'box') ctx.strokeText(p, x, y);
      ctx.fillStyle = st === 'pop' && active ? '#ffe14d' : '#fff'; ctx.fillText(p, x, y);
      ctx.restore();
      x += widths[i] + sp;
    });
    ctx.textAlign = 'center';
  }
}
