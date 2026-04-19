import type { Metadata, Viewport } from 'next'
import './globals.css'
import Cursor from '@/components/Cursor'

export const metadata: Metadata = {
  title: {
    default:  'AETERNA — Liens Trophées · Luxe Immatériel',
    template: '%s — AETERNA',
  },
  description: 'AETERNA ne vend pas de liens. Nous bâtissons des sanctuaires pour vos souvenirs les plus précieux.',
  keywords:    ['liens trophées', 'mémoire numérique', 'héritage', 'luxe immatériel', 'AETERNA'],
  authors:     [{ name: 'AETERNA CORP' }],
  openGraph: {
    siteName:    'AETERNA',
    type:        'website',
    title:       'AETERNA — Liens Trophées · Luxe Immatériel',
    description: 'Des sanctuaires pour vos souvenirs les plus précieux.',
  },
  twitter: { card: 'summary_large_image' },
  robots:  { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor:       '#043927',
  colorScheme:      'dark',
  width:            'device-width',
  initialScale:     1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Cinzel+Decorative:wght@400&family=Jost:wght@200;300;400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Cursor custom */}
        <div className="cursor"      id="cursor"     />
        <div className="cursor-ring" id="cursor-ring" />

        {children}

        {/* Script cursor global */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var c=document.getElementById('cursor'),r=document.getElementById('cursor-ring');
            var mx=0,my=0,rx=0,ry=0;
            document.addEventListener('mousemove',function(e){
              mx=e.clientX;my=e.clientY;
              c.style.left=mx+'px';c.style.top=my+'px';
            });
            (function loop(){
              rx+=(mx-rx)*.1;ry+=(my-ry)*.1;
              r.style.left=rx+'px';r.style.top=ry+'px';
              requestAnimationFrame(loop);
            })();
          })();
        `}} />
      </body>
    </html>
  )
}
