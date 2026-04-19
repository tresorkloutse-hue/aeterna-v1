import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      locale: 'fr',
      line_items: [{ price: process.env.STRIPE_PRICE_ESSENCE!, quantity: 1 }],
      success_url: 'https://aeterna-v1.vercel.app/success',
      cancel_url:  'https://aeterna-v1.vercel.app/cancel',
      metadata: {
        tier: 'essence',
        sender_name: 'Test',
        sender_email: 'test@test.com',
        recipient_name: 'Test',
        recipient_email: '',
        title: 'Test',
        message: 'Test message pour le sanctuaire',
        referral_slug: '',
        audio_url: '',
        audio_filename: '',
        has_audio: 'false',
      },
    })

    return NextResponse.json({ ok: true, session_id: session.id, url: session.url })
  } catch (err: unknown) {
    const e = err as { message?: string; type?: string; code?: string }
    return NextResponse.json({ ok: false, error: e.message, type: e.type, code: e.code }, { status: 200 })
  }
}
