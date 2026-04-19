import { createClient } from '@supabase/supabase-js'

// Lazy init — ne pas throw au module load (casse le build statique Next.js)
function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[supabase-admin] Variables d\'environnement manquantes')
    }
    // Retourner un client placeholder pour le build
    return createClient(
      url ?? 'https://placeholder.supabase.co',
      key ?? 'placeholder',
      { auth: { persistSession: false } }
    )
  }
  return createClient(url, key, {
    auth:   { persistSession: false },
    db:     { schema: 'public' },
    global: { headers: { 'x-app-name': 'aeterna-server' } },
  })
}

export const supabaseAdmin = createAdmin()
