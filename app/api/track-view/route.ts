import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug requis' }, { status: 400 })

    await supabaseAdmin.rpc('increment_link_view', { link_slug: slug })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // Silencieux — ne jamais bloquer l'UX
  }
}
