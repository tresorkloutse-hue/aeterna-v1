import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ ok: true })

    await supabaseAdmin
      .from('links')
      .update({ audio_play_count: supabaseAdmin.rpc('increment_link_view') as unknown as number })
      .eq('slug', slug)

    // Plus simple : SQL direct
    await supabaseAdmin.rpc('increment_audio_play', { link_slug: slug }).maybeSingle()

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
