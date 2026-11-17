"use client";

/** Import dynamique d'un module ESM depuis un CDN, hors du bundler. */
const importUrl = new Function("u", "return import(u)") as (u: string) => Promise<any>;

/* ---------- Images : réduction avant envoi ---------- */
export async function imageToDataUrl(file: File, max = 1600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

/* ---------- PDF : extraction du texte page par page ---------- */
/** Pages d'un PDF : texte + image de la page (pour l'afficher dans le cours). */
export async function pdfPages(file: File, maxPages = 80): Promise<{ text: string; image: Blob | null }[]> {
  const v = "4.10.38";
  const pdfjs = await importUrl(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const out: { text: string; image: Blob | null }[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    const text = tc.items.map((it: any) => it.str + (it.hasEOL ? "\n" : " ")).join("").trim();
    let image: Blob | null = null;
    try {
      const vp0 = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: Math.min(2, 1280 / vp0.width) });
      const c = document.createElement("canvas");
      c.width = Math.round(vp.width);
      c.height = Math.round(vp.height);
      await p.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      image = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.8));
    } catch {}
    out.push({ text, image });
  }
  return out;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: head.match(/data:([^;]+)/)?.[1] || "image/jpeg" });
}

export async function pdfToText(file: File): Promise<string[]> {
  const v = "4.10.38";
  const pdfjs = await importUrl(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    pages.push(tc.items.map((it: any) => it.str + (it.hasEOL ? "\n" : " ")).join("").trim());
  }
  return pages;
}

/* ---------- Audio / vidéo importés : découpe en morceaux de 10 min ---------- */
let ffmpegPromise: Promise<any> | null = null;

async function blobUrl(url: string, type: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Téléchargement du convertisseur impossible.");
  return URL.createObjectURL(new Blob([await r.arrayBuffer()], { type }));
}

function loadScript(src: string) {
  return new Promise<void>((res, rej) => {
    if ((window as any).FFmpegWASM) return res();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error("Chargement du convertisseur impossible."));
    document.head.appendChild(s);
  });
}

async function getFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      // Hébergé sur le site : son worker doit être sur la même origine (worker classique).
      await loadScript("/ffmpeg/ffmpeg.js");
      const ff = new (window as any).FFmpegWASM.FFmpeg();
      const base = (window as any).__FFMPEG_CORE__ || "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
      await ff.load({
        coreURL: await blobUrl(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await blobUrl(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ff;
    })().catch((e) => {
      ffmpegPromise = null;
      throw e;
    });
  }
  return ffmpegPromise;
}

/**
 * Convertit un fichier audio ou vidéo en morceaux MP3 mono de 10 minutes (environ 2,4 Mo chacun),
 * assez petits pour la transcription gratuite.
 */
export async function splitMedia(file: File, onProgress: (msg: string) => void): Promise<File[]> {
  onProgress("Chargement du convertisseur (une seule fois, ~30 Mo)…");
  const ff = await getFfmpeg();
  const progress = ({ progress }: { progress: number }) => {
    if (progress > 0 && progress <= 1) onProgress(`Extraction de l'audio : ${Math.round(progress * 100)} %`);
  };
  ff.on("progress", progress);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const input = `entree.${ext}`;
  try {
    onProgress("Lecture du fichier…");
    await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    const code = await ff.exec([
      "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k",
      "-f", "segment", "-segment_time", "600", "-reset_timestamps", "1", "morceau%03d.mp3",
    ]);
    if (code !== 0) throw new Error("Conversion impossible : le fichier ne contient peut-être pas de piste audio.");
    const list = (await ff.listDir("/")).map((e: any) => e.name as string).filter((n: string) => /^morceau\d+\.mp3$/.test(n)).sort();
    const out: File[] = [];
    for (const n of list) {
      const data = await ff.readFile(n);
      out.push(new File([data], n, { type: "audio/mpeg" }));
      await ff.deleteFile(n);
    }
    return out;
  } finally {
    ff.off("progress", progress);
    try { await ff.deleteFile(input); } catch {}
  }
}

/* ---------- Enregistrement en classe ---------- */
export function pickMime(): { mime: string; ext: string } {
  const opts = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
    { mime: "audio/webm", ext: "webm" },
  ];
  for (const o of opts) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(o.mime)) return o;
  return { mime: "", ext: "webm" };
}

export function fmtDuree(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return `${h ? h + ":" : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(ss).padStart(2, "0")}`;
}
