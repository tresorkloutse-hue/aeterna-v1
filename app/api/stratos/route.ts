import { NextRequest, NextResponse } from 'next/server'
import { z }                         from 'zod'

export const dynamic = 'force-dynamic'

/**
 * STRATOS — Agent Ads AI
 *
 * Deux fonctions :
 * 1. POST /api/stratos/convert  → Tracking conversions vers Make.com
 *    Appelé côté client après achat Stripe (pixel de conversion)
 *    Make.com peut relayer vers Meta Ads / Google Ads
 *
 * 2. POST /api/stratos/webhook  → Reçoit les leads de Make.com
 *    Make.com surveille les nouveaux liens → déclenche des micro-ads
 *    ciblés sur les contacts similaires au profil acheteur
 */

// ─── Schéma conversion ─────────────────────────────────────────────
const convertSchema = z.object({
  event:     z.enum(['purchase', 'lead', 'view_content', 'add_to_cart']),
  tier:      z.enum(['essence', 'heritage', 'diamond']).optional(),
  value:     z.number().optional(),
  currency:  z.string().default('EUR'),
  email_sha: z.string().optional(), // SHA-256 de l'email (RGPD)
  session_id:z.string().optional(),
})

// ─── Schéma webhook Make.com ────────────────────────────────────────
const webhookSchema = z.object({
  trigger:   z.enum(['new_purchase', 'gift_loop_activation', 'diamond_churn_risk']),
  data:      z.record(z.unknown()),
  secret:    z.string(),
})

// ─── POST /api/stratos/convert ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const url = req.nextUrl
  const action = url.searchParams.get('action') ?? 'convert'

  if (action === 'webhook') return handleWebhook(req)
  return handleConversion(req)
}

async function handleConversion(req: NextRequest) {
  try {
    const body  = await req.json()
    const input = convertSchema.parse(body)

    const MAKE_WEBHOOK = process.env.MAKE_STRATOS_WEBHOOK_URL
    const META_PIXEL   = process.env.META_PIXEL_ID
    const GA_MEASURE   = process.env.GA_MEASUREMENT_ID
    const GA_SECRET    = process.env.GA_API_SECRET

    const results: Record<string, boolean> = {}

    // ── Relay vers Make.com ─────────────────────────────────────────
    if (MAKE_WEBHOOK) {
      try {
        await fetch(MAKE_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event:      input.event,
            tier:       input.tier,
            value:      input.value ?? (input.tier === 'essence' ? 19 : input.tier === 'heritage' ? 49 : 9),
            currency:   input.currency,
            email_sha:  input.email_sha,
            session_id: input.session_id,
            timestamp:  new Date().toISOString(),
            source:     'aeterna_stratos',
          }),
        })
        results.make = true
      } catch { results.make = false }
    }

    // ── Meta Conversions API (CAPI) ─────────────────────────────────
    if (META_PIXEL && process.env.META_ACCESS_TOKEN) {
      try {
        await fetch(
          `https://graph.facebook.com/v18.0/${META_PIXEL}/events`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: [{
                event_name:  input.event === 'purchase' ? 'Purchase' : 'ViewContent',
                event_time:  Math.floor(Date.now() / 1000),
                action_source: 'website',
                user_data:   input.email_sha ? { em: [input.email_sha] } : {},
                custom_data: {
                  value:    input.value,
                  currency: input.currency,
                  content_ids: [input.tier],
                },
              }],
              access_token: process.env.META_ACCESS_TOKEN,
            }),
          }
        )
        results.meta = true
      } catch { results.meta = false }
    }

    // ── Google Analytics 4 Measurement Protocol ─────────────────────
    if (GA_MEASURE && GA_SECRET) {
      try {
        await fetch(
          `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASURE}&api_secret=${GA_SECRET}`,
          {
            method: 'POST',
            body: JSON.stringify({
              client_id: input.session_id ?? 'anonymous',
              events: [{
                name:   input.event === 'purchase' ? 'purchase' : 'view_item',
                params: {
                  currency: input.currency,
                  value:    input.value,
                  items: [{ item_id: input.tier, item_name: `Sanctuaire ${input.tier}` }],
                },
              }],
            }),
          }
        )
        results.ga4 = true
      } catch { results.ga4 = false }
    }

    // ── Log interne ─────────────────────────────────────────────────
    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'placeholder') {
      try {
        const { supabaseAdmin } = await import('@/lib/supabase-admin')
        await supabaseAdmin.from('log_events').insert({
          event_type: `stratos_${input.event}`,
          payload:    { tier: input.tier, value: input.value, results },
        })
      } catch {}
    }

    return NextResponse.json({ ok: true, results })

  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    return NextResponse.json({ ok: true }) // Silencieux côté client
  }
}

async function handleWebhook(req: NextRequest) {
  try {
    const body  = await req.json()
    const input = webhookSchema.parse(body)

    // Vérification secret Make.com
    if (input.secret !== process.env.MAKE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Traitement selon le trigger
    switch (input.trigger) {

      case 'new_purchase': {
        // Make.com vient de détecter un nouvel achat
        // → Déclencher une campagne lookalike si Diamond
        const d = input.data as { tier?: string; value?: number }
        if (d.tier === 'diamond' && d.value) {
          console.log('[STRATOS] Diamond purchase detected — lookalike campaign trigger')
        }
        break
      }

      case 'gift_loop_activation': {
        // Un destinataire a cliqué "Créer mon sanctuaire"
        // → Réduire le CPA via retargeting précis
        console.log('[STRATOS] Gift-Loop activated:', input.data)
        break
      }

      case 'diamond_churn_risk': {
        // Un Diamond n'a pas créé de lien depuis 14j
        // → Envoyer une notification de réactivation
        console.log('[STRATOS] Churn risk detected:', input.data)
        break
      }
    }

    return NextResponse.json({ ok: true, trigger: input.trigger })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
