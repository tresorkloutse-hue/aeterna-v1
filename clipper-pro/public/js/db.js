// Stockage local (IndexedDB). Version 2 : ajoute la table des films et migre les données de la version précédente.
const DB_NAME = 'clipper', DB_VERSION = 2;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    let done = false;
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const st of ['kv', 'blobs', 'films']) if (!d.objectStoreNames.contains(st)) d.createObjectStore(st);
      if (!d.objectStoreNames.contains('clips')) d.createObjectStore('clips', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'fp' });
    };
    r.onsuccess = () => { done = true; const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; res(d); };
    r.onerror = () => rej(r.error);
    // Un ancien onglet du site garde la base ouverte : on prévient, et l'ouverture reprend dès qu'il est fermé.
    r.onblocked = () => { setTimeout(() => { if (done) return; rej(new Error('mémoire bloquée par un autre onglet')); }, 5000); try { const t = document.getElementById('toast'); if (t) { t.textContent = 'Un autre onglet de Clipper Pro est ouvert avec une ancienne version : ferme-le, puis actualise cette page.'; t.hidden = false; } } catch (e) {} };
  });
  dbp.catch(() => {});
  return dbp;
}

export async function tx(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), r = fn(t.objectStore(store));
    t.oncomplete = () => res(r && r.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transaction annulée'));
  });
}

export const kv = {
  get: k => tx('kv', 'readonly', s => s.get(k)).catch(() => undefined),
  set: (k, v) => tx('kv', 'readwrite', s => s.put(v, k)),
  del: k => tx('kv', 'readwrite', s => s.delete(k)),
};
export const clipsDb = {
  all: () => tx('clips', 'readonly', s => s.getAll()),
  put: c => tx('clips', 'readwrite', s => s.put(c)),
  del: id => tx('clips', 'readwrite', s => s.delete(id)),
};
export const blobs = {
  get: id => tx('blobs', 'readonly', s => s.get(id)),
  put: (id, b) => tx('blobs', 'readwrite', s => s.put(b, id)),
  del: id => tx('blobs', 'readwrite', s => s.delete(id)),
};
export const films = {
  get: fp => tx('films', 'readonly', s => s.get(fp)),
  put: (fp, v) => tx('films', 'readwrite', s => s.put(v, fp)),
  del: fp => tx('films', 'readwrite', s => s.delete(fp)),
  keys: () => tx('films', 'readonly', s => s.getAllKeys()),
};
export const meta = {
  all: () => tx('meta', 'readonly', s => s.getAll()),
  get: fp => tx('meta', 'readonly', s => s.get(fp)),
  put: m => tx('meta', 'readwrite', s => s.put(m)),
  del: fp => tx('meta', 'readwrite', s => s.delete(fp)),
};

export async function clearAll() {
  for (const st of ['kv', 'clips', 'blobs', 'films', 'meta']) await tx(st, 'readwrite', s => s.clear());
}

// Reprend les données de l'ancienne version du site (un seul film, analyse « a:<empreinte> »).
export async function migrate() {
  if (await kv.get('migrated2')) return;
  try {
    const keys = await films.keys();
    for (const fp of keys) {
      if (await meta.get(fp)) continue;
      const f = await films.get(fp);
      await meta.put({ fp, name: (f && f.name) || String(fp).split('|')[0], size: +String(fp).split('|')[1] || 0, added: Date.now(), lastOpen: Date.now(), stored: !!(f && f.blob) });
    }
    const last = await kv.get('last');
    if (last && !(await meta.get(last))) await meta.put({ fp: last, name: String(last).split('|')[0], size: +String(last).split('|')[1] || 0, added: Date.now(), lastOpen: Date.now(), stored: false });
    if (last) {
      const old = await kv.get('a:' + last);
      if (old && old.data && !(await kv.get('f2:' + last))) {
        await kv.set('f2:' + last, { A: Float32Array.from(old.data.A), M: Float32Array.from(old.data.M), has: !!old.data.has, method: 'play', flags: {}, subs: {}, tracks: {}, notes: {} });
      }
    }
  } catch (e) { /* migration best effort */ }
  await kv.set('migrated2', true);
}

export async function storageInfo() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const e = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return { usage: e.usage || 0, quota: e.quota || 1, persisted };
}
export function askPersist() { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {} }
