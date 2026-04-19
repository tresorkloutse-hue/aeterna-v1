import { redirect }       from 'next/navigation'
import { supabaseAdmin }  from '@/lib/supabase-admin'
import Link               from 'next/link'
import { cookies }        from 'next/headers'
import { createClient }   from '@supabase/supabase-js'
import DashboardLinkActions from './DashboardLinkActions'
import DashboardTable       from './DashboardTable'

interface DashLink {
  id: string; slug: string; title: string; protocol: string
  status: string; view_count: number; audio_play_count: number
  share_count: number; created_at: string; recipient_name: string
}

async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sb-access-token')?.value
  if (!token) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

const PROTOCOL_GLYPHS: Record<string, string> = {
  ESSENCE:'◈', HERITAGE:'✦', DIAMOND:'◉',
}
const STATUS_COLORS: Record<string, string> = {
  active:'#4ade80', draft:'#facc15', archived:'rgba(247,242,236,.25)',
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/?auth=required')

  const [{ data: userRow }, { data: links }] = await Promise.all([
    supabaseAdmin.from('users').select('full_name, plan, plan_started_at').eq('id', user.id).single(),
    supabaseAdmin.from('links').select('id,slug,title,protocol,status,view_count,audio_play_count,share_count,created_at,recipient_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const plan     = userRow?.plan ?? 'essence'
  const isDiamond = plan === 'diamond'
  const totalViews = (links ?? []).reduce((s, l: DashLink) => s + l.view_count, 0)
  const totalPlays = (links ?? []).reduce((s, l: DashLink) => s + l.audio_play_count, 0)

  return (
    <main style={{ minHeight:'100vh', background:'#020f09', color:'#F7F2EC', padding:'60px 40px', fontFamily:"'Jost',sans-serif", fontWeight:300 }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:56 }}>
        <div>
          <Link href="/" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:10, letterSpacing:'.4em', color:'rgba(224,196,180,.3)', display:'block', marginBottom:16, textDecoration:'none' }}>
            AETERNA
          </Link>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:300, fontStyle:'italic', margin:0 }}>
            {isDiamond
              ? <><em style={{ color:'#c4b0e8' }}>◉</em> Coffre-fort Diamond</>
              : <>Vos <em style={{ color:'#E0C4B4' }}>sanctuaires</em></>
            }
          </h1>
          <p style={{ fontSize:11, color:'rgba(247,242,236,.3)', marginTop:8, letterSpacing:'.04em' }}>
            {userRow?.full_name ?? user.email} · Plan {plan.charAt(0).toUpperCase()+plan.slice(1)}
          </p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <Link href="/create" style={{ padding:'10px 24px', background:'#E0C4B4', color:'#020f09', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'.3em', textTransform:'uppercase', textDecoration:'none' }}>
            + Nouveau
          </Link>
        </div>
      </div>

      {/* Diamond banner */}
      {isDiamond && (
        <div style={{ background:'rgba(2,4,20,.7)', border:'1px solid rgba(180,160,224,.2)', padding:'24px 28px', marginBottom:40, display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#c4b0e8', animation:'dm-pulse 2s ease-in-out infinite', flexShrink:0 }} />
          <p style={{ fontSize:12, color:'rgba(196,176,232,.7)', letterSpacing:'.04em', margin:0 }}>
            Coffre-fort Diamond actif · Liens illimités · Audio + Vidéo 4K · Domaine personnalisé
          </p>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:2, marginBottom:40 }}>
        {[
          { label:'Sanctuaires',  value:(links??[]).length },
          { label:'Actifs',       value:(links??[]).filter((l:DashLink)=>l.status==='active').length },
          { label:'Vues totales', value:totalViews },
          { label:'Écoutes',      value:totalPlays },
        ].map((k,i) => (
          <div key={i} style={{ background:'rgba(6,57,39,.18)', border:'1px solid rgba(224,196,180,.07)', padding:'24px 20px' }}>
            <span style={{ fontSize:7, letterSpacing:'.3em', textTransform:'uppercase', color:'rgba(224,196,180,.3)', display:'block', marginBottom:10 }}>{k.label}</span>
            <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:300, color:'#E0C4B4', display:'block', lineHeight:1 }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Table avec pagination, filtre, export */}
      <DashboardTable
        links={(links ?? []) as any}
        baseUrl={process.env.NEXT_PUBLIC_BASE_URL ?? 'https://aeterna.co'}
      />

            <style>{`@keyframes dm-pulse{0%,100%{box-shadow:0 0 0 0 rgba(196,176,232,.4)}50%{box-shadow:0 0 0 8px rgba(196,176,232,0)}}`}</style>
    </main>
  )
}
