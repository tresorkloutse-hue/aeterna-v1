'use client'

import { useState, useMemo }        from 'react'
import DashboardLinkActions          from './DashboardLinkActions'
import Link                          from 'next/link'

interface DashLink {
  id: string; slug: string; title: string; protocol: string
  status: string; view_count: number; audio_play_count: number
  share_count: number; created_at: string; recipient_name: string
}

interface Props {
  links:   DashLink[]
  baseUrl: string
}

const PROTOCOL_GLYPHS: Record<string, string> = { ESSENCE:'◈', HERITAGE:'✦', DIAMOND:'◉' }
const STATUS_COLORS:   Record<string, string> = { active:'#4ade80', draft:'#facc15', archived:'rgba(247,242,236,.25)' }
const PAGE_SIZE = 10

export default function DashboardTable({ links, baseUrl }: Props) {
  const [query,      setQuery]      = useState('')
  const [filter,     setFilter]     = useState<'all'|'active'|'archived'>('all')
  const [sortBy,     setSortBy]     = useState<'created_at'|'view_count'|'share_count'>('created_at')
  const [sortDir,    setSortDir]    = useState<'desc'|'asc'>('desc')
  const [page,       setPage]       = useState(1)

  const filtered = useMemo(() => {
    let rows = [...links]

    // Filtre statut
    if (filter !== 'all') rows = rows.filter(l => l.status === filter)

    // Recherche
    if (query.trim()) {
      const q = query.toLowerCase()
      rows = rows.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.recipient_name.toLowerCase().includes(q) ||
        l.slug.toLowerCase().includes(q)
      )
    }

    // Tri
    rows.sort((a, b) => {
      const va = a[sortBy], vb = b[sortBy]
      const cmp = va < vb ? -1 : va > vb ? 1 : 0
      return sortDir === 'desc' ? -cmp : cmp
    })

    return rows
  }, [links, query, filter, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(col); setSortDir('desc') }
    setPage(1)
  }

  function exportCSV() {
    const header = 'Slug,Titre,Protocole,Destinataire,Statut,Vues,Écoutes,Partages,Date\n'
    const rows = filtered.map(l =>
      [l.slug, `"${l.title.replace(/"/g,'""')}"`, l.protocol, `"${l.recipient_name}"`,
       l.status, l.view_count, l.audio_play_count, l.share_count,
       new Date(l.created_at).toLocaleDateString('fr-FR')].join(',')
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = `aeterna-sanctuaires-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const inp: React.CSSProperties = {
    background:'transparent', border:'1px solid rgba(224,196,180,.12)',
    color:'rgba(247,242,236,.7)', fontFamily:"'Jost',sans-serif",
    fontSize:11, padding:'8px 14px', outline:'none', letterSpacing:'.02em',
  }
  const btn = (active=false): React.CSSProperties => ({
    background: active ? 'rgba(224,196,180,.1)' : 'transparent',
    border: `1px solid rgba(224,196,180,${active ? .3 : .1})`,
    color: active ? '#E0C4B4' : 'rgba(247,242,236,.4)',
    fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'.2em',
    textTransform:'uppercase', padding:'7px 14px', cursor:'pointer', transition:'all .2s',
  })

  return (
    <div>
      {/* Barre de contrôles */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input
          type="text" placeholder="Rechercher..." value={query}
          onChange={e => { setQuery(e.target.value); setPage(1) }}
          style={{ ...inp, flex:1, minWidth:180 }}
        />
        <div style={{ display:'flex', gap:2 }}>
          {(['all','active','archived'] as const).map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1) }} style={btn(filter===f)}>
              {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Archivés'}
            </button>
          ))}
        </div>
        <button onClick={exportCSV} style={{ ...btn(), color:'rgba(74,222,128,.5)', borderColor:'rgba(74,222,128,.2)' }}>
          ↓ CSV
        </button>
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 40px', border:'1px dashed rgba(224,196,180,.1)' }}>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontStyle:'italic', color:'rgba(247,242,236,.3)' }}>
            {query ? 'Aucun résultat.' : filter !== 'all' ? `Aucun sanctuaire ${filter}.` : 'Votre premier sanctuaire vous attend.'}
          </p>
          {!query && filter === 'all' && (
            <Link href="/create" style={{ display:'inline-block', marginTop:24, padding:'12px 36px', border:'1px solid rgba(224,196,180,.25)', color:'rgba(224,196,180,.6)', fontFamily:"'Jost',sans-serif", fontSize:9, letterSpacing:'.3em', textTransform:'uppercase', textDecoration:'none' }}>
              Créer un sanctuaire
            </Link>
          )}
        </div>
      ) : (
        <>
          <div style={{ border:'1px solid rgba(224,196,180,.07)', overflow:'hidden' }}>
            {/* Header */}
            <div style={{ display:'grid', gridTemplateColumns:'36px 1fr 110px 80px 52px 52px 64px 96px', background:'rgba(6,57,39,.25)', padding:'10px 16px', borderBottom:'1px solid rgba(224,196,180,.07)', gap:8 }}>
              {[
                ['', null],
                ['Sanctuaire', null],
                ['Destinataire', null],
                ['Date', 'created_at'],
                ['Vues', 'view_count'],
                ['Écoutes', 'audio_play_count'],
                ['Statut', null],
                ['', null],
              ].map(([label, col], i) => (
                <button key={i} onClick={() => col && toggleSort(col as typeof sortBy)}
                  style={{ background:'none', border:'none', padding:0, cursor:col?'pointer':'default', textAlign:'left' }}>
                  <span style={{ fontSize:7, letterSpacing:'.3em', textTransform:'uppercase', color: col===sortBy?'#E0C4B4':'rgba(224,196,180,.35)', fontFamily:"'Jost',sans-serif" }}>
                    {label}{col===sortBy ? (sortDir==='desc'?' ↓':' ↑') : ''}
                  </span>
                </button>
              ))}
            </div>

            {/* Rows */}
            {visible.map((l, i) => (
              <div key={l.id} style={{
                display:'grid', gridTemplateColumns:'36px 1fr 110px 80px 52px 52px 64px 96px',
                padding:'12px 16px', alignItems:'center', gap:8,
                borderBottom: i < visible.length-1 ? '1px solid rgba(224,196,180,.04)' : 'none',
                background: i%2===0 ? 'transparent' : 'rgba(255,255,255,.008)',
              }}>
                <span style={{ fontSize:16, color:'#E0C4B4', opacity:.5 }}>{PROTOCOL_GLYPHS[l.protocol]??'◈'}</span>
                <div>
                  <Link href={`/experience/${l.slug}`} target="_blank"
                    style={{ fontSize:12, color:'rgba(247,242,236,.7)', textDecoration:'none', display:'block', marginBottom:2, lineHeight:1.3 }}>
                    {l.title.length>38 ? l.title.slice(0,38)+'…' : l.title}
                  </Link>
                  <span style={{ fontSize:8, color:'rgba(247,242,236,.22)', letterSpacing:'.06em', fontFamily:"'Jost',sans-serif" }}>{l.slug}</span>
                </div>
                <span style={{ fontSize:10, color:'rgba(247,242,236,.45)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.recipient_name}</span>
                <span style={{ fontSize:9, color:'rgba(247,242,236,.3)', fontFamily:"'Jost',sans-serif" }}>
                  {new Date(l.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}
                </span>
                <span style={{ fontSize:12, color:'rgba(247,242,236,.45)' }}>{l.view_count}</span>
                <span style={{ fontSize:12, color:'rgba(247,242,236,.45)' }}>{l.audio_play_count}</span>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:STATUS_COLORS[l.status]??'gray', flexShrink:0 }} />
                  <span style={{ fontSize:8, color:'rgba(247,242,236,.32)', textTransform:'uppercase', letterSpacing:'.1em', fontFamily:"'Jost',sans-serif" }}>{l.status}</span>
                </div>
                <DashboardLinkActions
                  slug={l.slug}
                  status={l.status}
                  experienceUrl={`${baseUrl}/experience/${l.slug}`}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12, flexWrap:'wrap', gap:10 }}>
              <span style={{ fontSize:9, color:'rgba(247,242,236,.28)', fontFamily:"'Jost',sans-serif", letterSpacing:'.08em' }}>
                {filtered.length} résultat{filtered.length>1?'s':''} · Page {currentPage}/{totalPages}
              </span>
              <div style={{ display:'flex', gap:2 }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={currentPage===1} style={{ ...btn(), opacity:currentPage===1?.4:1 }}>← Préc.</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = totalPages <= 5 ? i+1 : Math.min(Math.max(currentPage-2, 1)+i, totalPages)
                  return (
                    <button key={pg} onClick={() => setPage(pg)} style={{ ...btn(pg===currentPage), minWidth:32 }}>
                      {pg}
                    </button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} style={{ ...btn(), opacity:currentPage===totalPages?.4:1 }}>Suiv. →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
