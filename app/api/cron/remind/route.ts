import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Vérification secret Vercel Cron
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    const { Resend }        = await import('resend')

    const resend = new Resend(process.env.RESEND_API_KEY)
    const base   = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aeterna.co'

    // Fenêtre J+30 (±12h)
    const target     = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const windowStart = new Date(target.getTime() - 12 * 3600 * 1000).toISOString()
    const windowEnd   = new Date(target.getTime() + 12 * 3600 * 1000).toISOString()

    // Liens actifs créés il y a ~30 jours
    const { data: links } = await supabaseAdmin
      .from('links')
      .select('id, slug, title, sender_name, recipient_name, view_count, audio_play_count')
      .eq('status', 'active')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)

    if (!links || links.length === 0) {
      return NextResponse.json({ ok: true, reminded: 0 })
    }

    // Exclure les liens déjà relancés
    const { data: already } = await supabaseAdmin
      .from('log_events')
      .select('experience_id')
      .eq('event_type', 'reminder_sent')
      .in('experience_id', links.map((l: { id: string }) => l.id))

    const alreadyIds = new Set((already ?? []).map((e: { experience_id: string }) => e.experience_id))
    const toRemind   = links.filter((l: { id: string }) => !alreadyIds.has(l.id))

    let reminded = 0
    for (const link of toRemind as { id:string; slug:string; title:string; sender_name:string; recipient_name:string; view_count:number; audio_play_count:number }[]) {
      // Récupérer l'email expéditeur depuis la transaction
      const { data: tx } = await supabaseAdmin
        .from('transactions')
        .select('metadata')
        .eq('link_id', link.id)
        .eq('status', 'succeeded')
        .single()

      const senderEmail = (tx?.metadata as Record<string,string>)?.sender_email
      if (!senderEmail) continue

      const expUrl = `${base}/experience/${link.slug}`
      const views  = link.view_count
      const plays  = link.audio_play_count

      try {
        await resend.emails.send({
          from:    `AETERNA <${process.env.RESEND_FROM ?? 'sanctuaire@aeterna.co'}>`,
          to:      senderEmail,
          subject: `Votre sanctuaire pour ${link.recipient_name} — 30 jours déjà`,
          html:    `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#020f09;font-family:Georgia,serif;color:#F7F2EC;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:60px 20px;">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td align="center" style="padding-bottom:44px;font-family:sans-serif;font-size:10px;letter-spacing:.4em;color:rgba(224,196,180,.35);">AETERNA</td></tr>
<tr><td align="center" style="padding-bottom:44px;">
  <h1 style="font-size:38px;font-weight:300;font-style:italic;color:#F7F2EC;margin:0;line-height:1.1;">${link.sender_name},<br>30 jours déjà.</h1>
</td></tr>
<tr><td style="background:rgba(6,57,39,.25);border:1px solid rgba(224,196,180,.1);padding:36px;">
  <p style="font-size:14px;color:rgba(247,242,236,.7);line-height:1.85;margin:0 0 16px;">
    Votre sanctuaire pour <strong style="color:#E0C4B4;font-weight:400;">${link.recipient_name}</strong> a été ouvert <strong style="color:#E0C4B4;font-weight:400;">${views} fois</strong>${plays > 0 ? ` et écouté <strong style="color:#E0C4B4;font-weight:400;">${plays} fois</strong>` : ''}.
  </p>
  <p style="font-size:12px;color:rgba(247,242,236,.38);line-height:1.75;margin:0;">Il est toujours accessible, conservé pour toujours.</p>
</td></tr>
<tr><td align="center" style="padding:44px 0 28px;">
  <a href="${expUrl}" style="display:inline-block;padding:16px 48px;border:1px solid #E0C4B4;color:#E0C4B4;font-family:sans-serif;font-size:10px;letter-spacing:.35em;text-transform:uppercase;text-decoration:none;">Revoir le sanctuaire</a>
</td></tr>
<tr><td align="center" style="border-top:1px solid rgba(224,196,180,.07);padding-top:28px;">
  <p style="font-family:sans-serif;font-size:9px;color:rgba(247,242,236,.12);margin:0;">AETERNA CORP · Mémoire Durable · ${new Date().getFullYear()}</p>
</td></tr>
</table></td></tr></table></body></html>`,
        })

        await supabaseAdmin.from('log_events').insert({
          experience_id: link.id,
          event_type:    'reminder_sent',
          payload:       { slug: link.slug, view_count: views, audio_plays: plays },
        })

        reminded++
      } catch (emailErr) {
        console.error('[CRON REMIND] Erreur email pour', link.slug, emailErr)
      }
    }

    console.log(`[CRON REMIND] ${reminded} rappels envoyés sur ${toRemind.length} éligibles`)
    return NextResponse.json({ ok: true, reminded, eligible: toRemind.length })

  } catch (err) {
    console.error('[CRON REMIND]', err)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}
