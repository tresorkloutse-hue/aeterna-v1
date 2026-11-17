"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { sb } from "@/lib/supabase";

function Nouveau() {
  const router = useRouter();
  const [ues, setUes] = useState<string[]>([]);
  const [ue, setUe] = useState("");
  const [titre, setTitre] = useState("");
  const [intervenant, setIntervenant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const pre = new URLSearchParams(location.search).get("ue");
    if (pre) setUe(pre);
    sb().from("notes_courses").select("ue").then(({ data }) => setUes(Array.from(new Set((data || []).map((d: any) => d.ue).filter(Boolean)))));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await sb().from("notes_courses").insert({ ue: ue.trim(), titre: titre.trim(), intervenant: intervenant.trim(), date_cours: date }).select("id").single();
    if (error) { setErr(error.message); setBusy(false); return; }
    router.push(`/cours/${data.id}`);
  }

  return (
    <>
      <h1>Nouveau cours</h1>
      <form className="card" onSubmit={create}>
        <label>UE (unité d'enseignement)</label>
        <input list="ues" required placeholder="ex. UE 3 : Santé et RSE" value={ue} onChange={(e) => setUe(e.target.value)} />
        <datalist id="ues">{ues.map((u) => <option key={u} value={u} />)}</datalist>
        <label>Titre de la séance</label>
        <input placeholder="ex. Séance 1 : santé et promotion de la santé" value={titre} onChange={(e) => setTitre(e.target.value)} />
        <div className="row">
          <div className="grow" style={{ minWidth: 180 }}>
            <label>Intervenant</label>
            <input placeholder="ex. Olivier Dufour" value={intervenant} onChange={(e) => setIntervenant(e.target.value)} />
          </div>
          <div style={{ minWidth: 160 }}>
            <label>Date</label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {err && <div className="note bad">{err}</div>}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn grow" disabled={busy}>Créer et commencer</button>
        </div>
      </form>
    </>
  );
}

export default function Page() {
  return <Shell><Nouveau /></Shell>;
}
