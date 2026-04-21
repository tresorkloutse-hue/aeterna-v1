import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

function makeSlug(len = 10): string {
  return randomBytes(len).toString('base64url').slice(0, len)
}

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      db: { schema: 'public' },
      global: {
        headers: {
          'x-my-custom-header': 'aeterna-webhook'
        }
      }
    }
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

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const meta    = session.metadata ?? {}
  const db      = getDb()

  console.log('[Webhook] Session reçue:', session.id, '| tier:', meta.tier)

  // ── 1. Upsert utilisateur ─────────────────────────────────────
  let userId: string | null = null
  try {
    const { data: user } = await db
      .from('users')
      .upsert({
        email:              session.customer_email ?? '',
        stripe_customer_id: session.customer as string ?? null,
        plan:               meta.tier ?? 'essence',
        plan_started_at:    new Date().toISOString(),
        full_name:          meta.sender_name || null,
      }, { onConflict: 'email' })
      .select('id')
      .single()
    userId = user?.id ?? null
    console.log('[Webhook] User:', userId)
  } catch (e) {
    console.error('[Webhook] User error (non-bloquant):', e)
  }

  // ── 2. Créer le lien ──────────────────────────────────────────
  let linkId: string | null = null
  let slug = makeSlug(10)
  try {
    const { data: link } = await db
      .from('links')
      .insert({
        user_id:         userId,
        slug,
        title:           meta.title          || 'Sanctuaire sans titre',
        message:         meta.message        || '',
        protocol:        (meta.tier ?? 'essence').toUpperCase(),
        sender_name:     meta.sender_name    || '',
        recipient_name:  meta.recipient_name || '',
        recipient_email: meta.recipient_email || null,
        audio_url:       meta.audio_url      || null,
        audio_filename:  meta.audio_filename || null,
        status:          'active',
        eco_trees:       2,
      })
      .select('id, slug')
      .single()
    linkId = link?.id ?? null
    slug   = link?.slug ?? slug
    console.log('[Webhook] Lien créé:', slug)
  } catch (e) {
    console.error('[Webhook] Lien error DETAILS:', JSON.stringify(e), 'Meta:', JSON.stringify(meta))
  }

  // ── 3. Transaction ────────────────────────────────────────────
  try {
    await db.from('transactions').insert({
      user_id:               userId,
      link_id:               linkId,
      type:                  meta.tier === 'diamond' ? 'subscription_start' : 'one_time',
      stripe_session_id:     session.id,
      stripe_payment_intent: session.payment_intent as string ?? null,
      amount_eur:            (session.amount_total ?? 0) / 100,
      status:                'succeeded',
      plan:                  meta.tier ?? 'essence',
    })
    console.log('[Webhook] Transaction créée')
  } catch (e) {
    console.error('[Webhook] Transaction error (non-bloquant):', e)
  }

  // ── 4. Emails ─────────────────────────────────────────────────
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && apiKey !== 'VALEUR_A_REMPLIR' && apiKey.startsWith('re_')) {
      const { Resend } = await import('resend')
      const resend = new Resend(apiKey)
      const base   = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aeterna-v1.vercel.app'
      const from   = process.env.RESEND_FROM ?? 'onboarding@resend.dev'
      const expUrl = `${base}/experience/${slug}`

      if (session.customer_email) {
        await resend.emails.send({
          from,
          to:      session.customer_email,
          subject: `Votre sanctuaire est gravé — AETERNA`,
          html:    `
            <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#020f09;color:#F7F2EC;padding:48px 32px;">
              <p style="font-size:11px;letter-spacing:.4em;color:rgba(224,196,180,.4);text-transform:uppercase;margin-bottom:40px;">AETERNA</p>
              <h1 style="font-size:32px;font-weight:200;font-style:italic;color:#F7F2EC;margin-bottom:16px;">Votre sanctuaire est gravé.</h1>
              <p style="color:rgba(247,242,236,.6);line-height:1.8;margin-bottom:32px;">Bonjour ${meta.sender_name},<br><br>Votre sanctuaire pour <strong>${meta.recipient_name}</strong> est prêt. Partagez ce lien avec votre destinataire :</p>
              <a href="${expUrl}" style="display:inline-block;padding:14px 36px;border:1px solid #E0C4B4;color:#E0C4B4;text-decoration:none;font-size:11px;letter-spacing:.2em;text-transform:uppercase;">Ouvrir le sanctuaire</a>
              <p style="margin-top:48px;font-size:11px;color:rgba(247,242,236,.2);">2 arbres plantés · 200% compensation carbone · EcoTree</p>
            </div>
          `,
        })
        console.log('[Webhook] Email expéditeur envoyé à:', session.customer_email)
      }

      if (meta.recipient_email) {
        await resend.emails.send({
          from,
          to:      meta.recipient_email,
          subject: `${meta.sender_name} vous a créé un sanctuaire — AETERNA`,
          html:    `
            <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#020f09;color:#F7F2EC;padding:48px 32px;">
              <p style="font-size:11px;letter-spacing:.4em;color:rgba(224,196,180,.4);text-transform:uppercase;margin-bottom:40px;">AETERNA</p>
              <h1 style="font-size:32px;font-weight:200;font-style:italic;color:#F7F2EC;margin-bottom:16px;">${meta.sender_name} vous a offert un sanctuaire.</h1>
              <p style="color:rgba(247,242,236,.6);line-height:1.8;margin-bottom:32px;">Bonjour ${meta.recipient_name},<br><br>Quelqu'un a pensé à vous. Voici votre sanctuaire :</p>
              <a href="${expUrl}" style="display:inline-block;padding:14px 36px;border:1px solid #E0C4B4;color:#E0C4B4;text-decoration:none;font-size:11px;letter-spacing:.2em;text-transform:uppercase;">Découvrir mon sanctuaire</a>
            </div>
          `,
        })
        console.log('[Webhook] Email destinataire envoyé à:', meta.recipient_email)
      }
    } else {
      console.log('[Webhook] Resend non configuré, emails ignorés. Clé:', apiKey?.slice(0,8))
    }
  } catch (e) {
    console.error('[Webhook] Email error:', e)
  }

  console.log(`[Webhook] ✓ Terminé | slug:${slug} | ${session.customer_email}`)
  return NextResponse.json({ received: true })
}
