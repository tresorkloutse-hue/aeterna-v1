import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente — AETERNA',
  robots: { index: false },
}

const S = {
  page: { minHeight:'100vh', background:'#020f09', color:'#F7F2EC', padding:'120px 40px 80px', fontFamily:"'Jost',sans-serif", fontWeight:300 } as React.CSSProperties,
  wrap: { maxWidth:700, margin:'0 auto' }  as React.CSSProperties,
  h1:   { fontFamily:"'Cormorant Garamond',serif", fontSize:48, fontWeight:200, fontStyle:'italic' as const, color:'#F7F2EC', marginBottom:14 } as React.CSSProperties,
  date: { fontSize:10, letterSpacing:'.15em', color:'rgba(247,242,236,.28)', marginBottom:72, display:'block' as const, fontFamily:"'Jost',sans-serif" },
  h2:   { fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:300, color:'rgba(224,196,180,.75)', marginBottom:14, marginTop:52, borderBottom:'1px solid rgba(224,196,180,.1)', paddingBottom:10 } as React.CSSProperties,
  p:    { fontSize:13, lineHeight:1.9, color:'rgba(247,242,236,.5)', marginBottom:14, letterSpacing:'.02em', fontFamily:"'Jost',sans-serif" } as React.CSSProperties,
}

const PLANS = [
  { name:'Essence',  price:'19€',   billing:'paiement unique',   desc:'Lien Trophée immersif, moteur LYRA génératif, accès à vie.' },
  { name:'Héritage', price:'49€',   billing:'paiement unique',   desc:'Tout Essence + upload audio haute-fidélité, waveform personnalisée.' },
  { name:'Diamond',  price:'9€/mois', billing:'abonnement mensuel', desc:'Liens illimités, audio + vidéo 4K, domaine personnalisé, 7 jours d\'essai offerts.' },
]

export default function CGV() {
  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <Link href="/" style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:10, letterSpacing:'.4em', color:'rgba(224,196,180,.3)', textDecoration:'none', display:'block', marginBottom:48 }}>AETERNA</Link>
        <h1 style={S.h1}>Conditions Générales de Vente</h1>
        <span style={S.date}>En vigueur au {new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}</span>

        <h2 style={S.h2}>Article 1 — Objet</h2>
        <p style={S.p}>Les présentes CGV régissent les ventes de sanctuaires numériques (ci-après «&nbsp;Sanctuaires&nbsp;») réalisées par AETERNA CORP sur aeterna.co.</p>

        <h2 style={S.h2}>Article 2 — Offres et tarifs</h2>
        <div style={{border:'1px solid rgba(224,196,180,.1)',marginBottom:14}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',background:'rgba(6,57,39,.25)',padding:'12px 20px',borderBottom:'1px solid rgba(224,196,180,.08)'}}>
            {['Protocole','Tarif','Inclus'].map(h=><span key={h} style={{fontSize:8,letterSpacing:'.3em',textTransform:'uppercase' as const,color:'rgba(224,196,180,.4)',fontFamily:"'Jost',sans-serif"}}>{h}</span>)}
          </div>
          {PLANS.map((pl,i)=>(
            <div key={pl.name} style={{display:'grid',gridTemplateColumns:'1fr 1fr 2fr',padding:'16px 20px',borderBottom:i<PLANS.length-1?'1px solid rgba(224,196,180,.05)':'none',alignItems:'start'}}>
              <span style={{fontFamily:"'Cinzel Decorative',serif",fontSize:9,letterSpacing:'.15em',color:'#E0C4B4'}}>{pl.name}</span>
              <div><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:200,color:'rgba(247,242,236,.7)'}}>{pl.price}</span><br/><span style={{fontSize:9,color:'rgba(247,242,236,.3)',fontFamily:"'Jost',sans-serif"}}>{pl.billing}</span></div>
              <span style={{fontSize:11,color:'rgba(247,242,236,.45)',lineHeight:1.6,fontFamily:"'Jost',sans-serif"}}>{pl.desc}</span>
            </div>
          ))}
        </div>
        <p style={S.p}>Tous les prix s'entendent TTC. La compensation écologique 200% (EcoTree) est incluse dans chaque offre.</p>

        <h2 style={S.h2}>Article 3 — Paiement</h2>
        <p style={S.p}>Paiement sécurisé via Stripe Inc. (PCI DSS Level 1). AETERNA ne conserve aucune donnée bancaire. La commande est confirmée à réception du paiement.</p>

        <h2 style={S.h2}>Article 4 — Livraison</h2>
        <p style={S.p}>Le Sanctuaire est activé et le lien transmis par email dans les <strong style={{color:'rgba(247,242,236,.75)'}}>5 minutes</strong> suivant la confirmation de paiement.</p>

        <h2 style={S.h2}>Article 5 — Droit de rétractation</h2>
        <p style={S.p}>Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation est exclu pour les contenus numériques dont l'exécution a débuté avec l'accord du consommateur avant l'expiration du délai. En procédant au paiement, vous renoncez expressément à ce droit et souhaitez l'activation immédiate de votre Sanctuaire.</p>
        <p style={S.p}>En cas d'erreur manifeste (mauvais destinataire), AETERNA étudiera toute demande de correction dans un délai de 24h : <a href="mailto:support@aeterna.co" style={{color:'rgba(224,196,180,.6)',textDecoration:'none'}}>support@aeterna.co</a></p>

        <h2 style={S.h2}>Article 6 — Diamond : abonnement et résiliation</h2>
        <p style={S.p}>L'abonnement Diamond démarre après 7 jours d'essai gratuit. Facturation mensuelle, résiliation possible à tout moment depuis le tableau de bord. L'accès reste actif jusqu'à la fin de la période payée en cours.</p>

        <h2 style={S.h2}>Article 7 — Pérennité des Sanctuaires</h2>
        <p style={S.p}>L'accès aux Sanctuaires est garanti sans limite de durée. En cas de cessation d'activité d'AETERNA, un préavis de 90 jours sera communiqué avec mise à disposition d'un export des données.</p>

        <h2 style={S.h2}>Article 8 — Responsabilité</h2>
        <p style={S.p}>La responsabilité d'AETERNA est limitée au montant de la commande concernée. AETERNA ne saurait être tenue responsable des dommages indirects.</p>

        <h2 style={S.h2}>Article 9 — Droit applicable</h2>
        <p style={S.p}>Droit français. Tout litige sera soumis aux juridictions compétentes du ressort du siège social d'AETERNA CORP.</p>

        <div style={{marginTop:72,paddingTop:40,borderTop:'1px solid rgba(224,196,180,.07)',display:'flex',justifyContent:'space-between',flexWrap:'wrap' as const,gap:16}}>
          <Link href="/mentions-legales" style={{fontSize:9,letterSpacing:'.25em',color:'rgba(247,242,236,.22)',textDecoration:'none',textTransform:'uppercase' as const,fontFamily:"'Jost',sans-serif"}}>← Mentions légales</Link>
          <Link href="/" style={{fontSize:9,letterSpacing:'.25em',color:'rgba(247,242,236,.22)',textDecoration:'none',textTransform:'uppercase' as const,fontFamily:"'Jost',sans-serif"}}>Accueil →</Link>
        </div>
      </div>
    </main>
  )
}
