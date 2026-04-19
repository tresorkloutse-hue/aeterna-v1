'use client'

import { Suspense }       from 'react'
import { useSearchParams } from 'next/navigation'
import Link                from 'next/link'
import { motion }          from 'framer-motion'

function CancelContent() {
  const p    = useSearchParams()
  const tier = p.get('tier') ?? 'essence'

  const REASONS: Record<string, string> = {
    essence:  'Votre sanctuaire Essence vous attend.',
    heritage: 'Votre héritage audio vous attend.',
    diamond:  'Votre coffre-fort Diamond vous attend.',
  }

  return (
    <main style={{ minHeight:'100vh', background:'#020f09', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(100,30,30,.12), transparent)', zIndex:0 }} />

      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:.8 }}
        style={{ position:'relative', zIndex:10, maxWidth:440 }}>

        <Link href="/" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:10, letterSpacing:'.4em', color:'rgba(224,196,180,.25)', textDecoration:'none', display:'block', marginBottom:56 }}>
          AETERNA
        </Link>

        <div style={{ fontSize:40, color:'rgba(224,196,180,.3)', marginBottom:36, lineHeight:1 }}>◈</div>

        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(26px,5vw,44px)', fontWeight:200, fontStyle:'italic', color:'#F7F2EC', marginBottom:16 }}>
          Paiement annulé.
        </h1>

        <p style={{ fontSize:13, color:'rgba(247,242,236,.38)', lineHeight:1.85, marginBottom:52, fontFamily:"'Jost',sans-serif", letterSpacing:'.03em' }}>
          {REASONS[tier] ?? REASONS.essence}<br />
          Aucun montant n'a été débité.
        </p>

        <div style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>
          <Link href="/create" style={{ padding:'15px 48px', border:'1px solid rgba(224,196,180,.32)', color:'rgba(224,196,180,.7)', fontFamily:"'Jost',sans-serif", fontSize:10, letterSpacing:'.35em', textTransform:'uppercase', textDecoration:'none' }}>
            Réessayer
          </Link>
          <Link href="/" style={{ fontSize:9, letterSpacing:'.2em', color:'rgba(247,242,236,.2)', textDecoration:'none', textTransform:'uppercase', fontFamily:"'Jost',sans-serif" }}>
            Retour à l'accueil
          </Link>
        </div>

        <div style={{ marginTop:56, paddingTop:32, borderTop:'1px solid rgba(224,196,180,.07)' }}>
          <p style={{ fontSize:10, color:'rgba(247,242,236,.18)', fontFamily:"'Jost',sans-serif", letterSpacing:'.08em', lineHeight:1.75 }}>
            Une question ? <a href="mailto:support@aeterna.co" style={{ color:'rgba(224,196,180,.35)', textDecoration:'none' }}>support@aeterna.co</a>
          </p>
        </div>
      </motion.div>
    </main>
  )
}

export default function CancelPage() {
  return <Suspense fallback={<div style={{ background:'#020f09', minHeight:'100vh' }} />}><CancelContent /></Suspense>
}
