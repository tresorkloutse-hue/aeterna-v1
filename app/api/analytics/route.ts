import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const EVENTS = ['experience_view','audio_play','gift_loop_click','create_start','protocol_select'] as const

export async function POST(req: NextRequest) {
  try {
    const { event, slug, protocol, metadata } = await req.json()
    if (!EVENTS.includes(event)) return NextResponse.json({ error:'Événement inconnu' }, { status:400 })

    const ip = (req.headers.get('x-forwarded-for')?.split(',')[0]??'').slice(0,8)+'***'

    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    await supabaseAdmin.from('log_events').insert({
      event_type: event,
      payload:    { slug, protocol, metadata, ip },
    }).throwOnError()

    return NextResponse.json({ ok:true })
  } catch {
    return NextResponse.json({ ok:true })  // Silencieux côté client
  }
}
