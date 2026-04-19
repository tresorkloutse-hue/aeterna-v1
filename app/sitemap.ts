import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aeterna.co'

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/create`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/auth`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    const { data } = await supabaseAdmin
      .from('links')
      .select('slug, updated_at')
      .eq('status', 'active')
      .eq('is_private', false)
      .order('updated_at', { ascending: false })
      .limit(500)

    const expRoutes: MetadataRoute.Sitemap = (data ?? []).map(l => ({
      url:             `${base}/experience/${l.slug}`,
      lastModified:    new Date(l.updated_at),
      changeFrequency: 'never' as const,
      priority:        0.6,
    }))

    return [...staticRoutes, ...expRoutes]
  } catch {
    return staticRoutes
  }
}
