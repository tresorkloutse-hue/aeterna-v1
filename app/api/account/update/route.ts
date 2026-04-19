import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase-admin'
import { z }                         from 'zod'

const schema = z.object({
  full_name: z.string().min(1).max(80).optional(),
  timezone:  z.string().optional(),
  locale:    z.string().optional(),
})

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.slice(7) ?? req.cookies.get('sb-access-token')?.value

  if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  try {
    const { supabase } = await import('@/lib/supabase')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Session invalide' }, { status: 401 })

    const body  = await req.json()
    const input = schema.parse(body)

    const { error } = await supabaseAdmin
      .from('users')
      .update(input)
      .eq('id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    console.error('[Account Update]', err)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
