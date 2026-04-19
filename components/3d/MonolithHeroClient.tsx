'use client'

import dynamic from 'next/dynamic'

const MonolithHero = dynamic(
  () => import('@/components/3d/MonolithHero'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        height: '100vh',
        background: '#020f09',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Préchargeur statique pendant le chargement R3F */}
        <div style={{ position:'relative', width:80, height:80 }}>
          {[0,8,20].map((ins,i) => (
            <div key={i} style={{
              position:'absolute', inset:ins,
              border:`1px solid rgba(224,196,180,${.25-i*.07})`,
              borderRadius:'50%',
              animation:`spin${i} ${10-i*2}s linear infinite ${i%2?'reverse':''}`,
            }} />
          ))}
          <div style={{
            position:'absolute', inset:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:"'Cormorant Garamond',serif",
            fontSize:26, color:'#E0C4B4',
            animation:'gpulse 2s ease-in-out infinite',
          }}>◈</div>
        </div>
        <style>{`
          @keyframes spin0  { from{transform:rotate(0)}   to{transform:rotate(360deg)}  }
          @keyframes spin1  { from{transform:rotate(0)}   to{transform:rotate(-360deg)} }
          @keyframes spin2  { from{transform:rotate(30deg)} to{transform:rotate(390deg)} }
          @keyframes gpulse { 0%,100%{opacity:.4} 50%{opacity:.9} }
        `}</style>
      </div>
    ),
  }
)

export default function MonolithHeroClient() {
  return <MonolithHero />
}
