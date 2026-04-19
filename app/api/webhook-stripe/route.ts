import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 })
  }

  const { supabaseAdmin } = await import('@/lib/supabase-admin')

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta    = session.metadata ?? {}

    // ── Idempotence ─────────────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle()
    if (existing) return NextResponse.json({ received: true, skipped: true })

    // ── Upsert utilisateur ───────────────────────────────────────
    let userId: string | null = null
    if (session.customer_email) {
      const { data: user } = await supabaseAdmin
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
      userId = user?.id ?? null
    }

    // ── Créer le lien en base ────────────────────────────────────
    const slug = Math.random().toString(36).substring(2, 12)

    let audioWaveform: number[] | null = null
    if (meta.audio_waveform) {
      try { audioWaveform = JSON.parse(meta.audio_waveform) } catch {}
    }

    const { data: link } = await supabaseAdmin
      .from('links')
      .insert({
        user_id:         userId,
        slug,
        title:           meta.title           || 'Sanctuaire sans titre',
        message:         meta.message         || '',
        protocol:        (meta.tier ?? 'essence').toUpperCase(),
        sender_name:     meta.sender_name     || '',
        recipient_name:  meta.recipient_name  || '',
        recipient_email: meta.recipient_email || null,
        audio_url:       meta.audio_url       || null,
        audio_filename:  meta.audio_filename  || null,
        audio_waveform:  audioWaveform,
        status:          'active',
        eco_trees:       2,
      })
      .select('id, slug')
      .single()

    // ── Enregistrer la transaction ───────────────────────────────
    await supabaseAdmin.from('transactions').insert({
      user_id:               userId,
      link_id:               link?.id ?? null,
      type:                  meta.tier === 'diamond' ? 'subscription_start' : 'one_time',
      stripe_session_id:     session.id,
      stripe_payment_intent: session.payment_intent as string ?? null,
      amount_eur:            (session.amount_total ?? 0) / 100,
      status:                'succeeded',
      plan:                  meta.tier ?? 'essence',
      metadata:              {
        slug:           link?.slug,
        sender_name:    meta.sender_name,
        recipient_name: meta.recipient_name,
        referral_slug:  meta.referral_slug || null,
      },
    })

    // ── Gift-Loop : tracker le référral ─────────────────────────
    if (meta.referral_slug && link?.slug) {
      supabaseAdmin.from('log_events').insert({
        event_type: 'gift_loop_referral',
        payload: { source_slug: meta.referral_slug, new_slug: link.slug },
      }).then(() => {})
    }

    // ── Emails ───────────────────────────────────────────────────
    try {
      const { Resend } = await import('resend')
      const { recipientEmail, senderEmail, diamondWelcomeEmail } = await import('@/lib/email')
      const resend  = new Resend(process.env.RESEND_API_KEY)
      const from    = `AETERNA <${process.env.RESEND_FROM ?? 'sanctuaire@aeterna.co'}>`
      const expUrl  = `${process.env.NEXT_PUBLIC_BASE_URL}/experience/${link?.slug}`

      const emails = []

      // Email destinataire (si email fourni)
      if (meta.recipient_email) {
        emails.push(resend.emails.send({
          from,
          to:      meta.recipient_email,
          subject: `Un sanctuaire vous attend, ${meta.recipient_name} — AETERNA`,
          html:    recipientEmail({
            recipientName: meta.recipient_name,
            senderName:    meta.sender_name,
            plan:          meta.tier,
            experienceUrl: expUrl,
          }),
        }))
      }

      // Confirmation expéditeur
      if (session.customer_email) {
        emails.push(resend.emails.send({
          from,
          to:      session.customer_email,
          subject: meta.tier === 'diamond'
            ? 'Bienvenue dans Diamond — AETERNA'
            : `Votre sanctuaire ${meta.tier} est gravé — AETERNA`,
          html: meta.tier === 'diamond'
            ? diamondWelcomeEmail({
                name:      meta.sender_name || session.customer_email,
                portalUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
              })
            : senderEmail({
                senderName:    meta.sender_name,
                recipientName: meta.recipient_name,
                plan:          meta.tier,
                experienceUrl: expUrl,
              }),
        }))
      }

      await Promise.allSettled(emails)
    } catch (emailErr) {
      console.error('[Webhook] Email erreur:', emailErr)
    }

    console.log(`[Webhook] ✓ ${meta.tier} | slug:${link?.slug} | ${session.customer_email}`)
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await supabaseAdmin
      .from('users')
      .update({ plan:'essence', plan_expires_at: new Date(sub.current_period_end * 1000).toISOString() })
      .eq('stripe_customer_id', sub.customer as string)
  }

  return NextResponse.json({ received: true })
}
