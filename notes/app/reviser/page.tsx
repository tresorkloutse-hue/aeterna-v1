"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import Quiz from "@/components/Quiz";
import { sb, BankQuestion, tirerSerie } from "@/lib/supabase";

function Reviser() {
  const [bank, setBank] = useState<BankQuestion[] | null>(null);
  const [ue, setUe] = useState("");
  const [serie, setSerie] = useState<BankQuestion[]>([]);
  const [key, setKey] = useState(0);
  const [unique, setUnique] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await sb().from("notes_questions").select("*");
      const all = (data as BankQuestion[]) || [];
      setBank(all);
      const qid = new URLSearchParams(location.search).get("q");
      const q = qid ? all.find((x) => x.id === qid) : null;
      if (q) {
        setUe(q.ue);
        setSerie([q]);
        setUnique(true);
      } else {
        setSerie(tirerSerie(all, 15));
      }
    })();
  }, []);

  function nouvelle(filtre = ue) {
    const pool = (bank || []).filter((q) => !filtre || q.ue === filtre);
    setSerie(tirerSerie(pool, 15));
    setUnique(false);
    setKey((k) => k + 1);
    history.replaceState(null, "", "/reviser");
  }

  if (bank === null) return <p className="muted">Chargement…</p>;
  const ues = Array.from(new Set(bank.map((q) => q.ue).filter(Boolean))).sort();
  const dues = bank.filter((q) => (!ue || q.ue === ue) && new Date(q.due_at).getTime() <= Date.now()).length;

  return (
    <>
      <h1>Réviser</h1>
      {!bank.length ? (
        <div className="card">Pas encore de questions. Génère d'abord un cours.</div>
      ) : (
        <>
          <div className="row" style={{ margin: "10px 0" }}>
            <select value={ue} onChange={(e) => { setUe(e.target.value); nouvelle(e.target.value); }} style={{ maxWidth: 360 }}>
              <option value="">Toutes les UE</option>
              {ues.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <span className="small muted">{dues} question(s) à revoir maintenant</span>
          </div>
          <Quiz key={key} serie={serie} titre={unique ? "Question du moment" : undefined} onFin={() => nouvelle()} />
          {unique && <button className="btn ghost" onClick={() => nouvelle()}>Continuer avec une série de 15 questions{ue ? ` en ${ue}` : ""}</button>}
        </>
      )}
    </>
  );
}

export default function Page() {
  return <Shell><Reviser /></Shell>;
}
