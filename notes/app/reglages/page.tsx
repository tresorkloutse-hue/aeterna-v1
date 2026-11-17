"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import { sb } from "@/lib/supabase";

const CONSEILLES: Record<string, string> = {
  auto: "Automatique (recommandé) : le meilleur modèle disponible, avec bascule en cas de souci",
  "llama-3.3-70b-versatile": "Très bonne rédaction",
  "moonshotai/kimi-k2-instruct-0905": "Très bonne rédaction",
  "moonshotai/kimi-k2-instruct": "Très bonne rédaction",
  "openai/gpt-oss-120b": "Bonne qualité, plus lent",
  "meta-llama/llama-4-maverick-17b-128e-instruct": "Bonne qualité",
  "meta-llama/llama-4-scout-17b-16e-instruct": "Plus de volume gratuit par jour",
  "qwen/qwen3-32b": "Correct",
  "openai/gpt-oss-20b": "Correct, rapide",
};

const HEURES = [7, 8, 9, 10, 12, 13, 14, 16, 18, 19, 20, 21, 22];

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function Notifications() {
  const [actif, setActif] = useState(false);
  const [heures, setHeures] = useState<number[]>([9, 18]);
  const [ues, setUes] = useState<string[]>([]);
  const [toutesUes, setToutesUes] = useState<string[]>([]);
  const [abonne, setAbonne] = useState(false);
  const [msg, setMsg] = useState<{ t: string; k?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const ios = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone);
  const supporte = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  useEffect(() => {
    sb().from("notes_settings").select("notif_actif, notif_heures, notif_ues").maybeSingle().then(({ data }) => {
      if (data) { setActif(!!data.notif_actif); setHeures(data.notif_heures || [9, 18]); setUes(data.notif_ues || []); }
    });
    sb().from("notes_courses").select("ue").then(({ data }) => setToutesUes(Array.from(new Set((data || []).map((d: any) => d.ue).filter(Boolean))).sort()));
    if (supporte) navigator.serviceWorker.getRegistration().then(async (r) => setAbonne(!!(await r?.pushManager.getSubscription())));
  }, [supporte]);

  async function sauver(patch: Record<string, unknown>) {
    const { data: u } = await sb().auth.getUser();
    await sb().from("notes_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", u.user!.id);
  }

  async function activer() {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notifications refusées : autorise-les pour ce site dans les réglages du navigateur.");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(process.env.NEXT_PUBLIC_VAPID_KEY!) }));
      const j = sub.toJSON() as any;
      const { error } = await sb().from("notes_push_subs").upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      await sauver({ notif_actif: true });
      setActif(true); setAbonne(true);
      setMsg({ t: "Notifications activées sur cet appareil." });
    } catch (e: any) {
      setMsg({ k: "bad", t: e.message || String(e) });
    } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setMsg(null);
    const { data } = await sb().auth.getSession();
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notes-push`, { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token}` } });
    const j = await r.json();
    setMsg(r.ok ? { t: "Question envoyée : elle doit arriver dans quelques secondes." } : { k: "bad", t: j.error });
    setBusy(false);
  }

  async function couper() {
    await sauver({ notif_actif: false });
    setActif(false);
    setMsg({ t: "Notifications en pause. Réactive-les quand tu veux." });
  }

  const basculer = (h: number) => { const n = heures.includes(h) ? heures.filter((x) => x !== h) : [...heures, h].sort((a, b) => a - b); setHeures(n); sauver({ notif_heures: n }); };
  const basculerUe = (u: string) => { const n = ues.includes(u) ? ues.filter((x) => x !== u) : [...ues, u]; setUes(n); sauver({ notif_ues: n }); };

  return (
    <div className="card">
      <b>Questions par notification</b>
      <p className="small muted">Aux heures choisies, tu reçois une question sur un cours : touche la notification pour y répondre. Les questions ratées reviennent plus souvent.</p>
      {!supporte ? (
        <div className="note warn small">
          {ios ? "Sur iPhone : ouvre ce site dans Safari, touche Partager puis « Sur l'écran d'accueil », puis ouvre l'app depuis l'écran d'accueil et reviens ici (iOS 16.4 ou plus)." : "Ce navigateur ne gère pas les notifications. Utilise Chrome sur Android ou un ordinateur."}
        </div>
      ) : ios && !standalone ? (
        <div className="note warn small">Sur iPhone, ajoute d'abord le site à l'écran d'accueil (Partager puis « Sur l'écran d'accueil »), ouvre-le depuis l'icône, puis active les notifications ici.</div>
      ) : (
        <div className="row">
          {!actif || !abonne ? (
            <button className="btn" onClick={activer} disabled={busy}>Activer sur cet appareil</button>
          ) : (
            <>
              <button className="btn ghost" onClick={test} disabled={busy}>M'envoyer une question maintenant</button>
              <button className="btn ghost" onClick={couper}>Mettre en pause</button>
            </>
          )}
        </div>
      )}
      <label>Heures (heure de Paris)</label>
      <div className="row">
        {HEURES.map((h) => (
          <button key={h} className={`chip ${heures.includes(h) ? "on" : ""}`} onClick={() => basculer(h)}>{h} h</button>
        ))}
      </div>
      <label>UE concernées</label>
      <div className="row">
        <button className={`chip ${!ues.length ? "on" : ""}`} onClick={() => { setUes([]); sauver({ notif_ues: [] }); }}>Toutes</button>
        {toutesUes.map((u) => <button key={u} className={`chip ${ues.includes(u) ? "on" : ""}`} onClick={() => basculerUe(u)}>{u}</button>)}
      </div>
      {msg && <div className={`note ${msg.k || ""} small`}>{msg.t}</div>}
    </div>
  );
}

const SECOURS_INFO = [
  {
    id: "openrouter" as const,
    nom: "OpenRouter (recommandé, sans carte bancaire)",
    url: "https://openrouter.ai/settings/keys",
    etapes: "Crée un compte sur openrouter.ai (Google, GitHub ou email), puis « Keys » et « Create API Key ». Aucune carte n'est demandée.",
    note: "Gratuit : environ 50 demandes par jour, ce qui suffit pour finir une génération quand Groq est saturé.",
  },
  {
    id: "cerebras" as const,
    nom: "Cerebras",
    url: "https://cloud.cerebras.ai",
    etapes: "Crée un compte sur cloud.cerebras.ai, puis « API Keys ». Cerebras peut demander une carte bancaire pour activer un crédit offert ; il indique ne rien prélever, mais c'est à toi de voir.",
    note: "Environ 1 million de jetons (tokens) par jour.",
  },
  {
    id: "mistral" as const,
    nom: "Mistral (payant sur certains comptes)",
    url: "https://console.mistral.ai/api-keys",
    etapes: "Sur console.mistral.ai, « API Keys ». Si Mistral te demande de passer à un plan supérieur, ignore cette ligne.",
    note: "",
  },
];

function CleSecours() {
  const [cles, setCles] = useState<{ mistral: string; cerebras: string; openrouter: string }>({ mistral: "", cerebras: "", openrouter: "" });
  const [msg, setMsg] = useState<Record<string, { t: string; k?: string }>>({});
  const [busy, setBusy] = useState("");

  useEffect(() => {
    sb().from("notes_settings").select("mistral_key, cerebras_key, openrouter_key").maybeSingle().then(({ data }) => {
      if (data) setCles({ mistral: data.mistral_key || "", cerebras: data.cerebras_key || "", openrouter: data.openrouter_key || "" });
    });
  }, []);

  async function sauver(id: "mistral" | "cerebras" | "openrouter") {
    const key = cles[id].trim();
    setBusy(id);
    setMsg((m) => ({ ...m, [id]: { t: "Vérification…" } }));
    try {
      if (key) {
        const r = await fetch("/api/verif-cle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fournisseur: id, key }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
      }
      const { data: u } = await sb().auth.getUser();
      const { error } = await sb().from("notes_settings").update({ [`${id}_key`]: key || null, updated_at: new Date().toISOString() }).eq("user_id", u.user!.id);
      if (error) throw error;
      setMsg((m) => ({ ...m, [id]: { t: key ? "Clé vérifiée et enregistrée." : "Clé retirée." } }));
    } catch (e: any) {
      setMsg((m) => ({ ...m, [id]: { k: "bad", t: e.message || String(e) } }));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card">
      <b>Clés de secours (gratuites, facultatives)</b>
      <p className="small muted">
        Quand la limite gratuite de Groq est atteinte, le site bascule tout seul sur ces services pour rédiger les cours, les cours de révision, les plans et les réponses aux questions. Ainsi tu n'attends plus. (La transcription de l'audio reste faite par Groq.)
      </p>
      {SECOURS_INFO.map((p) => (
        <div key={p.id} style={{ marginTop: 12 }}>
          <label>{p.nom}</label>
          <p className="small muted" style={{ margin: "2px 0 6px" }}>
            {p.etapes} <a href={p.url} target="_blank" rel="noreferrer">Ouvrir le site</a>{p.note ? `. ${p.note}` : "."}
          </p>
          <div className="row">
            <input type="password" className="grow" value={cles[p.id]} onChange={(e) => setCles({ ...cles, [p.id]: e.target.value })} placeholder="Colle la clé ici" autoComplete="off" style={{ flex: 1, minWidth: 180 }} />
            <button className="btn ghost" onClick={() => sauver(p.id)} disabled={busy === p.id}>Enregistrer</button>
          </div>
          {msg[p.id] && <div className={`note small ${msg[p.id].k || ""}`}>{msg[p.id].t}</div>}
        </div>
      ))}
    </div>
  );
}

function Reglages() {
  const [key, setKey] = useState("");
  const [model, setModel] = useState("auto");
  const [models, setModels] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ t: string; k?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    sb().auth.getUser().then(({ data }) => setEmail(data.user?.email || ""));
    sb().from("notes_settings").select("groq_key, model").maybeSingle().then(({ data }) => {
      if (data) { setKey(data.groq_key || ""); setModel(data.model && CONSEILLES[data.model] ? data.model : "auto"); }
    });
  }, []);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: key.trim() }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setModels(j.models);
      const m = model !== "auto" && j.models.includes(model) ? model : "auto";
      setModel(m);
      const { data: u } = await sb().auth.getUser();
      const { error } = await sb().from("notes_settings").upsert({ user_id: u.user!.id, groq_key: key.trim(), model: m, updated_at: new Date().toISOString() });
      if (error) throw error;
      setMsg({ t: "Clé vérifiée et enregistrée. Tout est prêt." });
    } catch (e: any) {
      setMsg({ k: "bad", t: e.message || String(e) });
    } finally {
      setBusy(false);
    }
  }

  const liste = Object.keys(CONSEILLES).filter((m) => m === "auto" || m === model || !models.length || models.includes(m));

  return (
    <>
      <h1>Réglages</h1>
      <div className="card">
        <b>Ta clé Groq (gratuite)</b>
        <p className="small muted">
          Groq transcrit l'audio et rédige les rendus. L'offre gratuite ne demande pas de carte bancaire et Groq n'entraîne pas ses modèles avec tes données.
        </p>
        <ol className="small">
          <li>Va sur <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com/keys</a> et crée un compte (Google ou email).</li>
          <li>Clique sur « Create API Key », donne-lui un nom, puis copie la clé (elle commence par <code>gsk_</code>).</li>
          <li>Colle-la ci-dessous et enregistre.</li>
        </ol>
        <label>Clé API Groq</label>
        <input type="password" placeholder="gsk_…" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
        <label>Modèle de rédaction</label>
        <select value={model} onChange={(e) => setModel(e.target.value)}>
          {liste.map((m) => <option key={m} value={m}>{m === "auto" ? CONSEILLES.auto : `${m} · ${CONSEILLES[m]}`}</option>)}
        </select>
        {msg && <div className={`note ${msg.k || ""}`}>{msg.t}</div>}
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" onClick={save} disabled={busy || key.trim().length < 10}>{busy ? "Vérification…" : "Vérifier et enregistrer"}</button>
        </div>
      </div>
      <CleSecours />
      <Notifications />
      <div className="card small">
        <b>Limites de l'offre gratuite</b>
        <ul style={{ marginBottom: 0 }}>
          <li>Transcription : environ 2 h d'audio par heure et 8 h par jour.</li>
          <li>Rédaction : quelques pauses d'une minute pendant la génération. Le site attend et reprend tout seul.</li>
          <li>Si la limite du jour est atteinte, ton travail reste sauvegardé : relance le lendemain, ou ajoute une clé de secours (OpenRouter par exemple) ci-dessus.</li>
        </ul>
      </div>
      <div className="card small">
        <div className="row">
          <span className="grow muted">Connecté : {email}</span>
          <button className="btn ghost" onClick={() => sb().auth.signOut()}>Se déconnecter</button>
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return <Shell><Reglages /></Shell>;
}
