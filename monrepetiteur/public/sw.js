// Cache de l'application : elle s'ouvre même avec une connexion faible.
// Les appels au répétiteur et à la base ne sont jamais mis en cache.
const CACHE = "monrepetiteur-v2";
const COQUILLE = ["./", "./index.html", "./manifest.webmanifest", "./icone.svg"];
const MAX_ENTREES = 60; // le cache reste borné : sans cela il grossit à chaque déploiement

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))));
  self.clients.claim();
});

// Garde les entrées les plus récentes, dans l'ordre où elles ont été ajoutées.
async function elaguer(cache) {
  const cles = await cache.keys();
  const trop = cles.length - MAX_ENTREES;
  for (let i = 0; i < trop; i++) {
    if (!COQUILLE.some((c) => cles[i].url.endsWith(c.replace("./", "")))) await cache.delete(cles[i]);
  }
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        if (rep.ok) {
          const copie = rep.clone();
          caches.open(CACHE).then(async (c) => { await c.put(e.request, copie); await elaguer(c); });
        }
        return rep;
      })
      .catch(async () => {
        const garde = await caches.match(e.request);
        if (garde) return garde;
        // Le secours index.html ne vaut que pour une navigation : renvoyé à la place
        // d'un fichier JavaScript, il casserait la page en silence.
        if (e.request.mode === "navigate") {
          const coquille = await caches.match("./index.html");
          if (coquille) return coquille;
        }
        return new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      })
  );
});
