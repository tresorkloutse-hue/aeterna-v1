import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Mentions légales — AETERNA',
  robots: { index: false },
}

const S = {
  page: { minHeight:'100vh', background:'#020f09', color:'#F7F2EC', padding:'120px 40px 80px', fontFamily:"'Jost',sans-serif", fontWeight:300 } as React.CSSProperties,
  wrap: { maxWidth:700, margin:'0 auto' }  as React.CSSProperties,
  h1:   { fontFamily:"'Cormorant Garamond',serif", fontSize:48, fontWeight:200, fontStyle:'italic' as const, color:'#F7F2EC', marginBottom:14 } as React.CSSProperties,
  date: { fontSize:10, letterSpacing:'.15em', color:'rgba(247,242,236,.28)', marginBottom:72, display:'block' as const, fontFamily:"'Jost',sans-serif" },
  h2:   { fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:300, color:'rgba(224,196,180,.75)', marginBottom:14, marginTop:52, borderBottom:'1px solid rgba(224,196,180,.1)', paddingBottom:10 } as React.CSSProperties,
  p:    { fontSize:13, lineHeight:1.9, color:'rgba(247,242,236,.5)', marginBottom:14, letterSpacing:'.02em', fontFamily:"'Jost',sans-serif" } as React.CSSProperties,
  a:    { color:'rgba(224,196,180,.6)', textDecoration:'none' } as React.CSSProperties,
}

export default function MentionsLegales() {
  const year = new Date().getFullYear()
  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <Link href="/" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:10, letterSpacing:'.4em', color:'rgba(224,196,180,.3)', textDecoration:'none', display:'block', marginBottom:48 }}>
          AETERNA
        </Link>
        <h1 style={S.h1}>Mentions légales</h1>
        <span style={S.date}>Mise à jour : {new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</span>

        <h2 style={S.h2}>Éditeur du site</h2>
        <p style={S.p}>Le site aeterna.co est édité par <strong style={{color:'rgba(247,242,236,.75)'}}>AETERNA CORP</strong>, société par actions simplifiée (SAS), dont le siège social est situé en France.</p>
        <p style={S.p}>Directeur de la publication : [NOM DU DIRIGEANT]<br/>Contact : <a href="mailto:legal@aeterna.co" style={S.a}>legal@aeterna.co</a></p>

        <h2 style={S.h2}>Hébergement</h2>
        <p style={S.p}><strong style={{color:'rgba(247,242,236,.75)'}}>Vercel Inc.</strong> — 340 Pine Street Suite 701, San Francisco, CA 94104, USA. Région : Europe (Paris, cdg1).<br/>
        <strong style={{color:'rgba(247,242,236,.75)'}}>Supabase Inc.</strong> — base de données et stockage fichiers.</p>

        <h2 style={S.h2}>Propriété intellectuelle</h2>
        <p style={S.p}>L'ensemble des éléments du site (textes, moteur sonore LYRA, architecture 3D, design) est la propriété exclusive d'AETERNA CORP. Toute reproduction sans autorisation écrite est interdite.</p>

        <h2 style={S.h2}>Données personnelles &amp; RGPD</h2>
        <p style={S.p}>AETERNA collecte nom et email pour la création de sanctuaires. Ces données sont traitées conformément au RGPD. Droits d'accès, rectification, suppression : <a href="mailto:privacy@aeterna.co" style={S.a}>privacy@aeterna.co</a></p>
        <p style={S.p}>Les données de paiement sont traitées exclusivement par Stripe Inc. (PCI DSS Level 1) — AETERNA ne stocke aucune donnée bancaire.</p>

        <h2 style={S.h2}>Cookies</h2>
        <p style={S.p}>Cookie de session Supabase Auth (httpOnly, Secure). Aucun cookie publicitaire tiers. Analytics anonymisées (IP tronquée) hébergées en propre.</p>

        <h2 style={S.h2}>Médiation</h2>
        <p style={S.p}>Plateforme européenne de règlement en ligne des litiges : <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" style={S.a}>ec.europa.eu/consumers/odr</a></p>

        <div style={{marginTop:72,paddingTop:40,borderTop:'1px solid rgba(224,196,180,.07)',display:'flex',justifyContent:'space-between',flexWrap:'wrap' as const,gap:16}}>
          <Link href="/" style={{fontSize:9,letterSpacing:'.25em',color:'rgba(247,242,236,.22)',textDecoration:'none',textTransform:'uppercase' as const,fontFamily:"'Jost',sans-serif"}}>← Accueil</Link>
          <Link href="/cgv" style={{fontSize:9,letterSpacing:'.25em',color:'rgba(247,242,236,.22)',textDecoration:'none',textTransform:'uppercase' as const,fontFamily:"'Jost',sans-serif"}}>CGV →</Link>
        </div>
      </div>
    </main>
  )
}
