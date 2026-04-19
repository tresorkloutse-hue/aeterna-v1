import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin')

    // 1. Archiver les liens expirés
    const { data: expired } = await supabaseAdmin
      .from('links')
      .update({ status: 'archived' })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select('id, slug')

    // 2. Supprimer les sessions pending vieilles de +2h (abandon panier)
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    const { data: abandoned } = await supabaseAdmin
      .from('links')
      .delete()
      .eq('status', 'draft')
      .lt('created_at', twoHoursAgo)
      .select('id')

    // 3. Log
    if (expired && expired.length > 0) {
      await supabaseAdmin.from('log_events').insert(
        (expired as { id:string; slug:string }[]).map(l => ({
          event_type: 'auto_archived',
          payload:    { slug: l.slug, reason: 'expires_at reached' },
        }))
      )
    }

    console.log(`[CRON CLEANUP] Archivés: ${expired?.length ?? 0} | Abandonnés supprimés: ${abandoned?.length ?? 0}`)
    return NextResponse.json({
      ok:        true,
      archived:  expired?.length  ?? 0,
      abandoned: abandoned?.length ?? 0,
    })
  } catch (err) {
    console.error('[CRON CLEANUP]', err)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
