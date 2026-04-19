'use client'

import { useState, Suspense, useCallback }  from 'react'
import { motion, AnimatePresence }           from 'framer-motion'
import { useSearchParams }                   from 'next/navigation'
import dynamic                               from 'next/dynamic'
import Link                                  from 'next/link'

const AudioUpload = dynamic(() => import('@/components/audio/AudioUpload'), { ssr:false })

// ─── Types & constantes ───────────────────────────────────────────
type Plan = 'essence' | 'heritage' | 'diamond'

const PLANS = [
  { key:'essence'  as Plan, glyph:'◈', name:'Essence',  price:19, hasAudio:false, accent:'#E0C4B4' },
  { key:'heritage' as Plan, glyph:'✦', name:'Héritage', price:49, hasAudio:true,  accent:'#E0C4B4' },
  { key:'diamond'  as Plan, glyph:'◉', name:'Diamond',  price:9,  hasAudio:true,  accent:'#c4b0e8' },
]

interface Form {
  sender_name:     string
  sender_email:    string
  recipient_name:  string
  recipient_email: string
  title:           string
  message:         string
}

// ─── Styles utilitaires ───────────────────────────────────────────
const inp: React.CSSProperties = {
  background:'transparent', border:'none',
  borderBottom:'1px solid rgba(224,196,180,.2)',
  color:'#F7F2EC', fontFamily:"'Jost',sans-serif",
  fontSize:15, fontWeight:200, padding:'12px 0',
  outline:'none', width:'100%', letterSpacing:'.02em',
}
const lbl: React.CSSProperties = {
  fontSize:8, letterSpacing:'.4em', textTransform:'uppercase',
  color:'rgba(224,196,180,.38)', fontFamily:"'Jost',sans-serif",
  display:'block', marginBottom:8,
}

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return <div style={{ display:'flex', flexDirection:'column', gap:0 }}><span style={lbl}>{label}</span>{children}</div>
}

// ─── Formulaire principal ─────────────────────────────────────────
function CreateForm() {
  const params     = useSearchParams()
  const refSlug    = params.get('ref') ?? ''

  const [step,       setStep]      = useState(1)
  const [plan,       setPlan]      = useState<Plan>('heritage')
  const [form,       setForm]      = useState<Form>({ sender_name:'', sender_email:'', recipient_name:'', recipient_email:'', title:'', message:'' })
  const [audioFile,  setAudioFile] = useState<File|null>(null)
  const [audioWave,  setAudioWave] = useState<number[]>([])
  const [loading,    setLoading]   = useState(false)
  const [error,      setError]     = useState('')

  const selectedPlan = PLANS.find(p => p.key === plan)!
  const upd = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const canStep2 = form.sender_name && form.sender_email && form.recipient_name
  const canStep3 = !!canStep2 && form.title && form.message.length >= 10

  const onAudioUpload = useCallback((f: File, wave: number[]) => {
    setAudioFile(f); setAudioWave(wave)
  }, [])

  async function handleSubmit() {
    setLoading(true); setError('')
    try {
      // 1. Upload audio si présent (Heritage/Diamond)
      let audioUrl: string | undefined
      let audioFilename: string | undefined

      if (audioFile && selectedPlan.hasAudio) {
        const fd = new FormData()
        fd.append('file', audioFile)
        const upRes = await fetch('/api/upload-audio', { method:'POST', body:fd })
        const upData = await upRes.json()
        if (!upRes.ok) throw new Error(upData.error ?? 'Upload audio échoué')
        audioUrl      = upData.url
        audioFilename = audioFile.name
      }

      // 2. Créer la session Stripe Checkout avec toutes les métadonnées
      const checkoutRes = await fetch('/api/create-checkout', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          tier:            plan,
          sender_name:     form.sender_name,
          sender_email:    form.sender_email,
          recipient_name:  form.recipient_name,
          recipient_email: form.recipient_email,
          title:           form.title,
          message:         form.message,
          audio_url:        audioUrl,
          audio_filename:   audioFilename,
          audio_waveform:   audioWave.length > 0 ? audioWave : undefined,
          referral_slug:    refSlug || undefined,
        }),
      })
      const { sessionId, error: checkoutError } = await checkoutRes.json()
      if (checkoutError) throw new Error(checkoutError)

      const { loadStripe } = await import('@stripe/stripe-js')
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
      await stripe?.redirectToCheckout({ sessionId })
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
      setLoading(false)
    }
  }

  const variants = { enter:{opacity:0,x:40}, center:{opacity:1,x:0}, exit:{opacity:0,x:-40} }
  const ease     = { duration:.4, ease:[.76,0,.24,1] as [number,number,number,number] }

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 24px', background:'#020f09' }}>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 30%,rgba(6,81,47,.2),transparent)', zIndex:0 }} />

      <div style={{ position:'relative', zIndex:10, width:'100%', maxWidth:560 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:56 }}>
          <Link href="/" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:11, letterSpacing:'.4em', color:'rgba(224,196,180,.3)', textDecoration:'none' }}>AETERNA</Link>
        </div>

        {/* Progress */}
        <div style={{ display:'flex', gap:8, marginBottom:48, justifyContent:'center' }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ height:1, width:60, background: s<=step ? '#E0C4B4' : 'rgba(224,196,180,.15)', transition:'background .4s' }} />
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── ÉTAPE 1 : Choisir le sanctuaire ── */}
          {step===1 && (
            <motion.div key="s1" variants={variants} initial="enter" animate="center" exit="exit" transition={ease}>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontWeight:200, fontStyle:'italic', color:'#F7F2EC', marginBottom:8, textAlign:'center' }}>
                Votre sanctuaire
              </h2>
              <p style={{ fontSize:11, color:'rgba(247,242,236,.3)', textAlign:'center', marginBottom:40, letterSpacing:'.05em', fontFamily:"'Jost',sans-serif" }}>
                Choisissez le niveau de votre mémoire
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                {PLANS.map(p => (
                  <button key={p.key} onClick={() => { setPlan(p.key); setTimeout(()=>setStep(2),220) }}
                    style={{
                      display:'flex', alignItems:'center', gap:20,
                      padding:'22px 24px', width:'100%', textAlign:'left',
                      background: plan===p.key ? 'rgba(6,57,39,.45)' : 'rgba(6,57,39,.15)',
                      border:`1px solid ${plan===p.key ? 'rgba(224,196,180,.32)' : 'rgba(224,196,180,.08)'}`,
                      cursor:'pointer', transition:'all .3s',
                    }}>
                    <span style={{ fontSize:24, color:p.accent, opacity:.65, minWidth:28 }}>{p.glyph}</span>
                    <div style={{ flex:1 }}>
                      <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:9, letterSpacing:'.2em', color:p.accent, display:'block', marginBottom:5 }}>{p.name}</span>
                      <span style={{ fontSize:10, color:'rgba(247,242,236,.35)', fontFamily:"'Jost',sans-serif" }}>
                        {p.hasAudio ? 'Audio haute-fidélité inclus' : 'Moteur génératif LYRA'}
                        {p.key==='diamond' && ' · Liens illimités'}
                      </span>
                    </div>
                    <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontStyle:'italic', color:'rgba(224,196,180,.45)', whiteSpace:'nowrap' }}>
                      {p.price}€{p.key==='diamond'?'/mois':''}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── ÉTAPE 2 : Les protagonistes + message ── */}
          {step===2 && (
            <motion.div key="s2" variants={variants} initial="enter" animate="center" exit="exit" transition={ease}>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, fontWeight:200, fontStyle:'italic', color:'#F7F2EC', marginBottom:8, textAlign:'center' }}>
                Les protagonistes
              </h2>
              <p style={{ fontSize:11, color:`${selectedPlan.accent}66`, textAlign:'center', marginBottom:36, fontFamily:"'Cinzel Decorative',serif", letterSpacing:'.2em' }}>
                {selectedPlan.glyph} {selectedPlan.name}
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                  <Field label="Votre prénom">
                    <input style={inp} value={form.sender_name} onChange={upd('sender_name')} placeholder="Marie" />
                  </Field>
                  <Field label="Votre email">
                    <input style={inp} type="email" value={form.sender_email} onChange={upd('sender_email')} placeholder="marie@..." />
                  </Field>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                  <Field label="Prénom du destinataire">
                    <input style={inp} value={form.recipient_name} onChange={upd('recipient_name')} placeholder="Lucas" />
                  </Field>
                  <Field label="Email du destinataire">
                    <input style={inp} type="email" value={form.recipient_email} onChange={upd('recipient_email')} placeholder="lucas@..." />
                  </Field>
                </div>
                <Field label="Titre du sanctuaire">
                  <input style={inp} value={form.title} onChange={upd('title')} placeholder="Pour toi qui as tout changé" maxLength={120} />
                </Field>
                <Field label={`Message gravé pour l'éternité (${form.message.length}/2000)`}>
                  <textarea
                    value={form.message} onChange={upd('message')} maxLength={2000} rows={5}
                    placeholder="Parce que certaines personnes changent tout, sans même le savoir..."
                    style={{ ...inp, borderBottom:'none', border:'1px solid rgba(224,196,180,.18)', padding:'16px', resize:'none', lineHeight:1.7, fontSize:14 }}
                  />
                </Field>

                {/* Upload audio (Heritage + Diamond) */}
                {selectedPlan.hasAudio && (
                  <div>
                    <span style={lbl}>Audio — Votre voix dans l'éternité</span>
                    <AudioUpload onUpload={onAudioUpload} />
                  </div>
                )}
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', marginTop:40 }}>
                <button onClick={()=>setStep(1)} style={{ background:'transparent', border:'1px solid rgba(224,196,180,.15)', color:'rgba(247,242,236,.3)', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'.3em', textTransform:'uppercase', padding:'12px 28px', cursor:'pointer' }}>
                  Retour
                </button>
                <button onClick={()=>setStep(3)} disabled={!canStep2}
                  style={{ background:'transparent', border:`1px solid ${canStep2?'#E0C4B4':'rgba(224,196,180,.2)'}`, color:canStep2?'#E0C4B4':'rgba(224,196,180,.3)', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'.35em', textTransform:'uppercase', padding:'12px 36px', cursor:canStep2?'pointer':'not-allowed', transition:'all .3s' }}>
                  Continuer
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ÉTAPE 3 : Récapitulatif & paiement ── */}
          {step===3 && (
            <motion.div key="s3" variants={variants} initial="enter" animate="center" exit="exit" transition={ease}>
              <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, fontWeight:200, fontStyle:'italic', color:'#F7F2EC', marginBottom:40, textAlign:'center' }}>
                Votre sanctuaire
              </h2>

              <div style={{ border:'1px solid rgba(224,196,180,.14)', padding:'36px', marginBottom:28 }}>
                {[
                  ['Protocole',    <span key="p" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:10, letterSpacing:'.15em', color:selectedPlan.accent }}>{selectedPlan.glyph} {selectedPlan.name}</span>],
                  ['De',           form.sender_name],
                  ['Pour',         form.recipient_name],
                  ['Titre',        form.title || '—'],
                  ['Audio',        audioFile ? audioFile.name : '—'],
                  ['Archivage',    'Éternel'],
                ].map(([k,v]) => (
                  <div key={String(k)} style={{ display:'flex', justifyContent:'space-between', padding:'11px 0', borderBottom:'1px solid rgba(224,196,180,.06)' }}>
                    <span style={{ fontSize:9, letterSpacing:'.25em', textTransform:'uppercase', color:'rgba(224,196,180,.35)', fontFamily:"'Jost',sans-serif" }}>{k}</span>
                    <span style={{ fontSize:12, color:'rgba(247,242,236,.65)', fontFamily:"'Jost',sans-serif" }}>{v}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:20, marginTop:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:5, height:5, background:'#4ade80', borderRadius:'50%' }} />
                    <span style={{ fontSize:9, color:'rgba(247,242,236,.28)', fontFamily:"'Jost',sans-serif", letterSpacing:'.1em' }}>200% compensation carbone</span>
                  </div>
                  <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:36, fontStyle:'italic', color:selectedPlan.accent }}>
                    {selectedPlan.price}€{selectedPlan.key==='diamond'?'/mois':''}
                  </span>
                </div>
              </div>

              {error && (
                <p style={{ fontSize:11, color:'rgba(239,68,68,.7)', marginBottom:16, fontFamily:"'Jost',sans-serif", letterSpacing:'.03em' }}>{error}</p>
              )}

              <p style={{ fontSize:10, color:'rgba(247,242,236,.18)', textAlign:'center', lineHeight:1.85, marginBottom:28, fontFamily:"'Jost',sans-serif", letterSpacing:'.03em' }}>
                Paiement sécurisé via Stripe · Votre sanctuaire s'active immédiatement après confirmation.
              </p>

              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <button onClick={()=>setStep(2)} style={{ background:'transparent', border:'1px solid rgba(224,196,180,.15)', color:'rgba(247,242,236,.3)', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'.3em', textTransform:'uppercase', padding:'12px 28px', cursor:'pointer' }}>
                  Retour
                </button>
                <button onClick={handleSubmit} disabled={loading||!canStep3}
                  style={{ background: canStep3 ? selectedPlan.accent : 'rgba(224,196,180,.15)', border:`1px solid ${canStep3?selectedPlan.accent:'rgba(224,196,180,.15)'}`, color: canStep3 ? '#020f09' : 'rgba(224,196,180,.3)', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'.35em', textTransform:'uppercase', padding:'14px 40px', cursor:canStep3&&!loading?'pointer':'not-allowed', transition:'all .3s', opacity:loading?.6:1 }}>
                  {loading ? '...' : `Graver — ${selectedPlan.price}€${selectedPlan.key==='diamond'?'/mois':''}`}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </main>
  )
}

export default function CreatePage() {
  return <Suspense fallback={<div style={{background:'#020f09',minHeight:'100vh'}}/>}><CreateForm/></Suspense>
}
