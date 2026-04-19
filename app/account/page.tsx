import { redirect }      from 'next/navigation'
import { cookies }       from 'next/headers'
import { createClient }  from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import AccountClient     from './AccountClient'

async function getSession() {
  const store = await cookies()
  const token = store.get('sb-access-token')?.value
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

export default async function AccountPage() {
  const user = await getSession()
  if (!user) redirect('/auth?redirect=/account')

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('full_name, plan, plan_started_at, stripe_customer_id, stripe_subscription_id')
    .eq('id', user.id)
    .single()

  const { data: recentLinks } = await supabaseAdmin
    .from('links')
    .select('id, slug, title, protocol, status, view_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: recentTx } = await supabaseAdmin
    .from('transactions')
    .select('amount_eur, plan, type, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <AccountClient
      email={user.email ?? ''}
      profile={profile ?? { full_name: null, plan: 'essence', plan_started_at: null, stripe_customer_id: null, stripe_subscription_id: null }}
      recentLinks={recentLinks ?? []}
      recentTransactions={recentTx ?? []}
    />
  )
}
