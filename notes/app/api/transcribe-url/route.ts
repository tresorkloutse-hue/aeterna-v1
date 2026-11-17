import { NextResponse } from "next/server";
import { context, fail, HttpError, sansCadratin, GROQ } from "@/lib/server";

// Un cours entier peut prendre plus d'une minute à transcrire.
export const maxDuration = 300;

/** Transcrit un fichier déjà déposé dans le stockage : Groq le télécharge lui-même (pas de limite de taille d'envoi). */
export async function POST(req: Request) {
  try {
    const { key } = await context(req);
    const { url } = await req.json();
    if (typeof url !== "string" || !url.startsWith("https://")) throw new HttpError(400, "Adresse du fichier manquante.");
    const fd = new FormData();
    fd.append("url", url);
    fd.append("model", "whisper-large-v3");
    fd.append("language", "fr");
    fd.append("response_format", "text");
    fd.append("temperature", "0");
    let res: Response;
    try {
      res = await fetch(`${GROQ}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: fd });
    } catch {
      throw new HttpError(502, "Groq est injoignable pour le moment, réessaie dans un instant.");
    }
    const body = await res.text();
    if (!res.ok) {
      if (res.status === 429) {
        const m = body.match(/try again in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
        const wait = m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Math.ceil(Number(m[3] || 0)) + 1 : 60;
        throw new HttpError(429, "Limite de l'offre gratuite", wait);
      }
      if (res.status === 401) throw new HttpError(400, "Clé Groq refusée : vérifie-la dans Réglages.");
      let msg = body;
      try { msg = JSON.parse(body).error?.message || body; } catch {}
      throw new HttpError(502, `Groq : ${msg.slice(0, 300)}`);
    }
    return NextResponse.json({ text: sansCadratin(body.trim()) });
  } catch (e) {
    return fail(e);
  }
}
