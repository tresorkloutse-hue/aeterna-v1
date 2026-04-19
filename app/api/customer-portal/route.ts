import { NextRequest, NextResponse } from 'next/server'
import Stripe                        from 'stripe'
import { supabaseAdmin }             from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

/**
 * POST /api/customer-portal
 * Crée une session Stripe Customer Portal pour gérer l'abonnement Diamond
 * Seuls les utilisateurs connectés avec un stripe_customer_id peuvent accéder
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 })

    // Récupérer le stripe_customer_id
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('stripe_customer_id, plan')
      .eq('id', user.id)
      .single()

    if (!userRow?.stripe_customer_id) {
      return NextResponse.json({ error: 'Pas de compte Stripe associé' }, { status: 400 })
    }

    if (userRow.plan !== 'diamond') {
      return NextResponse.json({ error: 'Portail réservé aux abonnés Diamond' }, { status: 403 })
    }

    // Créer la session portail
    const session = await stripe.billingPortal.sessions.create({
      customer:   userRow.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`,
    })

    return NextResponse.json({ url: session.url })

  } catch (err) {
    console.error('[Customer Portal]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
