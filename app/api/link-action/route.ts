import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase-admin'
import { z }                         from 'zod'

const schema = z.object({
  slug:   z.string().min(1),
  action: z.enum(['archive', 'restore', 'track-share']),
})

export async function PATCH(req: NextRequest) {
  try {
    const body  = await req.json()
    const input = schema.parse(body)

    // Auth check via cookie (production)
    // En demo : passe directement
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null
    if (authHeader?.startsWith('Bearer ')) {
      const { supabase } = await import('@/lib/supabase')
      const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7))
      userId = user?.id ?? null
    }

    if (input.action === 'track-share') {
      // Atomic increment via RPC
      await supabaseAdmin.rpc('increment_share_count', { link_slug: input.slug }).maybeSingle()
      return NextResponse.json({ ok: true })
    }

    const newStatus = input.action === 'archive' ? 'archived' : 'active'

    const query = supabaseAdmin
      .from('links')
      .update({ status: newStatus })
      .eq('slug', input.slug)

    // En production : vérifier que l'utilisateur possède le lien
    if (userId) query.eq('user_id', userId)

    const { error } = await query
    if (error) throw error

    // Log
    await supabaseAdmin.from('log_events').insert({
      event_type: input.action === 'archive' ? 'link_archived' : 'link_restored',
      payload:    { slug: input.slug, by_user: userId },
    })

    return NextResponse.json({ ok: true, status: newStatus })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }
    console.error('[link-action]', err)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
