import { NextRequest, NextResponse } from 'next/server'

const rateMap = new Map<string, { count: number; reset: number }>()

function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.reset) { rateMap.set(ip, { count:1, reset: now+windowMs }); return true }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  // Rate limiting
  if (pathname.startsWith('/api/')) {
    const limit = pathname.includes('checkout') ? 8 : 60
    if (!rateLimit(`${ip}:${pathname}`, limit, 60_000)) {
      return new NextResponse(JSON.stringify({ error:'Trop de requêtes' }), {
        status:  429,
        headers: { 'Content-Type':'application/json', 'Retry-After':'60' },
      })
    }
  }

  const res = NextResponse.next()

  // Security headers
  res.headers.set('X-Frame-Options',           'DENY')
  res.headers.set('X-Content-Type-Options',    'nosniff')
  res.headers.set('Referrer-Policy',           'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy',        'camera=(), microphone=(self), geolocation=()')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  res.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' blob: https://*.supabase.co",
    "connect-src 'self' https://api.stripe.com https://*.supabase.co wss://*.supabase.co",
    "frame-src https://js.stripe.com",
    "worker-src blob:",
  ].join('; '))

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
