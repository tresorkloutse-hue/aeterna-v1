import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start  = Date.now()
  const checks: Record<string, { ok: boolean; latency?: number }> = { app: { ok: true } }

  try {
    const { supabaseAdmin } = await import('@/lib/supabase-admin')
    const t0 = Date.now()
    const { error } = await supabaseAdmin.from('links').select('id').limit(1)
    checks.supabase = { ok: !error, latency: Date.now() - t0 }
  } catch {
    checks.supabase = { ok: false }
  }

  const allOk = Object.values(checks).every(c => c.ok)

  return NextResponse.json({
    status:    allOk ? 'ok' : 'degraded',
    uptime_ms: Date.now() - start,
    checks,
    timestamp: new Date().toISOString(),
    version:   '2.0.0',
  }, { status: allOk ? 200 : 503 })
}
