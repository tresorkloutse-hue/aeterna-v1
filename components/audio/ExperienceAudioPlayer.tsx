'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface Props {
  audioUrl:  string
  waveform?: number[] | null
  protocol:  string
  onPlay?:   () => void
}

const PROTOCOL_COLORS: Record<string, string> = {
  ESSENCE:  '#E0C4B4',
  HERITAGE: '#E0C4B4',
  DIAMOND:  '#c4b0e8',
}

export default function ExperienceAudioPlayer({ audioUrl, waveform, protocol, onPlay }: Props) {
  const audioRef    = useRef<HTMLAudioElement | null>(null)
  const ctxRef      = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const rafRef      = useRef(0)
  const playedRef   = useRef(false)

  const [isPlaying, setIsPlaying] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [elapsed,   setElapsed]   = useState(0)
  const [duration,  setDuration]  = useState(0)
  const [volume,    setVolume]    = useState(0.85)

  const accent = PROTOCOL_COLORS[protocol] ?? '#E0C4B4'

  // Dessiner la waveform statique
  useEffect(()=>{
    const c = canvasRef.current; if(!c) return
    const ctx = c.getContext('2d')!
    const dpr = window.devicePixelRatio||1
    c.width=c.offsetWidth*dpr; c.height=c.offsetHeight*dpr; ctx.scale(dpr,dpr)
    const W=c.offsetWidth, H=c.offsetHeight
    const data = waveform ?? Array.from({length:90},()=>Math.random()*.6+.1)
    data.forEach((v,i)=>{
      const h=v*H*.85+2, x=(i/data.length)*W, w=(W/data.length)*.6
      ctx.fillStyle=`rgba(224,196,180,${.06+v*.1})`
      ctx.fillRect(x,(H-h)/2,w,h)
    })
  },[waveform])

  // Animation live waveform
  const drawLive = useCallback(()=>{
    if(!analyserRef.current||!canvasRef.current) return
    const c=canvasRef.current, ctx=c.getContext('2d')!
    const W=c.offsetWidth, H=c.offsetHeight
    const data=new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    ctx.clearRect(0,0,W,H)
    data.forEach((v,i)=>{
      const h=(v/255)*H*.9+2, x=(i/data.length)*W, w=(W/data.length)*.65
      ctx.fillStyle=`rgba(224,196,180,${.08+(v/255)*.6})`
      ctx.fillRect(x,(H-h)/2,w,h)
    })
    if(audioRef.current){
      const a=audioRef.current
      setProgress(a.currentTime/a.duration||0)
      setElapsed(a.currentTime)
    }
    rafRef.current=requestAnimationFrame(drawLive)
  },[])

  function initAudio() {
    if(ctxRef.current) return
    const ctx = new (window.AudioContext||(window as any).webkitAudioContext)()
    ctxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize=512
    analyserRef.current = analyser

    const audio = new Audio(audioUrl)
    audio.crossOrigin='anonymous'
    audioRef.current = audio

    const src = ctx.createMediaElementSource(audio)
    const gain = ctx.createGain()
    gain.gain.value = volume

    src.connect(analyser)
    analyser.connect(gain)
    gain.connect(ctx.destination)

    audio.onloadedmetadata = () => setDuration(audio.duration)
    audio.onended = () => { setIsPlaying(false); setProgress(0); cancelAnimationFrame(rafRef.current) }
  }

  function toggle() {
    initAudio()
    if(!audioRef.current) return
    if(ctxRef.current?.state==='suspended') ctxRef.current.resume()

    if(isPlaying) {
      audioRef.current.pause()
      cancelAnimationFrame(rafRef.current)
    } else {
      audioRef.current.play()
      drawLive()
      if(!playedRef.current) { playedRef.current=true; onPlay?.() }
    }
    setIsPlaying(p=>!p)
  }

  function seek(e: React.MouseEvent<HTMLCanvasElement>) {
    if(!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct  = (e.clientX-rect.left)/rect.width
    audioRef.current.currentTime = pct * audioRef.current.duration
  }

  function changeVolume(v: number) {
    setVolume(v)
    if(ctxRef.current) {
      // Re-create gain node not needed — we'd need a ref. Simple approach: set audio.volume
      if(audioRef.current) audioRef.current.volume = v
    }
  }

  const fmt = (s:number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`

  return (
    <div>
      <p style={{fontSize:8,letterSpacing:'.4em',textTransform:'uppercase',color:'rgba(224,196,180,.32)',marginBottom:22,textAlign:'center',fontFamily:"'Jost',sans-serif"}}>
        {protocol==='HERITAGE'?'✦':protocol==='DIAMOND'?'◉':'◈'} &nbsp; Moteur Sonore LYRA
      </p>

      {/* Waveform cliquable */}
      <canvas
        ref={canvasRef}
        onClick={seek}
        style={{width:'100%',height:68,display:'block',borderBottom:'1px solid rgba(224,196,180,.1)',cursor:'pointer'}}
      />

      {/* Progress bar */}
      <div style={{height:1,background:'rgba(224,196,180,.08)',position:'relative',marginBottom:20}}>
        <div style={{position:'absolute',top:0,left:0,height:'100%',background:accent,width:`${progress*100}%`,transition:'width .1s linear',boxShadow:`0 0 8px ${accent}40`}}/>
      </div>

      {/* Controls */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:28}}>
        <span style={{fontSize:10,color:'rgba(247,242,236,.28)',minWidth:36,fontVariantNumeric:'tabular-nums',fontFamily:"'Jost',sans-serif"}}>{fmt(elapsed)}</span>

        <button onClick={toggle} style={{
          width:56,height:56,borderRadius:'50%',
          border:`1px solid rgba(224,196,180,${isPlaying?.55:.28})`,
          background:isPlaying?'rgba(224,196,180,.1)':'transparent',
          color:accent,fontSize:isPlaying?13:19,
          cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
          paddingLeft:isPlaying?0:3,transition:'all .3s',
        }}>
          {isPlaying?'⏸':'▶'}
        </button>

        <span style={{fontSize:10,color:'rgba(247,242,236,.18)',minWidth:36,fontVariantNumeric:'tabular-nums',fontFamily:"'Jost',sans-serif"}}>{duration>0?fmt(duration):'—'}</span>

        <input type="range" min={0} max={1} step={.01} value={volume}
          onChange={e=>changeVolume(parseFloat(e.target.value))}
          style={{width:72,accentColor:accent,cursor:'pointer'}}
        />
      </div>
    </div>
  )
}
