'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'

const MESSAGES = {
  essence:  { glyph:'◈', title:'Votre sanctuaire est gravé.',        sub:'Votre destinataire recevra son accès dans quelques instants.' },
  heritage: { glyph:'✦', title:'Votre héritage audio est vivant.',    sub:'Le son a été cristallisé. Votre destinataire va l\'entendre.' },
  diamond:  { glyph:'◉', title:'Bienvenue dans votre coffre-fort.',   sub:'Votre ère Diamond commence. 7 jours offerts pour explorer.' },
}

function SuccessContent() {
  const p     = useSearchParams()
  const tier  = (p.get('tier') ?? 'essence') as keyof typeof MESSAGES
  const msg   = MESSAGES[tier] ?? MESSAGES.essence
  const acc   = tier === 'diamond' ? '#c4b0e8' : '#E0C4B4'

  // STRATOS : tracking conversion (fire-and-forget)
  if (typeof window !== 'undefined') {
    const value = tier === 'essence' ? 19 : tier === 'heritage' ? 49 : 9
    setTimeout(() => {
      fetch('/api/stratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'purchase', tier, value }),
      }).catch(() => {})
    }, 500)
  }

  return (
    <main style={{ minHeight:'100vh', background:'#020f09', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px', textAlign:'center' }}>
      <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse 60% 50% at 50% 50%,${tier==='diamond'?'rgba(60,40,100,.15)':'rgba(6,81,47,.2)'},transparent)`, zIndex:0 }} />

      <motion.div initial={{ opacity:0, scale:.95 }} animate={{ opacity:1, scale:1 }} transition={{ duration:.8, ease:[.76,0,.24,1] as any }}
        style={{ position:'relative', zIndex:10, maxWidth:480 }}>

        {/* Sceau animé */}
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.3, duration:1 }}
          style={{ width:80, height:80, margin:'0 auto 48px', position:'relative' }}>
          {[0,8,20].map((ins,i) => (
            <div key={i} style={{ position:'absolute', inset:ins, border:`1px solid ${acc}${['44','28','18'][i]}`, borderRadius:'50%', animation:`spin${i} ${12-i*3}s linear infinite ${i%2?'reverse':''}` }} />
          ))}
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Cormorant Garamond',serif", fontSize:30, color:acc, opacity:.7 }}>
            {msg.glyph}
          </div>
        </motion.div>

        <motion.p initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:.5 }}
          style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:9, letterSpacing:'.4em', color:`${acc}60`, marginBottom:20, textTransform:'uppercase' }}>
          Sanctuaire activé
        </motion.p>

        <motion.h1 initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ delay:.65 }}
          style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:'clamp(26px,5vw,46px)', fontWeight:200, fontStyle:'italic', color:'#F7F2EC', marginBottom:20 }}>
          {msg.title}
        </motion.h1>

        <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:.85 }}
          style={{ fontSize:13, color:'rgba(247,242,236,.38)', lineHeight:1.85, marginBottom:52, fontFamily:"'Jost',sans-serif", letterSpacing:'.03em' }}>
          {msg.sub}
        </motion.p>

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.05 }}
          style={{ display:'flex', flexDirection:'column', gap:14, alignItems:'center' }}>
          <Link href={tier==='diamond' ? '/dashboard' : '/create'}
            style={{ padding:'15px 44px', border:`1px solid ${acc}`, color:acc, fontFamily:"'Jost',sans-serif", fontSize:10, letterSpacing:'.35em', textTransform:'uppercase', textDecoration:'none' }}>
            {tier==='diamond' ? 'Ouvrir mon coffre-fort' : 'Créer un autre sanctuaire'}
          </Link>
          <Link href="/" style={{ fontSize:9, letterSpacing:'.2em', color:'rgba(247,242,236,.2)', textDecoration:'none', textTransform:'uppercase', fontFamily:"'Jost',sans-serif" }}>
            Retour à l'accueil
          </Link>
        </motion.div>

        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:1.3 }}
          style={{ marginTop:56, paddingTop:32, borderTop:'1px solid rgba(224,196,180,.07)', display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
          <div style={{ width:5, height:5, background:'#4ade80', borderRadius:'50%', animation:'eco-pulse 2s ease-in-out infinite' }} />
          <p style={{ fontSize:9, color:'rgba(247,242,236,.2)', fontFamily:"'Jost',sans-serif", letterSpacing:'.1em' }}>
            2 arbres plantés · 200% compensation carbone · EcoTree
          </p>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes spin0{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        @keyframes spin1{from{transform:rotate(0)}to{transform:rotate(-360deg)}}
        @keyframes spin2{from{transform:rotate(30deg)}to{transform:rotate(390deg)}}
        @keyframes eco-pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.4)}50%{box-shadow:0 0 0 6px rgba(74,222,128,0)}}
      `}</style>
    </main>
  )
}

export default function SuccessPage() {
  return <Suspense fallback={<div style={{ background:'#020f09', minHeight:'100vh' }} />}><SuccessContent /></Suspense>
}
