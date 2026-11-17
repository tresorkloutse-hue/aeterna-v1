"use client";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import Recorder from "@/components/Recorder";
import Importer from "@/components/Importer";
import Md, { Sommaire } from "@/components/Md";
import Quiz from "@/components/Quiz";
import Question from "@/components/Question";
import { sb, Course, Segment, BankQuestion, signedUrls, tirerSerie, BUCKET } from "@/lib/supabase";
import { generer, plusDeQuestions, Progress } from "@/lib/generate";
import { genererSynthese } from "@/lib/synthese";

const KIND: Record<string, string> = { audio: "🎙️", live: "🎙️", photo: "🖼️", pdf: "📄", texte: "📝" };
type Tab = "sources" | "rendu" | "synthese" | "infos" | "quiz" | "fiche";

function CoursView({ id }: { id: string }) {
  const router = useRouter();
  const [course, setCourse] = useState<Course | null | undefined>(undefined);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [serie, setSerie] = useState<BankQuestion[]>([]);
  const [serieKey, setSerieKey] = useState(0);
  const [visuels, setVisuels] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("sources");
  const [gen, setGen] = useState<Progress | null>(null);
  const [err, setErr] = useState("");
  const [edition, setEdition] = useState<string | null>(null);
  const [infos, setInfos] = useState<{ titre: string; ue: string; intervenant: string; date_cours: string } | null>(null);
  const [toutesUes, setToutesUes] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [{ data: c }, { data: s }, { data: q }] = await Promise.all([
      sb().from("notes_courses").select("*").eq("id", id).maybeSingle(),
      sb().from("notes_segments").select("*").eq("course_id", id).order("position"),
      sb().from("notes_questions").select("*").eq("course_id", id),
    ]);
    const segs = (s as Segment[]) || [];
    setCourse(c as Course);
    setSegments(segs);
    setBank((q as BankQuestion[]) || []);
    const paths = segs.filter((x) => x.image_path).map((x) => x.image_path!);
    if (paths.length) {
      const urls = await signedUrls(paths);
      const parSeg: Record<string, string> = {};
      for (const x of segs) if (x.image_path && urls[x.image_path]) parSeg[x.id] = urls[x.image_path];
      setVisuels(parSeg);
    }
    return { c: c as Course, q: (q as BankQuestion[]) || [] };
  }, [id]);

  useEffect(() => {
    load().then(({ c, q }) => {
      if (c?.rendu_md) setTab("rendu");
      setSerie(tirerSerie(q));
    });
  }, [load]);

  async function lancer(depuisZero = false) {
    if (!course) return;
    setErr("");
    setGen({ step: "Préparation", done: 0, total: 1 });
    try {
      const { c } = await load();
      const { data: avant } = await sb().from("notes_courses").select("titre, rendu_md, date_cours").eq("ue", course.ue).neq("id", course.id).lte("date_cours", course.date_cours).not("rendu_md", "is", null).order("date_cours");
      const contexteUe = (avant || []).length
        ? ` Séances précédentes de cette UE (pour la continuité : fais le lien quand ce cours reprend ou prolonge une notion déjà vue, sans la réexpliquer en entier) : ${(avant || []).map((a: any) => `${a.titre || "séance"} [${(String(a.rendu_md).match(/^##\s+\d+\..+$/gm) || []).map((t: string) => t.replace(/^##\s+\d+\.\s*/, "")).join(", ")}]`).join(" ; ").slice(0, 1500)}.`
        : "";
      await generer(c || course, segments, setGen, depuisZero, contexteUe);
      const { q } = await load();
      setSerie(tirerSerie(q));
      setSerieKey((k) => k + 1);
      setTab("rendu");
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setGen(null);
    }
  }

  async function nouvelleSerie() {
    const { q } = await load();
    setSerie(tirerSerie(q));
    setSerieKey((k) => k + 1);
  }

  async function plusDeQ() {
    if (!course) return;
    setErr("");
    setGen({ step: "Nouvelles questions", done: 0, total: 1 });
    try {
      await plusDeQuestions(course, setGen);
      await nouvelleSerie();
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setGen(null);
    }
  }

  async function lancerSynthese() {
    if (!course) return;
    setErr("");
    setGen({ step: "Préparation du cours de révision", done: 0, total: 1 });
    try {
      const { c } = await load();
      await genererSynthese(c || course, setGen);
      await load();
    } catch (e: any) {
      setErr(e.message || String(e));
      await load();
    } finally {
      setGen(null);
    }
  }

  async function suppr(s: Segment) {
    if (!confirm(`Supprimer « ${s.label} » ?`)) return;
    if (s.image_path) await sb().storage.from(BUCKET).remove([s.image_path]);
    await sb().from("notes_segments").delete().eq("id", s.id);
    load();
  }

  async function supprCours() {
    if (!confirm("Supprimer définitivement ce cours et tout son contenu ?")) return;
    const paths = segments.filter((s) => s.image_path).map((s) => s.image_path!);
    if (paths.length) await sb().storage.from(BUCKET).remove(paths);
    await sb().from("notes_courses").delete().eq("id", id);
    router.push("/");
  }

  async function ouvrirInfos() {
    if (!course) return;
    setInfos({ titre: course.titre || "", ue: course.ue || "", intervenant: course.intervenant || "", date_cours: course.date_cours });
    const { data } = await sb().from("notes_courses").select("ue");
    setToutesUes(Array.from(new Set((data || []).map((d: any) => d.ue).filter(Boolean))).sort() as string[]);
  }

  async function sauverInfos() {
    if (!infos || !course) return;
    if (!infos.ue.trim()) { setErr("L'UE ne peut pas être vide."); return; }
    const ue = infos.ue.trim();
    const { error } = await sb().from("notes_courses").update({ titre: infos.titre.trim(), ue, intervenant: infos.intervenant.trim(), date_cours: infos.date_cours, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { setErr(error.message); return; }
    if (ue !== course.ue) await sb().from("notes_questions").update({ ue }).eq("course_id", id);
    setInfos(null);
    load();
  }

  function exporter() {
    if (!course) return;
    const t = document.title;
    document.title = `${course.ue}${course.titre ? " - " + course.titre : ""} (${course.date_cours})`.replace(/[\\/:*?"<>|]/g, " ");
    window.print();
    setTimeout(() => { document.title = t; }, 1000);
  }

  if (course === undefined) return <p className="muted">Chargement…</p>;
  if (!course) return <p>Cours introuvable.</p>;

  const parole = segments.filter((s) => ["audio", "live", "texte"].includes(s.kind)).reduce((n, s) => n + s.content.length, 0);
  const dateFr = new Date(course.date_cours).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const nbVisuels = segments.filter((s) => s.image_path).length;
  const dues = bank.filter((q) => new Date(q.due_at).getTime() <= Date.now()).length;
  const tri = [...bank].sort((a, b) => a.partie - b.partie);
  const synthese: string = (course as any).synthese_md || "";

  const progression = gen && (
    <div className="card">
      <div className="progress"><div style={{ width: `${(gen.done / gen.total) * 100}%` }} /></div>
      <div className="small">{gen.step}…</div>
      {gen.wait && <div className="small muted">{gen.wait}</div>}
    </div>
  );

  return (
    <>
      <div className="small muted noprint" style={{ marginTop: 14 }}><a href="/">Mes cours</a> › <a href={`/ue?nom=${encodeURIComponent(course.ue)}`}>📁 {course.ue}</a></div>
      {infos ? (
        <div className="card noprint">
          <b>Modifier les informations de la séance</b>
          <label>Titre</label>
          <input value={infos.titre} onChange={(e) => setInfos({ ...infos, titre: e.target.value })} placeholder="ex. Séance 2 : les théories de l'apprentissage" />
          <label>UE (déplace la séance dans un autre dossier)</label>
          <input list="ues-infos" value={infos.ue} onChange={(e) => setInfos({ ...infos, ue: e.target.value })} />
          <datalist id="ues-infos">{toutesUes.map((u) => <option key={u} value={u} />)}</datalist>
          <div className="row">
            <div className="grow" style={{ minWidth: 180 }}>
              <label>Intervenant</label>
              <input value={infos.intervenant} onChange={(e) => setInfos({ ...infos, intervenant: e.target.value })} />
            </div>
            <div style={{ minWidth: 160 }}>
              <label>Date</label>
              <input type="date" value={infos.date_cours} onChange={(e) => setInfos({ ...infos, date_cours: e.target.value })} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={sauverInfos}>Enregistrer</button>
            <button className="btn ghost" onClick={() => setInfos(null)}>Annuler</button>
          </div>
          {err && <div className="note bad small">{err}</div>}
        </div>
      ) : (
        <>
          <h1 style={{ marginTop: 2 }}>{course.titre || "Cours sans titre"}</h1>
          <div className="small muted">{dateFr}{course.intervenant ? ` · ${course.intervenant}` : ""} <button className="btn ghost small noprint" style={{ padding: "2px 8px", marginLeft: 6 }} onClick={ouvrirInfos}>✏️ Renommer</button></div>
        </>
      )}

      <div className="tabs noprint">
        {(["sources", "rendu", "synthese", "infos", "quiz", "fiche"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {{ sources: "Prise de notes", rendu: "Le cours", synthese: "Cours de révision", infos: "Infos pratiques", quiz: `Quiz${bank.length ? ` (${bank.length})` : ""}`, fiche: "Fiche express" }[t]}
          </button>
        ))}
      </div>

      {tab === "sources" && (
        <div className="noprint">
          <Recorder courseId={id} onAdded={load} />
          <Importer courseId={id} onAdded={load} />
          <div className="card">
            <b>Contenu récupéré ({segments.length}{nbVisuels ? `, dont ${nbVisuels} visuel(s)` : ""})</b>
            {segments.length === 0 && <p className="small muted" style={{ marginBottom: 0 }}>Rien pour l'instant.</p>}
            {segments.map((s) => (
              <div className="seg" key={s.id}>
                <div className="row">
                  <span className="grow">{KIND[s.kind]} {s.label}</span>
                  <button className="btn ghost small" style={{ padding: "2px 8px" }} onClick={() => suppr(s)}>Supprimer</button>
                </div>
                <div className="row" style={{ alignItems: "flex-start" }}>
                  {visuels[s.id] && <img src={visuels[s.id]} alt="" className="vignette" />}
                  <div className="txt grow">{s.content || "(vide)"}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <b>Générer le cours, les infos pratiques, les questions et la fiche</b>
            <p className="small muted">
              Environ {Math.max(1, Math.round(parole / 10000))} partie(s) à rédiger, puis les questions de chaque partie. Avec l'offre gratuite, compte 1 à 2 minutes par partie. Tu peux quitter et relancer : ce qui est fait est gardé.
            </p>
            {gen ? progression : (
              <div className="row">
                <button className="btn" onClick={() => lancer(false)} disabled={!segments.length}>{course.rendu_md ? "Mettre à jour" : "Générer"}</button>
                {course.rendu_md && <button className="btn ghost" onClick={() => lancer(true)}>Tout regénérer</button>}
              </div>
            )}
            {err && <div className="note bad small">{err}</div>}
          </div>
          <button className="btn danger" onClick={supprCours}>Supprimer ce cours</button>
        </div>
      )}

      {tab === "rendu" && (
        <div className="noprint">
          {course.rendu_md ? (
            <>
              <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn ghost" onClick={exporter}>Exporter en PDF</button></div>
              <div className="card">
                <Sommaire md={course.rendu_md} />
                <Md visuels={visuels}>{course.rendu_md}</Md>
              </div>
            </>
          ) : <p className="muted">Pas encore de rendu : ajoute du contenu dans « Prise de notes », puis lance la génération.</p>}
        </div>
      )}

      {tab === "synthese" && (
        <div className="noprint">
          {!course.rendu_md ? (
            <p className="muted">Génère d'abord le cours dans « Prise de notes » : la synthèse est faite à partir du cours rédigé.</p>
          ) : (
            <>
              <div className="card">
                <b>Cours de révision</b>
                <p className="small muted" style={{ marginBottom: 8 }}>
                  Tout le cours réorganisé pour réviser l'examen : mode d'emploi de l'épreuve, vue d'ensemble, parties numérotées avec tableaux, exemples, astuces et « À retenir », puis tableau de synthèse, pièges à éviter, auteurs et dates, questions de rappel et planning. Compte environ 1 minute par chapitre.
                </p>
                {gen ? progression : (
                  <div className="row">
                    <button className="btn" onClick={lancerSynthese}>{synthese ? "Refaire le cours de révision" : "Créer le cours de révision"}</button>
                    {synthese && edition === null && <button className="btn ghost" onClick={() => setEdition(synthese)}>Modifier</button>}
                    {synthese && <button className="btn ghost" onClick={exporter}>Exporter en PDF</button>}
                  </div>
                )}
                {err && <div className="note bad small">{err}</div>}
              </div>
              {edition !== null ? (
                <div className="card">
                  <p className="small muted" style={{ marginTop: 0 }}>Modifie ou complète le texte directement (titres avec ##, gras avec **). « Refaire » réécrira tout.</p>
                  <textarea value={edition} onChange={(e) => setEdition(e.target.value)} style={{ minHeight: 480, fontFamily: "ui-monospace, monospace", fontSize: 13 }} />
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn" onClick={async () => { const { error } = await sb().from("notes_courses").update({ synthese_md: edition }).eq("id", id); if (error) setErr(error.message); else { setEdition(null); load(); } }}>Enregistrer</button>
                    <button className="btn ghost" onClick={() => setEdition(null)}>Annuler</button>
                  </div>
                </div>
              ) : synthese && (
                <div className="card">
                  <Sommaire md={synthese} />
                  <Md>{synthese}</Md>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "infos" && (
        <div className="noprint">
          {course.infos_md ? (
            <div className="card infos">
              <p className="small muted" style={{ marginTop: 0 }}>Tout ce qui n'est pas le contenu du cours : organisation, évaluation, dates, consignes, à faire.</p>
              <Md>{course.infos_md}</Md>
            </div>
          ) : <p className="muted">{course.rendu_md ? "Aucune info pratique relevée (ou cours généré avant cette fonction : « Tout regénérer »)." : "Les infos pratiques apparaîtront après la génération."}</p>}
        </div>
      )}

      {tab === "quiz" && (
        <div className="noprint">
          {bank.length ? (
            <>
              <p className="small muted">
                {bank.length} questions sur ce cours, dont {bank.filter((q) => q.vus === 0).length} jamais vues et {dues} à revoir maintenant. Chaque série en tire 15, en priorité les nouvelles et celles que tu as ratées, réparties sur tout le cours.
              </p>
              <Quiz key={serieKey} serie={serie} onFin={nouvelleSerie} />
              <div className="row noprint">
                <button className="btn ghost" onClick={nouvelleSerie}>Changer de série</button>
                <button className="btn ghost" onClick={plusDeQ} disabled={!!gen}>+ Générer de nouvelles questions</button>
              </div>
              {gen && progression}
              {err && <div className="note bad small">{err}</div>}
            </>
          ) : <p className="muted">{course.rendu_md ? "Pas encore de questions : clique sur « Mettre à jour » dans Prise de notes." : "Les questions apparaîtront après la génération."}</p>}
        </div>
      )}

      {tab === "fiche" && (
        <div className="noprint">
          {course.fiche_md ? <div className="card fiche"><b>À retenir</b><Md>{course.fiche_md}</Md></div> : <p className="muted">La fiche apparaîtra après la génération.</p>}
        </div>
      )}

      <div className="printall">
        {tab === "synthese" && synthese ? (<><div className="part-title">Cours de révision</div><Sommaire md={synthese} /><Md>{synthese}</Md></>) : (<>
        {course.rendu_md && (<><div className="part-title">Partie 1 · Le cours</div><Sommaire md={course.rendu_md} /><Md visuels={visuels}>{course.rendu_md}</Md></>)}
        {!!tri.length && (
          <>
            <h2>Questions pour vérifier ce que j'ai retenu</h2>
            <ol>{tri.map((q) => <li key={q.id}>{q.question}<br />{q.choix.map((c, n) => <span key={n}>{String.fromCharCode(65 + n)}. {c}&nbsp;&nbsp; </span>)}</li>)}</ol>
            <h3>Corrigé</h3>
            <ol>{tri.map((q) => <li key={q.id}><b>{String.fromCharCode(65 + q.bonne)}. {q.choix[q.bonne]}</b> : {q.explication}</li>)}</ol>
          </>
        )}
        {course.fiche_md && (<><h2>Fiche express</h2><Md>{course.fiche_md}</Md></>)}
        {course.infos_md && (<><div className="part-title" style={{ breakBefore: "page" }}>Partie 2 · Organisation et infos pratiques</div><h2>Organisation et infos pratiques</h2><Md>{course.infos_md}</Md></>)}
        </>)}
      </div>

      <Question
        texte={[course.rendu_md || "", synthese].filter(Boolean).join("\n\n").replace(/!\[[^\]]*\]\([^)]*\)/g, "")}
        meta={`Cours : ${course.titre || "sans titre"}. UE : ${course.ue}.`}
        titre={course.titre || course.ue}
      />
    </>
  );
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Shell><CoursView id={id} /></Shell>;
}
