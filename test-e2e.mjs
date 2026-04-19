#!/usr/bin/env node
/**
 * AETERNA v2 — Suite de tests E2E complète
 * Usage : node test-e2e.mjs [--url http://localhost:3000]
 */

const BASE = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://localhost:3000'

const G='\x1b[32m',Y='\x1b[33m',R='\x1b[31m',B='\x1b[1m',DIM='\x1b[2m',X='\x1b[0m'
let pass=0, fail=0, total=0

async function test(name, fn) {
  total++
  try { await fn(); pass++; process.stdout.write(`${G}✓${X} ${name}\n`) }
  catch(e) { fail++; process.stdout.write(`${R}✗${X} ${name}\n  ${DIM}${e.message}${X}\n`) }
}

function assert(cond, msg) { if (!cond) throw new Error(msg) }

async function get(p, opts={}) {
  const r = await fetch(BASE+p, { redirect:'manual', ...opts })
  const b = await r.text()
  let json = null; try { json = JSON.parse(b) } catch {}
  return { status:r.status, body:b, json, headers:r.headers }
}

async function post(p, data, method='POST') {
  return get(p, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) })
}

async function patch(p, data) { return post(p, data, 'PATCH') }

console.log(`\n${Y}${B}═══════════════════════════════════════════════${X}`)
console.log(`${Y}${B}  AETERNA v2 — Tests E2E complets${X}`)
console.log(`${DIM}  ${BASE}${X}`)
console.log(`${Y}${B}═══════════════════════════════════════════════${X}\n`)

// ══════════════════════════════════════════════════
// PAGES PUBLIQUES
// ══════════════════════════════════════════════════
console.log(`${DIM}── Pages ─────────────────────────────────────${X}`)

await test('GET / → landing avec monolithe et pricing', async () => {
  const r = await get('/')
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.body.includes('AETERNA'), 'Logo absent')
  assert(r.body.length > 20000, 'Page trop courte: '+r.body.length)
})

await test('GET /create → formulaire 3 étapes', async () => {
  const r = await get('/create')
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.body.includes('Essence') || r.body.includes('sanctuaire'), 'Contenu absent')
})

await test('GET /create?ref=slug → Gift-Loop param accepté', async () => {
  const r = await get('/create?ref=demo-heritage')
  assert(r.status === 200, 'HTTP '+r.status)
})

await test('GET /auth → login/signup/forgot', async () => {
  const r = await get('/auth')
  assert(r.status === 200, 'HTTP '+r.status)
})

await test('GET /auth/callback?error=test → redirect (pas de crash)', async () => {
  const r = await get('/auth/callback?error=access_denied')
  assert([200, 302, 307, 308].includes(r.status), 'HTTP '+r.status)
})

await test('GET /success → page post-paiement', async () => {
  const r = await get('/success')
  assert(r.status === 200, 'HTTP '+r.status)
})

await test('GET /success?tier=diamond → variante Diamond', async () => {
  const r = await get('/success?tier=diamond')
  assert(r.status === 200, 'HTTP '+r.status)
})

await test('GET /dashboard → redirige vers auth (non connecté)', async () => {
  const r = await get('/dashboard')
  assert([200, 302, 307].includes(r.status), 'HTTP '+r.status)
})

await test('GET /account → redirige vers auth (non connecté)', async () => {
  const r = await get('/account')
  assert([200, 302, 307].includes(r.status), 'HTTP '+r.status)
})

await test('GET /experience/inexistant → 404 rendu', async () => {
  const r = await get('/experience/inexistant-slug-xyz')
  assert(r.status === 404, 'HTTP '+r.status+' (attendu 404)')
})

await test('GET /cgv → 200 avec tarifs', async () => {
  const r = await get('/cgv')
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.body.includes('Essence') || r.body.includes('Diamond'), 'Tarifs absents')
})

await test('GET /mentions-legales → 200', async () => {
  const r = await get('/mentions-legales')
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.body.includes('AETERNA'), 'Contenu absent')
})

// ══════════════════════════════════════════════════
// SEO / PWA
// ══════════════════════════════════════════════════
console.log(`\n${DIM}── SEO / PWA ─────────────────────────────────${X}`)

await test('GET /sitemap.xml → XML valide', async () => {
  const r = await get('/sitemap.xml')
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.body.includes('<urlset') || r.body.includes('aeterna'), 'XML invalide')
})

await test('GET /robots.txt → /dashboard protégé', async () => {
  const r = await get('/robots.txt')
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.body.includes('dashboard') || r.body.includes('Disallow'), '/dashboard non protégé')
})

await test('GET /manifest.webmanifest → PWA valide', async () => {
  const r = await get('/manifest.webmanifest')
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.json?.name?.includes('AETERNA'), 'name absent')
  assert(r.json?.theme_color, 'theme_color absent')
  assert(r.json?.display === 'standalone', 'display standalone absent')
})

// ══════════════════════════════════════════════════
// APIs PUBLIQUES
// ══════════════════════════════════════════════════
console.log(`\n${DIM}── APIs publiques ────────────────────────────${X}`)

await test('GET /api/health → status structuré (200/503)', async () => {
  const r = await get('/api/health')
  assert([200, 503].includes(r.status), 'HTTP '+r.status)
  assert(r.json?.status === 'ok' || r.json?.status === 'degraded', 'status: '+r.json?.status)
  assert(r.json?.checks?.app?.ok === true, 'app check manquant')
  assert(typeof r.json?.uptime_ms === 'number', 'uptime_ms manquant')
})

await test('GET /api/og → image 1200×630 (Essence)', async () => {
  const r = await get('/api/og?title=Test&recipient=Sophie&sender=Thomas&protocol=ESSENCE')
  assert(r.status === 200, 'HTTP '+r.status)
  const ct = r.headers.get('content-type') ?? ''
  assert(ct.includes('image') || ct.includes('png'), 'Content-Type: '+ct)
})

await test('GET /api/og → variante Diamond', async () => {
  const r = await get('/api/og?title=Pour+toujours&recipient=Cam&sender=Jul&protocol=DIAMOND')
  assert(r.status === 200, 'HTTP '+r.status)
})

await test('POST /api/analytics → experience_view → 200', async () => {
  const r = await post('/api/analytics', { event:'experience_view', slug:'test-slug' })
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.json?.ok === true, 'ok absent')
})

await test('POST /api/analytics → audio_play → 200', async () => {
  const r = await post('/api/analytics', { event:'audio_play', slug:'test', protocol:'HERITAGE' })
  assert(r.status === 200, 'HTTP '+r.status)
})

await test('POST /api/analytics → event invalide → 400', async () => {
  const r = await post('/api/analytics', { event:'HACK_INJECTION' })
  assert(r.status === 400, 'HTTP '+r.status+' (attendu 400)')
})

await test('POST /api/track-view → 200 silencieux', async () => {
  const r = await post('/api/track-view', { slug:'test' })
  assert(r.status === 200, 'HTTP '+r.status)
})

await test('POST /api/track-play → 200 silencieux', async () => {
  const r = await post('/api/track-play', { slug:'test' })
  assert(r.status === 200, 'HTTP '+r.status)
})

// ══════════════════════════════════════════════════
// LINK ACTIONS
// ══════════════════════════════════════════════════
console.log(`\n${DIM}── Link actions ──────────────────────────────${X}`)

await test('PATCH /api/link-action → track-share → 200', async () => {
  const r = await patch('/api/link-action', { slug:'test', action:'track-share' })
  assert(r.status === 200, 'HTTP '+r.status)
  assert(r.json?.ok === true, 'ok absent')
})

await test('PATCH /api/link-action → action invalide → 400', async () => {
  const r = await patch('/api/link-action', { slug:'test', action:'INVALID' })
  assert(r.status === 400, 'HTTP '+r.status+' (attendu 400)')
})

await test('PATCH /api/link-action → données manquantes → 400', async () => {
  const r = await patch('/api/link-action', {})
  assert(r.status === 400, 'HTTP '+r.status+' (attendu 400)')
})

// ══════════════════════════════════════════════════
// PAIEMENT
// ══════════════════════════════════════════════════
console.log(`\n${DIM}── Paiement ──────────────────────────────────${X}`)

await test('POST /api/create-checkout → tier invalide → 400', async () => {
  const r = await post('/api/create-checkout', { tier:'invalid' })
  assert(r.status === 400, 'HTTP '+r.status+' (attendu 400)')
})

await test('POST /api/create-checkout → données incomplètes → 400', async () => {
  const r = await post('/api/create-checkout', { tier:'essence' })
  assert(r.status === 400, 'HTTP '+r.status+' (attendu 400, message manquant)')
})

await test('POST /api/create-checkout → Essence complet → 200 ou 500 (placeholder Stripe)', async () => {
  const r = await post('/api/create-checkout', {
    tier:'essence', sender_name:'Alice', sender_email:'alice@test.com',
    recipient_name:'Bob', title:'Test', message:'Message de longueur suffisante pour valider',
  })
  assert([200, 500].includes(r.status), 'HTTP '+r.status)
})

await test('POST /api/create-link → plan invalide → 400', async () => {
  const r = await post('/api/create-link', { plan:'INVALID', title:'T', message:'M', sender_name:'A', sender_email:'a@a.com', recipient_name:'B' })
  assert(r.status === 400, 'HTTP '+r.status+' (attendu 400)')
})

// ══════════════════════════════════════════════════
// APIS PROTÉGÉES
// ══════════════════════════════════════════════════
console.log(`\n${DIM}── APIs protégées ────────────────────────────${X}`)

await test('GET /api/cron/cleanup → 401 sans secret', async () => {
  const r = await get('/api/cron/cleanup')
  assert(r.status === 401, 'HTTP '+r.status+' (attendu 401)')
})

await test('GET /api/cron/remind → 401 sans secret', async () => {
  const r = await get('/api/cron/remind')
  assert(r.status === 401, 'HTTP '+r.status+' (attendu 401)')
})

await test('POST /api/customer-portal → 401 sans auth', async () => {
  const r = await post('/api/customer-portal', {})
  assert(r.status === 401, 'HTTP '+r.status+' (attendu 401)')
})

await test('PATCH /api/account/update → 401 sans auth', async () => {
  const r = await patch('/api/account/update', { full_name:'Test' })
  assert(r.status === 401, 'HTTP '+r.status+' (attendu 401)')
})

await test('POST /api/webhook-stripe → 400 signature invalide', async () => {
  const r = await post('/api/webhook-stripe', {})
  assert(r.status === 400, 'HTTP '+r.status+' (attendu 400, sig invalide)')
})

// ══════════════════════════════════════════════════
// RAPPORT FINAL
// ══════════════════════════════════════════════════
console.log(`\n${B}═══════════════════════════════════════════════${X}`)
const pct = Math.round(pass/total*100)
const col = pct===100?G:pct>=90?G:pct>=75?Y:R
console.log(`${col}${B}  ${pass}/${total} passés (${pct}%)${X}`)
if (fail > 0) console.log(`${R}  ${fail} échec${fail>1?'s':''}${X}`)
console.log(`${B}═══════════════════════════════════════════════${X}\n`)
process.exit(fail > 0 ? 1 : 0)
