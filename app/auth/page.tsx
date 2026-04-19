'use client'

import { useState, Suspense }  from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient }         from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

type Mode = 'login' | 'signup' | 'forgot'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
  )
}

function AuthForm() {
  const router   = useRouter()
  const params   = useSearchParams()
  const redirect = params.get('redirect') ?? '/dashboard'

  const [mode,     setMode]     = useState<Mode>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'forgot') {
        const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        })
        if (error) throw error
        setSuccess('Lien de réinitialisation envoyé. Vérifiez votre boîte mail.')
        setLoading(false)
        return
      }

      if (mode === 'signup') {
        const { error } = await getSupabase().auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        setSuccess('Compte créé ! Vérifiez votre email pour confirmer.')
        setLoading(false)
        return
      }

      // Login
      const { error } = await getSupabase().auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push(redirect)

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue'
      setError(
        msg.includes('Invalid') ? 'Email ou mot de passe incorrect.' :
        msg.includes('already') ? 'Cet email est déjà utilisé.' :
        msg.includes('weak')    ? 'Mot de passe trop faible (8 caractères minimum).' :
        msg
      )
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    background:    'transparent',
    border:        'none',
    borderBottom:  '1px solid rgba(224,196,180,.2)',
    color:         '#F7F2EC',
    fontFamily:    "'Jost', sans-serif",
    fontSize:      15, fontWeight: 200,
    padding:       '12px 0',
    outline:       'none', width: '100%',
    letterSpacing: '.02em',
    transition:    'border-color .3s',
  }

  const titles: Record<Mode, string> = {
    login:  'Accéder à mon sanctuaire',
    signup: 'Créer mon espace',
    forgot: 'Réinitialiser mon accès',
  }

  return (
    <main style={{ minHeight:'100vh', background:'#020f09', display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 24px' }}>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(6,81,47,.18), transparent)', zIndex:0 }} />

      <div style={{ position:'relative', zIndex:10, width:'100%', maxWidth:380 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:60 }}>
          <Link href="/" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:11, letterSpacing:'.4em', color:'rgba(224,196,180,.35)', textDecoration:'none', display:'block', marginBottom:36 }}>
            AETERNA
          </Link>
          <AnimatePresence mode="wait">
            <motion.h1 key={mode} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:.4 }}
              style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:200, fontStyle:'italic', color:'#F7F2EC', margin:0 }}>
              {titles[mode]}
            </motion.h1>
          </AnimatePresence>
        </div>

        <form onSubmit={handle} style={{ display:'flex', flexDirection:'column', gap:28 }}>

          {mode === 'signup' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <label style={{ fontSize:8, letterSpacing:'.4em', textTransform:'uppercase', color:'rgba(224,196,180,.38)', fontFamily:"'Jost',sans-serif" }}>Votre nom</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Marie Durand" required style={inputStyle} />
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <label style={{ fontSize:8, letterSpacing:'.4em', textTransform:'uppercase', color:'rgba(224,196,180,.38)', fontFamily:"'Jost',sans-serif" }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@domaine.fr" required autoFocus style={inputStyle} />
          </div>

          {mode !== 'forgot' && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <label style={{ fontSize:8, letterSpacing:'.4em', textTransform:'uppercase', color:'rgba(224,196,180,.38)', fontFamily:"'Jost',sans-serif" }}>Mot de passe</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required minLength={8} style={inputStyle} />
            </div>
          )}

          {error && (
            <p style={{ fontSize:11, color:'rgba(239,68,68,.7)', fontFamily:"'Jost',sans-serif", letterSpacing:'.03em', lineHeight:1.6 }}>{error}</p>
          )}
          {success && (
            <p style={{ fontSize:11, color:'rgba(74,222,128,.7)', fontFamily:"'Jost',sans-serif", letterSpacing:'.03em', lineHeight:1.6 }}>{success}</p>
          )}

          <button type="submit" disabled={loading} style={{
            padding:       '16px',
            background:    'transparent',
            border:        '1px solid rgba(224,196,180,.32)',
            color:         'rgba(224,196,180,.75)',
            fontFamily:    "'Jost',sans-serif",
            fontSize:      10, letterSpacing:'.35em', textTransform:'uppercase',
            cursor:        loading ? 'wait' : 'pointer',
            transition:    'all .3s',
            opacity:       loading ? .5 : 1,
          }}>
            {loading ? '...' : mode === 'login' ? 'Accéder' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        {/* Liens de navigation */}
        <div style={{ marginTop:40, display:'flex', flexDirection:'column', gap:12, alignItems:'center' }}>
          {mode === 'login' && (<>
            <button onClick={() => { setMode('signup'); setError(''); setSuccess('') }}
              style={{ background:'none', border:'none', color:'rgba(247,242,236,.3)', fontSize:10, letterSpacing:'.2em', cursor:'pointer', fontFamily:"'Jost',sans-serif", textTransform:'uppercase' }}>
              Créer un compte →
            </button>
            <button onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
              style={{ background:'none', border:'none', color:'rgba(247,242,236,.18)', fontSize:9, letterSpacing:'.15em', cursor:'pointer', fontFamily:"'Jost',sans-serif", textTransform:'uppercase' }}>
              Mot de passe oublié
            </button>
          </>)}
          {mode !== 'login' && (
            <button onClick={() => { setMode('login'); setError(''); setSuccess('') }}
              style={{ background:'none', border:'none', color:'rgba(247,242,236,.3)', fontSize:10, letterSpacing:'.2em', cursor:'pointer', fontFamily:"'Jost',sans-serif", textTransform:'uppercase' }}>
              ← Se connecter
            </button>
          )}
        </div>

        {/* Séparateur offres */}
        <div style={{ marginTop:56, paddingTop:36, borderTop:'1px solid rgba(224,196,180,.07)', textAlign:'center' }}>
          <p style={{ fontSize:10, color:'rgba(247,242,236,.2)', fontFamily:"'Jost',sans-serif", letterSpacing:'.08em', marginBottom:20 }}>
            Pas encore de compte ?
          </p>
          <Link href="/#pricing" style={{ fontSize:9, letterSpacing:'.3em', color:'rgba(224,196,180,.35)', textTransform:'uppercase', textDecoration:'none', fontFamily:"'Jost',sans-serif" }}>
            Voir nos sanctuaires →
          </Link>
        </div>
      </div>
    </main>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div style={{ background:'#020f09', minHeight:'100vh' }} />}>
      <AuthForm />
    </Suspense>
  )
}
