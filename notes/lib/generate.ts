"use client";
import { apiRetry, sb, Course, Segment } from "./supabase";

const CHUNK_CHARS = 10000;

type Piece = { text: string; pos: number };
type Visuel = { segId: string; texte: string };
type Chunk = { text: string; from: number; to: number; slides: string[]; visuels: Visuel[] };
type Note = { cours: string; hors: string; q?: boolean };

function decouper(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(". ", max);
    if (cut < max * 0.6) cut = rest.lastIndexOf(" ", max);
    if (cut < 0) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

export function construireMorceaux(segments: Segment[]): Chunk[] {
  const parole = segments.filter((s) => ["audio", "live", "texte"].includes(s.kind)).sort((a, b) => a.position - b.position);
  const pieces: Piece[] = [];
  for (const s of parole) {
    const morceaux = decouper(s.content, CHUNK_CHARS).filter((t) => t.trim());
    // Un long segment (≈ 10 min) : on répartit les morceaux sur sa durée pour bien placer les visuels
    morceaux.forEach((t, k) => pieces.push({ text: t, pos: s.position + (k * 600) / morceaux.length }));
  }

  const chunks: Chunk[] = [];
  let cur: Chunk | null = null;
  for (const p of pieces) {
    if (!cur || cur.text.length + p.text.length > CHUNK_CHARS) {
      cur = { text: "", from: p.pos, to: p.pos, slides: [], visuels: [] };
      chunks.push(cur);
    }
    cur.text += (cur.text ? "\n" : "") + p.text;
    cur.to = p.pos;
  }
  if (!chunks.length) return chunks;

  const ajouter = (c: Chunk, s: Segment) => {
    if (s.content.trim()) c.slides.push(s.content);
    if (estVisuel(s)) c.visuels.push({ segId: s.id, texte: s.content });
  };
  // Photos et captures : rattachées au moment où elles ont été prises
  for (const ph of segments.filter((s) => s.kind === "photo").sort((a, b) => a.position - b.position)) {
    let best = 0;
    for (let i = 0; i < chunks.length; i++) if (ph.position >= chunks[i].from - 60) best = i;
    ajouter(chunks[best], ph);
  }
  // Slides PDF : réparties dans l'ordre sur la durée du cours
  const pages = segments.filter((s) => s.kind === "pdf").sort((a, b) => a.position - b.position);
  pages.forEach((pg, i) => ajouter(chunks[Math.min(chunks.length - 1, Math.floor((i * chunks.length) / pages.length))], pg));
  return chunks;
}

/** Une page n'est un visuel utile que si c'est une slide ou une photo, pas une page d'article pleine de texte. */
const PAGE_TEXTE = 1500;
function estVisuel(s: Segment) {
  return !!s.image_path && (s.kind === "photo" || s.content.replace(/\s+/g, " ").trim().length < PAGE_TEXTE);
}

function nomDocument(label: string) {
  return label.replace(/,\s*(page|diapo|partie)\s+\d+(\/\d+)?$/i, "").trim();
}

/** Cours fait uniquement de documents (PDF, Word, PowerPoint, photos) : on suit les documents dans l'ordre. */
export function morceauxDocuments(segments: Segment[]): Chunk[] {
  const pages = segments.filter((s) => s.kind === "photo" || s.kind === "pdf").sort((a, b) => a.position - b.position);
  const chunks: Chunk[] = [];
  let cur: Chunk | null = null;
  let docPrec = "";
  for (const pg of pages) {
    const doc = nomDocument(pg.label || "");
    const entete = doc !== docPrec ? `\n\n=== Document : ${doc} ===\n` : "";
    docPrec = doc;
    const morceaux = decouper(pg.content || "", CHUNK_CHARS).filter((t) => t.trim());
    morceaux.forEach((t, k) => {
      const ajout = (k === 0 ? entete : "") + t;
      if (!cur || (cur.text.length + ajout.length > CHUNK_CHARS && cur.text.length > 0)) {
        cur = { text: "", from: pg.position, to: pg.position, slides: [], visuels: [] };
        chunks.push(cur);
      }
      cur.text += (cur.text ? "\n" : "") + ajout;
      cur.to = pg.position;
    });
    if (cur && estVisuel(pg) && morceaux.length) (cur as Chunk).visuels.push({ segId: pg.id, texte: pg.content });
  }
  return chunks.filter((c) => c.text.trim());
}

/** Garde chaque visuel une seule fois dans tout le cours. */
export function dedoublonnerVisuels(md: string) {
  const vus = new Set<string>();
  let out = md.replace(/!\[[^\]]*\]\(visuel:([^)]+)\)\n*/g, (m, id) => (vus.has(id) ? "" : (vus.add(id), m)));
  out = out.replace(/\*\*Visuels de ce passage\*\*\s*(?=\n#|\n\*\*Visuels|$)/g, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function signature(chunks: Chunk[]) {
  return `${chunks.length}:${chunks.reduce((n, c) => n + c.text.length + c.slides.join("").length, 0)}`;
}

function titres(notes: Note[]) {
  return notes.flatMap((n) => n.cours.split("\n").filter((l) => /^##\s/.test(l)).map((l) => l.replace(/^##\s+/, "").trim())).slice(-25);
}

/** Remplace les repères [[VISUEL:Vn]] par des images ; ajoute les visuels utiles non placés. */
export function placerVisuels(md: string, visuels: Visuel[]) {
  const places = new Set<string>();
  let out = md.replace(/\[\[\s*VISUEL\s*:\s*V(\d+)\s*\]\]/gi, (_m, n) => {
    const v = visuels[Number(n) - 1];
    if (!v || places.has(v.segId)) return "";
    places.add(v.segId);
    return `\n\n![Visuel du cours](visuel:${v.segId})\n\n`;
  });
  const restants = visuels.filter((v) => !places.has(v.segId) && v.texte.replace(/\s+/g, " ").trim().length > 40).slice(0, 6);
  if (restants.length) {
    out += `\n\n**Visuels de ce passage**\n\n${restants.map((v) => `![Visuel du cours](visuel:${v.segId})`).join("\n\n")}`;
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function contenuUtile(md: string) {
  return md
    .replace(/\[passage peu clair\]/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/^#+.*$/gm, "")
    .replace(/[*_>|#-]/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

type Section = { titre: string; body: string };

export function sections(cours: string[]): Section[] {
  const out: Section[] = [];
  for (const md of cours) {
    const parts = md.split(/^##\s+/m);
    const pre = parts.shift() || "";
    if (pre.trim()) {
      if (out.length) out[out.length - 1].body += "\n\n" + pre.trim();
      else out.push({ titre: "Introduction", body: pre.trim() });
    }
    for (const p of parts) {
      const nl = p.indexOf("\n");
      out.push({ titre: (nl < 0 ? p : p.slice(0, nl)).trim(), body: (nl < 0 ? "" : p.slice(nl + 1)).trim() });
    }
  }
  return out;
}

function descendre(body: string) {
  return body.replace(/^(#{3,5})\s/gm, (_m, h) => `${h}# `);
}

/** Regroupe les sections en chapitres numérotés ; renvoie aussi les sections hors cours. */
export function assembler(secs: Section[], plan: { chapitres: { titre: string; sections: number[] }[] | null; hors_cours: number[] }) {
  if (!plan.chapitres?.length) {
    return { md: secs.map((s) => `## ${s.titre}\n\n${s.body}`).join("\n\n"), hors: "" };
  }
  const hors = new Set(plan.hors_cours.map(Number).filter((i) => i >= 0 && i < secs.length));
  const vu = new Set<number>();
  const chap = plan.chapitres
    .map((c) => ({ titre: String(c.titre || "").replace(/^\d+[.)]\s*/, "").trim(), sections: (c.sections || []).map(Number).filter((i) => i >= 0 && i < secs.length && !hors.has(i)) }))
    .filter((c) => c.titre && c.sections.length);
  for (const c of chap) c.sections = c.sections.filter((i) => (vu.has(i) ? false : (vu.add(i), true)));
  // Sections oubliées : dans le chapitre de la section précédente
  for (let i = 0; i < secs.length; i++) {
    if (vu.has(i) || hors.has(i)) continue;
    let cible = chap[0];
    for (const c of chap) if (c.sections.some((x) => x < i)) cible = c;
    if (cible) { cible.sections.push(i); vu.add(i); }
  }
  chap.forEach((c) => c.sections.sort((a, b) => a - b));
  chap.sort((a, b) => Math.min(...a.sections) - Math.min(...b.sections));
  const md = chap.map((c, k) => {
    const corps = c.sections.map((i) => {
      const s = secs[i];
      const memeTitre = s.titre.toLowerCase() === c.titre.toLowerCase();
      return `${memeTitre ? "" : `### ${s.titre}\n\n`}${descendre(s.body)}`;
    }).join("\n\n");
    return `## ${k + 1}. ${c.titre}\n\n${corps}`;
  }).join("\n\n");
  const horsMd = Array.from(hors).sort((a, b) => a - b).map((i) => `${secs[i].titre}\n${secs[i].body.replace(/!\[[^\]]*\]\([^)]*\)/g, "")}`).join("\n\n");
  return { md, hors: horsMd };
}

const DOCS = " SOURCE : des documents écrits (articles, polycopiés, diaporamas, consignes), PAS un enregistrement oral. Le texte fourni comme « transcription » est le texte de ces documents, séparés par des lignes « === Document : nom === ». Rédige une synthèse de cours fidèle et détaillée de ces documents : garde leurs définitions, distinctions, auteurs et références (nom, année), exemples et chiffres ; ne parle ni de séance, ni de professeur, ni d'oral. Les consignes de lecture ou de travail et les informations d'organisation vont dans le hors-cours.";

export type Progress = { step: string; done: number; total: number; wait?: string };

export async function generer(course: Course, segments: Segment[], onProgress: (p: Progress) => void, depuisZero = false, contexteUe = "") {
  const parle = segments.some((s) => ["audio", "live", "texte"].includes(s.kind) && s.content.trim());
  const chunks = parle ? construireMorceaux(segments) : morceauxDocuments(segments);
  if (!chunks.length) throw new Error("Ajoute d'abord un enregistrement, un document ou du texte.");
  const sig = (parle ? "v3:" : "d1:") + signature(chunks);
  const meta = `Cours : ${course.titre || "sans titre"}. UE : ${course.ue}. ${course.intervenant ? `Intervenant : ${course.intervenant}. ` : ""}Date : ${course.date_cours}.${parle ? "" : DOCS}${contexteUe}`;
  const saved: any = course.chunk_notes;
  let notes: Note[] = [];
  if (!depuisZero && saved && !Array.isArray(saved) && saved.sig === sig) notes = [...(saved.notes || [])];
  if (depuisZero || !notes.length) await sb().from("notes_questions").delete().eq("course_id", course.id);

  const total = chunks.length * 2 + 4;
  const sauver = () => sb().from("notes_courses").update({ chunk_notes: { sig, notes }, updated_at: new Date().toISOString() }).eq("id", course.id);
  const attente = (step: string, done: number) => (s: number, m: string) => onProgress({ step, done, total, wait: `${m} : reprise dans ${s} s` });

  // 1. Rédaction, partie par partie
  for (let i = 0; i < chunks.length; i++) {
    if (notes[i]) continue;
    const step = `Rédaction de la partie ${i + 1} sur ${chunks.length}`;
    onProgress({ step, done: i, total });
    const visuels = chunks[i].visuels.map((v, k) => ({ ref: `V${k + 1}`, texte: v.texte }));
    const j = await apiRetry(
      "/api/notes",
      () => ({ index: i, total: chunks.length, texte: chunks[i].text, slides: chunks[i].slides.join("\n\n"), titres: titres(notes.slice(0, i)), meta, visuels }),
      false,
      attente(step, i)
    );
    notes[i] = { cours: placerVisuels(j.cours || "", chunks[i].visuels), hors: j.hors || "" };
    await sauver();
  }

  // 2. Vérification : y a-t-il vraiment un cours ?
  const utile = notes.reduce((n, x) => n + contenuUtile(x.cours), 0);
  if (utile < 400) {
    throw new Error(
      "Aucun contenu de cours détecté : l'enregistrement ne semble pas contenir de cours (son trop faible, autre chose que le prof, ou trop court). Vérifie le texte dans « Contenu récupéré » avant de relancer."
    );
  }

  // 3. Questions de révision, partie par partie (couvrent tout le cours)
  for (let i = 0; i < notes.length; i++) {
    if (notes[i].q || contenuUtile(notes[i].cours) < 200) continue;
    const step = `Questions sur la partie ${i + 1} sur ${notes.length}`;
    onProgress({ step, done: chunks.length + i, total });
    const texte = notes[i].cours.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
    const nb = contenuUtile(texte) > 2500 ? 8 : 5;
    const j = await apiRetry("/api/finalize", () => ({ kind: "questions", notes: texte, meta, n: nb, existantes: [] }), false, attente(step, chunks.length + i));
    const rows = (j.questions || []).map((q: any) => ({ course_id: course.id, ue: course.ue, partie: i, question: q.question, choix: q.choix, bonne: q.bonne, explication: q.explication }));
    if (rows.length) await sb().from("notes_questions").insert(rows);
    notes[i].q = true;
    await sauver();
  }

  // 4. Mise en ordre en chapitres
  const k0 = chunks.length * 2;
  onProgress({ step: "Mise en ordre en chapitres", done: k0, total });
  const secs = sections(notes.map((n) => n.cours).filter(Boolean));
  const liste = secs.map((s, i) => `${i}. ${s.titre} | ${s.body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, " ").slice(0, 140)}`).join("\n");
  let plan: any = { chapitres: null, hors_cours: [] };
  try {
    plan = await apiRetry("/api/finalize", () => ({ kind: "plan", notes: liste, meta }), false, attente("Mise en ordre en chapitres", k0));
  } catch {}
  const { md: assemble, hors: horsPlan } = assembler(secs, plan);
  const corps = dedoublonnerVisuels(assemble);

  const resumeSrc = corps.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const resume = resumeSrc.slice(0, 13000);
  const hors = [notes.map((n) => n.hors).filter(Boolean).join("\n"), horsPlan].filter(Boolean).join("\n\n");

  const etape = async (kind: string, label: string, k: number, input: string) => {
    onProgress({ step: label, done: k0 + k, total });
    return apiRetry("/api/finalize", () => ({ kind, notes: input, meta }), false, attente(label, k0 + k));
  };
  const bref = await etape("bref", "Écriture de « La séance en bref »", 1, resume);
  const fiche = await etape("fiche", "Création de la fiche express", 2, resume);
  const infos = hors.trim() ? await etape("infos", "Mise en ordre des infos pratiques", 3, hors) : { md: "" };

  const ouverture = parle ? bref.md : String(bref.md || "").replace(/^##\s*La séance en bref/m, "## L'essentiel des documents").replace(/\*\*Déroulé du cours\*\*/, "**Plan**");
  const rendu_md = `${ouverture}\n\n${corps}`;
  const { error } = await sb().from("notes_courses").update({
    rendu_md, infos_md: infos.md || null, fiche_md: fiche.md, statut: "genere", chunk_notes: { sig, notes }, updated_at: new Date().toISOString(),
  }).eq("id", course.id);
  if (error) throw error;
  onProgress({ step: "Terminé", done: total, total });
}

/** Ajoute de nouvelles questions (différentes des existantes) sur quelques parties du cours. */
export async function plusDeQuestions(course: Course, onProgress: (p: Progress) => void, parties = 3) {
  const saved: any = course.chunk_notes;
  const notes: Note[] = saved && !Array.isArray(saved) ? saved.notes || [] : [];
  const idx = notes.map((n, i) => ({ n, i })).filter(({ n }) => n && typeof n.cours === "string" && contenuUtile(n.cours) >= 200).map(({ i }) => i);
  if (!idx.length) throw new Error("Génère d'abord le cours.");
  const { data: exist } = await sb().from("notes_questions").select("partie, question").eq("course_id", course.id);
  const compte = (i: number) => (exist || []).filter((q: any) => q.partie === i).length;
  const choisis = idx.sort((a, b) => compte(a) - compte(b) || Math.random() - 0.5).slice(0, parties);
  const meta = `Cours : ${course.titre}. UE : ${course.ue}.`;
  for (let k = 0; k < choisis.length; k++) {
    const i = choisis[k];
    const step = `Nouvelles questions (${k + 1}/${choisis.length})`;
    onProgress({ step, done: k, total: choisis.length });
    const existantes = (exist || []).filter((q: any) => q.partie === i).map((q: any) => q.question);
    const j = await apiRetry(
      "/api/finalize",
      () => ({ kind: "questions", notes: notes[i].cours.replace(/!\[[^\]]*\]\([^)]*\)/g, ""), meta, n: 6, existantes }),
      false,
      (s, m) => onProgress({ step, done: k, total: choisis.length, wait: `${m} : reprise dans ${s} s` })
    );
    const rows = (j.questions || []).map((q: any) => ({ course_id: course.id, ue: course.ue, partie: i, question: q.question, choix: q.choix, bonne: q.bonne, explication: q.explication }));
    if (rows.length) await sb().from("notes_questions").insert(rows);
  }
  onProgress({ step: "Terminé", done: choisis.length, total: choisis.length });
}
