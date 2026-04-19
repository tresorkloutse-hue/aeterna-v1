'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ─── Configuration des offres ─────────────────────────────────────
const TIERS = [
  {
    key:      'essence' as const,
    glyph:    '◈',
    name:     'Essence',
    subtitle: 'L\'essentiel de l\'éternité',
    price:    19,
    billing:  'paiement unique',
    color:    'rgba(224,196,180,0.12)',
    border:   'rgba(224,196,180,0.2)',
    accent:   '#E0C4B4',
    features: [
      'Lien Trophée immersif',
      'Message personnalisé',
      'Moteur sonore génératif LYRA',
      'Compensation carbone 200%',
      'Accès à vie garanti',
      'OG image dynamique',
    ],
    excluded: [
      'Upload audio personnalisé',
      'Vidéo intégrée',
      'Coffre-fort privé Diamond',
    ],
  },
  {
    key:      'heritage' as const,
    glyph:    '✦',
    name:     'Héritage',
    subtitle: 'Votre voix dans l\'éternité',
    price:    49,
    billing:  'paiement unique',
    color:    'rgba(6,57,39,0.4)',
    border:   'rgba(224,196,180,0.35)',
    accent:   '#E0C4B4',
    featured: true,
    features: [
      'Tout ce qu\'inclut Essence',
      'Upload audio drag & drop',
      'Traitement cristallin haute-fidélité',
      'Waveform visuelle personnalisée',
      'Image de fond sur mesure',
      'Badge éco certifié EcoTree',
    ],
    excluded: [
      'Vidéo intégrée',
      'Coffre-fort privé Diamond',
    ],
  },
  {
    key:      'diamond' as const,
    glyph:    '◉',
    name:     'Diamond',
    subtitle: 'Votre sanctuaire privé',
    price:    9,
    billing:  'par mois',
    color:    'rgba(2,9,20,0.8)',
    border:   'rgba(180,160,224,0.4)',
    accent:   '#c4b0e8',
    badge:    'Coffre-fort numérique',
    features: [
      'Liens illimités',
      'Sanctuaires privés protégés',
      'Upload audio + vidéo 4K',
      'Domaine personnalisé aeterna.co/vous',
      'Analytics en temps réel',
      'Support prioritaire 24/7',
      'Héritage transmissible',
      'API accès partenaires',
    ],
    excluded: [],
  },
] as const

type TierKey = typeof TIERS[number]['key']

// ─── Composant carte ─────────────────────────────────────────────
function TierCard({ tier, onSelect, loading }: {
  tier:     typeof TIERS[number]
  onSelect: (key: TierKey) => void
  loading:  TierKey | null
}) {
  const isDiamond  = tier.key === 'diamond'
  const isFeatured = (tier as typeof TIERS[1]).featured === true
  const isLoading  = loading === tier.key

  return (
    <div style={{
      background:    tier.color,
      border:        `1px solid ${tier.border}`,
      padding:       '48px 36px',
      display:       'flex',
      flexDirection: 'column',
      gap:           24,
      position:      'relative',
      overflow:      'hidden',
      transition:    'transform .3s, border-color .3s',
    }}>
      {/* Effet fond Diamond */}
      {isDiamond && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(180,160,224,.12), transparent),
            radial-gradient(ellipse 60% 40% at 100% 100%, rgba(180,160,224,.06), transparent)
          `,
          pointerEvents: 'none',
        }} />
      )}

      {/* Badge featured */}
      {isFeatured && (
        <div style={{
          position:   'absolute',
          top:        0, left: '50%',
          transform:  'translateX(-50%)',
          background: 'var(--rose-gold, #E0C4B4)',
          color:      '#020f09',
          fontSize:   8,
          letterSpacing: '.3em',
          textTransform: 'uppercase',
          padding:    '5px 20px',
          fontFamily: "'Jost', sans-serif",
        }}>
          Le plus choisi
        </div>
      )}

      {/* Badge Diamond */}
      {isDiamond && (tier as typeof TIERS[2]).badge && (
        <div style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        8,
          padding:    '5px 14px',
          border:     '1px solid rgba(180,160,224,.3)',
          color:      'rgba(180,160,224,.8)',
          fontSize:   8,
          letterSpacing: '.3em',
          textTransform: 'uppercase',
          fontFamily: "'Jost', sans-serif",
          width:      'fit-content',
          position:   'relative',
          zIndex:     1,
        }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:'#c4b0e8', animation:'dm-pulse 2s ease-in-out infinite' }} />
          {(tier as typeof TIERS[2]).badge}
        </div>
      )}

      {/* Header */}
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize:   48,
          color:      tier.accent,
          opacity:    .6,
          lineHeight: 1,
          marginBottom: 12,
        }}>
          {tier.glyph}
        </div>
        <h3 style={{
          fontFamily: "'Cinzel Decorative', serif",
          fontSize:   13,
          letterSpacing: '.25em',
          color:      tier.accent,
          marginBottom: 6,
          textTransform: 'uppercase' as const,
        }}>
          {tier.name}
        </h3>
        <p style={{
          fontSize:   11,
          color:      'rgba(247,242,236,.35)',
          letterSpacing: '.05em',
          fontFamily: "'Jost', sans-serif",
          fontStyle:  'italic',
        }}>
          {tier.subtitle}
        </p>
      </div>

      {/* Prix */}
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize:   56, fontWeight:200,
            color:      '#F7F2EC',
            lineHeight: 1,
          }}>
            {tier.price}€
          </span>
          <span style={{
            fontSize:   10, letterSpacing:'.15em',
            color:      'rgba(247,242,236,.3)',
            textTransform: 'uppercase' as const,
            fontFamily: "'Jost', sans-serif",
          }}>
            {tier.billing}
          </span>
        </div>
      </div>

      {/* Features */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, position:'relative', zIndex:1 }}>
        {tier.features.map(f => (
          <div key={f} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            <span style={{ color:tier.accent, fontSize:10, flexShrink:0, marginTop:2, opacity:.7 }}>✓</span>
            <span style={{ fontSize:12, color:'rgba(247,242,236,.65)', fontFamily:"'Jost',sans-serif", lineHeight:1.5 }}>{f}</span>
          </div>
        ))}
        {tier.excluded.map(f => (
          <div key={f} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
            <span style={{ color:'rgba(247,242,236,.2)', fontSize:10, flexShrink:0, marginTop:2 }}>—</span>
            <span style={{ fontSize:12, color:'rgba(247,242,236,.2)', fontFamily:"'Jost',sans-serif", lineHeight:1.5, textDecoration:'line-through', textDecorationColor:'rgba(247,242,236,.1)' }}>{f}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        onClick={() => onSelect(tier.key)}
        disabled={!!loading}
        style={{
          position:      'relative',
          zIndex:        1,
          padding:       '16px 32px',
          background:    isFeatured || isDiamond ? tier.accent : 'transparent',
          border:        `1px solid ${isFeatured || isDiamond ? tier.accent : 'rgba(224,196,180,.3)'}`,
          color:         isFeatured || isDiamond ? '#020f09' : tier.accent,
          fontFamily:    "'Jost', sans-serif",
          fontSize:      10,
          letterSpacing: '.3em',
          textTransform: 'uppercase' as const,
          cursor:        loading ? 'wait' : 'pointer',
          width:         '100%',
          opacity:       loading ? .6 : 1,
          transition:    'all .3s',
        }}
      >
        {isLoading ? 'Redirection...' : isDiamond ? 'Commencer Diamond' : `Créer mon ${tier.name}`}
      </button>
    </div>
  )
}

// ─── Section pricing complète ─────────────────────────────────────
export default function PricingSection() {
  const [loading, setLoading] = useState<TierKey | null>(null)

  async function handleSelect(tier: TierKey) {
    setLoading(tier)
    try {
      const res = await fetch('/api/create-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier }),
      })
      const { sessionId, error } = await res.json()
      if (error) throw new Error(error)
      const stripe = await stripePromise
      await stripe?.redirectToCheckout({ sessionId })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(null)
    }
  }

  return (
    <section style={{ padding:'140px 60px', maxWidth:1200, margin:'0 auto' }}>
      <div style={{ textAlign:'center', marginBottom:80 }}>
        <p style={{
          fontSize: 9, letterSpacing:'.45em', textTransform:'uppercase',
          color:'rgba(224,196,180,.4)', marginBottom:16,
          fontFamily:"'Jost',sans-serif",
        }}>
          Choisissez votre sanctuaire
        </p>
        <h2 style={{
          fontFamily:"'Cormorant Garamond',serif",
          fontSize:'clamp(36px,5vw,60px)',
          fontWeight:200, lineHeight:1.05, color:'#F7F2EC',
        }}>
          L'éternité, à votre<br />
          <em style={{ fontStyle:'italic', color:'#E0C4B4' }}>mesure</em>
        </h2>
      </div>

      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap:                 2,
        marginTop:           28,
      }}>
        {TIERS.map(tier => (
          <TierCard
            key={tier.key}
            tier={tier}
            onSelect={handleSelect}
            loading={loading}
          />
        ))}
      </div>

      <p style={{
        textAlign:   'center',
        marginTop:   48,
        fontSize:    10,
        color:       'rgba(247,242,236,.2)',
        letterSpacing: '.1em',
        fontFamily:  "'Jost',sans-serif",
      }}>
        Tous les prix incluent la TVA · Compensation écologique 200% incluse · Accès garanti à vie
      </p>

      <style>{`
        @keyframes dm-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(196,176,232,.4)} 50%{box-shadow:0 0 0 6px rgba(196,176,232,0)} }
      `}</style>
    </section>
  )
}
