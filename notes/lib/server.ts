import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const GROQ = "https://api.groq.com/openai/v1";

export class HttpError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) {
    super(message);
  }
}

/** Vérifie la session et récupère la clé Groq de l'utilisateur. */
export async function context(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Connecte-toi d'abord.");
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: u, error } = await supa.auth.getUser(token);
  if (error || !u.user) throw new HttpError(401, "Session expirée, reconnecte-toi.");
  const { data: s } = await supa.from("notes_settings").select("groq_key, model, mistral_key, cerebras_key, openrouter_key").eq("user_id", u.user.id).maybeSingle();
  if (!s?.groq_key) throw new HttpError(400, "Ajoute ta clé Groq gratuite dans Réglages.");
  return {
    supa,
    user: u.user,
    key: s.groq_key as string,
    model: (s.model as string) || "auto",
    secours: { mistral: (s.mistral_key as string) || "", cerebras: (s.cerebras_key as string) || "", openrouter: (s.openrouter_key as string) || "" },
  };
}

function parseRetry(res: Response, body: string): number {
  const h = res.headers.get("retry-after");
  if (h && !isNaN(Number(h))) return Number(h);
  const m = body.match(/try again in\s+(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
  if (m) return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Math.ceil(Number(m[3] || 0)) + 1;
  return 30;
}

async function groqFetch(key: string, path: string, init: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${GROQ}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, ...(init.headers || {}) },
    });
  } catch {
    throw new HttpError(502, "Groq est injoignable pour le moment, réessaie dans un instant.");
  }
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new HttpError(429, "Limite de l'offre gratuite", parseRetry(res, body));
    if (res.status === 401) throw new HttpError(400, "Clé Groq refusée : vérifie-la dans Réglages.");
    if (res.status === 413) throw new HttpError(502, "Demande trop longue pour ce modèle gratuit.");
    let msg = body;
    try { msg = JSON.parse(body).error?.message || body; } catch {}
    throw new HttpError(502, `Groq : ${msg.slice(0, 300)}`);
  }
  return res;
}

export async function chat(key: string, model: string, system: string, user: string, opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}) {
  const res = await groqFetch(key, "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 3000,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  const j = await res.json();
  return (j.choices?.[0]?.message?.content as string) || "";
}

export async function vision(key: string, prompt: string, dataUrl: string) {
  const res = await groqFetch(key, "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      temperature: 0.1,
      max_tokens: 1500,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: dataUrl } }] }],
    }),
  });
  const j = await res.json();
  return (j.choices?.[0]?.message?.content as string) || "";
}

export async function transcribe(key: string, file: File) {
  const fd = new FormData();
  fd.append("file", file, file.name || "audio.webm");
  fd.append("model", "whisper-large-v3");
  fd.append("language", "fr");
  fd.append("response_format", "text");
  fd.append("temperature", "0");
  const res = await groqFetch(key, "/audio/transcriptions", { method: "POST", body: fd });
  return (await res.text()).trim();
}

/** Modèles de rédaction, du meilleur au moins bon. Les petits modèles sont exclus. */
export const PREFERES = [
  "llama-3.3-70b-versatile",
  "moonshotai/kimi-k2-instruct-0905",
  "moonshotai/kimi-k2-instruct",
  "openai/gpt-oss-120b",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "qwen/qwen3-32b",
  "openai/gpt-oss-20b",
];

export async function modelesDisponibles(key: string): Promise<string[]> {
  const res = await groqFetch(key, "/models", { method: "GET" });
  const j = await res.json();
  return (j.data || []).map((m: any) => m.id as string);
}

export function meilleurModele(dispo: string[]): string | null {
  for (const m of PREFERES) if (dispo.includes(m)) return m;
  const autres = dispo.filter((id) => /70b|120b|maverick|scout|kimi|qwen3|gpt-oss/i.test(id));
  return autres[0] || null;
}

function retirerReflexion(s: string) {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/**
 * Rédige avec le modèle choisi ; s'il est indisponible, trop petit ou refusé,
 * bascule tout seul sur le meilleur modèle disponible et le mémorise.
 */
async function smartChatGroq(ctx: Awaited<ReturnType<typeof context>>, system: string, user: string, opts: { maxTokens?: number; temperature?: number } = {}) {
  const essayes = new Set<string>();
  let model = ctx.model;
  if (!model || model === "auto" || !PREFERES.includes(model)) {
    model = meilleurModele(await modelesDisponibles(ctx.key)) || "llama-3.3-70b-versatile";
  }
  let derniere: unknown = null;
  for (let tour = 0; tour < 4; tour++) {
    essayes.add(model);
    try {
      const out = retirerReflexion(await chat(ctx.key, model, system, user, opts));
      if (ctx.model !== "auto" && model !== ctx.model) {
        await ctx.supa.from("notes_settings").update({ model, updated_at: new Date().toISOString() }).eq("user_id", ctx.user.id);
        ctx.model = model;
      }
      return out;
    } catch (e) {
      // Pause courte : on attend. Limite longue (quota du jour) : on essaie un autre modèle.
      if (e instanceof HttpError && e.status === 429 && (e.retryAfter || 0) <= 120) throw e;
      derniere = e;
      const dispo = await modelesDisponibles(ctx.key).catch(() => [] as string[]);
      const suivant = PREFERES.find((m) => dispo.includes(m) && !essayes.has(m));
      if (!suivant) break;
      model = suivant;
    }
  }
  if (derniere instanceof HttpError) throw derniere;
  throw new HttpError(502, "La rédaction a échoué, réessaie dans un instant.");
}

/** Fournisseurs de secours (API compatibles OpenAI), essayés quand Groq est saturé. */
export const SECOURS = {
  mistral: { nom: "Mistral", base: "https://api.mistral.ai/v1", modeles: ["mistral-medium-latest", "mistral-large-latest", "mistral-small-latest"] },
  cerebras: { nom: "Cerebras", base: "https://api.cerebras.ai/v1", modeles: ["gpt-oss-120b", "llama-3.3-70b", "qwen-3-235b-a22b-instruct-2507", "llama3.1-8b"] },
  // Modèles gratuits (« :free ») choisis au moment de l'appel, car la liste change souvent
  openrouter: { nom: "OpenRouter", base: "https://openrouter.ai/api/v1", modeles: [] as string[] },
} as const;

/** Modèles gratuits d'OpenRouter, les plus capables d'abord. */
async function modelesGratuitsOpenRouter(): Promise<string[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models").catch(() => null);
  if (!res?.ok) return [];
  const j = await res.json().catch(() => ({ data: [] }));
  const ids: { id: string; ctx: number }[] = (j.data || [])
    .filter((m: any) => String(m.id).endsWith(":free"))
    .map((m: any) => ({ id: String(m.id), ctx: Number(m.context_length) || 0 }))
    .filter((m: { ctx: number }) => m.ctx >= 32000);
  const rang = (id: string) => {
    const ordre = [/llama-3\.3-70b/i, /deepseek/i, /qwen3?-.*(235|72|32)/i, /gpt-oss-120b/i, /llama-4/i, /mistral|gemma/i];
    const k = ordre.findIndex((r) => r.test(id));
    return k < 0 ? ordre.length : k;
  };
  return ids.sort((a, b) => rang(a.id) - rang(b.id) || b.ctx - a.ctx).map((m) => m.id).slice(0, 4);
}

export type Fournisseur = keyof typeof SECOURS;

async function chatCompatible(f: Fournisseur, key: string, system: string, user: string, opts: { maxTokens?: number; temperature?: number }) {
  const p = SECOURS[f];
  let derniere: HttpError | null = null;
  const modeles = f === "openrouter" ? await modelesGratuitsOpenRouter() : [...p.modeles];
  for (const model of modeles) {
    let res: Response;
    try {
      res = await fetch(`${p.base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: opts.temperature ?? 0.3,
          max_tokens: opts.maxTokens ?? 3000,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
    } catch {
      throw new HttpError(502, `${p.nom} est injoignable.`);
    }
    if (res.ok) {
      const j = await res.json();
      const out = retirerReflexion((j.choices?.[0]?.message?.content as string) || "");
      if (out) return out;
      derniere = new HttpError(502, `${p.nom} : réponse vide.`);
      continue;
    }
    const body = await res.text();
    if (res.status === 401 || res.status === 403) throw new HttpError(400, `Clé ${p.nom} refusée : vérifie-la dans Réglages.`);
    if (res.status === 429 && f !== "openrouter") throw new HttpError(429, `Limite ${p.nom}`, parseRetry(res, body));
    derniere = new HttpError(res.status === 429 ? 429 : 502, `${p.nom} : ${body.slice(0, 200)}`);
  }
  throw derniere || new HttpError(502, `${p.nom} : aucun modèle disponible.`);
}

/** Vérifie une clé de secours en listant les modèles. */
export async function verifierCle(f: Fournisseur, key: string) {
  const res = await fetch(`${SECOURS[f].base}${f === "openrouter" ? "/key" : "/models"}`, { headers: { Authorization: `Bearer ${key}` } }).catch(() => null);
  if (!res) throw new HttpError(502, `${SECOURS[f].nom} est injoignable.`);
  if (res.status === 401 || res.status === 403) throw new HttpError(400, `Clé ${SECOURS[f].nom} refusée.`);
  if (!res.ok) throw new HttpError(502, `${SECOURS[f].nom} : erreur ${res.status}.`);
  return true;
}

/**
 * Rédaction avec bascule automatique : Groq (tous ses modèles), puis OpenRouter, Cerebras et Mistral
 * si l'utilisateur a ajouté ces clés gratuites. Si tout est saturé, renvoie l'erreur de Groq
 * (le navigateur attend alors et réessaie).
 */
export async function redigerAvecSecours(ctx: Awaited<ReturnType<typeof context>>, system: string, user: string, opts: { maxTokens?: number; temperature?: number } = {}) {
  try {
    return await smartChatGroq(ctx, system, user, opts);
  } catch (eGroq) {
    if (eGroq instanceof HttpError && eGroq.status === 400) throw eGroq;
    for (const f of ["openrouter", "cerebras", "mistral"] as Fournisseur[]) {
      const k = ctx.secours?.[f];
      if (!k) continue;
      try {
        return await chatCompatible(f, k, system, user, opts);
      } catch (e) {
        console.error(`secours ${f}`, e instanceof Error ? e.message : e);
      }
    }
    throw eGroq;
  }
}

export const smartChat = redigerAvecSecours;

export function fail(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message, retryAfter: e.retryAfter }, { status: e.status });
  }
  console.error(e);
  return NextResponse.json({ error: "Erreur inattendue du serveur." }, { status: 500 });
}

/** Enlève les tirets cadratins, à la demande de l'utilisateur. */
export function sansCadratin(s: string) {
  return s.replace(/\s*—\s*/g, ", ").replace(/,\s*,/g, ",");
}
