import { ImageResponse } from '@vercel/og'
import { NextRequest }    from 'next/server'

export const runtime = 'edge'

const GLYPHS: Record<string, string> = { ESSENCE:'◈', HERITAGE:'✦', DIAMOND:'◉' }
const COLORS: Record<string, string> = { ESSENCE:'#E0C4B4', HERITAGE:'#E0C4B4', DIAMOND:'#c4b0e8' }

export async function GET(req: NextRequest) {
  const p         = req.nextUrl.searchParams
  const title     = p.get('title')     ?? 'Un sanctuaire pour toujours'
  const recipient = p.get('recipient') ?? 'vous'
  const sender    = p.get('sender')    ?? 'quelqu\'un'
  const protocol  = (p.get('protocol') ?? 'ESSENCE').toUpperCase()
  const glyph     = GLYPHS[protocol]  ?? '◈'
  const accent    = COLORS[protocol]  ?? '#E0C4B4'

  return new ImageResponse(
    (
      <div style={{
        width:'100%', height:'100%',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        background:'linear-gradient(135deg,#020f09 0%,#043927 50%,#020f09 100%)',
        fontFamily:'Georgia,serif', position:'relative', overflow:'hidden',
      }}>
        {/* Orbes */}
        <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(6,81,47,.4),transparent)', filter:'blur(80px)', top:-150, left:-150, display:'flex' }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:`radial-gradient(circle,${accent}12,transparent)`, filter:'blur(60px)', bottom:-100, right:-100, display:'flex' }} />
        {/* Cadre intérieur */}
        <div style={{ position:'absolute', inset:24, border:'1px solid rgba(224,196,180,.1)', display:'flex' }} />

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, zIndex:1, padding:'0 80px', textAlign:'center' }}>
          <div style={{ fontSize:11, letterSpacing:'0.4em', color:'rgba(224,196,180,.4)', marginBottom:44, display:'flex', textTransform:'uppercase', fontFamily:'sans-serif' }}>
            AETERNA
          </div>
          <div style={{ fontSize:54, color:accent, marginBottom:24, opacity:0.65, display:'flex' }}>{glyph}</div>
          <div style={{ fontSize:16, color:'rgba(247,242,236,.4)', marginBottom:14, display:'flex', fontStyle:'italic' }}>
            De la part de {sender}
          </div>
          <div style={{
            fontSize: title.length > 32 ? 42 : 54,
            fontWeight:300, fontStyle:'italic', color:'#F7F2EC',
            lineHeight:1.1, marginBottom:18, display:'flex', flexWrap:'wrap', justifyContent:'center',
          }}>
            {title}
          </div>
          <div style={{ fontSize:18, color:accent, letterSpacing:'0.08em', display:'flex' }}>Pour {recipient}</div>
          <div style={{ width:100, height:1, background:'rgba(224,196,180,.2)', margin:'32px 0', display:'flex' }} />
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 18px', border:'1px solid rgba(6,81,47,.6)', background:'rgba(6,81,47,.15)' }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:'#4ade80', display:'flex' }} />
            <div style={{ fontSize:10, color:'rgba(247,242,236,.4)', letterSpacing:'0.15em', textTransform:'uppercase', fontFamily:'sans-serif', display:'flex' }}>
              200% Compensation Carbone · EcoTree
            </div>
          </div>
        </div>
      </div>
    ),
    { width:1200, height:630 }
  )
}
