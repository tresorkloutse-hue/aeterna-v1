import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'AETERNA — Liens Trophées',
    short_name:       'AETERNA',
    description:      'Sanctuaires numériques pour vos souvenirs les plus précieux.',
    start_url:        '/',
    display:          'standalone',
    background_color: '#020f09',
    theme_color:      '#043927',
    orientation:      'portrait',
    lang:             'fr',
    icons: [
      { src:'/icon-192.png', sizes:'192x192', type:'image/png', purpose:'maskable' },
      { src:'/icon-512.png', sizes:'512x512', type:'image/png', purpose:'any' },
    ],
    categories: ['lifestyle', 'social'],
  }
}
