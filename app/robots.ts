import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aeterna.co'
  return {
    rules: [
      {
        userAgent: '*',
        allow:     ['/', '/create', '/experience/', '/auth'],
        disallow:  ['/dashboard/', '/api/', '/auth/reset'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
