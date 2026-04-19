'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface LyraPlayerProps {
  audioUrl:    string
  waveform?:   number[]
  slug:        string
  accentColor?: string
}

export default function LyraPlayer({
  audioUrl,
  waveform = [],
  slug,
  accentColor = '#E0C4B4',
}: LyraPlayerProps) {
  const [isPlaying, setIsPlaying]   = useState(false)
  const [progress,  setProgress]    = useState(0)
  const [elapsed,   setElapsed]     = useState(0)
  const [duration,  setDuration]    = useState(0)
  const [volume,    setVolume]      = useState(0.85)
  const [tracked,   setTracked]     = useState(false)

  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const animRef    = useRef(0)

  // Initialiser l'audio
  useEffect(() => {
    const audio = new Audio(audioUrl)
    audio.volume = volume
    audioRef.current = audio

    audio.onloadedmetadata = () => setDuration(audio.duration)
    audio.ontimeupdate = () => {
      setProgress(audio.currentTime / audio.duration)
      setElapsed(audio.currentTime)
    }
    audio.onended = () => { setIsPlaying(false); setProgress(0); setElapsed(0) }

    return () => { audio.pause(); cancelAnimationFrame(animRef.current) }
  }, [audioUrl])

  // Waveform statique
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = devicePixelRatio || 1
    canvas.width  = canvas.offsetWidth  * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx.scale(dpr, dpr)
    const W = canvas.offsetWidth, H = canvas.offsetHeight
    const data = waveform.length > 0 ? waveform : Array.from({ length:90 }, () => Math.random())

    data.forEach((v, i) => {
      const h = (v * .85 + .08) * H
      const x = (i / data.length) * W
      const w = (W / data.length) * .58
      ctx.fillStyle = `rgba(224,196,180,${.05 + v * .1})`
      ctx.fillRect(x, (H - h) / 2, w, h)
    })
  }, [waveform])

  // Waveform live (progress)
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.offsetWidth, H = canvas.offsetHeight
    const data = waveform.length > 0 ? waveform : Array.from({ length:90 }, () => Math.random())

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const p = progress

      data.forEach((v, i) => {
        const frac = i / data.length
        const h    = (v * .85 + .08) * H
        const x    = frac * W
        const w    = (W / data.length) * .58
        const done = frac < p
        ctx.fillStyle = done
          ? `rgba(224,196,180,${.3 + v * .55})`
          : `rgba(224,196,180,${.05 + v * .08})`
        ctx.fillRect(x, (H - h) / 2, w, h)
      })

      // Curseur
      if (p > 0 && p < 1) {
        ctx.fillStyle = accentColor
        ctx.fillRect(p * W - 1, 0, 2, H)
      }

      if (isPlaying) animRef.current = requestAnimationFrame(draw)
    }

    if (isPlaying) {
      draw()
    } else {
      draw()
      cancelAnimationFrame(animRef.current)
    }
  }, [isPlaying, progress, waveform, accentColor])

  const toggle = useCallback(() => {
    const audio = audioRef.current; if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
      // Tracker la lecture (une seule fois)
      if (!tracked) {
        setTracked(true)
        fetch('/api/track-play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        }).catch(() => {})
      }
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, slug, tracked])

  const seek = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas || !audioRef.current) return
    const rect  = canvas.getBoundingClientRect()
    const frac  = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = frac * audioRef.current.duration
    setProgress(frac)
  }, [])

  const onVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }, [])

  const fmt = (s: number) => isNaN(s) ? '0:00' : `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`

  return (
    <div>
      <p style={{ fontSize:8, letterSpacing:'.4em', textTransform:'uppercase', color:`${accentColor}55`, marginBottom:20, textAlign:'center', fontFamily:"'Jost',sans-serif" }}>
        ◈ &nbsp; Moteur Sonore LYRA · Haute-Fidélité
      </p>

      {/* Waveform cliquable */}
      <canvas
        ref={canvasRef}
        onClick={seek}
        style={{ width:'100%', height:72, display:'block', borderBottom:`1px solid ${accentColor}18`, cursor:'pointer' }}
      />

      {/* Contrôles */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:28, marginTop:20 }}>
        <span style={{ fontSize:11, color:'rgba(247,242,236,.28)', fontVariantNumeric:'tabular-nums', minWidth:36, fontFamily:"'Jost',sans-serif" }}>
          {fmt(elapsed)}
        </span>

        <button onClick={toggle} style={{
          width:56, height:56, borderRadius:'50%',
          border:`1px solid ${accentColor}${isPlaying ? '80' : '40'}`,
          background: isPlaying ? `${accentColor}14` : 'transparent',
          color: accentColor,
          fontSize: isPlaying ? 13 : 19,
          cursor: 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          paddingLeft: isPlaying ? 0 : 4,
          transition: 'all .3s',
        }}>
          {isPlaying ? '⏸' : '▶'}
        </button>

        <span style={{ fontSize:11, color:'rgba(247,242,236,.2)', fontVariantNumeric:'tabular-nums', minWidth:36, fontFamily:"'Jost',sans-serif" }}>
          {fmt(duration)}
        </span>

        {/* Volume */}
        <input
          type="range" min={0} max={1} step={.01} value={volume}
          onChange={onVolumeChange}
          style={{ width:60, accentColor, cursor:'pointer', opacity:.6 }}
        />
      </div>
    </div>
  )
}
