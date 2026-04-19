import MonolithHero   from '@/components/3d/MonolithHeroClient'
import PricingSection  from '@/components/pricing/PricingSection'
import Link            from 'next/link'

const S = {
  section: { padding:'120px 60px', maxWidth:1200, margin:'0 auto' } as React.CSSProperties,
  label:   { fontSize:9, letterSpacing:'.45em', textTransform:'uppercase' as const, color:'rgba(224,196,180,.4)', marginBottom:16, display:'block' as const, fontFamily:'var(--font-body)' },
  h2:      { fontFamily:'var(--font-display)', fontSize:'clamp(32px,4vw,52px)', fontWeight:200, lineHeight:1.05, marginBottom:24 } as React.CSSProperties,
  p:       { fontSize:13, lineHeight:1.9, color:'rgba(247,242,236,.45)', letterSpacing:'.02em', fontFamily:'var(--font-body)' } as React.CSSProperties,
}

// ─── Témoignages ─────────────────────────────────────────────────
const TESTIMONIALS = [
  { quote: 'J\'ai offert un Héritage à mon père pour ses 70 ans. Il en a pleuré. Rien ne peut remplacer ça.', name:'Marie-Claire D.', plan:'Héritage' },
  { quote: 'Diamond a transformé notre façon de célébrer les achievements de notre équipe. Chaque victoire est gravée.', name:'Alexandre M.', plan:'Diamond · DG' },
  { quote: 'Un sanctuaire pour ma mère disparue. L\'audio de sa voix, pour toujours accessible. Merci AETERNA.', name:'Thomas B.', plan:'Héritage' },
]

export default function HomePage() {
  return (
    <main>
      {/* NAV */}
      <nav style={{
        position:'fixed', top:0, left:0, right:0, zIndex:100,
        padding:'24px 60px',
        display:'flex', justifyContent:'space-between', alignItems:'center',
        background:'linear-gradient(to bottom,rgba(2,15,9,.95),transparent)',
      }}>
        <span style={{ fontFamily:'var(--font-logo)', fontSize:11, letterSpacing:'.35em', color:'rgba(224,196,180,.45)' }}>
          AETERNA
        </span>
        <ul style={{ display:'flex', gap:40, listStyle:'none' }}>
          {[['Vision','#manifesto'],['Sanctuaires','#pricing'],['Créer','/create'],['Connexion','/auth']].map(([l,h])=>(
            <li key={l}>
              <Link href={h} style={{ fontSize:10, letterSpacing:'.3em', textTransform:'uppercase', color: l==='Créer' ? 'rgba(224,196,180,.65)' : 'rgba(247,242,236,.35)', textDecoration:'none', fontFamily:'var(--font-body)' }}>
                {l}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* HERO 3D */}
      <MonolithHero />

      {/* MANIFESTO */}
      <section id="manifesto" style={{ ...S.section, textAlign:'center', borderTop:'1px solid rgba(224,196,180,.06)' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          <span style={S.label}>Le Manifeste AURA</span>
          <blockquote style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(20px,3vw,32px)',
            fontWeight: 200,
            fontStyle: 'italic',
            lineHeight: 1.6,
            color: 'rgba(247,242,236,.75)',
            margin: '0 0 40px',
            position: 'relative',
            padding: '0 40px',
          }}>
            <span style={{ position:'absolute',top:-10,left:0,fontSize:80,color:'rgba(224,196,180,.08)',fontFamily:'Georgia',lineHeight:1 }}>&ldquo;</span>
            AETERNA ne vend pas de liens.<br />
            Nous bâtissons des sanctuaires pour vos souvenirs les plus précieux.
            <span style={{ position:'absolute',bottom:-30,right:0,fontSize:80,color:'rgba(224,196,180,.08)',fontFamily:'Georgia',lineHeight:1 }}>&rdquo;</span>
          </blockquote>
          <p style={{ ...S.p, maxWidth:580, margin:'0 auto 48px', textAlign:'center' }}>
            Chaque lien AETERNA est une œuvre d'art immatérielle. Conçu pour traverser le temps, pour émouvoir au premier regard, pour demeurer lorsque tout le reste s'efface.
          </p>
          <div style={{ display:'flex', gap:2, justifyContent:'center' }}>
            {[
              ['200%', 'Compensation carbone'],
              ['∞',    'Accès à vie'],
              ['60fps','Expérience fluide'],
            ].map(([n,l])=>(
              <div key={n} style={{ padding:'28px 40px', background:'rgba(6,57,39,.18)', border:'1px solid rgba(224,196,180,.07)', textAlign:'center' }}>
                <span style={{ fontFamily:'var(--font-display)', fontSize:40, fontWeight:200, color:'var(--rose-gold)', display:'block', lineHeight:1 }}>{n}</span>
                <span style={{ fontSize:8, letterSpacing:'.25em', textTransform:'uppercase', color:'rgba(247,242,236,.3)', marginTop:8, display:'block', fontFamily:'var(--font-body)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{ ...S.section, borderTop:'1px solid rgba(224,196,180,.06)' }}>
        <span style={S.label}>Processus CHRONOS</span>
        <h2 style={S.h2}>De l'émotion à l'<em style={{ fontStyle:'italic',color:'var(--rose-gold)' }}>éternité</em></h2>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:2, marginTop:48 }}>
          {[
            { n:'01', title:'Choisissez', desc:'Sélectionnez votre sanctuaire — Essence, Héritage ou Diamond.' },
            { n:'02', title:'Composez', desc:'Écrivez votre message. Déposez votre audio (Heritage+). Personnalisez.' },
            { n:'03', title:'Activez', desc:'Le paiement déclenche l\'activation immédiate. LYRA s\'éveille.' },
            { n:'04', title:'Transmettez', desc:'Votre destinataire reçoit son sanctuaire. Pour toujours.' },
          ].map(s=>(
            <div key={s.n} style={{ padding:'40px 32px', borderLeft:'1px solid rgba(224,196,180,.08)', borderBottom:'1px solid rgba(224,196,180,.06)' }}>
              <span style={{ fontFamily:'var(--font-display)', fontSize:48, fontWeight:200, color:'rgba(224,196,180,.15)', display:'block', lineHeight:1, marginBottom:20 }}>{s.n}</span>
              <h3 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:300, fontStyle:'italic', color:'var(--ivory)', marginBottom:12 }}>{s.title}</h3>
              <p style={{ ...S.p, fontSize:12 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <div id="pricing" style={{ borderTop:'1px solid rgba(224,196,180,.06)' }}>
        <PricingSection />
      </div>

      {/* TÉMOIGNAGES */}
      <section style={{ ...S.section, borderTop:'1px solid rgba(224,196,180,.06)' }}>
        <span style={S.label}>Sanctuaires créés</span>
        <h2 style={{ ...S.h2, marginBottom:56 }}>Ce qu'ils ont <em style={{ fontStyle:'italic',color:'var(--rose-gold)' }}>gravé</em></h2>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:2 }}>
          {TESTIMONIALS.map((t,i)=>(
            <div key={i} style={{ padding:'44px 36px', background:'rgba(6,57,39,.12)', border:'1px solid rgba(224,196,180,.08)', position:'relative' }}>
              <span style={{ position:'absolute',top:20,left:24,fontSize:56,color:'rgba(224,196,180,.06)',fontFamily:'Georgia',lineHeight:1 }}>&ldquo;</span>
              <p style={{ fontFamily:'var(--font-display)', fontSize:17, fontStyle:'italic', lineHeight:1.7, color:'rgba(247,242,236,.7)', marginBottom:28, position:'relative', zIndex:1 }}>
                {t.quote}
              </p>
              <div>
                <span style={{ fontSize:11, color:'var(--rose-gold)', fontFamily:'var(--font-body)', display:'block', marginBottom:2 }}>{t.name}</span>
                <span style={{ fontSize:9, letterSpacing:'.2em', color:'rgba(247,242,236,.25)', textTransform:'uppercase', fontFamily:'var(--font-body)' }}>{t.plan}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding:'160px 60px', textAlign:'center', borderTop:'1px solid rgba(224,196,180,.06)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 50% at 50% 50%,rgba(6,81,47,.2),transparent)', zIndex:0 }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(40px,6vw,80px)', fontWeight:200, lineHeight:1.05, marginBottom:48 }}>
            Votre sanctuaire<br />commence <em style={{ fontStyle:'italic',color:'var(--rose-gold)' }}>maintenant</em>
          </h2>
          <Link href="/create" className="btn-primary"><span>Créer mon premier sanctuaire</span></Link>
          <p style={{ marginTop:32, fontSize:10, color:'rgba(247,242,236,.2)', letterSpacing:'.15em', fontFamily:'var(--font-body)' }}>
            À partir de 19€ · Accès à vie · Compensation carbone 200%
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding:'44px 60px', borderTop:'1px solid rgba(224,196,180,.07)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
        <span style={{ fontFamily:'var(--font-logo)', fontSize:10, letterSpacing:'.3em', color:'rgba(224,196,180,.25)' }}>AETERNA</span>
        <div style={{ display:'flex', gap:32 }}>
          {[['Mentions légales','/mentions-legales'],['CGV','/cgv'],['Support','mailto:support@aeterna.co']].map(([l,h])=>(
            <Link key={l} href={h} style={{ fontSize:9, letterSpacing:'.2em', textTransform:'uppercase', color:'rgba(247,242,236,.18)', textDecoration:'none', fontFamily:'var(--font-body)' }}>
              {l}
            </Link>
          ))}
        </div>
        <span style={{ fontSize:9, color:'rgba(247,242,236,.12)', letterSpacing:'.1em', fontFamily:'var(--font-body)' }}>
          © {new Date().getFullYear()} AETERNA CORP
        </span>
      </footer>
    </main>
  )
}
