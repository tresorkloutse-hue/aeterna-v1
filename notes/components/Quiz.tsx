"use client";
import { useMemo, useState } from "react";
import { BankQuestion, melanger, noterReponse } from "@/lib/supabase";

/** Série de questions : une à la fois, choix mélangés, résultat enregistré pour la révision espacée. */
export default function Quiz({ serie, onFin, titre }: { serie: BankQuestion[]; onFin?: () => void; titre?: string }) {
  const melanges = useMemo(() => serie.map(melanger), [serie]);
  const [reponses, setReponses] = useState<(number | null)[]>(() => serie.map(() => null));
  const [i, setI] = useState(0);

  if (!serie.length) return <p className="muted">Aucune question pour l'instant.</p>;

  const score = reponses.filter((a, k) => a === melanges[k].bonne).length;

  if (i >= serie.length) {
    const rates = serie.map((q, k) => ({ q, k })).filter(({ k }) => reponses[k] !== melanges[k].bonne);
    return (
      <div className="card" style={{ textAlign: "center" }}>
        <div className="score">{score} / {serie.length}</div>
        <p className="muted">
          {score === serie.length ? "Parfait, tout est acquis !" : score >= serie.length * 0.7 ? "Bien retenu. Les questions ratées reviendront bientôt." : "Relis le cours et la fiche : les questions ratées reviendront dans les prochaines séries."}
        </p>
        {rates.length > 0 && (
          <div style={{ textAlign: "left" }}>
            <b>À revoir</b>
            {rates.map(({ q, k }) => (
              <div className="seg" key={q.id}>
                <div>{q.question}</div>
                <div className="small"><b>Réponse :</b> {q.choix[q.bonne]}. <span className="muted">{q.explication}</span></div>
              </div>
            ))}
          </div>
        )}
        {onFin && <button className="btn" style={{ marginTop: 14 }} onClick={onFin}>Nouvelle série de questions</button>}
      </div>
    );
  }

  const q = serie[i];
  const m = melanges[i];
  const a = reponses[i];
  function repondre(k: number) {
    setReponses(reponses.map((x, n) => (n === i ? k : x)));
    noterReponse(q, k === m.bonne);
  }
  return (
    <div className="card q">
      <div className="small muted">{titre ? `${titre} · ` : ""}Question {i + 1} sur {serie.length}{q.vus === 0 ? " · nouvelle" : q.rates > 0 ? " · déjà ratée" : ""}</div>
      <div className="progress"><div style={{ width: `${(i / serie.length) * 100}%` }} /></div>
      <p style={{ fontWeight: 600, fontSize: 18 }}>{q.question}</p>
      {m.choix.map((c, k) => (
        <button key={k} className={`choice ${a !== null && k === m.bonne ? "good" : ""} ${a === k && k !== m.bonne ? "badc" : ""}`} disabled={a !== null} onClick={() => repondre(k)}>
          {String.fromCharCode(65 + k)}. {c}
        </button>
      ))}
      {a !== null && (
        <>
          <div className={`note ${a === m.bonne ? "" : "bad"}`}>
            <b>{a === m.bonne ? "Bonne réponse." : `Pas tout à fait : la bonne réponse est ${String.fromCharCode(65 + m.bonne)}.`}</b> {q.explication}
          </div>
          <button className="btn" onClick={() => setI(i + 1)}>{i + 1 < serie.length ? "Question suivante" : "Voir mon score"}</button>
        </>
      )}
    </div>
  );
}
