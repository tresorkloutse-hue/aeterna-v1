import { NextResponse } from "next/server";
import { GROQ, fail, HttpError } from "@/lib/server";

/** Vérifie une clé Groq et liste les modèles de texte disponibles. */
export async function POST(req: Request) {
  try {
    const { key } = await req.json();
    if (typeof key !== "string" || key.length < 10) throw new HttpError(400, "Clé manquante.");
    const r = await fetch(`${GROQ}/models`, { headers: { Authorization: `Bearer ${key}` } }).catch(() => {
      throw new HttpError(502, "Groq est injoignable pour le moment, réessaie.");
    });
    if (r.status === 401) throw new HttpError(400, "Clé Groq refusée.");
    if (!r.ok) throw new HttpError(502, "Groq ne répond pas, réessaie.");
    const j = await r.json();
    const models = (j.data || [])
      .map((m: any) => m.id as string)
      .filter((id: string) => !/whisper|tts|orpheus|guard|playai|compound|safeguard/i.test(id))
      .sort();
    return NextResponse.json({ ok: true, models });
  } catch (e) {
    return fail(e);
  }
}
