// Détection de tous les moments forts et découpage en parties qui commencent par une réplique ou par de l'action.
import { pct, clipKey } from './state.js';

const norm = a => { const p = pct(a, .95) || 1e-6; return Array.from(a, x => Math.min(1.5, x / p)); };

export function detect(data, ui, dur) {
  if (!data) return [];
  const actionOnly = ui.mtype === 'action', has = data.has && !actionOnly;
  const A = data.A, Mv = data.M, n = Math.min(A.length, Mv.length), end = Math.floor(dur);
  const MIN = +ui.minLen, PART = +ui.partLen, MAXM = +ui.maxMoment, LIM = +ui.limit, SENS = +ui.sens;
  const na = norm(A), nm = norm(Mv), sc = new Float32Array(n), P = new Float32Array(n + 1);
  const e0i = Math.floor(n * .03), e1i = Math.ceil(n * .97); // on ignore les génériques
  for (let i = 0; i < n; i++) sc[i] = (i < e0i || i > e1i) ? 0 : (has ? .55 * na[i] + .45 * nm[i] : nm[i]);
  for (let i = 0; i < n; i++) P[i + 1] = P[i] + sc[i];
  const sm = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 7), b = Math.min(n, i + 8); sm[i] = (P[b] - P[a]) / (b - a); }
  const gate = pct(sm, SENS);
  const regs = []; let cur = null;
  for (let i = 0; i < n; i++) if (sm[i] >= gate && sm[i] > 0) { if (cur && i - cur.b <= 20) cur.b = i + 1; else { cur = { a: i, b: i + 1 }; regs.push(cur); } }
  // Un moment trop court est prolongé vers l'avant : le début reste sur la montée d'intensité.
  regs.forEach(r => { if (r.b - r.a < MIN) { r.b = Math.min(end, r.a + MIN); r.a = Math.max(0, r.b - MIN); } r.b = Math.min(r.b, end); });
  regs.sort((x, y) => x.a - y.a);
  const mg = []; regs.forEach(r => { const l = mg[mg.length - 1]; if (l && r.a <= l.b + 5) l.b = Math.max(l.b, r.b); else mg.push({ a: r.a, b: r.b }); });
  mg.forEach(r => r.w = (P[Math.min(n, Math.ceil(r.b))] - P[Math.floor(r.a)]) / Math.max(1, r.b - r.a));
  let moms = mg;
  if (LIM < 999) moms = [...mg].sort((x, y) => y.w - x.w).slice(0, LIM).sort((x, y) => x.a - y.a);
  const big = []; moms.forEach(r => { const len = r.b - r.a, c = Math.ceil(len / MAXM); for (let q = 0; q < c; q++) big.push({ a: r.a + q * len / c, b: r.a + (q + 1) * len / c, w: r.w }); });
  const maxW = Math.max(1e-6, ...big.map(b => b.w));
  const aLo = has ? pct(A, .4) : 0, aHi = has ? Math.max(pct(A, .55), aLo * 1.5, 1e-4) : 0, mHi = pct(Mv, .72), mMid = pct(Mv, .5);
  const startAt = (t, back, fwd) => {
    let best = null, bd = 1e9;
    for (let i = Math.max(1, Math.round(t - back)); i <= Math.min(n - 3, Math.round(t + fwd)); i++) {
      const voice = has && A[i - 1] <= aLo * 1.2 && A[i] >= aHi && A[i] >= A[i - 1] * 1.8, action = Mv[i] >= mHi && Mv[i - 1] < mMid;
      if ((voice || action) && Math.abs(i - t) < bd) { bd = Math.abs(i - t); best = { t: Math.max(0, i - .3), kind: voice ? 'voix' : 'action' }; }
    }
    if (best) return best;
    for (let i = Math.max(1, Math.round(t)); i <= Math.min(n - 3, Math.round(t + fwd + 8)); i++) {
      const sound = has && A[i] >= aHi && A[i + 1] >= aHi * .8, action = Mv[i] >= mHi;
      if (sound || action) return { t: i, kind: action && !sound ? 'action' : 'voix' };
    }
    return null;
  };
  const snapEnd = (t, hi) => { if (!has) return Math.round(t); let b = Math.round(t), bv = Infinity; for (let i = Math.round(t); i <= Math.min(n - 2, Math.round(t + hi)); i++) if (A[i] < bv) { bv = A[i]; b = i; } return b; };
  const out = []; let mi = 0;
  big.forEach(r => {
    const s = startAt(r.a, 6, 10); if (!s) return;
    let e0 = Math.min(end, snapEnd(r.b, 6));
    // On ne garde pas une longue fin calme : le clip s'arrête peu après le dernier passage fort.
    let hot = -1; for (let i = Math.ceil(s.t); i < Math.min(n, e0); i++) if (sc[i] >= gate * .8) hot = i;
    if (hot > 0 && e0 - hot > 8) e0 = Math.min(e0, Math.max(Math.ceil(s.t + MIN), snapEnd(hot + 2, 3)));
    const len = e0 - s.t;
    if (len < MIN * .8) return;
    let k = Math.max(1, Math.min(Math.floor(len / MIN), Math.round(len / PART))), cuts = [s];
    for (; k >= 1; k--) {
      const cl = len / k, rg = Math.min(10, Math.max(3, cl - MIN)), cs = [s]; let ok = true;
      for (let j = 1; j < k; j++) { const c = startAt(s.t + j * cl, rg, rg); if (!c || c.t <= cs[cs.length - 1].t + MIN * .8) { ok = false; break; } cs.push(c); }
      if (ok) { cuts = cs; break; }
    }
    mi++; const w = Math.round(100 * r.w / maxW);
    cuts.forEach((c, j) => { const cl = { s: c.t, e: j + 1 < cuts.length ? cuts[j + 1].t : e0, m: mi, j: j + 1, k: cuts.length, on: true, score: w, kind: c.kind }; cl.key = clipKey(cl); out.push(cl); });
  });
  return { clips: out, smooth: sm };
}
