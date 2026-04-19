'use client'

export default function MonolithHeroClient() {
  return (
    <div style={{
      height: '100vh',
      background: '#020f09',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Fond */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 60% at 50% 10%, rgba(6,81,47,.32) 0%, transparent 70%)',
      }} />

      {/* Monolithe CSS */}
      <div style={{
        position: 'absolute',
        width: 120, height: 320,
        background: 'linear-gradient(135deg, rgba(224,196,180,.18) 0%, rgba(224,196,180,.05) 40%, rgba(6,57,39,.15) 100%)',
        border: '1px solid rgba(224,196,180,.2)',
        animation: 'float 8s ease-in-out infinite',
        boxShadow: '0 0 80px rgba(6,81,47,.3)',
      }} />

      {/* Texte */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', maxWidth: 700, padding: '0 32px' }}>
        <p style={{
          fontFamily: "'Cinzel Decorative', serif",
          fontSize: 10, letterSpacing: '.5em',
          color: 'rgba(224,196,180,.4)',
          textTransform: 'uppercase',
          marginBottom: 32,
        }}>AETERNA</p>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 'clamp(52px, 8vw, 108px)',
          fontWeight: 200, fontStyle: 'italic',
          lineHeight: .95, color: '#F7F2EC',
          marginBottom: 28,
        }}>
          Vos sanctuaires<br />
          <em style={{ color: '#E0C4B4' }}>éternels</em>
        </h1>

        <p style={{
          fontSize: 14, letterSpacing: '.06em',
          color: 'rgba(247,242,236,.42)',
          lineHeight: 1.85, fontFamily: "'Jost', sans-serif",
          fontWeight: 200, maxWidth: 500, margin: '0 auto 48px',
        }}>
          AETERNA ne vend pas de liens.<br />
          Nous bâtissons des sanctuaires pour vos souvenirs les plus précieux.
        </p>

        <a href="/create" style={{
          display: 'inline-block',
          padding: '16px 48px',
          border: '1px solid #E0C4B4',
          color: '#E0C4B4',
          fontFamily: "'Jost', sans-serif",
          fontSize: 10, letterSpacing: '.35em',
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}>
          Créer mon sanctuaire
        </a>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-12px) rotate(1deg); }
          66% { transform: translateY(6px) rotate(-1deg); }
        }
      `}</style>
    </div>
  )
}
