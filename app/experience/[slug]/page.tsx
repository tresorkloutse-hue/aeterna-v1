import { createClient }   from '@supabase/supabase-js'
import { notFound }       from 'next/navigation'
import ExperienceView     from './ExperienceView'

export const dynamic = 'force-dynamic'

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function ExperiencePage({ params }: Props) {
  const { slug } = await params
  const db = getDb()

  const { data: link, error } = await db
    .from('links')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (error || !link) {
    console.error('[Experience] Lien non trouvé:', slug, error)
    notFound()
  }

  // Incrémenter les vues (non-bloquant)
  db.rpc('increment_link_view', { link_slug: slug }).then(() => {})

  return <ExperienceView link={link} />
}
