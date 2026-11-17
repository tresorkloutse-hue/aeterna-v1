import { NextResponse } from "next/server";
import { context, smartChat, fail, HttpError, sansCadratin } from "@/lib/server";

export const maxDuration = 60;

const PROMPT = `Tu es un tuteur qui aide un étudiant à comprendre son cours. Tu reçois des extraits de son cours, puis sa question (et parfois les échanges précédents).

Comment répondre :
- Commence par la réponse directe, en 1 ou 2 phrases simples.
- Puis explique pas à pas, avec des mots simples, et au moins un exemple concret (vie quotidienne, école, terrain professionnel).
- Appuie-toi d'abord sur le cours : reprends ses définitions, ses auteurs et ses exemples, et indique de quelle partie ça vient quand c'est utile.
- Si la question dépasse le cours, tu peux compléter avec tes connaissances générales, mais signale-le clairement par « **En dehors du cours :** ». N'invente jamais ce que le cours dirait.
- Si l'étudiant confond deux notions, montre la différence (un petit tableau si ça aide).
- Termine, si c'est utile, par une courte question pour vérifier qu'il a compris.
- Réponds en français, en Markdown, de façon concise (pas plus d'une page). N'utilise jamais de tiret cadratin (—).`;

export async function POST(req: Request) {
  try {
    const ctx = await context(req);
    const { question, extraits, historique, meta } = await req.json();
    if (typeof question !== "string" || !question.trim()) throw new HttpError(400, "Question vide.");
    const hist = Array.isArray(historique)
      ? historique.slice(-6).map((h: any) => `${h.role === "user" ? "Étudiant" : "Tuteur"} : ${String(h.text || "").slice(0, 1500)}`).join("\n\n")
      : "";
    const user =
      `Extraits du cours :\n\n${String(extraits || "").slice(0, 14000)}\n\n` +
      (hist ? `Échanges précédents :\n${hist}\n\n` : "") +
      `Question de l'étudiant : ${question.trim().slice(0, 2000)}`;
    const md = await smartChat(ctx, `${PROMPT}\n\n${String(meta || "")}`, user, { maxTokens: 1800, temperature: 0.4 });
    return NextResponse.json({ md: sansCadratin(md.trim()) });
  } catch (e) {
    return fail(e);
  }
}
