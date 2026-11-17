"use client";
import { apiRetry, sb, uploadVisuel, BUCKET } from "./supabase";

/**
 * Les fichiers lourds (audio, images) ne passent plus par le serveur du site :
 * ils sont déposés dans le stockage, et seul un lien temporaire est envoyé à l'IA.
 */
const TEMP = "notes-audio";

async function uid() {
  const { data } = await sb().auth.getUser();
  if (!data.user) throw new Error("Session expirée, reconnecte-toi.");
  return data.user.id;
}

async function lien(bucket: string, path: string) {
  const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error || !data) throw new Error("Lien du fichier impossible à créer.");
  return data.signedUrl;
}

type Attente = (s: number, msg: string) => void;

/** Transcrit un audio : dépôt temporaire, transcription par lien, suppression. */
export async function transcrireBlob(blob: Blob, nom: string, onWait: Attente): Promise<string> {
  const ext = (nom.split(".").pop() || "webm").toLowerCase().replace(/[^a-z0-9]/g, "") || "webm";
  const path = `${await uid()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const up = await sb().storage.from(TEMP).upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
  if (up.error) throw new Error(`Envoi impossible : ${up.error.message}`);
  try {
    const url = await lien(TEMP, path);
    const j = await apiRetry("/api/transcribe-url", () => ({ url }), false, onWait);
    return String(j.text || "");
  } finally {
    await sb().storage.from(TEMP).remove([path]);
  }
}

/**
 * Lit le texte d'une image. Si courseId est donné, l'image est gardée comme visuel du cours
 * (son chemin est renvoyé) ; sinon elle est supprimée après lecture.
 */
export async function lireImage(blob: Blob, onWait: Attente, courseId?: string): Promise<{ text: string; path: string | null }> {
  let bucket = TEMP;
  let path: string | null = null;
  if (courseId) {
    path = await uploadVisuel(blob, courseId);
    bucket = BUCKET;
  }
  if (!path) {
    bucket = TEMP;
    path = `${await uid()}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const up = await sb().storage.from(TEMP).upload(path, blob, { contentType: blob.type || "image/jpeg" });
    if (up.error) throw new Error(`Envoi impossible : ${up.error.message}`);
  }
  try {
    const url = await lien(bucket, path);
    const j = await apiRetry("/api/ocr-url", () => ({ url }), false, onWait);
    return { text: String(j.text || ""), path: bucket === BUCKET ? path : null };
  } catch (e) {
    if (bucket === BUCKET) await sb().storage.from(BUCKET).remove([path]);
    throw e;
  } finally {
    if (bucket === TEMP) await sb().storage.from(TEMP).remove([path]);
  }
}

/** Supprime un visuel devenu inutile (image sans texte). */
export async function supprimerVisuel(path: string | null) {
  if (path) await sb().storage.from(BUCKET).remove([path]);
}
