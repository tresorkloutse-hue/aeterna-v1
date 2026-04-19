import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { z } from 'zod'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const PRICE_IDS = {
  essence:  process.env.STRIPE_PRICE_ESSENCE  ?? '',
  heritage: process.env.STRIPE_PRICE_HERITAGE ?? '',
  diamond:  process.env.STRIPE_PRICE_DIAMOND  ?? '',
} as const

const schema = z.object({
  tier:            z.enum(['essence','heritage','diamond']),
  sender_name:     z.string().min(1),
  sender_email:    z.string().email(),
  recipient_name:  z.string().min(1),
  recipient_email: z.string().optional(),
  title:           z.string().min(1).max(120),
  message:         z.string().min(0).max(2000).default(''),
  audio_url:       z.string().url().optional(),
  audio_filename:  z.string().optional(),
  // JSON-serialized waveform array
  audio_waveform:  z.array(z.number()).optional(),
  referral_slug:   z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json()
    const input = schema.parse(body)
    const base  = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aeterna.co'
    const isDiamond = input.tier === 'diamond'

    // Transmettre toutes les données dans les metadata Stripe
    // (le webhook les récupère pour créer le lien en base)
    const meta: Record<string, string> = {
      tier:            input.tier,
      sender_name:     input.sender_name,
      sender_email:    input.sender_email,
      recipient_name:  input.recipient_name,
      recipient_email: input.recipient_email ?? '',
      title:           input.title,
      message:         input.message.slice(0, 500), // Stripe limit 500 chars/value
      referral_slug:   input.referral_slug ?? '',
      audio_url:       input.audio_url ?? '',
      audio_filename:  input.audio_filename ?? '',
      has_audio:       input.audio_url ? 'true' : 'false',
    }

    // Waveform serialisée (truncated si trop longue)
    if (input.audio_waveform && input.audio_waveform.length > 0) {
      const serialized = JSON.stringify(input.audio_waveform.slice(0, 80))
      if (serialized.length <= 500) meta.audio_waveform = serialized
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 isDiamond ? 'subscription' : 'payment',
      locale:               'fr',
      customer_email:       input.sender_email,
      allow_promotion_codes: true,
      line_items: [{ price: PRICE_IDS[input.tier], quantity: 1 }],
      metadata:             meta,
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}&tier=${input.tier}`,
      cancel_url:  `${base}/cancel?tier=${input.tier}`,
      ...(isDiamond && {
        subscription_data: {
          metadata: meta,
          trial_period_days: 7,
        },
      }),
    })

    return NextResponse.json({ sessionId: session.id })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', issues: err.issues }, { status: 400 })
    }
    console.error('[Checkout]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
