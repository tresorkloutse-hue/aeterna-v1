// Score de viralité : une liste de contrôle mesurable, basée sur les bonnes pratiques de rétention.
// Ce n'est pas une prédiction : un clip à 90 n'est pas garanti de percer, il évite simplement les erreurs connues.
import { pct } from './state.js';
import { captionChecks } from './captions.js';

function intensity(data) {
  if (data._I) return data._I;
  const has = data.has, n = Math.min(data.A.length, data.M.length), pa = pct(data.A, .95) || 1e-6, pm = pct(data.M, .95) || 1e-6, I = new Float32Array(n);
  for (let i = 0; i < n; i++) I[i] = has ? .55 * Math.min(1.5, data.A[i] / pa) + .45 * Math.min(1.5, data.M[i] / pm) : Math.min(1.5, data.M[i] / pm);
  data._I = I; return I;
}
const mean = (I, a, b) => { a = Math.max(0, Math.floor(a)); b = Math.min(I.length, Math.ceil(b)); let s = 0; for (let i = a; i < b; i++) s += I[i]; return b > a ? s / (b - a) : 0; };

export function scoreClip(clip, data, ui, subs, caption, filmH) {
  const items = [], add = (label, pts, max, tip) => items.push({ label, pts: Math.round(pts), max, ok: pts >= max * .75, tip });
  const d = clip.e - clip.s;
  if (data) {
    const I = intensity(data), seg = Array.from(I.slice(Math.floor(clip.s), Math.ceil(clip.e))), med = pct(seg, .5) || 1e-6;
    const r = mean(I, clip.s, clip.s + 2) / med;
    add('Début fort (action ou réplique dès la 1re seconde)', 20 * Math.max(0, Math.min(1, (r - .5) / .7)), 20, 'Le début est calme. Choisis un clip qui démarre sur l’action, ou garde une accroche à l’écran.');
    const endR = mean(I, clip.e - 3, clip.e) / med;
    if (clip.k > 1 && clip.j < clip.k) add('Fin qui donne envie de voir la suite', 15, 15, '');
    else add('Fin sur un moment fort', endR >= 1 ? 15 : endR >= .7 ? 11 : 6, 15, 'La fin retombe. Termine sur un moment fort, ou découpe le moment en parties.');
    add('Intensité du moment', 15 * Math.min(1, (clip.score || 0) / 100), 15, 'Moment moins intense que les autres du film.');
    const speech = data.has && pct(Array.from(data.A.slice(Math.floor(clip.s), Math.ceil(clip.e))), .6) > pct(data.A, .4) * 1.2;
    if (!speech) add('Sous-titres (pas de dialogue détecté)', 10, 10, '');
    else add('Sous-titres', ui.subsOn ? (subs && subs.length ? 10 : 3) : 0, 10, ui.subsOn ? 'Génère les sous-titres : beaucoup regardent sans le son.' : 'Active les sous-titres : beaucoup regardent sans le son.');
  }
  add('Durée adaptée', d >= 60 && d <= 150 ? 15 : (d >= 45 && d <= 180) ? 10 : 5, 15, d > 150 ? 'Clip long : découpe en parties plus courtes.' : 'Clip court : vise au moins une minute.');
  add('Accroche à l’écran pendant 3 s', (ui.hook3 || '').trim() ? 10 : 0, 10, 'Ajoute une accroche affichée au début.');
  add('Boucle propre', ui.loopOn ? 5 : 0, 5, 'Active la boucle parfaite pour encourager le revisionnage.');
  if (filmH) add('Qualité de la source', filmH >= 1080 ? 5 : filmH >= 720 ? 3 : 0, 5, 'Source en basse définition : utilise une version 1080p du film si possible.');
  if (caption != null) {
    const c = captionChecks(caption);
    add('Légende engageante (question, appel, hashtags)', (c.question ? 3 : 0) + (c.cta ? 3 : 0) + (c.tagsOk ? 4 : 0), 10, !c.question ? 'Ajoute une question dans la légende.' : !c.cta ? 'Ajoute un appel à s’abonner.' : 'Utilise entre 5 et 12 hashtags.');
  }
  const got = items.reduce((a, x) => a + x.pts, 0), max = items.reduce((a, x) => a + x.max, 0);
  return { score: max ? Math.round(got / max * 100) : 0, items };
}

export const scoreClass = s => s >= 80 ? 'good' : s >= 60 ? 'mid' : 'low';

// Contrôle des 3 premières secondes à partir d'une image du début (luminosité) et des mesures du film.
export function firstSecondsCheck(clip, data, ui, brightness) {
  const out = [];
  if (data) {
    const I = intensity(data), seg = Array.from(I.slice(Math.floor(clip.s), Math.ceil(clip.e))), med = pct(seg, .5) || 1e-6, r = mean(I, clip.s, clip.s + 2) / med;
    out.push(r >= 1 ? { ok: true, t: 'Début dynamique : le clip démarre au niveau de son intensité moyenne ou au-dessus.' } : { ok: false, t: 'Début plus calme que le reste du clip : risque de défilement.' });
  }
  if (brightness != null) out.push(brightness >= 45 ? { ok: true, t: 'Image du début bien lisible.' } : { ok: false, t: 'Image du début très sombre : sur un téléphone, elle peut paraître vide.' });
  out.push((ui.hook3 || '').trim() ? { ok: true, t: 'Accroche affichée : « ' + ui.hook3.trim() + ' ».' } : { ok: false, t: 'Aucune accroche à l’écran pendant les 3 premières secondes.' });
  out.push(clip.kind === 'action' ? { ok: true, t: 'Le clip commence sur de l’action.' } : { ok: true, t: 'Le clip commence sur une réplique ou du son.' });
  return out;
}
