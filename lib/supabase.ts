import { createClient } from '@supabase/supabase-js'

// Lazy init — same pattern as supabase-admin to avoid throw at module load
function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  )
}

export const supabase = createBrowserClient()

// Helper : récupérer la session courante
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Helper : récupérer l'utilisateur courant depuis notre table users
export async function getCurrentUser() {
  const session = await getSession()
  if (!session) return null
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()
  return data
}
