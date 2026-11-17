"use client";
import { useEffect, useRef, useState } from "react";
import { sb } from "@/lib/supabase";
import { lireImage, supprimerVisuel, transcrireBlob } from "@/lib/transfert";
import { dataUrlToBlob, fmtDuree, imageToDataUrl, pickMime } from "@/lib/media";

const SEGMENT_S = 600; // un fichier audio toutes les 10 minutes
const CAPTURE_S = 15; // vérification de l'écran partagé toutes les 15 s

type Item = { blob: Blob; position: number; label: string; ext: string };
type Mode = "salle" | "visio";

export default function Recorder({ courseId, onAdded }: { courseId: string; onAdded: () => void }) {
  const [mode, setMode] = useState<Mode>("salle");
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState("");
  const [withMic, setWithMic] = useState(false);
  const [autoSlides, setAutoSlides] = useState(true);
  const [rec, setRec] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [queue, setQueue] = useState(0);
  const [slides, setSlides] = useState(0);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");
  const [photoBusy, setPhotoBusy] = useState(0);
  const [level, setLevel] = useState(0);
  const [bloque, setBloque] = useState("");

  const streams = useRef<MediaStream[]>([]);
  const mixed = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<any>(null);
  const segStart = useRef(0);
  const segIndex = useRef(0);
  const started = useRef(0);
  const pending = useRef<Item[]>([]);
  const working = useRef(false);
  const wake = useRef<any>(null);
  const mime = useRef(pickMime());
  const video = useRef<HTMLVideoElement | null>(null);
  const lastThumb = useRef<Float32Array | null>(null);
  const lastCapture = useRef(0);
  const ocrQueue = useRef<{ image: string; position: number; essais?: number }[]>([]);
  const echecs = useRef(0);
  const ocrWorking = useRef(false);

  async function listMics() {
    try {
      const d = (await navigator.mediaDevices.enumerateDevices()).filter((x) => x.kind === "audioinput");
      setMics(d);
    } catch {}
  }

  useEffect(() => {
    listMics();
    navigator.mediaDevices?.addEventListener?.("devicechange", listMics);
    const warn = (e: BeforeUnloadEvent) => {
      if (recorder.current || pending.current.length || ocrQueue.current.length) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    const vis = () => { if (document.visibilityState === "visible" && recorder.current) lockScreen(); };
    document.addEventListener("visibilitychange", vis);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", listMics);
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  async function lockScreen() {
    try { wake.current = await (navigator as any).wakeLock?.request("screen"); } catch {}
  }

  /* ---------- File d'attente de transcription ---------- */
  // L'audio passe par le stockage (pas par le serveur du site). En cas d'échec, on réessaie
  // de plus en plus espacé ; une erreur définitive (clé, limite du jour) met la file en pause.
  const PERMANENT = /Limite journalière|Clé Groq|Session|clé/i;
  async function processQueue() {
    if (working.current) return;
    working.current = true;
    try {
      while (pending.current.length) {
        const it = pending.current[0];
        setQueue(pending.current.length);
        try {
          setStatus(`Transcription de « ${it.label} »…`);
          const texte = await transcrireBlob(it.blob, `segment.${it.ext}`, (s) => setStatus(`Pause imposée par l'offre gratuite : reprise dans ${s} s`));
          const { error } = await sb().from("notes_segments").insert({ course_id: courseId, kind: "audio", position: it.position, label: it.label, content: texte });
          if (error) throw error;
          pending.current.shift();
          echecs.current = 0;
          onAdded();
        } catch (e: any) {
          const m = String(e?.message || e);
          echecs.current += 1;
          if (PERMANENT.test(m) || echecs.current >= 6) {
            setBloque(`Transcription en pause : ${m}. L'audio est gardé dans cette page : corrige le problème puis clique sur « Réessayer » (ne ferme pas l'onglet).`);
            return;
          }
          const attente = Math.min(15 * 2 ** (echecs.current - 1), 600);
          for (let s = attente; s > 0; s--) {
            setStatus(`Envoi en attente (${m}). Nouvel essai dans ${s} s, garde la page ouverte.`);
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }
      setStatus("");
    } finally {
      setQueue(pending.current.length);
      working.current = false;
    }
  }

  function reessayer() {
    setBloque("");
    echecs.current = 0;
    processQueue();
  }

  /* ---------- Lecture des slides capturées ---------- */
  async function processOcr() {
    if (ocrWorking.current) return;
    ocrWorking.current = true;
    try {
      while (ocrQueue.current.length) {
        const it = ocrQueue.current[0];
        try {
          const { text, path } = await lireImage(dataUrlToBlob(it.image), () => {}, courseId);
          const t = text.trim();
          if (t && !/^\[rien de lisible\]$/i.test(t)) {
            await sb().from("notes_segments").insert({
              course_id: courseId, kind: "photo", position: it.position, image_path: path,
              label: `Slide capturée à ${new Date(it.position * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
              content: t,
            });
            setSlides((n) => n + 1);
            onAdded();
          } else {
            await supprimerVisuel(path);
          }
          ocrQueue.current.shift();
        } catch (e: any) {
          it.essais = (it.essais || 0) + 1;
          // Une capture qui échoue 3 fois est abandonnée (l'audio du cours, lui, n'est jamais abandonné)
          if (it.essais >= 3 || PERMANENT.test(String(e?.message || e))) ocrQueue.current.shift();
          else await new Promise((r) => setTimeout(r, 30000 * (it.essais || 1)));
        }
      }
    } finally {
      ocrWorking.current = false;
    }
  }

  function captureScreen(force = false) {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const small = document.createElement("canvas");
    small.width = 64; small.height = 36;
    const sc = small.getContext("2d", { willReadFrequently: true })!;
    sc.drawImage(v, 0, 0, 64, 36);
    const px = sc.getImageData(0, 0, 64, 36).data;
    const g = new Float32Array(64 * 36);
    for (let i = 0; i < g.length; i++) g[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3;
    let diff = 255;
    if (lastThumb.current) {
      let s = 0;
      for (let i = 0; i < g.length; i++) s += Math.abs(g[i] - lastThumb.current[i]);
      diff = s / g.length;
    }
    if (!force && diff < 6) return;
    lastThumb.current = g;
    lastCapture.current = Date.now();
    const scale = Math.min(1, 1600 / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    ocrQueue.current.push({ image: c.toDataURL("image/jpeg", 0.8), position: Date.now() / 1000 });
    processOcr();
  }

  /* ---------- Enregistrement ---------- */
  function startSegment() {
    const s = mixed.current!;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(s, { ...(mime.current.mime ? { mimeType: mime.current.mime } : {}), audioBitsPerSecond: 32000 });
    segStart.current = Date.now() / 1000;
    segIndex.current += 1;
    const label = `Enregistrement, partie ${segIndex.current}`;
    const position = segStart.current;
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      const blob = new Blob(chunks, { type: r.mimeType || mime.current.mime || "audio/webm" });
      if (blob.size > 2000) {
        pending.current.push({ blob, position, label, ext: mime.current.ext });
        setQueue(pending.current.length);
        processQueue();
      }
    };
    r.start(5000);
    recorder.current = r;
  }

  async function getMic() {
    return navigator.mediaDevices.getUserMedia({
      audio: { ...(micId ? { deviceId: { exact: micId } } : {}), echoCancellation: false, noiseSuppression: true, autoGainControl: true },
    });
  }

  async function start() {
    setErr("");
    setSlides(0);
    const ctx = new AudioContext();
    audioCtx.current = ctx;
    const dest = ctx.createMediaStreamDestination();
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    analyser.current = an;
    streams.current = [];
    try {
      if (mode === "visio") {
        const disp = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 2 }, audio: true } as any);
        streams.current.push(disp);
        if (!disp.getAudioTracks().length) {
          disp.getTracks().forEach((t) => t.stop());
          throw new Error("Le son n'est pas partagé. Recommence et coche « Partager l'audio » (sur Chrome, partage l'onglet de la visio ou l'écran entier).");
        }
        ctx.createMediaStreamSource(new MediaStream(disp.getAudioTracks())).connect(dest);
        ctx.createMediaStreamSource(new MediaStream(disp.getAudioTracks())).connect(an);
        disp.getVideoTracks()[0]?.addEventListener("ended", () => stop());
        if (autoSlides && disp.getVideoTracks().length) {
          const v = document.createElement("video");
          v.muted = true;
          v.playsInline = true;
          v.srcObject = new MediaStream(disp.getVideoTracks());
          await v.play().catch(() => {});
          video.current = v;
          lastThumb.current = null;
        } else {
          disp.getVideoTracks().forEach((t) => t.stop());
        }
        if (withMic) {
          const mic = await getMic();
          streams.current.push(mic);
          ctx.createMediaStreamSource(mic).connect(dest);
        }
      } else {
        const mic = await getMic();
        streams.current.push(mic);
        const src = ctx.createMediaStreamSource(mic);
        src.connect(dest);
        src.connect(an);
        listMics();
      }
    } catch (e: any) {
      streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      ctx.close();
      const m = String(e?.message || e);
      setErr(/NotAllowed|Permission|denied/i.test(m)
        ? (mode === "visio" ? "Partage annulé ou refusé." : "Micro inaccessible : autorise le micro pour ce site (icône à gauche de l'adresse).")
        : m);
      return;
    }
    mixed.current = dest.stream;
    started.current = Date.now();
    segIndex.current = 0;
    startSegment();
    lockScreen();
    setRec(true);
    const buf = new Uint8Array(an.fftSize);
    timer.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started.current) / 1000));
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (const b of buf) peak = Math.max(peak, Math.abs(b - 128));
      setLevel(Math.min(1, peak / 64));
      if (recorder.current && Date.now() / 1000 - segStart.current >= SEGMENT_S) {
        recorder.current.stop();
        startSegment();
      }
      if (video.current && Date.now() - lastCapture.current >= CAPTURE_S * 1000) {
        lastCapture.current = Date.now();
        captureScreen();
      }
    }, 1000);
  }

  function stop() {
    clearInterval(timer.current);
    recorder.current?.stop();
    recorder.current = null;
    streams.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streams.current = [];
    if (video.current) { video.current.srcObject = null; video.current = null; }
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    try { wake.current?.release(); } catch {}
    setRec(false);
    setLevel(0);
  }

  async function photos(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setPhotoBusy((n) => n + list.length);
    for (const f of list) {
      try {
        const image = await imageToDataUrl(f);
        const { text, path: image_path } = await lireImage(dataUrlToBlob(image), (s) => setStatus(`Lecture de l'image : pause de ${s} s`), courseId);
        await sb().from("notes_segments").insert({ course_id: courseId, kind: "photo", position: (f.lastModified || Date.now()) / 1000, label: f.name || "Image", content: text, image_path });
        onAdded();
      } catch (e: any) {
        setErr(`Image non lue : ${e.message || e}`);
      } finally {
        setPhotoBusy((n) => n - 1);
      }
    }
    setStatus("");
  }

  return (
    <div className="card">
      {!rec ? (
        <>
          <b>Enregistrer le cours depuis l'ordinateur</b>
          <div className="seg-choice">
            <button className={mode === "salle" ? "on" : ""} onClick={() => setMode("salle")}>
              <b>🎙️ Cours en salle</b>
              <span>Le micro de l'ordinateur capte le prof</span>
            </button>
            <button className={mode === "visio" ? "on" : ""} onClick={() => setMode("visio")}>
              <b>💻 Cours en visio</b>
              <span>Teams, Zoom… : le son de l'ordinateur et les slides partagées</span>
            </button>
          </div>
          {mode === "salle" ? (
            <>
              <label>Micro</label>
              <select value={micId} onChange={(e) => setMicId(e.target.value)}>
                <option value="">Micro par défaut</option>
                {mics.filter((m) => m.deviceId && m.deviceId !== "default").map((m, i) => <option key={m.deviceId} value={m.deviceId}>{m.label || `Micro ${i + 1}`}</option>)}
              </select>
              <p className="small muted">Place l'ordinateur au plus près du prof. Un micro externe ou un casque-micro posé devant améliore beaucoup la transcription.</p>
            </>
          ) : (
            <>
              <p className="small muted" style={{ marginBottom: 6 }}>
                Au clic, choisis l'onglet ou la fenêtre de la visio (ou l'écran entier) et <b>coche « Partager l'audio »</b>. Fonctionne le mieux avec Chrome ou Edge. Sur Mac, partage un onglet Chrome : la visio doit donc être ouverte dans le navigateur.
              </p>
              <label className="check"><input type="checkbox" checked={autoSlides} onChange={(e) => setAutoSlides(e.target.checked)} /> Capturer automatiquement les slides quand elles changent</label>
              <label className="check"><input type="checkbox" checked={withMic} onChange={(e) => setWithMic(e.target.checked)} /> Inclure aussi mon micro (si je prends la parole)</label>
            </>
          )}
          <button className="btn big rec" style={{ marginTop: 14 }} onClick={start}>● Démarrer l'enregistrement</button>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Garde cet onglet ouvert et l'ordinateur branché, sans mise en veille. L'audio est transcrit toutes les 10 minutes pendant le cours. Pense à demander l'accord du professeur.
          </p>
        </>
      ) : (
        <div className="recbox">
          <div><span className="dot" />Enregistrement en cours{mode === "visio" ? " (visio)" : ""}</div>
          <div className="time">{fmtDuree(elapsed)}</div>
          <div className="meter" title="Niveau sonore"><div style={{ width: `${Math.round(level * 100)}%` }} /></div>
          {level < 0.03 && elapsed > 5 && <div className="small muted">Aucun son détecté pour l'instant.</div>}
          {mode === "visio" && autoSlides && (
            <div className="small muted">
              {slides} slide(s) capturée(s).{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); captureScreen(true); }}>Capturer maintenant</a>
            </div>
          )}
          <button className="btn big" style={{ marginTop: 12 }} onClick={stop}>■ Arrêter</button>
        </div>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <label className="btn ghost" style={{ margin: 0 }}>
          🖼️ Ajouter des captures ou photos
          <input type="file" accept="image/*" multiple style={{ position: "absolute", width: 1, height: 1, opacity: 0, overflow: "hidden" }} onChange={(e) => { photos(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {(queue > 0 || photoBusy > 0 || status) && (
        <div className="note small">
          {queue > 0 && <div>{queue} partie(s) audio en attente de transcription.</div>}
          {photoBusy > 0 && <div>{photoBusy} image(s) en cours de lecture.</div>}
          {status && <div>{status}</div>}
        </div>
      )}
      {bloque && (
        <div className="note bad small">
          {bloque} <button className="btn ghost small" style={{ padding: "2px 8px", marginLeft: 6 }} onClick={reessayer}>Réessayer</button>
        </div>
      )}
      {err && <div className="note bad small">{err}</div>}
    </div>
  );
}
