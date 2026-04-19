import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{ minHeight:'100vh', background:'#020f09', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 40px', textAlign:'center', fontFamily:"'Jost',sans-serif" }}>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse 50% 40% at 50% 50%, rgba(6,57,39,.15), transparent)', zIndex:0 }} />
      <div style={{ position:'relative', zIndex:10, maxWidth:480 }}>
        <Link href="/" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:9, letterSpacing:'.4em', color:'rgba(224,196,180,.25)', textDecoration:'none', display:'block', marginBottom:40 }}>
          AETERNA
        </Link>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:88, fontWeight:200, fontStyle:'italic', color:'rgba(224,196,180,.5)', lineHeight:1, marginBottom:20 }}>
          404
        </div>
        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:200, color:'rgba(247,242,236,.55)', marginBottom:14 }}>
          Ce sanctuaire n'existe pas encore.
        </h1>
        <p style={{ fontSize:12, color:'rgba(247,242,236,.28)', lineHeight:1.85, marginBottom:52, letterSpacing:'.03em' }}>
          Le lien est peut-être invalide ou a expiré.
        </p>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/" style={{ padding:'13px 36px', border:'1px solid rgba(224,196,180,.28)', color:'rgba(224,196,180,.65)', fontSize:9, letterSpacing:'.3em', textTransform:'uppercase', textDecoration:'none', fontFamily:"'Jost',sans-serif" }}>
            Accueil
          </Link>
          <Link href="/create" style={{ padding:'13px 36px', border:'1px solid rgba(224,196,180,.12)', color:'rgba(247,242,236,.3)', fontSize:9, letterSpacing:'.3em', textTransform:'uppercase', textDecoration:'none', fontFamily:"'Jost',sans-serif" }}>
            Créer un sanctuaire
          </Link>
        </div>
      </div>
    </main>
  )
}
