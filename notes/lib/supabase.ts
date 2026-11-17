"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      { auth: { persistSession: true, autoRefreshToken: true, storageKey: "notes-cours-auth" } }
    );
  }
  return client;
}

export type Course = {
  id: string;
  ue: string;
  titre: string;
  intervenant: string;
  date_cours: string;
  statut: string;
  chunk_notes: { sig: string; notes: { cours: string; hors: string }[] } | [];
  rendu_md: string | null;
  infos_md: string | null;
  quiz: QuizQuestion[] | null;
  fiche_md: string | null;
  created_at: string;
};

export type Segment = {
  id: string;
  course_id: string;
  kind: "audio" | "live" | "photo" | "pdf" | "texte";
  position: number;
  label: string;
  content: string;
  image_path: string | null;
};

export type BankQuestion = {
  id: string;
  course_id: string;
  ue: string;
  partie: number;
  question: string;
  choix: string[];
  bonne: number;
  explication: string;
  vus: number;
  rates: number;
  serie: number;
  due_at: string;
};

export const BUCKET = "notes-visuels";

/** Envoie une image dans le stockage privé et renvoie son chemin. */
export async function uploadVisuel(blob: Blob, courseId: string): Promise<string | null> {
  const { data } = await sb().auth.getUser();
  if (!data.user) return null;
  const path = `${data.user.id}/${courseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb().storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
  return error ? null : path;
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const uniq = Array.from(new Set(paths.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 100) {
    const { data } = await sb().storage.from(BUCKET).createSignedUrls(uniq.slice(i, i + 100), 60 * 60 * 6);
    for (const d of data || []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  }
  return out;
}

/** Enregistre une réponse : révision espacée simple. */
export async function noterReponse(q: BankQuestion, juste: boolean) {
  const serie = juste ? q.serie + 1 : 0;
  const jours = [1, 3, 7, 16, 35, 80][Math.min(serie, 5)];
  const due = juste ? new Date(Date.now() + (serie ? jours : 1) * 86400000) : new Date(Date.now() + 10 * 60000);
  await sb().from("notes_questions").update({
    vus: q.vus + 1, rates: q.rates + (juste ? 0 : 1), serie, due_at: due.toISOString(), dernier_vu: new Date().toISOString(),
  }).eq("id", q.id);
}

/** Tire une série variée : questions dues, jamais vues et ratées d'abord, réparties sur tout le cours. */
export function tirerSerie(bank: BankQuestion[], n = 15): BankQuestion[] {
  const now = Date.now();
  const score = (q: BankQuestion) =>
    (new Date(q.due_at).getTime() <= now ? 0 : 2) + (q.vus === 0 ? 0 : 1) - (q.rates > 0 ? 0.5 : 0) + Math.random() * 1.2;
  const parPartie = new Map<number, BankQuestion[]>();
  for (const q of [...bank].sort((a, b) => score(a) - score(b))) {
    if (!parPartie.has(q.partie)) parPartie.set(q.partie, []);
    parPartie.get(q.partie)!.push(q);
  }
  const groupes = Array.from(parPartie.values());
  const out: BankQuestion[] = [];
  while (out.length < Math.min(n, bank.length)) {
    for (const g of groupes) if (g.length && out.length < n) out.push(g.shift()!);
  }
  return out.sort(() => Math.random() - 0.5);
}

export function melanger(q: BankQuestion): { choix: string[]; bonne: number } {
  const idx = q.choix.map((_, i) => i).sort(() => Math.random() - 0.5);
  return { choix: idx.map((i) => q.choix[i]), bonne: idx.indexOf(q.bonne) };
}

export type QuizQuestion = {
  question: string;
  choix: string[];
  bonne: number;
  explication: string;
};

/** Appelle une route API du site avec le jeton de session. */
export async function api(path: string, body: unknown, isForm = false): Promise<Response> {
  const { data } = await sb().auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token ?? ""}`,
      ...(isForm ? {} : { "Content-Type": "application/json" }),
    },
    body: isForm ? (body as FormData) : JSON.stringify(body),
  });
}

/**
 * Appel avec reprise automatique quand l'offre gratuite impose une pause (429).
 * onWait reçoit le nombre de secondes d'attente pour l'afficher.
 */
export async function apiRetry(
  path: string,
  makeBody: () => unknown,
  isForm: boolean,
  onWait: (s: number, msg: string) => void,
  maxTries = 8
): Promise<any> {
  for (let i = 0; i < maxTries; i++) {
    const r = await api(path, makeBody(), isForm);
    if (r.ok) return r.json();
    const j = await r.json().catch(() => ({ error: r.statusText }));
    if (r.status === 429) {
      const wait = Math.min(Math.max(Number(j.retryAfter) || 30, 5), 3600);
      if (wait > 900) {
        throw new Error(
          `Limite journalière de l'offre gratuite atteinte (reprise possible dans ${Math.round(wait / 60)} min). ` +
            "Ton travail est sauvegardé : relance plus tard, ou choisis un autre modèle dans Réglages."
        );
      }
      for (let s = wait; s > 0; s--) {
        onWait(s, "Pause imposée par l'offre gratuite");
        await new Promise((res) => setTimeout(res, 1000));
      }
      continue;
    }
    throw new Error(j.error || `Erreur ${r.status}`);
  }
  throw new Error("Trop de tentatives, réessaie dans quelques minutes.");
}
