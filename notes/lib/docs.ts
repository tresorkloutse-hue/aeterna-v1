"use client";

/** Charge une bibliothèque UMD depuis un CDN (une seule fois). */
function charger(src: string, globalName: string): Promise<any> {
  const w = window as any;
  if (w[globalName]) return Promise.resolve(w[globalName]);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => (w[globalName] ? res(w[globalName]) : rej(new Error(`Lecteur ${globalName} indisponible.`)));
    s.onerror = () => rej(new Error("Chargement du lecteur de documents impossible (connexion ?)."));
    document.head.appendChild(s);
  });
}

/** Découpe un long texte en parties d'environ max caractères, aux fins de paragraphe. */
export function enParties(text: string, max = 4000): string[] {
  const paras = text.replace(/\r/g, "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length > max) { out.push(cur); cur = ""; }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur) out.push(cur);
  return out;
}

/** Texte d'un document Word (.docx). */
export async function texteDocx(file: File): Promise<string> {
  const mammoth = await charger("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js", "mammoth");
  const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return String(r.value || "").trim();
}

/** Texte de chaque diapositive d'un PowerPoint (.pptx), dans l'ordre. */
export async function diapositivesPptx(file: File): Promise<string[]> {
  const JSZip = await charger("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js", "JSZip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const noms = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const out: string[] = [];
  for (const n of noms) {
    const xml: string = await zip.file(n).async("string");
    const paras = xml.split(/<\/a:p>/).map((p) =>
      Array.from(p.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map((m) => m[1]).join("")
    );
    const txt = paras.map((p) => p.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim()).filter(Boolean).join("\n");
    out.push(txt);
  }
  return out;
}
