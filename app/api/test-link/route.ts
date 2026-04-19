import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await db
    .from('links')
    .select('slug, title, status')
    .order('created_at', { ascending: false })
    .limit(3)

  return NextResponse.json({
    url:   process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30),
    data,
    error,
  })
}
