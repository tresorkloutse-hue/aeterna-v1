'use client'

import { useState }    from 'react'
import { useRouter }   from 'next/navigation'

interface Props {
  slug:   string
  status: string
  experienceUrl: string
}

export default function DashboardLinkActions({ slug, status, experienceUrl }: Props) {
  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)
  const router = useRouter()

  async function archive() {
    if (!confirm(`Archiver ce sanctuaire ? Il ne sera plus accessible.`)) return
    setLoading(true)
    try {
      await fetch('/api/link-action', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ slug, action: 'archive' }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function restore() {
    setLoading(true)
    try {
      await fetch('/api/link-action', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ slug, action: 'restore' }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(experienceUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    // Incrémenter le compteur de partages
    fetch('/api/link-action', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ slug, action: 'track-share' }),
    }).catch(() => {})
  }

  const btnBase: React.CSSProperties = {
    background:    'transparent',
    border:        '1px solid rgba(224,196,180,.12)',
    fontFamily:    "'Jost', sans-serif",
    fontSize:      8,
    letterSpacing: '.2em',
    textTransform: 'uppercase',
    padding:       '5px 10px',
    cursor:        loading ? 'wait' : 'pointer',
    transition:    'all .2s',
    whiteSpace:    'nowrap',
  }

  return (
    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
      {/* Copier le lien */}
      <button onClick={copyLink}
        style={{ ...btnBase, color: copied ? '#4ade80' : 'rgba(247,242,236,.4)', borderColor: copied ? 'rgba(74,222,128,.3)' : 'rgba(224,196,180,.12)' }}>
        {copied ? '✓' : '⊡'}
      </button>

      {/* Archive/Restore */}
      {status === 'active' && (
        <button onClick={archive} disabled={loading}
          style={{ ...btnBase, color:'rgba(247,242,236,.28)' }}>
          {loading ? '…' : 'Archiver'}
        </button>
      )}
      {status === 'archived' && (
        <button onClick={restore} disabled={loading}
          style={{ ...btnBase, color:'rgba(74,222,128,.5)', borderColor:'rgba(74,222,128,.2)' }}>
          {loading ? '…' : 'Restaurer'}
        </button>
      )}
    </div>
  )
}
