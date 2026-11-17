import { NextResponse } from "next/server";
import { context, smartChat, fail, HttpError, sansCadratin } from "@/lib/server";
import { promptNotes } from "@/lib/prompts";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const ctx = await context(req);
    const { index, total, texte, slides, titres, meta, visuels } = await req.json();
    if (typeof texte !== "string" || !texte.trim()) throw new HttpError(400, "Morceau vide.");
    const user =
      (slides ? `Contenu des diapositives ou photos correspondant à ce moment du cours :\n${String(slides).slice(0, 2000)}\n\n` : "") +
      (Array.isArray(visuels) && visuels.length
        ? `VISUELS disponibles pour ce moment du cours :\n${visuels.slice(0, 15).map((v: any) => `${v.ref} : ${String(v.texte || "").replace(/\s+/g, " ").slice(0, 160)}`).join("\n")}\n\n`
        : "") +
      `Transcription (morceau ${Number(index) + 1}/${total}) :\n${texte}`;
    const md = await smartChat(ctx, promptNotes(Number(index), Number(total), Array.isArray(titres) ? titres : [], String(meta || "")), user, {
      maxTokens: 3000,
    });
    const parts = md.split(/%{2,}\s*HORS[\s-]*COURS\s*%*/i);
    const cours = parts[0].replace(/\n\s*%{2,}\s*$/g, "").trim();
    const hors = parts.slice(1).join("\n").replace(/^\s*%+\s*$/gm, "").trim();
    return NextResponse.json({ cours: sansCadratin(cours.trim()), hors: sansCadratin(/^(aucun|rien|néant|\(vide\))\.?$/i.test(hors) ? "" : hors) });
  } catch (e) {
    return fail(e);
  }
}
