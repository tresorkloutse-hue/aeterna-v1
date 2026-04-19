#!/usr/bin/env node
/**
 * AETERNA v2 — Script de déploiement interactif
 * Usage : node setup.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { execSync, spawnSync }                     from 'child_process'
import { createInterface }                          from 'readline'
import { randomBytes, createHash }                  from 'crypto'

const rl  = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q, d = '') => new Promise(r => rl.question(d ? `${q} [${d}] ` : q, a => r(a.trim() || d)))

const G='\x1b[32m',Y='\x1b[33m',R='\x1b[31m',B='\x1b[1m',DIM='\x1b[2m',X='\x1b[0m'
const ok  = m => console.log(`${G}✓${X} ${m}`)
const inf = m => console.log(`${Y}◈${X} ${m}`)
const err = m => console.log(`${R}✗${X} ${m}`)
const sep = () => console.log(`${DIM}${'─'.repeat(44)}${X}`)

const gen32 = () => randomBytes(32).toString('hex')

console.log(`\n${Y}${B}
  ╔══════════════════════════════════════════╗
  ║       AETERNA v2 — Setup & Deploy        ║
  ║       Liens Trophées · Luxe Immatériel   ║
  ╚══════════════════════════════════════════╝
${X}`)

async function main() {

  // ─── Mode ───────────────────────────────────────────────────
  const mode = await ask(`Mode ? (${G}demo${X}/${Y}production${X}) `, 'demo')
  const isDev = mode !== 'production'

  if (isDev) {
    inf('Mode DÉMO — génération de .env.local minimal...\n')
    const adminSecret = gen32()
    const cronSecret  = gen32()

    writeFileSync('.env.local', `# AETERNA v2 — Démo — ${new Date().toISOString()}
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder
SUPABASE_SERVICE_ROLE_KEY=placeholder
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_placeholder
STRIPE_SECRET_KEY=sk_test_placeholder
STRIPE_WEBHOOK_SECRET=whsec_placeholder
STRIPE_PRICE_ESSENCE=price_placeholder
STRIPE_PRICE_HERITAGE=price_placeholder
STRIPE_PRICE_DIAMOND=price_placeholder
RESEND_API_KEY=re_placeholder
RESEND_FROM=sanctuaire@aeterna.co
ADMIN_SECRET=${adminSecret}
CRON_SECRET=${cronSecret}
NEXT_PUBLIC_BASE_URL=http://localhost:3000
`)
    ok('.env.local créé (mode démo)')
    console.log(`\n${B}Démarrage :${X}`)
    console.log(`  npm install && npm run dev`)
    console.log(`\n${B}Pages disponibles :${X}`)
    console.log(`  http://localhost:3000`)
    console.log(`  http://localhost:3000/create`)
    console.log(`  http://localhost:3000/auth`)
    console.log(`\n${B}Tests :${X}`)
    console.log(`  npm run dev &`)
    console.log(`  node test-e2e.mjs\n`)
    rl.close(); return
  }

  // ─── Production ─────────────────────────────────────────────
  console.log(`\n${Y}${B}Configuration production${X}\n`)
  inf('Préparez vos comptes : supabase.com · stripe.com · resend.com · vercel.com\n')

  sep(); console.log(`${Y}Supabase${X}`)
  const supaUrl  = await ask('URL projet (https://xxx.supabase.co) : ')
  const supaAnon = await ask('Clé anon publique                    : ')
  const supaServ = await ask('Clé service_role                     : ')

  sep(); console.log(`${Y}Stripe${X}`)
  const stripePk  = await ask('Publishable Key (pk_live_...) : ')
  const stripeSk  = await ask('Secret Key (sk_live_...)      : ')
  const stripeWh  = await ask('Webhook Secret (whsec_...)    : ')
  const priceEss  = await ask('Price ID Essence (19€)  : ', 'price_1TNOQ969oaV5B5FFFklvT6f2')
  const priceHer  = await ask('Price ID Heritage (49€) : ', 'price_1TNOYB69oaV5B5FFNlk8-PRlQ')
  const priceDia  = await ask('Price ID Diamond (9€)   : ', 'price_1TNOdR69oaV5B5FFkEzNh-Mtp')

  sep(); console.log(`${Y}Resend${X}`)
  const resendKey  = await ask('API Key (re_...)           : ')
  const resendFrom = await ask('Email expéditeur           : ', 'sanctuaire@aeterna.co')

  sep(); console.log(`${Y}Application${X}`)
  const baseUrl = await ask('URL de production : ', 'https://aeterna.co')

  // Secrets auto-générés
  const adminSecret = gen32()
  const cronSecret  = gen32()
  ok(`ADMIN_SECRET généré : ${adminSecret.slice(0,12)}...`)
  ok(`CRON_SECRET  généré : ${cronSecret.slice(0,12)}...`)

  // ─── Écriture .env.local ─────────────────────────────────────
  const envContent = `# AETERNA v2 — Production — ${new Date().toISOString()}
# NE PAS COMMITER CE FICHIER

NEXT_PUBLIC_SUPABASE_URL=${supaUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supaAnon}
SUPABASE_SERVICE_ROLE_KEY=${supaServ}

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${stripePk}
STRIPE_SECRET_KEY=${stripeSk}
STRIPE_WEBHOOK_SECRET=${stripeWh}
STRIPE_PRICE_ESSENCE=${priceEss}
STRIPE_PRICE_HERITAGE=${priceHer}
STRIPE_PRICE_DIAMOND=${priceDia}

RESEND_API_KEY=${resendKey}
RESEND_FROM=${resendFrom}

ADMIN_SECRET=${adminSecret}
CRON_SECRET=${cronSecret}

NEXT_PUBLIC_BASE_URL=${baseUrl}
`
  writeFileSync('.env.local', envContent)
  ok('.env.local créé\n')

  // ─── Test connexion Supabase ──────────────────────────────────
  inf('Test de connexion Supabase...')
  try {
    const r = await fetch(`${supaUrl}/rest/v1/links?select=id&limit=1`, {
      headers: { apikey: supaAnon, Authorization: `Bearer ${supaAnon}` }
    })
    if (r.ok || r.status === 406) {
      ok('Supabase joignable')
    } else if (r.status === 404) {
      err('Table "links" introuvable — exécutez db/schema.sql d\'abord')
    } else {
      err(`Supabase → HTTP ${r.status}`)
    }
  } catch {
    err('Supabase inaccessible — vérifiez l\'URL')
  }

  // ─── SQL ─────────────────────────────────────────────────────
  sep()
  console.log(`${Y}${B}Base de données Supabase${X}`)
  console.log(`  Ouvrez : ${supaUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`)
  console.log(`  Exécutez : ${B}db/schema.sql${X} puis ${B}db/migration-v2.sql${X}`)
  await ask('\nAppuyez sur Entrée quand c\'est fait...')

  // ─── Vercel ──────────────────────────────────────────────────
  const deploy = await ask(`\nDéployer sur Vercel maintenant ? (${G}o${X}/n) `, 'o')

  if (deploy.toLowerCase() === 'o') {
    // Vérifier Vercel CLI
    if (spawnSync('vercel', ['--version'], { stdio: 'pipe' }).status !== 0) {
      inf('Installation Vercel CLI...')
      execSync('npm install -g vercel@latest', { stdio: 'inherit' })
    }

    inf('Push des variables d\'environnement vers Vercel...')
    const vars = {
      NEXT_PUBLIC_SUPABASE_URL:         supaUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY:    supaAnon,
      SUPABASE_SERVICE_ROLE_KEY:        supaServ,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: stripePk,
      STRIPE_SECRET_KEY:                stripeSk,
      STRIPE_WEBHOOK_SECRET:            stripeWh,
      STRIPE_PRICE_ESSENCE:             priceEss,
      STRIPE_PRICE_HERITAGE:            priceHer,
      STRIPE_PRICE_DIAMOND:             priceDia,
      RESEND_API_KEY:                   resendKey,
      RESEND_FROM:                      resendFrom,
      ADMIN_SECRET:                     adminSecret,
      CRON_SECRET:                      cronSecret,
      NEXT_PUBLIC_BASE_URL:             baseUrl,
    }

    for (const [k, v] of Object.entries(vars)) {
      try {
        execSync(`echo "${v}" | vercel env add ${k} production --force 2>/dev/null`, { stdio: 'pipe' })
        ok(`  ${k}`)
      } catch {
        console.log(`${DIM}  ${k} (à définir manuellement)${X}`)
      }
    }

    inf('\nBuild et déploiement Vercel...')
    try {
      execSync('vercel --prod', { stdio: 'inherit' })
      ok('Déployé !')
    } catch {
      err('Erreur — relancez : vercel --prod')
    }
  }

  // ─── Checklist finale ─────────────────────────────────────────
  console.log(`
${Y}${B}═══ Checklist restante ═════════════════════${X}

${G}1. Webhook Stripe${X}
   Dashboard Stripe > Developers > Webhooks
   URL      : ${baseUrl}/api/webhook-stripe
   Événement: checkout.session.completed

${G}2. Domaine email Resend${X}
   resend.com > Domains > Add ${resendFrom.split('@')[1]}
   Ajouter les DNS records fournis

${G}3. Auth Supabase${X}
   supabase.com > Authentication > URL Configuration
   Site URL : ${baseUrl}
   Redirect URLs : ${baseUrl}/auth/callback

${G}4. Test end-to-end${X}
   ${baseUrl}/create (carte test: 4242 4242 4242 4242)
   ${baseUrl}/api/health

${G}5. Validation E2E${X}
   node test-e2e.mjs --url ${baseUrl}
`)

  rl.close()
}

main().catch(e => { err(e.message); rl.close(); process.exit(1) })
