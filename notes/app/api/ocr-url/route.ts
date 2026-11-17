import { NextResponse } from "next/server";
import { context, vision, fail, HttpError, sansCadratin } from "@/lib/server";
import { PROMPT_OCR } from "@/lib/prompts";

export const maxDuration = 60;

/** Lit une image déjà déposée dans le stockage : seul son lien transite par le serveur. */
export async function POST(req: Request) {
  try {
    const { key } = await context(req);
    const { url } = await req.json();
    if (typeof url !== "string" || !url.startsWith("https://")) throw new HttpError(400, "Lien de l'image manquant.");
    const text = await vision(key, PROMPT_OCR, url);
    return NextResponse.json({ text: sansCadratin(text) });
  } catch (e) {
    return fail(e);
  }
}
