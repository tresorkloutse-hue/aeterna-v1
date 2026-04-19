'use client'

import { useRef, useState, useCallback } from 'react'

interface LyraAmbientProps {
  protocol: string
  accentColor?: string
}

// Accord par protocole — construit une atmosphère sonore unique
const CHORDS: Record<string, { freqs: number[]; name: string }> = {
  ESSENCE:  { freqs:[110.0, 138.6, 164.8], name:'La mineur · Do# · Mi' },
  HERITAGE: { freqs:[130.8, 164.8, 196.0], name:'Do majeur · Mi · Sol' },
  DIAMOND:  { freqs:[138.6, 185.0, 220.0], name:'Do# majeur · Fa# · La' },
}
const DEFAULT_CHORD = CHORDS.ESSENCE

export default function LyraAmbient({ protocol, accentColor = '#E0C4B4' }: LyraAmbientProps) {
  const [active, setActive]   = useState(false)
  const [built,  setBuilt]    = useState(false)
  const ctxRef  = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const chord = CHORDS[protocol] ?? DEFAULT_CHORD

  const buildGraph = useCallback(() => {
    if (built) return
    setBuilt(true)

    const ctx    = new (window.AudioContext || (window as any).webkitAudioContext)()
    ctxRef.current = ctx

    const master = ctx.createGain()
    master.gain.setValueAtTime(0, ctx.currentTime)
    master.connect(ctx.destination)
    masterRef.current = master

    // Reverb synthétique (impulse response)
    const conv = ctx.createConvolver()
    const len  = ctx.sampleRate * 5
    const ir   = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2)
    }
    conv.buffer = ir
    conv.connect(master)

    // 3 oscillateurs fondamentaux avec LFO vibrato
    chord.freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      const lfo  = ctx.createOscillator()
      const lfog = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = freq

      lfo.frequency.value = 0.10 + i * 0.045
      lfog.gain.value     = 0.3
      lfo.connect(lfog); lfog.connect(osc.frequency)
      lfo.start()

      gain.gain.setValueAtTime(0, ctx.currentTime)
      gain.gain.linearRampToValueAtTime(0.065 - i * 0.015, ctx.currentTime + 4)

      osc.connect(gain)
      gain.connect(conv)
      gain.connect(master)
      osc.start()
    })

    // Harmoniques shimmer (hautes fréquences)
    const shimmerFreqs = [2093, 3136, 4186, 5274]
    shimmerFreqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type         = 'sine'
      osc.frequency.value = freq
      gain.gain.value  = 0
      osc.connect(gain); gain.connect(conv); osc.start()

      const pulse = () => {
        if (!ctxRef.current) return
        const now = ctxRef.current.currentTime
        gain.gain.setValueAtTime(0, now)
        gain.gain.linearRampToValueAtTime(0.0035 + Math.random() * 0.002, now + 2)
        gain.gain.linearRampToValueAtTime(0, now + 5)
        setTimeout(pulse, 5000 + i * 1800 + Math.random() * 3000)
      }
      setTimeout(pulse, 2000 + i * 600)
    })

    // Sub-bass très doux
    const sub  = ctx.createOscillator()
    const subG = ctx.createGain()
    sub.type = 'sine'
    sub.frequency.value = chord.freqs[0] / 2
    subG.gain.setValueAtTime(0, ctx.currentTime)
    subG.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 6)
    sub.connect(subG); subG.connect(master); sub.start()
  }, [built, chord])

  const toggle = useCallback(() => {
    if (!built) buildGraph()

    const ctx = ctxRef.current
    const master = masterRef.current
    if (!ctx || !master) return

    if (ctx.state === 'suspended') ctx.resume()

    if (!active) {
      master.gain.linearRampToValueAtTime(0.75, ctx.currentTime + 1.5)
      setActive(true)
    } else {
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2)
      setTimeout(() => ctx.suspend(), 1300)
      setActive(false)
    }
  }, [active, built, buildGraph])

  return (
    <div style={{ textAlign:'center' }}>
      <p style={{ fontSize:8, letterSpacing:'.4em', textTransform:'uppercase', color:`${accentColor}55`, marginBottom:24, fontFamily:"'Jost',sans-serif" }}>
        ◈ &nbsp; Moteur Sonore LYRA · Génératif
      </p>

      {/* Visualiseur de fréquences CSS */}
      <div style={{ height:64, display:'flex', alignItems:'center', justifyContent:'center', gap:2, marginBottom:28, overflow:'hidden' }}>
        {Array.from({ length:48 }).map((_, i) => (
          <div key={i} style={{
            width: 3,
            background: accentColor,
            borderRadius: 1,
            opacity: active ? 0.15 + Math.random() * 0.25 : 0.06 + (Math.sin(i * 0.4) * 0.5 + 0.5) * 0.1,
            animation: active
              ? `bar-dance ${0.8 + (i % 7) * 0.15}s ease-in-out infinite alternate ${i * 0.04}s`
              : 'none',
            height: active
              ? `${16 + (Math.sin(i * 0.6) * 0.5 + 0.5) * 40}px`
              : `${6 + (Math.sin(i * 0.4) * 0.5 + 0.5) * 18}px`,
            transition: 'height .6s ease, opacity .6s ease',
          }} />
        ))}
      </div>

      <button onClick={toggle} style={{
        width:56, height:56, borderRadius:'50%',
        border:`1px solid ${accentColor}${active?'80':'30'}`,
        background: active ? `${accentColor}12` : 'transparent',
        color: accentColor,
        fontSize: active ? 13 : 19,
        cursor: 'pointer',
        display: 'inline-flex', alignItems:'center', justifyContent:'center',
        paddingLeft: active ? 0 : 4,
        transition: 'all .35s',
      }}>
        {active ? '⏸' : '▶'}
      </button>

      {active && (
        <p style={{ marginTop:16, fontSize:9, color:`${accentColor}45`, fontFamily:"'Jost',sans-serif", letterSpacing:'.12em' }}>
          {chord.name}
        </p>
      )}

      <style>{`
        @keyframes bar-dance {
          from { transform: scaleY(0.5); opacity: 0.12; }
          to   { transform: scaleY(1.8); opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
