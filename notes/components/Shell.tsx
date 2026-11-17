"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "@/lib/supabase";

function Login() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState<{ t: string; k?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "in") {
        const { error } = await sb().auth.signInWithPassword({ email, password: pwd });
        if (error) throw error;
      } else {
        const { data, error } = await sb().auth.signUp({ email, password: pwd, options: { emailRedirectTo: location.origin } });
        if (error) throw error;
        if (!data.session) {
          setMsg({ t: "Compte créé. Clique sur le lien reçu par mail pour confirmer ton adresse, puis reviens ici te connecter. (Si le lien ouvre une page d'erreur, ton adresse est quand même confirmée.)" });
          setMode("in");
        }
      }
    } catch (err: any) {
      const m = String(err?.message || err);
      setMsg({
        k: "bad",
        t: /Invalid login/i.test(m)
          ? "Email ou mot de passe incorrect."
          : /not confirmed/i.test(m)
          ? "Confirme d'abord ton adresse avec le lien reçu par mail."
          : /already registered/i.test(m)
          ? "Ce compte existe déjà : connecte-toi."
          : m,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 440 }}>
      <h1>Mes notes de cours</h1>
      <p className="muted">Enregistre tes cours depuis ton ordinateur, en salle ou en visio. Tu récupères le cours rédigé, les infos pratiques à part, un quiz et une fiche de révision.</p>
      <form className="card" onSubmit={go}>
        <label>Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <label>Mot de passe</label>
        <input type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)} autoComplete={mode === "in" ? "current-password" : "new-password"} />
        {msg && <div className={`note ${msg.k || ""}`}>{msg.t}</div>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn grow" disabled={busy}>{mode === "in" ? "Se connecter" : "Créer mon compte"}</button>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          {mode === "in" ? "Pas encore de compte ? " : "Déjà un compte ? "}
          <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
            {mode === "in" ? "Créer un compte" : "Se connecter"}
          </a>
        </p>
      </form>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    sb().auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb().auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="wrap muted">Chargement…</div>;
  if (!session) return <Login />;
  return (
    <>
      <header className="top">
        <div className="in">
          <Link href="/" className="logo"><span>N</span>Mes notes</Link>
          <nav>
            <Link href="/reviser">Réviser</Link>
            <Link href="/cours/nouveau">+ Cours</Link>
            <Link href="/reglages">Réglages</Link>
          </nav>
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
