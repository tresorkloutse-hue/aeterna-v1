import { notFound }      from 'next/navigation'
import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase-admin'
import ExperienceView    from './ExperienceView'

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabaseAdmin
    .from('links')
    .select('recipient_name, sender_name, title, protocol')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!data) return { title: 'AETERNA' }

  const base   = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aeterna.co'
  const ogUrl  = `${base}/api/og?title=${encodeURIComponent(data.title)}&recipient=${encodeURIComponent(data.recipient_name)}&sender=${encodeURIComponent(data.sender_name)}&protocol=${data.protocol}`

  return {
    title:       `Un sanctuaire pour ${data.recipient_name} — AETERNA`,
    description: `${data.sender_name} vous a ouvert un sanctuaire éternel.`,
    openGraph: {
      title:       `Un sanctuaire pour ${data.recipient_name}`,
      description: `${data.sender_name} vous a ouvert un sanctuaire — Protocole ${data.protocol}`,
      images:      [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card:   'summary_large_image',
      title:  `Un sanctuaire pour ${data.recipient_name} — AETERNA`,
      images: [ogUrl],
    },
  }
}

export default async function ExperiencePage({ params }: Props) {
  const { slug } = await params
  const { data: link } = await supabaseAdmin
    .from('links')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!link) notFound()

  // Incrémenter les vues (non-bloquant)
  supabaseAdmin.rpc('increment_link_view', { link_slug: slug }).then(() => {})

  return <ExperienceView link={link} />
}
