"use client";
import { useEffect, useRef, useState } from "react";
import Md from "@/components/Md";
import { apiRetry } from "@/lib/supabase";

type Msg = { role: "user" | "tuteur"; text: string };

const MOTS_VIDES = new Set("le la les un une des de du et ou en a au aux est sont que qui quoi dans pour par sur avec ce cette ces se sa son ses il elle on je tu nous vous ils elles pas plus ne comment pourquoi quel quelle quels quelles est-ce c'est entre".split(" "));

/** Choisit les passages du cours les plus proches de la question (sans dépasser max caractères). */
export function extraitsPertinents(texte: string, question: string, max = 14000) {
  if (texte.length <= max) return texte;
  const mots = question.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((m) => m.length > 2 && !MOTS_VIDES.has(m));
  const blocs = texte.split(/^(?=#{2,3}\s)/m).filter((b) => b.trim());
  const score = (b: string) => {
    const t = b.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return mots.reduce((n, m) => n + (t.split(m).length - 1), 0);
  };
  const tries = blocs.map((b, i) => ({ b, i, s: score(b) })).sort((a, b) => b.s - a.s || a.i - b.i);
  const gardes: { b: string; i: number }[] = [];
  let total = 0;
  for (const x of tries) {
    if (total + x.b.length > max) continue;
    gardes.push(x);
    total += x.b.length;
  }
  if (!gardes.length) return (tries[0]?.b || texte).slice(0, max);
  return gardes.sort((a, b) => a.i - b.i).map((x) => x.b).join("\n\n");
}

export default function Question({ texte, meta, titre }: { texte: string; meta: string; titre: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [attente, setAttente] = useState("");
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => { fin.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function envoyer() {
    const question = q.trim();
    if (!question || busy) return;
    const historique = msgs.slice(-6);
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    setAttente("");
    try {
      const contexte = [...historique.filter((h) => h.role === "user").map((h) => h.text), question].join(" ");
      const j = await apiRetry("/api/question", () => ({ question, extraits: extraitsPertinents(texte, contexte), historique, meta }), false, (s) => setAttente(`Pause imposée par l'offre gratuite : reprise dans ${s} s`));
      setMsgs((m) => [...m, { role: "tuteur", text: j.md || "Je n'ai pas de réponse, reformule ta question." }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "tuteur", text: `Désolé, je n'ai pas pu répondre : ${e.message || e}` }]);
    } finally {
      setBusy(false);
      setAttente("");
    }
  }

  if (!texte.trim()) return null;

  return (
    <div className="noprint">
      {!ouvert && (
        <button className="btn" onClick={() => setOuvert(true)} style={{ position: "fixed", right: 16, bottom: 16, zIndex: 50, borderRadius: 999, padding: "12px 18px", boxShadow: "0 6px 20px rgba(0,0,0,.18)" }}>
          💬 Poser une question
        </button>
      )}
      {ouvert && (
        <div style={{ position: "fixed", right: 12, bottom: 12, zIndex: 60, width: "min(440px, calc(100vw - 24px))", height: "min(72vh, 640px)", display: "flex", flexDirection: "column", background: "var(--card)", border: "1px solid var(--line)", borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.25)", overflow: "hidden" }}>
          <div className="row" style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)", alignItems: "center" }}>
            <div className="grow">
              <b>Une question sur le cours ?</b>
              <div className="small muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{titre}</div>
            </div>
            {msgs.length > 0 && <button className="btn ghost small" style={{ padding: "2px 8px" }} onClick={() => setMsgs([])}>Effacer</button>}
            <button className="btn ghost small" style={{ padding: "2px 10px" }} onClick={() => setOuvert(false)} aria-label="Fermer">✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {!msgs.length && (
              <div className="small muted">
                Pose n'importe quelle question pour mieux comprendre : « Explique-moi simplement… », « Quelle différence entre… et… ? », « Donne-moi un exemple de… », « Pourquoi… ? ». Je réponds à partir de ton cours, avec des exemples.
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ margin: "10px 0", display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "92%", padding: "8px 12px", borderRadius: 12, background: m.role === "user" ? "var(--accent, #1f6f5c)" : "transparent", color: m.role === "user" ? "#fff" : "inherit", border: m.role === "user" ? "none" : "1px solid var(--line)" }}>
                  {m.role === "user" ? <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div> : <Md>{m.text}</Md>}
                </div>
              </div>
            ))}
            {busy && <div className="small muted">Je réfléchis…{attente ? ` ${attente}` : ""}</div>}
            <div ref={fin} />
          </div>
          <div className="row" style={{ padding: 10, borderTop: "1px solid var(--line)", alignItems: "flex-end" }}>
            <textarea
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
              placeholder="Ta question…"
              rows={2}
              style={{ flex: 1, minHeight: 44, resize: "none", margin: 0 }}
            />
            <button className="btn" onClick={envoyer} disabled={busy || !q.trim()}>Envoyer</button>
          </div>
        </div>
      )}
    </div>
  );
}
