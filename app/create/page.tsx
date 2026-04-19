'use client'

import { useState, Suspense, useCallback }  from 'react'
import { motion, AnimatePresence }           from 'framer-motion'
import { useSearchParams }                   from 'next/navigation'
import dynamic                               from 'next/dynamic'
import Link                                  from 'next/link'

const AudioUpload = dynamic(() => import('@/components/audio/AudioUpload'), { ssr:false })

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

function CreateForm() {
  const params  = useSearchParams()
  const refSlug = params.get('ref') ?? ''

  const [step,      setStep]      = useState(1)
  const [plan,      setPlan]      = useState<Plan>('heritage')
  const [form,      setForm]      = useState<Form>({ sender_name:'', sender_email:'', recipient_name:'', recipient_email:'', title:'', message:'' })
  const [audioFile, setAudioFile] = useState<File|null>(null)
  const [audioWave, setAudioWave] = useState<number[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const selectedPlan = PLANS.find(p => p.key === plan)!
  const upd = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const canStep2 = form.sender_name && form.sender_email && form.recipient_name
  const canStep3 = !!canStep2 && form.title.length >= 1

  const onAudioUpload = useCallback((f: File, wave: number[]) => {
    setAudioFile(f); setAudioWave(wave)
  }, [])

  async function handleSubmit() {
    setLoading(true); setError('')
    try {
      let audioUrl: string | undefined
      let audioFilename: string | undefined

      if (audioFile && selectedPlan.hasAudio) {
        const fd = new FormData()
        fd.append('file', audioFile)
        const upRes  = await fetch('/api/upload-audio', { method:'POST', body:fd
