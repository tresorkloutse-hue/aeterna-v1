"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Md, { Sommaire } from "@/components/Md";
import { sb } from "@/lib/supabase";
import { genererSyntheseUe } from "@/lib/synthese";
import type { Progress } from "@/lib/generate";
import Question from "@/components/Question";

type Seance = { id: string; titre: string; date_cours: string; statut: string; intervenant: string | null; synthese_md: string | null; rendu_md: string | null };
type Tab = "seances" | "revision" | "travaux" | "ajouts";
type TravailLigne = { id: string; titre: string; echeance: string | null; plan_md: string | null; updated_at: string };

function Dossier() {
  const [ue, setUe] = useState<string | null>(null);
  const [seances, setSeances] = useState<Seance[] | null>(null);
  const [synthese, setSynthese] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSauvees, setNotesSauvees] = useState("");
  const [tab, setTab] = useState<Tab>("seances");
  const [gen, setGen] = useState<Progress | null>(null);
  const [err, setErr] = useState("");
  const [edition, setEdition] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [nouveauNom, setNouveauNom] = useState<string | null>(null);
  const [travaux, setTravaux] = useState<TravailLigne[]>([]);

  useEffect(() => {
    setUe(new URLSearchParams(location.search).get("nom") || "");
  }, []);

  const load = useCallback(async () => {
    if (!ue) return;
    const [{ data: c }, { data: d }, { data: tr }] = await Promise.all([
      sb().from("notes_courses").select("id, titre, date_cours, statut, intervenant, synthese_md, rendu_md").eq("ue", ue).order("date_cours").order("created_at"),
      sb().from("notes_ues").select("synthese_md, notes_md").eq("ue", ue).maybeSingle(),
      sb().from("notes_travaux").select("id, titre, echeance, plan_md, updated_at").eq("ue", ue).order("created_at", { ascending: false }),
    ]);
    setTravaux((tr as TravailLigne[]) || []);
    setSeances((c as Seance[]) || []);
    setSynthese(d?.synthese_md || "");
    setNotes(d?.notes_md || "");
    setNotesSauvees(d?.notes_md || "");
  }, [ue]);

  useEffect(() => { load(); }, [load]);

  async function enregistrer(patch: Record<string, unknown>) {
    const { error } = await sb().from("notes_ues").upsert({ ue, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id,ue" });
    if (error) throw error;
  }

  async function generer() {
    if (!ue) return;
    setErr("");
    setGen({ step: "Préparation", done: 0, total: 1 });
    try {
      await genererSyntheseUe(ue, setGen);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setGen(null);
      load();
    }
  }

  async function sauverEdition() {
    if (edition === null) return;
    try {
      await enregistrer({ synthese_md: edition });
      setSynthese(edition);
      setEdition(null);
    } catch (e: any) { setErr(e.message || String(e)); }
  }

  async function sauverNotes() {
    try {
      await enregistrer({ notes_md: notes });
      setNotesSauvees(notes);
      setMsg("Enregistré. Ce sera intégré à la prochaine génération du cours de révision de l'UE.");
    } catch (e: any) { setMsg(e.message || String(e)); }
  }

  async function nouveauTravail() {
    const { data, error } = await sb().from("notes_travaux").insert({ ue, titre: "" }).select("id").single();
    if (error) { setErr(error.message); return; }
    location.href = `/travail?id=${data.id}`;
  }

  async function renommer() {
    const nom = (nouveauNom || "").trim();
    if (!ue || !nom || nom === ue) { setNouveauNom(null); return; }
    setErr("");
    const r1 = await sb().from("notes_courses").update({ ue: nom }).eq("ue", ue);
    if (r1.error) { setErr(r1.error.message); return; }
    await sb().from("notes_questions").update({ ue: nom }).eq("ue", ue);
    await sb().from("notes_travaux").update({ ue: nom }).eq("ue", ue);
    const { data: cible } = await sb().from("notes_ues").select("notes_md").eq("ue", nom).maybeSingle();
    if (cible) {
      // Le dossier existe déjà : on fusionne les ajouts et on garde son cours de révision (à mettre à jour)
      if (notesSauvees.trim()) await sb().from("notes_ues").update({ notes_md: [cible.notes_md, notesSauvees].filter(Boolean).join("\n\n") }).eq("ue", nom);
      await sb().from("notes_ues").delete().eq("ue", ue);
    } else {
      await sb().from("notes_ues").update({ ue: nom }).eq("ue", ue);
    }
    setNouveauNom(null);
    history.replaceState(null, "", `/ue?nom=${encodeURIComponent(nom)}`);
    setUe(nom);
  }

  function exporter() {
    const t = document.title;
    document.title = `${ue} - cours de révision`.replace(/[\\/:*?"<>|]/g, " ");
    window.print();
    setTimeout(() => { document.title = t; }, 1000);
  }

  if (ue === null) return <p className="muted">Chargement…</p>;
  if (!ue) return <p>Dossier introuvable. <Link href="/">Retour à mes cours</Link></p>;
  if (seances === null) return <p className="muted">Chargement…</p>;

  const generees = seances.filter((s) => s.statut === "genere").length;
  const fr = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const progression = gen && (
    <div className="card">
      <div className="progress"><div style={{ width: `${(gen.done / gen.total) * 100}%` }} /></div>
      <div className="small">{gen.step}…</div>
      {gen.wait && <div className="small muted">{gen.wait}</div>}
    </div>
  );

  return (
    <>
      <div className="small muted noprint" style={{ marginTop: 14 }}><Link href="/">Mes cours</Link> › Dossier</div>
      {nouveauNom !== null ? (
        <div className="row noprint" style={{ margin: "8px 0" }}>
          <input value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renommer(); }} autoFocus style={{ flex: 1, minWidth: 200 }} />
          <button className="btn" onClick={renommer}>Renommer</button>
          <button className="btn ghost" onClick={() => setNouveauNom(null)}>Annuler</button>
        </div>
      ) : (
        <h1 style={{ marginTop: 2 }}>📁 {ue} <button className="btn ghost small noprint" style={{ padding: "2px 8px", fontSize: 13, verticalAlign: "middle" }} onClick={() => setNouveauNom(ue)}>✏️ Renommer</button></h1>
      )}
      {nouveauNom !== null && <p className="small muted noprint">Toutes les séances du dossier seront déplacées sous ce nouveau nom. Si une UE porte déjà ce nom, les deux dossiers seront réunis.</p>}
      <div className="small muted noprint">{seances.length} séance{seances.length > 1 ? "s" : ""}, dont {generees} générée{generees > 1 ? "s" : ""}</div>

      <div className="tabs noprint">
        {(["seances", "revision", "travaux", "ajouts"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {{ seances: "Séances", revision: "Cours de révision de l'UE", travaux: `Travaux${travaux.length ? ` (${travaux.length})` : ""}`, ajouts: "Mes ajouts" }[t]}
          </button>
        ))}
      </div>

      {tab === "seances" && (
        <div className="noprint">
          {seances.map((s, i) => (
            <Link className="course" key={s.id} href={`/cours/${s.id}`}>
              <div>
                <div style={{ fontWeight: 600 }}>Séance {i + 1} : {s.titre || "sans titre"}</div>
                <div className="small muted">{fr(s.date_cours)}{s.intervenant ? ` · ${s.intervenant}` : ""}{s.synthese_md ? " · cours de révision prêt" : ""}</div>
              </div>
              <span className={`pill ${s.statut === "genere" ? "ok" : ""}`}>{s.statut === "genere" ? "Rendu prêt" : "Prise de notes"}</span>
            </Link>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <Link className="btn" href={`/cours/nouveau?ue=${encodeURIComponent(ue)}`}>+ Nouvelle séance dans cette UE</Link>
          </div>
          <p className="small muted">Pour ajouter des documents, un audio ou un enregistrement à une séance existante, ouvre-la puis va dans « Prise de notes » et clique sur « Mettre à jour ».</p>
        </div>
      )}

      {tab === "revision" && (
        <>
          <div className="card noprint">
            <b>Cours de révision de toute l'UE</b>
            <p className="small muted">
              Toutes les séances générées, dans l'ordre, réunies en un seul document : mode d'emploi, vue d'ensemble, une partie par chapitre avec les liens entre les séances, puis tableau de synthèse, pièges, auteurs, questions de rappel et planning. Tes ajouts sont intégrés. Refais-le après chaque nouvelle séance. Compte environ 1 minute par chapitre.
            </p>
            {gen ? progression : (
              <div className="row">
                <button className="btn" onClick={generer} disabled={!generees}>{synthese ? "Mettre à jour le cours de révision" : "Créer le cours de révision de l'UE"}</button>
                {synthese && edition === null && <button className="btn ghost" onClick={() => setEdition(synthese)}>Modifier</button>}
                {synthese && <button className="btn ghost" onClick={exporter}>Exporter en PDF</button>}
              </div>
            )}
            {!generees && <div className="note small">Génère d'abord au moins une séance de ce dossier.</div>}
            {err && <div className="note bad small">{err}</div>}
          </div>
          {edition !== null ? (
            <div className="card noprint">
              <p className="small muted" style={{ marginTop: 0 }}>Modifie ou complète le texte directement (titres avec ##, gras avec **). Attention : « Mettre à jour » réécrit tout ; tes compléments durables vont plutôt dans « Mes ajouts ».</p>
              <textarea value={edition} onChange={(e) => setEdition(e.target.value)} style={{ minHeight: 480, fontFamily: "ui-monospace, monospace", fontSize: 13 }} />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn" onClick={sauverEdition}>Enregistrer</button>
                <button className="btn ghost" onClick={() => setEdition(null)}>Annuler</button>
              </div>
            </div>
          ) : synthese ? (
            <div className="card">
              <Sommaire md={synthese} />
              <Md>{synthese}</Md>
            </div>
          ) : null}
        </>
      )}

      {tab === "travaux" && (
        <div className="noprint">
          <p className="small muted">Un espace par devoir, dossier ou exposé de cette UE : tu y mets la consigne et les documents, et tu obtiens un plan détaillé et des pistes reliés à tes cours.</p>
          {travaux.map((w) => (
            <Link className="course" key={w.id} href={`/travail?id=${w.id}`}>
              <div>
                <div style={{ fontWeight: 600 }}>{w.titre || "Travail sans titre"}</div>
                <div className="small muted">{w.echeance ? `À rendre le ${fr(w.echeance)}` : "Pas d'échéance"}</div>
              </div>
              <span className={`pill ${w.plan_md ? "ok" : ""}`}>{w.plan_md ? "Plan prêt" : "En préparation"}</span>
            </Link>
          ))}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={nouveauTravail}>+ Nouveau travail</button>
          </div>
          {err && <div className="note bad small">{err}</div>}
        </div>
      )}

      {tab === "ajouts" && (
        <div className="card noprint">
          <b>Mes ajouts à cette UE</b>
          <p className="small muted">
            Écris ici tout ce que tu veux intégrer au cours de révision de l'UE : compléments, précisions du prof, consignes d'examen, tes propres exemples, points à approfondir. Ils seront intégrés comme une partie à part lors de la prochaine mise à jour.
          </p>
          <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setMsg(""); }} placeholder="Ex. : le prof a insisté sur la différence entre renforcement négatif et punition ; l'examen portera sur l'analyse d'une campagne…" style={{ minHeight: 260 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={sauverNotes} disabled={notes === notesSauvees}>Enregistrer</button>
          </div>
          {msg && <div className="note small">{msg}</div>}
        </div>
      )}

      <Question
        texte={[synthese, ...seances.filter((s) => s.rendu_md).map((s, i) => `## Séance ${i + 1} : ${s.titre || "sans titre"}\n\n${s.rendu_md}`)].filter(Boolean).join("\n\n").replace(/!\[[^\]]*\]\([^)]*\)/g, "")}
        meta={`UE : ${ue}. Les extraits viennent de plusieurs séances de cette UE.`}
        titre={ue}
      />
    </>
  );
}

export default function Page() {
  return <Shell><Dossier /></Shell>;
}
