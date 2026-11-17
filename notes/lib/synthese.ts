"use client";
import { apiRetry, sb, Course } from "./supabase";
import type { Progress } from "./generate";

/** Découpe le cours rédigé en chapitres ("## "), sans la section d'ouverture ni les images. */
export function chapitres(rendu: string): string[] {
  const propre = rendu.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\*\*Visuels de ce passage\*\*/g, "");
  return propre
    .split(/^(?=##\s)/m)
    .map((c) => c.trim())
    .filter((c) => /^##\s/.test(c) && !/^##\s*(La séance en bref|L'essentiel des documents)/i.test(c))
    .filter((c) => c.replace(/^##.*$/m, "").replace(/\s+/g, " ").trim().length > 150);
}

/** Regroupe des chapitres en blocs d'au plus max caractères (un chapitre trop long reste seul). */
export function blocs(chaps: string[], max = 12000): string[] {
  const out: string[] = [];
  let cur = "";
  for (const c of chaps) {
    if (cur && cur.length + c.length > max) { out.push(cur); cur = ""; }
    cur += (cur ? "\n\n" : "") + c;
  }
  if (cur) out.push(cur);
  return out;
}

/** Titre et paragraphe « À retenir » d'une partie rédigée. */
export function resumePartie(md: string) {
  const titre = (md.match(/^##\s+(.+)$/m) || [])[1] || "";
  const sous = Array.from(md.matchAll(/^###\s+(.+)$/gm)).map((m) => m[1]).join(" ; ");
  const retenir = (md.match(/\*\*À retenir[^*]*\*\*[\s\S]*$/) || [""])[0].replace(/\s+/g, " ").slice(0, 900);
  return `${titre}\nSous-parties : ${sous}\n${retenir}`;
}

/** Condensé pour la fin du document : titres, lignes avec auteurs/dates ou notions en gras, et « À retenir ». */
export function condense(parties: string[], max = 16000) {
  const parPartie = Math.floor(max / Math.max(1, parties.length));
  return parties
    .map((p) => {
      const lignes = p.split("\n").filter((l) => /^#{2,3}\s/.test(l) || /\b(1[5-9]\d\d|20\d\d)\b|XV|XIX|XX/.test(l) || /\*\*/.test(l));
      return lignes.join("\n").slice(0, parPartie);
    })
    .join("\n\n");
}

export type Source = { titre: string; texte: string };

/**
 * Écrit un cours de révision à partir d'une ou plusieurs sources (une séance, ou toutes les séances d'une UE) :
 * les parties dans l'ordre, puis le début (mode d'emploi, vue d'ensemble) et la fin (synthèse, pièges, auteurs, questions, planning).
 */
export async function genererRevision(
  sources: Source[],
  opts: { meta: string; infos: string; notesPerso?: string; sauver: (md: string) => Promise<void> },
  onProgress: (p: Progress) => void
) {
  const morceaux: { seance: string; texte: string }[] = [];
  for (const s of sources) for (const b of blocs(chapitres(s.texte))) morceaux.push({ seance: s.titre, texte: b });
  if (opts.notesPerso?.trim()) morceaux.push({ seance: "Notes personnelles", texte: `## Notes personnelles\n\n${opts.notesPerso.trim()}` });
  if (!morceaux.length) throw new Error("Pas encore de cours rédigé : génère d'abord au moins une séance.");
  const plusieurs = sources.length > 1;
  const total = morceaux.length + 2;
  const appel = (step: string, done: number, body: Record<string, unknown>) => {
    onProgress({ step, done, total });
    return apiRetry("/api/synthese", () => ({ ...body, meta: opts.meta }), false, (s, m) => onProgress({ step, done, total, wait: `${m} : reprise dans ${s} s` }));
  };

  const parties: string[] = [];
  for (let i = 0; i < morceaux.length; i++) {
    const contexte = parties.map((p) => (p.match(/^##\s+(.+)$/m) || [])[1] || "").filter(Boolean);
    const j = await appel(`Partie ${i + 1} sur ${morceaux.length}`, i, {
      kind: "partie",
      chapitre: plusieurs ? `(Source : ${morceaux[i].seance})\n\n${morceaux[i].texte}` : morceaux[i].texte,
      n: i + 1,
      contexte,
    });
    parties.push(String(j.md || "").trim());
    await opts.sauver(parties.join("\n\n"));
  }

  const intro = await appel("Mode d'emploi et vue d'ensemble", morceaux.length, {
    kind: "intro",
    plan: (plusieurs ? `Séances, dans l'ordre : ${sources.map((s) => s.titre).join(" ; ")}\n\n` : "") + parties.map(resumePartie).join("\n\n"),
    infos: opts.infos,
  });
  await opts.sauver(`${String(intro.md || "").trim()}\n\n${parties.join("\n\n")}`);

  const fin = await appel("Tableau de synthèse, pièges, auteurs et questions", morceaux.length + 1, { kind: "fin", notes: condense(parties) });
  const md = [String(intro.md || "").trim(), ...parties, String(fin.md || "").trim()].filter(Boolean).join("\n\n");
  await opts.sauver(md);
  onProgress({ step: "Terminé", done: total, total });
  return md;
}

/** Cours de révision d'une séance. */
export async function genererSynthese(course: Course, onProgress: (p: Progress) => void) {
  if (!course.rendu_md) throw new Error("Génère d'abord le cours dans « Prise de notes ».");
  return genererRevision(
    [{ titre: course.titre || "Séance", texte: course.rendu_md }],
    {
      meta: `Cours : ${course.titre || "sans titre"}. UE : ${course.ue}.`,
      infos: course.infos_md || "",
      sauver: async (md) => {
        const { error } = await sb().from("notes_courses").update({ synthese_md: md }).eq("id", course.id);
        if (error) throw error;
      },
    },
    onProgress
  );
}

/** Cours de révision complet d'une UE : toutes les séances générées, dans l'ordre des dates, plus les notes personnelles. */
export async function genererSyntheseUe(ue: string, onProgress: (p: Progress) => void) {
  const { data, error } = await sb().from("notes_courses").select("id, titre, date_cours, rendu_md, infos_md").eq("ue", ue).order("date_cours").order("created_at");
  if (error) throw error;
  const seances = (data || []).filter((c: any) => c.rendu_md);
  if (!seances.length) throw new Error("Aucune séance générée dans cette UE pour l'instant.");
  const { data: dossier } = await sb().from("notes_ues").select("notes_md").eq("ue", ue).maybeSingle();
  const date = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return genererRevision(
    seances.map((c: any, i: number) => ({ titre: `Séance ${i + 1} (${date(c.date_cours)}) : ${c.titre || "sans titre"}`, texte: c.rendu_md })),
    {
      meta: `UE : ${ue}. Cours de révision de toute l'UE, construit à partir de ${seances.length} séance(s) dans l'ordre : fais apparaître la continuité entre les séances.`,
      infos: seances.map((c: any) => c.infos_md).filter(Boolean).join("\n\n"),
      notesPerso: dossier?.notes_md || "",
      sauver: async (md) => {
        const { error } = await sb().from("notes_ues").upsert({ ue, synthese_md: md, updated_at: new Date().toISOString() }, { onConflict: "user_id,ue" });
        if (error) throw error;
      },
    },
    onProgress
  );
}
