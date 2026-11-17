import { NextResponse } from "next/server";
import { context, smartChat, fail, HttpError, sansCadratin } from "@/lib/server";
import { PROMPT_BREF, PROMPT_FICHE, PROMPT_INFOS, PROMPT_PLAN, PROMPT_QUESTIONS, PROMPT_QUIZ } from "@/lib/prompts";

export const maxDuration = 120;

function extraireJson(s: string) {
  let t = s.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  t = t.slice(a, b + 1);
  const essais = [
    t,
    t.replace(/,\s*([}\]])/g, "$1"),
    t.replace(/,\s*([}\]])/g, "$1").replace(/[\u201c\u201d]/g, '"').replace(/\n/g, " "),
  ];
  for (const e of essais) {
    try { return JSON.parse(e); } catch {}
  }
  return null;
}

async function genererQuiz(ctx: Awaited<ReturnType<typeof context>>, input: string, prompt: string = PROMPT_QUIZ, min = 3) {
  let derniere = "";
  for (let essai = 0; essai < 3; essai++) {
    let raw = "";
    try {
      raw = await smartChat(ctx, prompt, input, { maxTokens: 4000, temperature: essai ? 0.2 : 0.4 });
    } catch (e: any) {
      if (e instanceof HttpError && e.status === 429) throw e;
      derniere = e?.message || String(e);
      continue;
    }
    const j = extraireJson(raw);
    const questions = (Array.isArray(j?.questions) ? j.questions : [])
      .filter((q: any) => q && typeof q.question === "string" && Array.isArray(q.choix) && q.choix.length >= 2)
      .map((q: any) => ({
        question: sansCadratin(q.question),
        choix: q.choix.slice(0, 4).map((c: any) => sansCadratin(String(c))),
        bonne: Math.min(Math.max(Number(q.bonne) || 0, 0), Math.min(q.choix.length, 4) - 1),
        explication: sansCadratin(String(q.explication || "")),
      }));
    if (questions.length >= min) return questions;
    derniere = "réponse illisible";
  }
  throw new HttpError(502, `Le quiz n'a pas pu être créé (${derniere}). Relance la génération : le reste est sauvegardé.`);
}

export async function POST(req: Request) {
  try {
    const ctx = await context(req);
    const { kind, notes, meta, n, existantes } = await req.json();
    const input = `${meta ? meta + "\n\n" : ""}Notes du cours :\n${String(notes || "").slice(0, 14000)}`;
    if (kind === "bref") {
      const md = await smartChat(ctx, PROMPT_BREF, input, { maxTokens: 800 });
      return NextResponse.json({ md: sansCadratin(md.trim()) });
    }
    if (kind === "infos") {
      const md = await smartChat(ctx, PROMPT_INFOS, `Informations relevées :\n${String(notes || "").slice(0, 16000)}`, { maxTokens: 2500 });
      return NextResponse.json({ md: sansCadratin(md.trim()) });
    }
    if (kind === "fiche") {
      const md = await smartChat(ctx, PROMPT_FICHE, input, { maxTokens: 700 });
      return NextResponse.json({ md: sansCadratin(md.trim()) });
    }
    if (kind === "questions") {
      const nb = Math.min(Math.max(Number(n) || 8, 3), 12);
      const qs = await genererQuiz(ctx, `${meta ? meta + "\n\n" : ""}Partie du cours :\n${String(notes || "").slice(0, 12000)}`, PROMPT_QUESTIONS(nb, Array.isArray(existantes) ? existantes : []), 2);
      return NextResponse.json({ questions: qs });
    }
    if (kind === "plan") {
      for (let essai = 0; essai < 2; essai++) {
        const raw = await smartChat(ctx, PROMPT_PLAN, String(notes || "").slice(0, 14000), { maxTokens: 1500, temperature: 0.2 });
        const j = extraireJson(raw);
        if (j && Array.isArray(j.chapitres) && j.chapitres.length) return NextResponse.json({ chapitres: j.chapitres, hors_cours: Array.isArray(j.hors_cours) ? j.hors_cours : [] });
      }
      return NextResponse.json({ chapitres: null, hors_cours: [] });
    }
    if (kind === "quiz") {
      return NextResponse.json({ questions: await genererQuiz(ctx, input) });
    }
    throw new HttpError(400, "Type inconnu.");
  } catch (e) {
    return fail(e);
  }
}
