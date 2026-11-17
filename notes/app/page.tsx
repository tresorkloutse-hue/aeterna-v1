"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { sb, Course } from "@/lib/supabase";

const STATUTS: Record<string, string> = {
  brouillon: "En cours de prise de notes",
  genere: "Rendu prêt",
};

function Bibliotheque() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [hasKey, setHasKey] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    sb().from("notes_courses").select("id, ue, titre, intervenant, date_cours, statut, created_at").order("date_cours", { ascending: false })
      .then(({ data }) => setCourses((data as Course[]) || []));
    sb().from("notes_settings").select("groq_key").maybeSingle().then(({ data }) => setHasKey(!!data?.groq_key));
  }, []);

  const filtres = (courses || []).filter((c) => !q || `${c.ue} ${c.titre} ${c.intervenant}`.toLowerCase().includes(q.toLowerCase()));
  const parUe = filtres.reduce<Record<string, Course[]>>((acc, c) => {
    (acc[c.ue || "Sans UE"] ||= []).push(c);
    return acc;
  }, {});

  return (
    <>
      <h1>Mes cours</h1>
      {!hasKey && (
        <div className="note warn">
          Dernière étape avant ton premier cours : ajoute ta clé Groq gratuite dans <Link href="/reglages">Réglages</Link>.
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <input className="grow" placeholder="Rechercher un cours, une UE…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
        <Link href="/cours/nouveau" className="btn">+ Nouveau cours</Link>
      </div>
      {courses === null && <p className="muted">Chargement…</p>}
      {courses?.length === 0 && (
        <div className="card">
          <b>Aucun cours pour l'instant.</b>
          <p className="muted small" style={{ marginBottom: 0 }}>
            Crée un cours, puis enregistre-le depuis ton ordinateur (en salle ou en visio) ou importe un audio, une vidéo, des captures ou les slides.
          </p>
        </div>
      )}
      {Object.entries(parUe).sort(([a], [b]) => a.localeCompare(b)).map(([ue, list]) => (
        <section className="ue" key={ue}>
          <Link href={`/ue?nom=${encodeURIComponent(ue)}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "var(--card)", border: "1px solid var(--line)", textDecoration: "none", color: "var(--ink)", marginBottom: 4 }}>
            <span>📁 <b>{ue}</b> <span className="small muted">· {list.length} séance{list.length > 1 ? "s" : ""}</span></span>
            <span className="small">Ouvrir le dossier ›</span>
          </Link>
          {list.map((c) => (
            <Link className="course" key={c.id} href={`/cours/${c.id}`}>
              <div>
                <div style={{ fontWeight: 600 }}>{c.titre || "Cours sans titre"}</div>
                <div className="small muted">
                  {new Date(c.date_cours).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  {c.intervenant ? ` · ${c.intervenant}` : ""}
                </div>
              </div>
              <span className={`pill ${c.statut === "genere" ? "ok" : ""}`}>{STATUTS[c.statut] || c.statut}</span>
            </Link>
          ))}
        </section>
      ))}
    </>
  );
}

export default function Page() {
  return <Shell><Bibliotheque /></Shell>;
}
