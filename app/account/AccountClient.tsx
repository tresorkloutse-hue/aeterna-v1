'use client'

import { useState, useCallback } from 'react'
import { useRouter }             from 'next/navigation'
import { createClient }          from '@supabase/supabase-js'
import Link                      from 'next/link'

interface Profile {
  full_name:            string | null
  plan:                 string
  plan_started_at:      string | null
  stripe_customer_id:   string | null
  stripe_subscription_id: string | null
}

interface LinkRow   { id:string; slug:string; title:string; protocol:string; status:string; view_count:number; created_at:string }
interface TxRow     { amount_eur:number|null; plan:string; type:string; status:string; created_at:string }

const PLAN_LABELS: Record<string, { label:string; accent:string; glyph:string }> = {
  essence:  { label:'Essence',  accent:'#E0C4B4', glyph:'◈' },
  heritage: { label:'Héritage', accent:'#E0C4B4', glyph:'✦' },
  diamond:  { label:'Diamond',  accent:'#c4b0e8', glyph:'◉' },
}
const STATUS_COLORS: Record<string,string> = { active:'#4ade80', archived:'rgba(247,242,236,.25)', draft:'#facc15' }

export default function AccountClient({ email, profile, recentLinks, recentTransactions }: {
  email: string
  profile: Profile
  recentLinks: LinkRow[]
  recentTransactions: TxRow[]
}) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [nameEdit, setNameEdit] = useState(false)
  const [name,     setName]     = useState(profile.full_name ?? '')
  const [saved,    setSaved]    = useState(false)

  const planInfo = PLAN_LABELS[profile.plan] ?? PLAN_LABELS.essence
  const isDiamond = profile.plan === 'diamond'

  const logout = useCallback(async () => {
    setLoading(true)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    document.cookie = 'sb-access-token=; Max-Age=0; path=/'
    document.cookie = 'sb-refresh-token=; Max-Age=0; path=/'
    router.push('/')
  }, [router])

  const saveName = useCallback(async () => {
    setLoading(true)
    await fetch('/api/account/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name }),
    })
    setLoading(false)
    setNameEdit(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [name])

  const openPortal = useCallback(async () => {
    setLoading(true)
    try {
      const token = document.cookie.match(/sb-access-token=([^;]+)/)?.[1]
      const res = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const { url, error } = await res.json()
      if (url) window.location.href = url
      else console.error(error)
    } finally {
      setLoading(false)
    }
  }, [])

  const S = {
    card: { background:'rgba(6,57,39,.18)', border:'1px solid rgba(224,196,180,.09)', padding:'28px 32px', marginBottom:2 } as React.CSSProperties,
    label: { fontSize:8, letterSpacing:'.35em', textTransform:'uppercase' as const, color:'rgba(224,196,180,.38)', fontFamily:"'Jost',sans-serif", display:'block' as const, marginBottom:8 },
    value: { fontSize:14, color:'rgba(247,242,236,.75)', fontFamily:"'Jost',sans-serif", letterSpacing:'.03em' },
    inp:   { background:'transparent', border:'none', borderBottom:'1px solid rgba(224,196,180,.25)', color:'#F7F2EC', fontFamily:"'Jost',sans-serif", fontSize:14, fontWeight:200, padding:'8px 0', outline:'none', letterSpacing:'.03em' } as React.CSSProperties,
  }

  return (
    <main style={{ minHeight:'100vh', background:'#020f09', color:'#F7F2EC', padding:'60px 40px', fontFamily:"'Jost',sans-serif", fontWeight:300 }}>
      <div style={{ maxWidth:640, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom:52 }}>
          <Link href="/" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:10, letterSpacing:'.4em', color:'rgba(224,196,180,.3)', textDecoration:'none', display:'block', marginBottom:20 }}>AETERNA</Link>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:16 }}>
            <div>
              <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:200, fontStyle:'italic', color:'#F7F2EC', display:'block' }}>Mon compte</span>
              <span style={{ fontSize:11, color:'rgba(247,242,236,.35)', letterSpacing:'.03em' }}>{email}</span>
            </div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              <Link href="/dashboard" style={{ padding:'9px 22px', border:'1px solid rgba(224,196,180,.2)', color:'rgba(247,242,236,.45)', fontSize:9, letterSpacing:'.25em', textTransform:'uppercase', textDecoration:'none', fontFamily:"'Jost',sans-serif" }}>
                Dashboard
              </Link>
              <button onClick={logout} disabled={loading} style={{ padding:'9px 22px', border:'1px solid rgba(239,68,68,.2)', color:'rgba(239,68,68,.45)', fontSize:9, letterSpacing:'.25em', textTransform:'uppercase', background:'transparent', cursor:'pointer', fontFamily:"'Jost',sans-serif" }}>
                {loading ? '...' : 'Déconnexion'}
              </button>
            </div>
          </div>
        </div>

        {/* Profil */}
        <div style={S.card}>
          <span style={S.label}>Nom</span>
          {nameEdit ? (
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              <input value={name} onChange={e=>setName(e.target.value)} style={{ ...S.inp, flex:1 }} autoFocus />
              <button onClick={saveName} disabled={loading} style={{ background:'transparent', border:'1px solid rgba(224,196,180,.3)', color:'#E0C4B4', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'.2em', textTransform:'uppercase', padding:'7px 18px', cursor:'pointer' }}>
                {saved ? '✓ Sauvegardé' : 'Sauvegarder'}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={S.value}>{profile.full_name || <em style={{ color:'rgba(247,242,236,.3)' }}>Non renseigné</em>}</span>
              <button onClick={()=>setNameEdit(true)} style={{ background:'none', border:'none', color:'rgba(224,196,180,.4)', fontSize:9, letterSpacing:'.2em', cursor:'pointer', fontFamily:"'Jost',sans-serif", textTransform:'uppercase' }}>Modifier</button>
            </div>
          )}
        </div>

        {/* Plan */}
        <div style={{ ...S.card, background: isDiamond ? 'rgba(2,4,20,.7)' : S.card.background, border: isDiamond ? '1px solid rgba(180,160,224,.2)' : S.card.border }}>
          <span style={S.label}>Votre sanctuaire</span>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:28, color:planInfo.accent, opacity:.65 }}>{planInfo.glyph}</span>
              <div>
                <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:10, letterSpacing:'.2em', color:planInfo.accent, display:'block' }}>{planInfo.label}</span>
                {profile.plan_started_at && (
                  <span style={{ fontSize:10, color:'rgba(247,242,236,.3)', fontFamily:"'Jost',sans-serif" }}>
                    Depuis le {new Date(profile.plan_started_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              {isDiamond && profile.stripe_customer_id && (
                <button onClick={openPortal} disabled={loading} style={{ padding:'9px 22px', border:'1px solid rgba(180,160,224,.3)', color:'rgba(180,160,224,.7)', fontSize:9, letterSpacing:'.25em', textTransform:'uppercase', background:'transparent', cursor:'pointer', fontFamily:"'Jost',sans-serif" }}>
                  Gérer Diamond
                </button>
              )}
              {!isDiamond && (
                <Link href="/#pricing" style={{ padding:'9px 22px', border:'1px solid rgba(224,196,180,.25)', color:'rgba(224,196,180,.6)', fontSize:9, letterSpacing:'.25em', textTransform:'uppercase', textDecoration:'none', fontFamily:"'Jost',sans-serif" }}>
                  Passer à Diamond
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Derniers sanctuaires */}
        {recentLinks.length > 0 && (
          <div style={{ ...S.card, marginTop:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <span style={S.label}>Sanctuaires récents</span>
              <Link href="/dashboard" style={{ fontSize:9, letterSpacing:'.2em', color:'rgba(224,196,180,.4)', textDecoration:'none', fontFamily:"'Jost',sans-serif", textTransform:'uppercase' }}>Voir tous →</Link>
            </div>
            {recentLinks.map(l => (
              <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(224,196,180,.05)' }}>
                <div>
                  <Link href={`/experience/${l.slug}`} target="_blank" style={{ fontSize:12, color:'rgba(247,242,236,.65)', textDecoration:'none', display:'block', marginBottom:2 }}>
                    {l.title.length>42 ? l.title.slice(0,42)+'…' : l.title}
                  </Link>
                  <span style={{ fontSize:9, color:'rgba(247,242,236,.25)', letterSpacing:'.05em', fontFamily:"'Jost',sans-serif" }}>{l.slug}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, color:'rgba(247,242,236,.35)', fontFamily:"'Jost',sans-serif" }}>{l.view_count} vues</span>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:STATUS_COLORS[l.status]??'gray' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Historique transactions */}
        {recentTransactions.length > 0 && (
          <div style={{ ...S.card, marginTop:2 }}>
            <span style={{ ...S.label, marginBottom:16 }}>Historique de paiement</span>
            {recentTransactions.map((tx, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(224,196,180,.05)' }}>
                <div>
                  <span style={{ fontSize:11, color:'rgba(247,242,236,.6)', fontFamily:"'Jost',sans-serif", display:'block', marginBottom:2, textTransform:'capitalize' }}>
                    {tx.type.replace('_',' ')} — {tx.plan}
                  </span>
                  <span style={{ fontSize:9, color:'rgba(247,242,236,.28)', fontFamily:"'Jost',sans-serif" }}>
                    {new Date(tx.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontStyle:'italic', color:'rgba(224,196,180,.6)' }}>
                    {tx.amount_eur ? `${tx.amount_eur}€` : '—'}
                  </span>
                  <span style={{ fontSize:8, padding:'3px 8px', border:`1px solid ${tx.status==='succeeded'?'rgba(74,222,128,.3)':'rgba(239,68,68,.2)'}`, color:tx.status==='succeeded'?'#4ade80':'rgba(239,68,68,.6)', fontFamily:"'Jost',sans-serif", letterSpacing:'.15em', textTransform:'uppercase' }}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop:40, paddingTop:28, borderTop:'1px solid rgba(224,196,180,.07)', display:'flex', justifyContent:'space-between' }}>
          <span style={{ fontSize:8, color:'rgba(247,242,236,.15)', letterSpacing:'.15em', fontFamily:"'Jost',sans-serif" }}>AETERNA CORP · Mémoire Durable</span>
          <Link href="/cgv" style={{ fontSize:8, letterSpacing:'.15em', color:'rgba(247,242,236,.15)', textDecoration:'none', fontFamily:"'Jost',sans-serif", textTransform:'uppercase' }}>CGV</Link>
        </div>
      </div>
    </main>
  )
}
