import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * /auth/callback
 * Reçoit le code d'échange Supabase (OAuth ou magic link)
 * Échange contre une session et redirige vers /dashboard
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code     = searchParams.get('code')
  const error    = searchParams.get('error')
  const redirect = searchParams.get('redirect') ?? '/dashboard'
  const base     = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  if (error) {
    console.error('[Auth Callback] Erreur :', error, searchParams.get('error_description'))
    return NextResponse.redirect(`${base}/auth?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${base}/auth?error=no_code`)
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError || !data.session) {
      throw exchangeError ?? new Error('Échange de session échoué')
    }

    // Réponse avec cookie de session
    const response = NextResponse.redirect(`${base}${redirect}`)

    // Supabase SSR : persister la session via cookie
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   data.session.expires_in,
      path:     '/',
    })
    response.cookies.set('sb-refresh-token', data.session.refresh_token ?? '', {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 30, // 30 jours
      path:     '/',
    })

    return response

  } catch (err) {
    console.error('[Auth Callback] Exception :', err)
    return NextResponse.redirect(`${base}/auth?error=callback_failed`)
  }
}
