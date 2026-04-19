import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

    const balance = await stripe.balance.retrieve()

    const prices = await Promise.allSettled([
      stripe.prices.retrieve(process.env.STRIPE_PRICE_ESSENCE  ?? ''),
      stripe.prices.retrieve(process.env.STRIPE_PRICE_HERITAGE ?? ''),
      stripe.prices.retrieve(process.env.STRIPE_PRICE_DIAMOND  ?? ''),
    ])

    return NextResponse.json({
      ok: true,
      stripe_connected: true,
      currency: balance.available[0]?.currency ?? 'eur',
      prices: {
        essence:  prices[0].status === 'fulfilled' ? 'OK' : 'ERREUR: ' + (prices[0] as PromiseRejectedResult).reason?.message,
        heritage: prices[1].status === 'fulfilled' ? 'OK' : 'ERREUR: ' + (prices[1] as PromiseRejectedResult).reason?.message,
        diamond:  prices[2].status === 'fulfilled' ? 'OK' : 'ERREUR: ' + (prices[2] as PromiseRejectedResult).reason?.message,
      },
      env: {
        secret_key_prefix: process.env.STRIPE_SECRET_KEY?.slice(0, 12) + '...',
        base_url:          process.env.NEXT_PUBLIC_BASE_URL,
        price_essence:     process.env.STRIPE_PRICE_ESSENCE,
        price_heritage:    process.env.STRIPE_PRICE_HERITAGE,
        price_diamond:     process.env.STRIPE_PRICE_DIAMOND,
      }
    })
  } catch (err: unknown) {
    const e = err as { message?: string; type?: string; code?: string }
    return NextResponse.json({
      ok:    false,
      error: e.message,
      type:  e.type,
      code:  e.code,
    }, { status: 200 })
  }
}
