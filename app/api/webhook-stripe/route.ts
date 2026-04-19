import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

function makeSlug(len = 10): string {
  return randomBytes(len).toString('base64url').slice(0, len)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('[Webhook] Signature invalide:', err)
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  console.log('[Webhook] Événement reçu:', event.type)

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta    = session.metadata ?? {}

    console.log('[Webhook] Metadata:', JSON.stringify(meta))
    console.log('[Webhook] Customer email:', session.customer_email)
    console.log('[Webhook] Amount:', session.amount_total)

    const db = getSupabase()

    // ── Idempotence ──────────────────────────────────────────────
    const { data: existing } = await db
      .from('transactions')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

    if (existing) {
      console.log('[Webhook] Déjà traité, skip')
      return NextResponse.json({ received: true, skipped: true })
    }

    // ── Upsert utilisateur ───────────────────────────────────────
    let userId: string | null = null
    if (session.customer_email) {
      const { data: user, error: userErr } = await db
        .from('users')
        .upsert({
          email:              session.customer_email,
          stripe_customer_id: session.customer as string,
          plan:               meta.tier ?? 'essence',
          plan_started_at:    new Date().toISOString(),
          full_name:          meta.sender_name || null,
        }, { onConflict: 'email' })
        .select('id')
        .single()

      if (userErr) console.error('[Webhook] Erreur upsert user:', userErr)
      else userId = user?.id ?? null
      console.log('[Webhook] UserId:', userId)
    }

    // ── Créer le lien ────────────────────────────────────────────
    const slug = makeSlug(10)
    console.log('[Webhook] Slug généré:', slug)

    const { data: link, error: linkErr } = await db
      .from('links')
      .insert({
        user_id:        userId,
        slug,
        title:          meta.title         || 'Sanctuaire sans titre',
        message:        meta.message       || '',
        protocol:       (meta.tier ?? 'essence').toUpperCase(),
        sender_name:    meta.sender_name   || '',
        recipient_name: meta.recipient_name || '',
        recipient_email:meta.recipient_email || null,
        audio_url:      meta.audio_url     || null,
        audio_filename: meta.audio_filename || null,
        status:         'active',
        eco_trees:      2,
      })
      .select('id, slug')
      .single()

    if (linkErr) {
      console.error('[Webhook] Erreur création lien:', JSON.stringify(linkErr))
    } else {
      console.log('[Webhook] Lien créé:', link?.slug)
    }

    // ── Transaction ──────────────────────────────────────────────
    const { error: txErr } = await db.from('transactions').insert({
      user_id:               userId,
      link_id:               link?.id ?? null,
      type:                  meta.tier === 'diamond' ? 'subscription_start' : 'one_time',
      stripe_session_id:     session.id,
      stripe_payment_intent: session.payment_intent as string ?? null,
      amount_eur:            (session.amount_total ?? 0) / 100,
      status:                'succeeded',
      plan:                  meta.tier ?? 'essence',
      metadata:              { slug: link?.slug, sender_name: meta.sender_name },
    })

    if (txErr) console.error('[Webhook] Erreur transaction:', JSON.stringify(txErr))

    // ── Emails ───────────────────────────────────────────────────
    try {
      if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'VALEUR_A_REMPLIR') {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const base   = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aeterna-v1.vercel.app'
        const expUrl = `${base}/experience/${link?.slug}`
        const from   = `AETERNA <${process.env.RESEND_FROM ?? 'onboarding@resend.dev'}>`

        if (session.customer_email) {
          await resend.emails.send({
            from,
            to:      session.customer_email,
            subject: `Votre sanctuaire est gravé — AETERNA`,
            html:    `<p>Bonjour ${meta.sender_name},</p><p>Votre sanctuaire est prêt : <a href="${expUrl}">${expUrl}</a></p>`,
          })
          console.log('[Webhook] Email envoyé à:', session.customer_email)
        }
      }
    } catch (emailErr) {
      console.error('[Webhook] Email erreur:', emailErr)
    }

    console.log(`[Webhook] ✓ ${meta.tier} | slug:${link?.slug} | ${session.customer_email}`)
  }

  return NextResponse.json({ received: true })
}
