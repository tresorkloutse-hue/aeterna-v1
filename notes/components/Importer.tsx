"use client";
import { useRef, useState } from "react";
import { apiRetry, sb, uploadVisuel } from "@/lib/supabase";
import { dataUrlToBlob, imageToDataUrl, pdfPages, splitMedia } from "@/lib/media";
import { diapositivesPptx, enParties, texteDocx } from "@/lib/docs";
import { lireImage, transcrireBlob } from "@/lib/transfert";

export default function Importer({ courseId, onAdded }: { courseId: string; onAdded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [texte, setTexte] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr("");
    try { await fn(); } catch (e: any) { setErr(e.message || String(e)); } finally { setBusy(false); setStatus(""); }
  }

  const wait = (what: string) => (s: number) => setStatus(`${what} : pause imposée par l'offre gratuite, reprise dans ${s} s`);

  /** Voie rapide : le fichier entier va dans le stockage, Groq le transcrit d'un coup (marche aussi sur téléphone). */
  async function viaStockage(file: File): Promise<string> {
    const { data: u } = await sb().auth.getUser();
    if (!u.user) throw new Error("Session expirée, reconnecte-toi.");
    const ext = (file.name.split(".").pop() || "m4a").toLowerCase().replace(/[^a-z0-9]/g, "") || "m4a";
    const path = `${u.user.id}/${courseId}-${Date.now()}.${ext}`;
    setStatus(`Envoi de « ${file.name} » (${Math.round(file.size / 1e6)} Mo)…`);
    const up = await sb().storage.from("notes-audio").upload(path, file, { contentType: file.type || "audio/mp4", upsert: false });
    if (up.error) throw new Error(`Envoi impossible : ${up.error.message}`);
    try {
      const { data: signe, error } = await sb().storage.from("notes-audio").createSignedUrl(path, 60 * 60);
      if (error || !signe) throw new Error("Lien du fichier impossible à créer.");
      setStatus(`Transcription de « ${file.name} » : compte environ 1 minute par heure de cours…`);
      const j = await apiRetry("/api/transcribe-url", () => ({ url: signe.signedUrl }), false, wait("Transcription"));
      return j.text || "";
    } finally {
      await sb().storage.from("notes-audio").remove([path]);
    }
  }

  async function media(file: File) {
    const base = Date.now() / 1000;
    if (file.size <= 48 * 1024 * 1024) {
      try {
        const text = await viaStockage(file);
        const { error } = await sb().from("notes_segments").insert({ course_id: courseId, kind: "audio", position: base, label: file.name, content: text });
        if (error) throw error;
        onAdded();
        return;
      } catch (e: any) {
        if (/Limite journalière|Clé Groq|Session/i.test(e?.message || "")) throw e;
        setStatus("Voie rapide indisponible, découpe du fichier dans le navigateur…");
      }
    }
    let parts: File[];
    try {
      parts = file.size < 3.8 * 1024 * 1024 && file.type.startsWith("audio/") ? [file] : await splitMedia(file, setStatus);
    } catch (e: any) {
      throw new Error(`Fichier trop lourd pour ce navigateur (${Math.round(file.size / 1e6)} Mo). Importe-le depuis un ordinateur avec Chrome. (${e?.message || e})`);
    }
    for (let i = 0; i < parts.length; i++) {
      setStatus(`Transcription de la partie ${i + 1} sur ${parts.length}…`);
      const texte = await transcrireBlob(parts[i], parts[i].name || file.name, wait(`Partie ${i + 1}/${parts.length}`));
      const { error } = await sb().from("notes_segments").insert({
        course_id: courseId, kind: "audio", position: base + i,
        label: parts.length > 1 ? `${file.name}, partie ${i + 1}/${parts.length}` : file.name, content: texte,
      });
      if (error) throw error;
      onAdded();
    }
  }

  async function images(files: File[]) {
    for (let i = 0; i < files.length; i++) {
      setStatus(`Lecture de l'image ${i + 1} sur ${files.length}…`);
      const image = await imageToDataUrl(files[i]);
      const { text, path: image_path } = await lireImage(dataUrlToBlob(image), wait(`Image ${i + 1}`), courseId);
      await sb().from("notes_segments").insert({ course_id: courseId, kind: "photo", position: (files[i].lastModified || Date.now()) / 1000, label: files[i].name, content: text, image_path });
      onAdded();
    }
  }

  async function pdf(file: File) {
    setStatus("Lecture du PDF…");
    const pages = await pdfPages(file);
    const base = Date.now() / 1000;
    let sansTexte = 0;
    for (let i = 0; i < pages.length; i++) {
      setStatus(`Slides : page ${i + 1} sur ${pages.length}…`);
      let text = pages[i].text;
      let image_path: string | null = null;
      if (!text.trim() && pages[i].image) {
        sansTexte++;
        const lu = await lireImage(pages[i].image!, wait(`Page ${i + 1}`), courseId);
        text = lu.text;
        image_path = lu.path;
      } else if (pages[i].image) {
        image_path = await uploadVisuel(pages[i].image!, courseId);
      }
      await sb().from("notes_segments").insert({ course_id: courseId, kind: "pdf", position: base + i / 1000, label: `${file.name}, page ${i + 1}`, content: text, image_path });
    }
    onAdded();
    if (sansTexte) setStatus(`${sansTexte} page(s) scannée(s) lue(s) depuis l'image.`);
  }

  /** Word, PowerPoint, texte : chaque partie devient une « page » de document. */
  async function lireDocument(file: File) {
    const nom = file.name.toLowerCase();
    setStatus(`Lecture de « ${file.name} »…`);
    let pages: { label: string; text: string }[];
    if (nom.endsWith(".pptx")) {
      pages = (await diapositivesPptx(file)).map((t, i) => ({ label: `${file.name}, diapo ${i + 1}`, text: t })).filter((p) => p.text.trim());
    } else {
      const texte = nom.endsWith(".docx") ? await texteDocx(file) : (await file.text()).trim();
      pages = enParties(texte).map((t, i, all) => ({ label: all.length > 1 ? `${file.name}, partie ${i + 1}` : file.name, text: t }));
    }
    if (!pages.length) throw new Error(`Aucun texte trouvé dans « ${file.name} ».`);
    const base = Date.now() / 1000;
    const rows = pages.map((pg, i) => ({ course_id: courseId, kind: "pdf", position: base + i / 1000, label: pg.label, content: pg.text }));
    const { error } = await sb().from("notes_segments").insert(rows);
    if (error) throw error;
    onAdded();
  }

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
    run(async () => {
      const erreurs: string[] = [];
      const imgs = files.filter((f) => f.type.startsWith("image/"));
      if (imgs.length) {
        try { await images(imgs); } catch (e: any) { erreurs.push(`Images : ${e.message || e}`); }
      }
      for (const f of files) {
        if (f.type.startsWith("image/")) continue;
        const n = f.name.toLowerCase();
        try {
          if (files.length > 1) setStatus(`Fichier ${files.indexOf(f) + 1} sur ${files.length} : ${f.name}`);
          if (f.type === "application/pdf" || n.endsWith(".pdf")) await pdf(f);
          else if (/\.(docx|pptx|txt|md)$/.test(n)) await lireDocument(f);
          else if (/\.(doc|ppt)$/.test(n)) throw new Error("ancien format Office : enregistre-le en .docx, .pptx ou PDF, puis réessaie.");
          else if (f.type.startsWith("audio/") || f.type.startsWith("video/") || /\.(mp3|m4a|wav|ogg|webm|mp4|mov|mkv|aac|flac)$/i.test(n)) await media(f);
          else throw new Error("format non pris en charge (PDF, Word, PowerPoint, images, audio ou vidéo).");
        } catch (e: any) {
          if (/Limite journalière|Clé Groq|Session/i.test(e?.message || "")) throw e;
          erreurs.push(`« ${f.name} » : ${e.message || e}`);
        }
      }
      if (erreurs.length) throw new Error(`Les autres fichiers sont bien ajoutés, sauf : ${erreurs.join(" / ")}`);
    });
  }

  async function addTexte() {
    if (!texte.trim()) return;
    run(async () => {
      await sb().from("notes_segments").insert({ course_id: courseId, kind: "texte", position: Date.now() / 1000, label: "Texte ajouté", content: texte.trim() });
      setTexte("");
      onAdded();
    });
  }

  return (
    <div className="card">
      <b>Importer après le cours</b>
      <p className="small muted">Enregistrement audio ou vidéo du cours (même une visio enregistrée), captures d'écran, photos du tableau, documents PDF, Word (.docx) et PowerPoint (.pptx). Tu peux en mettre plusieurs d'un coup, même sans enregistrement. Fonctionne aussi depuis le téléphone (mémos vocaux, audios WhatsApp) jusqu'à 48 Mo par fichier.</p>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => input.current?.click()}>Choisir des fichiers</button>
      <input ref={input} type="file" multiple style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <details style={{ marginTop: 12 }}>
        <summary className="small">Coller du texte (notes perso, transcription, sous-titres)</summary>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Colle ici…" />
        <button className="btn ghost" style={{ marginTop: 8 }} disabled={busy || !texte.trim()} onClick={addTexte}>Ajouter ce texte</button>
      </details>
      {status && <div className="note small">{status}</div>}
      {err && <div className="note bad small">{err}</div>}
    </div>
  );
}
