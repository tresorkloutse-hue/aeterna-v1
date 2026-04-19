'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface AudioUploadProps {
  onUpload: (file: File, waveform: number[]) => void
  maxDurationSec?: number
  accept?: string
}

// ─── Traitement du signal audio ──────────────────────────────────
async function extractWaveform(file: File, samples = 120): Promise<number[]> {
  const ctx    = new AudioContext()
  const buffer = await file.arrayBuffer()
  const audio  = await ctx.decodeAudioData(buffer)
  const data   = audio.getChannelData(0)
  const step   = Math.floor(data.length / samples)
  const wave: number[] = []

  for (let i = 0; i < samples; i++) {
    let peak = 0
    for (let j = 0; j < step; j++) {
      const abs = Math.abs(data[i * step + j])
      if (abs > peak) peak = abs
    }
    wave.push(peak)
  }

  // Normalisation
  const max = Math.max(...wave, 0.001)
  await ctx.close()
  return wave.map(v => v / max)
}

// ─── Rendu de la waveform ────────────────────────────────────────
function WaveformDisplay({ data, progress = 0 }: { data: number[]; progress?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return
    const ctx    = canvas.getContext('2d')!
    const dpr    = window.devicePixelRatio || 1
    canvas.width  = canvas.offsetWidth  * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx.scale(dpr, dpr)
    const W = canvas.offsetWidth, H = canvas.offsetHeight
    ctx.clearRect(0, 0, W, H)

    data.forEach((v, i) => {
      const x    = (i / data.length) * W
      const barW = (W / data.length) * 0.6
      const h    = v * H * 0.85 + 2
      const y    = (H - h) / 2
      const done = (i / data.length) < progress

      ctx.fillStyle = done
        ? `rgba(224,196,180,${0.4 + v * 0.5})`
        : `rgba(224,196,180,${0.08 + v * 0.15})`
      ctx.fillRect(x, y, barW, h)
    })
  }, [data, progress])

  return (
    <canvas
      ref={canvasRef}
      style={{ width:'100%', height:72, display:'block' }}
    />
  )
}

// ─── Player audio ────────────────────────────────────────────────
function MiniPlayer({ file, waveform }: { file: File; waveform: number[] }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress,  setProgress]  = useState(0)
  const [elapsed,   setElapsed]   = useState(0)
  const audioRef   = useRef<HTMLAudioElement | null>(null)
  const urlRef     = useRef<string>('')

  useEffect(() => {
    urlRef.current = URL.createObjectURL(file)
    return () => URL.revokeObjectURL(urlRef.current)
  }, [file])

  function toggle() {
    if (!audioRef.current) {
      audioRef.current = new Audio(urlRef.current)
      audioRef.current.ontimeupdate = () => {
        const a = audioRef.current!
        setProgress(a.currentTime / a.duration)
        setElapsed(a.currentTime)
      }
      audioRef.current.onended = () => { setIsPlaying(false); setProgress(0) }
    }
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const fmt = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`

  return (
    <div style={{ marginTop:20 }}>
      <WaveformDisplay data={waveform} progress={progress} />
      <div style={{ display:'flex', alignItems:'center', gap:20, marginTop:14 }}>
        <span style={{ fontSize:11, color:'rgba(247,242,236,.3)', minWidth:36, fontFamily:"'Jost',sans-serif", fontVariantNumeric:'tabular-nums' }}>
          {fmt(elapsed)}
        </span>
        <button onClick={toggle} style={{
          width:48, height:48, borderRadius:'50%',
          border:`1px solid rgba(224,196,180,${isPlaying?.5:.25})`,
          background: isPlaying ? 'rgba(224,196,180,.1)' : 'transparent',
          color:'#E0C4B4', fontSize:isPlaying?13:17,
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
          paddingLeft: isPlaying ? 0 : 3,
          transition:'all .3s',
        }}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span style={{ fontSize:11, color:'rgba(247,242,236,.2)', fontFamily:"'Jost',sans-serif" }}>
          {file.name.length > 28 ? file.name.slice(0,28)+'…' : file.name}
        </span>
      </div>
    </div>
  )
}

// ─── Upload principal ────────────────────────────────────────────
export default function AudioUpload({
  onUpload,
  maxDurationSec = 300,
  accept = 'audio/mp3,audio/wav,audio/m4a,audio/ogg,audio/flac',
}: AudioUploadProps) {
  const [drag,     setDrag]     = useState(false)
  const [file,     setFile]     = useState<File | null>(null)
  const [waveform, setWaveform] = useState<number[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const process = useCallback(async (f: File) => {
    setError('')
    setLoading(true)
    try {
      if (f.size > 50 * 1024 * 1024) throw new Error('Fichier trop volumineux (max 50 MB)')
      const wave = await extractWaveform(f)
      setFile(f)
      setWaveform(wave)
      onUpload(f, wave)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de traitement')
    } finally {
      setLoading(false)
    }
  }, [onUpload])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) process(f)
  }, [process])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) process(f)
  }, [process])

  return (
    <div>
      {/* Zone de drop */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `1px dashed rgba(224,196,180,${drag ? .5 : .2})`,
            background: drag ? 'rgba(224,196,180,.04)' : 'transparent',
            padding: '48px 32px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all .3s',
            position: 'relative',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={onFileChange}
            style={{ display:'none' }}
          />

          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
              <div style={{ width:40, height:40, border:'1px solid rgba(224,196,180,.3)', borderRadius:'50%', borderTop:'1px solid rgba(224,196,180,.8)', animation:'spin 1s linear infinite' }} />
              <span style={{ fontSize:11, color:'rgba(247,242,236,.35)', letterSpacing:'.15em', fontFamily:"'Jost',sans-serif" }}>
                Traitement du signal...
              </span>
            </div>
          ) : (
            <>
              {/* Icône audio */}
              <div style={{ marginBottom:20 }}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ margin:'0 auto', display:'block' }}>
                  <rect x=".5" y=".5" width="39" height="39" rx="4" stroke="rgba(224,196,180,.2)" />
                  <path d="M20 8v16M14 12v8M26 12v8M8 16v4M32 16v4" stroke="#E0C4B4" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
                </svg>
              </div>
              <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontStyle:'italic', color:'rgba(247,242,236,.6)', marginBottom:10 }}>
                Déposez votre fichier audio
              </p>
              <p style={{ fontSize:10, letterSpacing:'.2em', color:'rgba(247,242,236,.25)', textTransform:'uppercase', fontFamily:"'Jost',sans-serif" }}>
                MP3, WAV, FLAC, M4A · Max 50 MB · {maxDurationSec/60} min
              </p>
            </>
          )}
        </div>
      )}

      {/* Résultat */}
      {file && waveform.length > 0 && (
        <div style={{ border:'1px solid rgba(224,196,180,.18)', padding:'28px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <span style={{ fontSize:8, letterSpacing:'.35em', textTransform:'uppercase', color:'rgba(224,196,180,.4)', fontFamily:"'Jost',sans-serif" }}>
              ◈ Signal audio capturé
            </span>
            <button
              onClick={() => { setFile(null); setWaveform([]) }}
              style={{ background:'transparent', border:'none', color:'rgba(247,242,236,.25)', fontSize:9, letterSpacing:'.2em', cursor:'pointer', textTransform:'uppercase', fontFamily:"'Jost',sans-serif" }}
            >
              Changer
            </button>
          </div>
          <MiniPlayer file={file} waveform={waveform} />
        </div>
      )}

      {error && (
        <p style={{ fontSize:11, color:'rgba(239,68,68,.7)', marginTop:12, fontFamily:"'Jost',sans-serif", letterSpacing:'.03em' }}>
          {error}
        </p>
      )}

      <style>{`@keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}
