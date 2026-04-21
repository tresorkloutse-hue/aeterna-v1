import { createClient } from '@supabase/supabase-js'
import { notFound }     from 'next/navigation'
import ExperienceView   from './ExperienceView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ExperiencePage({ params }: Props) {
  const { slug } = await params

  console.log('[Experience] Recherche slug:', slug)

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: link, error } = await db
    .from('links')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  console.log('[Experience] Résultat:', JSON.stringify({ found: !!link, status: link?.status, error }))

  if (!link) {
    console.error('[Experience] Lien introuvable pour slug:', slug)
    notFound()
  }

  if (link.status !== 'active') {
    console.error('[Experience] Lien inactif:', link.status)
    notFound()
  }

  db.rpc('increment_link_view', { link_slug: slug }).then(() => {}).catch(() => {})

  return <ExperienceView link={link} />
}
