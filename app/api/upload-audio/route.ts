import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase-admin'
import { generateSlug }              from '@/lib/nanoid'

export const dynamic = 'force-dynamic'

const MAX_SIZE   = 50 * 1024 * 1024   // 50 MB
const ALLOWED    = ['audio/mpeg','audio/wav','audio/flac','audio/mp4','audio/ogg','audio/x-m4a']
const BUCKET     = 'audio'

export async function POST(req: NextRequest) {
  try {
    const form     = await req.formData()
    const file     = form.get('file') as File | null
    const waveform = form.get('waveform') as string | null
    const linkSlug = form.get('link_slug') as string | null

    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

    // Validations
    if (file.size > MAX_SIZE)       return NextResponse.json({ error: 'Fichier trop volumineux (max 50 MB)' }, { status: 400 })
    if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Format non supporté' }, { status: 400 })

    // Nom unique
    const ext      = file.name.split('.').pop() ?? 'mp3'
    const filename = `${linkSlug ?? generateSlug()}_${Date.now()}.${ext}`
    const path     = `links/${filename}`

    // Upload Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType:  file.type,
        cacheControl: '3600',
        upsert:       false,
      })

    if (error) {
      console.error('[Upload]', error)
      return NextResponse.json({ error: 'Erreur de stockage' }, { status: 500 })
    }

    // URL publique signée (valide 10 ans)
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10)
    const signedUrl = signedUrlData?.signedUrl ?? ''

    // Si on a un link_slug, mettre à jour le lien
    if (linkSlug) {
      await supabaseAdmin
        .from('links')
        .update({
          audio_url:      signedUrl,
          audio_filename: file.name,
          audio_waveform: waveform ? JSON.parse(waveform) : null,
        })
        .eq('slug', linkSlug)
    }

    return NextResponse.json({
      ok:         true,
      url:        signedUrl,
      path:       data.path,
      filename:   file.name,
      size:       file.size,
      waveform:   waveform ? JSON.parse(waveform) : null,
    })

  } catch (err) {
    console.error('[Upload]', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
