// @ts-nocheck
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence }                   from 'framer-motion'
import dynamic                                        from 'next/dynamic'
import NextLink                                       from 'next/link'

const ExperienceAudioPlayer = dynamic(() => import('@/components/audio/ExperienceAudioPlayer'), { ssr:false })
const LyraAmbient           = dynamic(() => import('@/components/audio/LyraAmbient'),           { ssr:false })

// ─── Protocole ────────────────────────────────────────────────────
const GLYPHS  = { ESSENCE:'◈', HERITAGE:'✦', DIAMOND:'◉' }
const ACCENTS = { ESSENCE:'#E0C4B4', HERITAGE:'#E0C4B4', DIAMOND:'#c4b0e8' }

// ─── Particules ───────────────────────────────────────────────────
function Particles({ accent }: { accent: string }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); let W=0,H=0,raf=0
    const resize = () => { W=c.width=window.innerWidth; H=c.height=window.innerHeight }
    const mk = (ry=false) => ({ x:Math.random()*W, y:ry?Math.random()*H:H+5, size:Math.random()*1.3+.25, speed:Math.random()*.3+.08, opacity:Math.random()*.28+.04, drift:(Math.random()-.5)*.22 })
    window.addEventListener('resize',resize); resize()
    let pts = Array.from({length:90},()=>mk(true))
    const draw = () => {
      ctx.clearRect(0,0,W,H)
      pts.forEach(p=>{
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2)
        ctx.fillStyle=`rgba(224,196,180,${p.opacity})`; ctx.fill()
        p.y-=p.speed; p.x+=p.drift; p.opacity-=.0003
        if(p.y<-5||p.opacity<=0) Object.assign(p,mk())
      })
      raf=requestAnimationFrame(draw)
    }
    draw()
    return ()=>{ window.removeEventListener('resize',resize); cancelAnimationFrame(raf) }
  },[])
  return <canvas ref={ref} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:1}}/>
}

// ─── Préchargeur ──────────────────────────────────────────────────
function Loader({ protocol, onDone }) {
  const [prog, setProg] = useState(0)
  const [out,  setOut]  = useState(false)
  const glyph  = GLYPHS[protocol]  ?? '◈'
  const accent = ACCENTS[protocol] ?? '#E0C4B4'

  useEffect(() => {
    let p=0
    const iv = setInterval(()=>{
      p += Math.random()*8+2
      if(p>=100){ p=100; clearInterval(iv); setProg(100); setTimeout(()=>{ setOut(true); setTimeout(onDone,550) },380) }
      setProg(p)
    }, 85)
    return ()=>clearInterval(iv)
  },[onDone])

  return (
    <AnimatePresence>
      {!out && (
        <motion.div key="ldr" exit={{opacity:0}} transition={{duration:.55}}
          style={{position:'fixed',inset:0,background:'#020f09',zIndex:500,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:36}}>
          <div style={{position:'relative',width:84,height:84}}>
            {[0,8,20].map((ins,i)=>(
              <div key={i} style={{position:'absolute',inset:ins,border:`1px solid ${accent}${['44','2a','18'][i]}`,borderRadius:'50%',animation:`sld${i} ${10-i*2}s linear infinite ${i%2?'reverse':''}`}}/>
            ))}
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Cormorant Garamond',serif",fontSize:28,color:accent,animation:'gpls 2s ease-in-out infinite',opacity:.7}}>
              {glyph}
            </div>
          </div>
          <div style={{textAlign:'center'}}>
            <span style={{display:'block',fontSize:8,letterSpacing:'.5em',color:`${accent}44`,textTransform:'uppercase',marginBottom:12,fontFamily:"'Jost',sans-serif"}}>
              Ouverture du sanctuaire
            </span>
          </div>
          <div style={{width:180,height:1,background:'rgba(224,196,180,.1)',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',top:0,left:0,height:'100%',background:accent,width:`${prog}%`,transition:'width .08s ease',boxShadow:`0 0 10px ${accent}80`}}/>
          </div>
          <style>{`
            @keyframes sld0{from{transform:rotate(0)}to{transform:rotate(360deg)}}
            @keyframes sld1{from{transform:rotate(0)}to{transform:rotate(-360deg)}}
            @keyframes sld2{from{transform:rotate(30deg)}to{transform:rotate(390deg)}}
            @keyframes gpls{0%,100%{opacity:.4}50%{opacity:.9}}
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Share button ─────────────────────────────────────────────────
function ShareButton({ slug, title, accent }) {
  const [copied, setCopied] = useState(false)
  const [open,   setOpen]   = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}/experience/${slug}` : ''

  async function copy() {
    await navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(()=>setCopied(false),2000)
  }

  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(!open)} style={{background:'transparent',border:`1px solid ${accent}30`,color:`${accent}70`,fontFamily:"'Jost',sans-serif",fontSize:9,letterSpacing:'.3em',textTransform:'uppercase',padding:'9px 22px',cursor:'pointer',transition:'all .3s'}}>
        Partager
      </button>
      {open && (
        <div style={{position:'absolute',bottom:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',background:'#043927',border:'1px solid rgba(224,196,180,.15)',padding:'20px',width:260,zIndex:100,boxShadow:'0 20px 60px rgba(0,0,0,.6)'}}>
          <p style={{fontSize:8,letterSpacing:'.35em',color:`${accent}55`,textTransform:'uppercase',marginBottom:14,fontFamily:"'Jost',sans-serif"}}>Partager ce sanctuaire</p>
          <button onClick={copy} style={{width:'100%',background:copied?'rgba(74,222,128,.08)':'rgba(224,196,180,.04)',border:`1px solid ${copied?'rgba(74,222,128,.3)':'rgba(224,196,180,.12)'}`,color:copied?'#4ade80':`${accent}80`,padding:'11px 14px',fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:'.2em',textTransform:'uppercase',cursor:'pointer',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'center',gap:10,transition:'all .3s'}}>
            {copied?'✓ Copié !':'⊡ Copier le lien'}
          </button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button onClick={()=>navigator.share({title,url})} style={{width:'100%',background:'transparent',border:'1px solid rgba(224,196,180,.08)',color:'rgba(247,242,236,.4)',padding:'11px 14px',fontFamily:"'Jost',sans-serif",fontSize:10,letterSpacing:'.2em',textTransform:'uppercase',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
              ↑ Partager via...
            </button>
          )}
          <p style={{marginTop:14,fontSize:8,color:'rgba(247,242,236,.15)',wordBreak:'break-all',lineHeight:1.5,fontFamily:"'Jost',sans-serif"}}>{url}</p>
        </div>
      )}
    </div>
  )
}

// ─── Vue principale ───────────────────────────────────────────────
export default function ExperienceView({ link }) {
  const [ready,    setReady]    = useState(false)
  const [revealed, setRevealed] = useState(false)

  const onDone = useCallback(()=>{
    setReady(true)
    setTimeout(()=>setRevealed(true), 150)
    // Track view
    fetch('/api/track-view',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({slug:link.slug}) }).catch(()=>{})
  },[link.slug])

  const protocol = link.protocol ?? 'ESSENCE'
  const accent   = ACCENTS[protocol] ?? '#E0C4B4'
  const glyph    = GLYPHS[protocol]  ?? '◈'
  const isDiamond = protocol === 'DIAMOND'
  const hasAudio  = !!link.audio_url

  const dateStr = new Date(link.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})

  return (
    <>
      <Loader protocol={protocol} onDone={onDone} />

      <motion.div initial={{opacity:0}} animate={{opacity:revealed?1:0}} transition={{duration:1.1,ease:'easeOut'}}
        style={{minHeight:'100vh',overflowY:'auto',position:'relative'}}>

        {/* Fond */}
        <div style={{position:'fixed',inset:0,zIndex:0,
          background: isDiamond
            ? 'radial-gradient(ellipse 70% 55% at 50% -5%,rgba(60,20,120,.3) 0%,transparent 70%),radial-gradient(ellipse 40% 30% at 85% 85%,rgba(180,160,224,.06) 0%,transparent 60%),#020f09'
            : 'radial-gradient(ellipse 80% 55% at 50% -5%,rgba(6,81,47,.35) 0%,transparent 70%),#020f09',
        }}/>

        <Particles accent={accent}/>

        <div style={{position:'relative',zIndex:10,minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 32px',textAlign:'center'}}>

          {/* Logo */}
          <motion.div initial={{opacity:0}} animate={{opacity:revealed?1:0}} transition={{delay:.2}} style={{marginBottom:52}}>
            <NextLink href="/" style={{fontFamily:"'Cinzel Decorative',serif",fontSize:10,letterSpacing:'.4em',color:'rgba(224,196,180,.22)',textDecoration:'none'}}>AETERNA</NextLink>
          </motion.div>

          {/* Glyph */}
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:revealed?1:0,y:revealed?0:12}} transition={{delay:.4}} style={{marginBottom:18}}>
            <span style={{fontSize:42,color:accent,opacity:.6,display:'block',lineHeight:1,marginBottom:10}}>{glyph}</span>
            <span style={{fontFamily:"'Jost',sans-serif",fontSize:8,letterSpacing:'.5em',textTransform:'uppercase',color:`${accent}55`}}>
              Sanctuaire {protocol}
            </span>
          </motion.div>

          {/* De la part de */}
          <motion.p initial={{opacity:0,y:12}} animate={{opacity:revealed?1:0,y:revealed?0:12}} transition={{delay:.55}}
            style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontStyle:'italic',color:'rgba(247,242,236,.38)',marginBottom:18,letterSpacing:'.06em'}}>
            De la part de <em style={{color:'rgba(247,242,236,.6)'}}>{link.sender_name}</em>
          </motion.p>

          {/* Titre */}
          <motion.h1 initial={{opacity:0,y:22}} animate={{opacity:revealed?1:0,y:revealed?0:22}} transition={{delay:.7,duration:1.1,ease:[.76,0,.24,1]}}
            style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(38px,8vw,100px)',fontWeight:200,lineHeight:.97,letterSpacing:'-.01em',marginBottom:64}}>
            {link.title.split(' ').map((w,i,a)=>
              i===a.length-1
                ? <em key={i} style={{fontStyle:'italic',color:accent,marginLeft:'.14em'}}>{w}</em>
                : <span key={i} style={{marginRight:'.14em'}}>{w}</span>
            )}
          </motion.h1>

          {/* Audio : player uploaded OU ambiant génératif */}
          <motion.div initial={{opacity:0,y:18}} animate={{opacity:revealed?1:0,y:revealed?0:18}} transition={{delay:1}}
            style={{width:'100%',maxWidth:520,marginBottom:64}}>
            {hasAudio
              ? <ExperienceAudioPlayer audioUrl={link.audio_url} waveform={link.audio_waveform} protocol={protocol} />
              : <LyraAmbient protocol={protocol} accentColor={accent} />
            }
          </motion.div>

          {/* Message */}
          <motion.div initial={{opacity:0,y:18}} animate={{opacity:revealed?1:0,y:revealed?0:18}} transition={{delay:hasAudio?1.25:1.05}}
            style={{maxWidth:580,marginBottom:72}}>
            <blockquote style={{fontFamily:"'Cormorant Garamond',serif",fontSize:'clamp(17px,2.5vw,24px)',fontWeight:200,fontStyle:'italic',lineHeight:1.72,color:'rgba(247,242,236,.82)',padding:'36px 44px',borderLeft:`1px solid ${accent}28`,borderRight:`1px solid ${accent}28`,position:'relative'}}>
              <span style={{position:'absolute',top:0,left:12,fontSize:72,color:`${accent}07`,fontFamily:'Georgia',lineHeight:1}}>&ldquo;</span>
              {link.message}
              <span style={{position:'absolute',bottom:-22,right:12,fontSize:72,color:`${accent}07`,fontFamily:'Georgia',lineHeight:1}}>&rdquo;</span>
            </blockquote>
            <p style={{marginTop:24,fontSize:10,letterSpacing:'.15em',color:'rgba(247,242,236,.18)',fontFamily:"'Jost',sans-serif"}}>
              Gravé le {dateStr} · Conservé pour toujours
            </p>
          </motion.div>

          {/* Actions */}
          <motion.div initial={{opacity:0}} animate={{opacity:revealed?1:0}} transition={{delay:1.5}}
            style={{display:'flex',gap:12,marginBottom:72,flexWrap:'wrap',justifyContent:'center'}}>
            <ShareButton slug={link.slug} title={link.title} accent={accent}/>
          </motion.div>

          {/* Badge éco */}
          <motion.div initial={{opacity:0}} animate={{opacity:revealed?1:0}} transition={{delay:1.65}}
            style={{display:'inline-flex',alignItems:'center',gap:14,padding:'12px 28px',border:'1px solid rgba(6,81,47,.5)',background:'rgba(6,81,47,.1)',marginBottom:72}}>
            <div style={{width:6,height:6,background:'#4ade80',borderRadius:'50%',animation:'eco-pulse 2s ease-in-out infinite'}}/>
            <p style={{fontSize:9,letterSpacing:'.18em',color:'rgba(247,242,236,.4)',textTransform:'uppercase',fontFamily:"'Jost',sans-serif",margin:0}}>
              <strong style={{color:'#4ade80',fontWeight:300}}>{link.eco_trees ?? 2} arbres plantés</strong> · 200% compensation carbone · EcoTree
            </p>
          </motion.div>

          {/* Gift-Loop CTA */}
          <motion.div initial={{opacity:0,y:18}} animate={{opacity:revealed?1:0,y:revealed?0:18}} transition={{delay:1.85}}
            style={{maxWidth:420,width:'100%',padding:'44px 40px',border:'1px solid rgba(224,196,180,.09)',marginBottom:72}}>
            <p style={{fontSize:8,letterSpacing:'.4em',color:'rgba(224,196,180,.22)',textTransform:'uppercase',marginBottom:14,fontFamily:"'Jost',sans-serif"}}>Vous aussi</p>
            <h3 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:200,lineHeight:1.15,color:'rgba(247,242,236,.65)',marginBottom:18}}>
              Créez votre <em style={{fontStyle:'italic',color:'#E0C4B4'}}>sanctuaire</em>
            </h3>
            <NextLink href={`/create?ref=${link.slug}`}
              style={{display:'inline-block',padding:'13px 36px',border:'1px solid rgba(224,196,180,.22)',color:'rgba(224,196,180,.55)',fontFamily:"'Jost',sans-serif",fontSize:9,letterSpacing:'.3em',textTransform:'uppercase',textDecoration:'none'}}>
              Découvrir AETERNA
            </NextLink>
          </motion.div>

        </div>

        <footer style={{textAlign:'center',padding:'32px 40px',borderTop:'1px solid rgba(224,196,180,.06)',position:'relative',zIndex:10}}>
          <NextLink href="/" style={{fontFamily:"'Cinzel Decorative',serif",fontSize:9,letterSpacing:'.3em',color:'rgba(224,196,180,.16)',display:'block',marginBottom:6,textDecoration:'none'}}>AETERNA</NextLink>
          <div style={{display:'flex',justifyContent:'center',gap:24,flexWrap:'wrap'}}>
            {[['Mentions légales','/mentions-legales'],['CGV','/cgv']].map(([l,h])=>(
              <NextLink key={l} href={h} style={{fontSize:8,letterSpacing:'.15em',color:'rgba(247,242,236,.12)',textDecoration:'none',fontFamily:"'Jost',sans-serif",textTransform:'uppercase'}}>{l}</NextLink>
            ))}
          </div>
        </footer>
      </motion.div>

      <style>{`@keyframes eco-pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,.4)}50%{box-shadow:0 0 0 7px rgba(74,222,128,0)}}`}</style>
    </>
  )
}
