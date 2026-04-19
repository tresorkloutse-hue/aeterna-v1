import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase-admin'
import { nanoid }                    from 'nanoid'
import { z }                         from 'zod'

const schema = z.object({
  plan:           z.enum(['essence', 'heritage', 'diamond']),
  title:          z.string().min(1).max(120),
  message:        z.string().min(1).max(2000),
  sender_name:    z.string().min(1),
  sender_email:   z.string().email(),
  recipient_name: z.string().min(1),
  recipient_email:z.string().email().optional(),
  custom_bg:      z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  // waveform JSON si audio uploadé côté client
  audio_waveform: z.array(z.number()).optional(),
  audio_filename: z.string().optional(),
  referral_slug:  z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json()
    const input = schema.parse(body)

    // Vérifier que l'utilisateur a le bon plan
    // En production : décoder le JWT Supabase depuis le header Authorization
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7)
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        userId = user.id
        // Vérifier le plan
        const { data: userRow } = await supabaseAdmin
          .from('users')
          .select('plan')
          .eq('id', user.id)
          .single()

        const plan = userRow?.plan ?? 'essence'
        if (input.plan === 'diamond' && plan !== 'diamond') {
          return NextResponse.json({ error: 'Plan Diamond requis' }, { status: 403 })
        }
        if (input.plan === 'heritage' && !['heritage','diamond'].includes(plan)) {
          return NextResponse.json({ error: 'Plan Héritage requis' }, { status: 403 })
        }
      }
    }

    const slug = nanoid(10)

    const { data: link, error } = await supabaseAdmin
      .from('links')
      .insert({
        user_id:         userId,
        slug,
        title:           input.title,
        message:         input.message,
        protocol:        input.plan.toUpperCase(),
        sender_name:     input.sender_name,
        recipient_name:  input.recipient_name,
        recipient_email: input.recipient_email,
        custom_bg:       input.custom_bg,
        audio_filename:  input.audio_filename,
        audio_waveform:  input.audio_waveform,
        status:          'active',
        eco_trees:       2,
      })
      .select('id, slug')
      .single()

    if (error || !link) {
      console.error('[create-link]', error)
      return NextResponse.json({ error: 'Erreur base de données' }, { status: 500 })
    }

    // Tracker le référral si présent
    if (input.referral_slug) {
      supabaseAdmin.from('log_events').insert({
        event_type: 'gift_loop_referral',
        payload: { source_slug: input.referral_slug, new_slug: slug },
      }).then(() => {})
    }

    const url = `${process.env.NEXT_PUBLIC_BASE_URL}/experience/${slug}`
    return NextResponse.json({ ok: true, slug, url })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', issues: err.issues }, { status: 400 })
    }
    console.error('[create-link]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
