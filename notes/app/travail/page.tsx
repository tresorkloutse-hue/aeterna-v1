"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Shell from "@/components/Shell";
import Md, { Sommaire } from "@/components/Md";
import Question, { extraitsPertinents } from "@/components/Question";
import { apiRetry, sb } from "@/lib/supabase";
import { dataUrlToBlob, imageToDataUrl, pdfPages } from "@/lib/media";
import { lireImage } from "@/lib/transfert";
import { diapositivesPptx, texteDocx } from "@/lib/docs";

type Doc = { nom: string; texte: string };
type Travail = { id: string; ue: string; titre: string; consigne: string; echeance: string | null; docs: Doc[]; plan_md: string | null };

const MAX_DOC = 60000;

/** Morceaux des documents les plus proches de la consigne, avec le nom du document. */
function extraitsDocs(docs: Doc[], consigne: string, max = 9000) {
  if (!docs.length) return "";
  const parDoc = Math.floor(max / docs.length);
  return docs
    .map((d) => {
      const md = d.texte.split(/\n{2,}/).reduce<string[]>((acc, p) => {
        const last = acc[acc.length - 1];
        if (last !== undefined && last.length + p.length < 1500) acc[acc.length - 1] = `${last}\n\n${p}`;
        else acc.push(p);
        return acc;
      }, []).map((b) => `### ${d.nom}\n${b}`).join("\n\n");
      return `=== Document : ${d.nom} ===\n${extraitsPertinents(md, consigne || d.nom, parDoc).replace(/^### .*$/gm, "").trim()}`;
    })
    .join("\n\n");
}

function EspaceTravail() {
  const [id, setId] = useState<string | null>(null);
  const [t, setT] = useState<Travail | null | undefined>(undefined);
  const [sauve, setSauve] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [demande, setDemande] = useState("");
  const [edition, setEdition] = useState<string | null>(null);
  const [texteColle, setTexteColle] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<any>(null);

  useEffect(() => { setId(new URLSearchParams(location.search).get("id") || ""); }, []);
  useEffect(() => {
    if (!id) { if (id === "") setT(null); return; }
    sb().from("notes_travaux").select("*").eq("id", id).maybeSingle().then(({ data }) => setT((data as Travail) || null));
  }, [id]);

  async function enregistrer(patch: Partial<Travail>) {
    if (!t) return;
    const { error } = await sb().from("notes_travaux").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", t.id);
    setSauve(error ? `Erreur : ${error.message}` : "Enregistré");
  }

  function changer(patch: Partial<Travail>) {
    if (!t) return;
    setT({ ...t, ...patch });
    setSauve("…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => enregistrer(patch), 800);
  }

  async function lireFichier(f: File): Promise<string> {
    const n = f.name.toLowerCase();
    if (f.type === "application/pdf" || n.endsWith(".pdf")) {
      const pages = await pdfPages(f, 60);
      const out: string[] = [];
      let ocr = 0;
      for (let i = 0; i < pages.length; i++) {
        let txt = pages[i].text;
        if (!txt.trim() && pages[i].image && ocr < 15) {
          ocr++;
          setBusy(`Lecture de « ${f.name} » : page scannée ${i + 1}…`);
          txt = (await lireImage(pages[i].image!, () => {})).text;
        }
        if (txt.trim()) out.push(txt.trim());
      }
      return out.join("\n\n");
    }
    if (n.endsWith(".docx")) return texteDocx(f);
    if (n.endsWith(".pptx")) return (await diapositivesPptx(f)).map((d, i) => `Diapo ${i + 1} : ${d}`).join("\n\n");
    if (f.type.startsWith("image/")) {
      const image = await imageToDataUrl(f);
      return (await lireImage(dataUrlToBlob(image), () => {})).text;
    }
    if (/\.(txt|md)$/.test(n)) return f.text();
    if (/\.(doc|ppt)$/.test(n)) throw new Error("ancien format Office : enregistre-le en .docx, .pptx ou PDF.");
    throw new Error("format non pris en charge (PDF, Word, PowerPoint, image, texte).");
  }

  async function ajouterFichiers(list: FileList | null) {
    if (!t || !list?.length) return;
    setErr("");
    const nouveaux: Doc[] = [];
    const erreurs: string[] = [];
    for (const f of Array.from(list)) {
      setBusy(`Lecture de « ${f.name} »…`);
      try {
        const texte = (await lireFichier(f)).trim();
        if (!texte) throw new Error("aucun texte trouvé.");
        nouveaux.push({ nom: f.name, texte: texte.slice(0, MAX_DOC) });
      } catch (e: any) {
        erreurs.push(`« ${f.name} » : ${e.message || e}`);
      }
    }
    const docs = [...t.docs, ...nouveaux];
    setT({ ...t, docs });
    await enregistrer({ docs });
    setBusy("");
    if (erreurs.length) setErr(erreurs.join(" / "));
  }

  async function ajouterTexte() {
    if (!t || !texteColle.trim()) return;
    const docs = [...t.docs, { nom: `Texte collé ${t.docs.length + 1}`, texte: texteColle.trim().slice(0, MAX_DOC) }];
    setT({ ...t, docs });
    setTexteColle("");
    await enregistrer({ docs });
  }

  async function retirer(i: number) {
    if (!t || !confirm(`Retirer « ${t.docs[i].nom} » ?`)) return;
    const docs = t.docs.filter((_, k) => k !== i);
    setT({ ...t, docs });
    await enregistrer({ docs });
  }

  async function generer() {
    if (!t) return;
    setErr("");
    setBusy("Récupération des cours de l'UE…");
    try {
      const { data } = await sb().from("notes_courses").select("titre, rendu_md").eq("ue", t.ue).not("rendu_md", "is", null).order("date_cours");
      const coursMd = (data || []).map((c: any, i: number) => `## Séance ${i + 1} : ${c.titre || "sans titre"}\n\n${String(c.rendu_md).replace(/!\[[^\]]*\]\([^)]*\)/g, "")}`).join("\n\n");
      const requete = `${t.titre} ${t.consigne} ${demande}`;
      setBusy("Rédaction du plan et des pistes (environ 1 minute)…");
      const j = await apiRetry(
        "/api/travail",
        () => ({ titre: t.titre, ue: t.ue, consigne: t.consigne, echeance: t.echeance, docs: extraitsDocs(t.docs, requete), cours: extraitsPertinents(coursMd, requete, 6000), consigneSup: demande }),
        false,
        (s) => setBusy(`Pause imposée par l'offre gratuite : reprise dans ${s} s`)
      );
      setT({ ...t, plan_md: j.md });
      await enregistrer({ plan_md: j.md });
      setDemande("");
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy("");
    }
  }

  async function supprimer() {
    if (!t || !confirm("Supprimer définitivement ce travail ?")) return;
    await sb().from("notes_travaux").delete().eq("id", t.id);
    location.href = `/ue?nom=${encodeURIComponent(t.ue)}`;
  }

  function exporter() {
    if (!t) return;
    const avant = document.title;
    document.title = `${t.ue} - ${t.titre || "travail"} - plan`.replace(/[\\/:*?"<>|]/g, " ");
    window.print();
    setTimeout(() => { document.title = avant; }, 1000);
  }

  if (t === undefined) return <p className="muted">Chargement…</p>;
  if (!t) return <p>Travail introuvable. <Link href="/">Retour à mes cours</Link></p>;

  const contexteQuestion = [`## Consigne\n\n${t.consigne}`, t.plan_md || "", ...t.docs.map((d) => `## Document : ${d.nom}\n\n${d.texte}`)].join("\n\n");

  return (
    <>
      <div className="small muted noprint" style={{ marginTop: 14 }}><Link href="/">Mes cours</Link> › <Link href={`/ue?nom=${encodeURIComponent(t.ue)}`}>📁 {t.ue}</Link> › Travaux</div>
      <div className="noprint">
        <input value={t.titre} onChange={(e) => changer({ titre: e.target.value })} placeholder="Titre du travail (ex. Dossier : analyse d'une campagne de prévention)" style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }} />
        <div className="row" style={{ alignItems: "center", marginTop: 6 }}>
          <label style={{ margin: 0 }}>À rendre le</label>
          <input type="date" value={t.echeance || ""} onChange={(e) => changer({ echeance: e.target.value || null })} style={{ maxWidth: 180 }} />
          <span className="small muted grow" style={{ textAlign: "right" }}>{sauve}</span>
        </div>
      </div>

      <div className="card noprint">
        <b>1. La consigne</b>
        <p className="small muted" style={{ marginTop: 4 }}>Colle ou recopie le sujet, les attendus, la longueur, les critères de notation : plus c'est précis, meilleur est le plan.</p>
        <textarea value={t.consigne} onChange={(e) => changer({ consigne: e.target.value })} placeholder="Ex. : Réalisez un dossier de 8 pages analysant une action d'éducation à la santé…" style={{ minHeight: 140 }} />
      </div>

      <div className="card noprint">
        <b>2. Les documents ({t.docs.length})</b>
        <p className="small muted" style={{ marginTop: 4 }}>Sujet en PDF, articles, polycopiés, diaporamas, photos de documents, grille d'évaluation… (PDF, Word .docx, PowerPoint .pptx, images). Tes cours de l'UE sont utilisés automatiquement.</p>
        {t.docs.map((d, i) => (
          <div className="seg" key={i}>
            <div className="row">
              <span className="grow">📄 {d.nom} <span className="small muted">· {Math.round(d.texte.length / 1000)} k caractères</span></span>
              <button className="btn ghost small" style={{ padding: "2px 8px" }} onClick={() => retirer(i)}>Retirer</button>
            </div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <button type="button" className="btn ghost" disabled={!!busy} onClick={() => input.current?.click()}>Joindre des documents</button>
          <input ref={input} type="file" multiple style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden", pointerEvents: "none" }} onChange={(e) => { ajouterFichiers(e.target.files); e.target.value = ""; }} />
        </div>
        <details style={{ marginTop: 10 }}>
          <summary className="small">Coller du texte (extrait, mail du prof, notes…)</summary>
          <textarea value={texteColle} onChange={(e) => setTexteColle(e.target.value)} placeholder="Colle ici…" />
          <button className="btn ghost" style={{ marginTop: 8 }} disabled={!texteColle.trim()} onClick={ajouterTexte}>Ajouter ce texte</button>
        </details>
      </div>

      <div className="card noprint">
        <b>3. Plan et pistes</b>
        <p className="small muted" style={{ marginTop: 4 }}>
          Analyse de la consigne, problématiques possibles, plan détaillé avec les sources à utiliser, pistes tirées de tes documents et de tes cours, notions et auteurs à mobiliser, étapes et check-list.
        </p>
        {t.plan_md && (
          <input value={demande} onChange={(e) => setDemande(e.target.value)} placeholder="Optionnel : ce que tu veux changer (ex. un plan en 2 parties, plus d'exemples, angle plus critique…)" style={{ marginBottom: 8 }} />
        )}
        <div className="row">
          <button className="btn" onClick={generer} disabled={!!busy || (!t.consigne.trim() && !t.docs.length)}>{t.plan_md ? "Proposer une nouvelle version" : "Générer le plan et les pistes"}</button>
          {t.plan_md && edition === null && <button className="btn ghost" onClick={() => setEdition(t.plan_md || "")}>Modifier</button>}
          {t.plan_md && <button className="btn ghost" onClick={exporter}>Exporter en PDF</button>}
        </div>
        {busy && <div className="note small">{busy}</div>}
        {err && <div className="note bad small">{err}</div>}
      </div>

      {edition !== null ? (
        <div className="card noprint">
          <textarea value={edition} onChange={(e) => setEdition(e.target.value)} style={{ minHeight: 480, fontFamily: "ui-monospace, monospace", fontSize: 13 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={async () => { await enregistrer({ plan_md: edition }); setT({ ...t, plan_md: edition }); setEdition(null); }}>Enregistrer</button>
            <button className="btn ghost" onClick={() => setEdition(null)}>Annuler</button>
          </div>
        </div>
      ) : t.plan_md ? (
        <div className="card">
          <Sommaire md={t.plan_md} />
          <Md>{t.plan_md}</Md>
        </div>
      ) : null}

      <button className="btn danger noprint" onClick={supprimer}>Supprimer ce travail</button>

      <Question texte={contexteQuestion} meta={`Travail « ${t.titre} » pour l'UE ${t.ue}. Les extraits contiennent la consigne, le plan proposé et les documents joints.`} titre={t.titre || "Ce travail"} />
    </>
  );
}

export default function Page() {
  return <Shell><EspaceTravail /></Shell>;
}
