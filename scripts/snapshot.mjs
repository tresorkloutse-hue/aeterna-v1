// Copie un site statique en ligne (fichiers déjà construits) dans un dossier local.
// Usage : node scripts/snapshot.mjs <url> <dossier> [chemins de départ...]
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const [base, dest, ...graines] = process.argv.slice(2);
const origine = new URL(base).origin;
const vus = new Set();
const file = ["/", ...graines];
const TEXTE = /\.(html?|js|mjs|css|json|webmanifest|svg|txt)$/i;
let erreurs = 0;

function liens(texte, depuis) {
  const out = new Set();
  const re = /(?:src|href|content)\s*=\s*["']([^"'#?]+)|url\(\s*["']?([^"')#?]+)|["'`](\/?(?:\.\/)?[\w@\-./]+\.(?:js|mjs|css|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|json|webmanifest|wasm|onnx|mp3|m4a|txt))["'`]/gi;
  let m;
  while ((m = re.exec(texte))) {
    const brut = m[1] || m[2] || m[3];
    if (!brut || /^(data:|blob:|mailto:|javascript:)/.test(brut)) continue;
    try {
      const u = new URL(brut, origine + depuis);
      if (u.origin === origine) out.add(u.pathname);
    } catch {}
  }
  // Morceaux Vite cités sans barre de début : "assets/x.js"
  for (const a of texte.matchAll(/["'`](assets\/[\w\-.]+)["'`]/g)) out.add("/" + a[1]);
  return out;
}

while (file.length) {
  const chemin = file.shift();
  if (vus.has(chemin)) continue;
  vus.add(chemin);
  const res = await fetch(origine + chemin, { redirect: "follow" });
  if (!res.ok) { console.log("absent", res.status, chemin); if (chemin !== "/") erreurs += chemin.startsWith("/assets/") ? 1 : 0; continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") || "";
  const nom = chemin.endsWith("/") ? chemin + "index.html" : chemin;
  // Une route inconnue d'une appli monopage renvoie index.html : on ne la copie pas
  if (chemin !== "/" && !/\.\w+$/.test(nom) && type.includes("text/html")) continue;
  const cible = join(dest, nom);
  await mkdir(dirname(cible), { recursive: true });
  await writeFile(cible, buf);
  console.log("ok", chemin, buf.length);
  if (TEXTE.test(nom) || type.includes("text") || type.includes("javascript") || type.includes("json")) {
    const dossier = nom.slice(0, nom.lastIndexOf("/") + 1);
    for (const l of liens(buf.toString("utf8"), dossier)) if (!vus.has(l)) file.push(l);
  }
}
console.log(`${vus.size} chemins visités`);
if (erreurs) { console.error(`${erreurs} fichiers d'assets manquants`); process.exit(1); }
