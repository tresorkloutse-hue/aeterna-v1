# AETERNA v2 — Liens Trophées

> Sanctuaires numériques pour vos souvenirs les plus précieux.

## Stack

| Couche       | Technologie                        |
|:-------------|:-----------------------------------|
| Frontend     | Next.js 15.5 · React 19 · TypeScript |
| 3D           | React Three Fiber + Drei           |
| Animation    | Framer Motion                      |
| Audio        | Web Audio API (moteur LYRA)        |
| Base de données | Supabase (PostgreSQL + RLS)     |
| Paiement     | Stripe (one-time + subscription)   |
| Email        | Resend                             |
| Déploiement  | Vercel (région cdg1 — Paris)       |

## Routes

```
/                         Landing page (monolithe R3F + pricing 3 niveaux)
/create                   Formulaire 3 étapes + audio upload
/auth                     Login / Signup / Mot de passe oublié
/dashboard                Coffre-fort utilisateur (liens + analytics)
/experience/[slug]        Page destinataire (LYRA + partage + éco)
/success                  Confirmation post-paiement

/api/create-checkout      Stripe Checkout session
/api/webhook-stripe       Webhook paiement → création lien → emails
/api/create-link          Création directe (API)
/api/upload-audio         Audio → Supabase Storage
/api/link-action          Archive / Restaure / Partage
/api/track-view           Vues atomiques
/api/track-play           Écoutes atomiques
/api/analytics            Événements RGPD-friendly
/api/health               Monitoring (200/503)
/api/og                   OG images dynamiques (Edge)
/api/cron/cleanup         Archivage auto + nettoyage (3h/jour)
/api/cron/remind          Rappel J+30 expéditeur (10h/jour)

/sitemap.xml              SEO dynamique
/robots.txt               /dashboard + /api protégés
/manifest.webmanifest     PWA installable
/mentions-legales         RGPD · Hébergement · Propriété intellectuelle
/cgv                      Tarifs · Rétractation · Diamond abonnement
```

## Démarrage rapide

```bash
# Cloner le projet
tar -xzf aeterna-v2-final.tar.gz && cd aeterna-v2

# Installer les dépendances
npm install

# Mode démo (sans clés réelles)
node setup.mjs   # choisir "demo"
npm run dev      # → http://localhost:3000

# Tests
node test-e2e.mjs
```

## Déploiement production

```bash
# Configuration interactive (Supabase + Stripe + Resend + Vercel)
node setup.mjs   # choisir "production"
```

Le script :
1. Collecte les clés API interactivement
2. Génère `ADMIN_SECRET` et `CRON_SECRET` automatiquement
3. Teste la connexion Supabase
4. Push les variables sur Vercel
5. Lance `vercel --prod`

### Après le déploiement

```bash
# 1. Exécuter le schéma SQL dans Supabase SQL Editor
#    supabase.com > project > SQL Editor
#    → db/schema.sql puis db/migration-v2.sql

# 2. Webhook Stripe
#    dashboard.stripe.com > Developers > Webhooks
#    URL : https://aeterna.co/api/webhook-stripe
#    Événement : checkout.session.completed

# 3. Domaine Resend
#    resend.com > Domains > Add domain

# 4. Auth Supabase
#    supabase.com > Authentication > URL Configuration
#    Site URL : https://aeterna.co
#    Redirect URLs : https://aeterna.co/auth/callback

# 5. Validation
node test-e2e.mjs --url https://aeterna.co
```

## Architecture des données

```sql
users        -- Comptes + plan (essence/heritage/diamond) + Stripe IDs
links        -- Sanctuaires (slug unique, audio, waveform, métriques)
transactions -- Paiements (one_time + subscription) avec link_id
log_events   -- Analytics RGPD (event_type, payload JSON, experience_id)
```

## Protocoles Stripe

| Plan     | Prix  | Mode         | Price ID |
|:---------|:------|:-------------|:---------|
| Essence  | 19€   | Unique        | `STRIPE_PRICE_ESSENCE`  |
| Héritage | 49€   | Unique        | `STRIPE_PRICE_HERITAGE` |
| Diamond  | 9€/mois | Abonnement + 7j d'essai | `STRIPE_PRICE_DIAMOND` |

## Variables d'environnement

Voir `.env.example` pour la liste complète.
Générer `ADMIN_SECRET` et `CRON_SECRET` avec :

```bash
openssl rand -hex 32
```

## Flux complet

```
Acheteur → /create (formulaire + audio upload)
  → /api/create-checkout (Stripe session avec metadata complètes)
    → Stripe Checkout (paiement 3D Secure)
      → /api/webhook-stripe
        → Créer link en DB (slug nanoid)
        → Upsert user (plan mis à jour)
        → Enregistrer transaction (avec link_id)
        → Email destinataire (Resend)
        → Email confirmation expéditeur
      → /success (Essence/Héritage/Diamond)
        → /experience/[slug] (destinataire ouvre)
          → LyraAmbient (si pas d'audio)
          → ExperienceAudioPlayer (si audio uploadé)
          → ShareButton → Gift-Loop → /create?ref={slug}
```

## Tests

```bash
# Suite complète (21 tests)
node test-e2e.mjs

# Contre la production
node test-e2e.mjs --url https://aeterna.co

# Test webhook Stripe en local
stripe listen --forward-to localhost:3000/api/webhook-stripe
```

## Carte de test Stripe

```
Numéro  : 4242 4242 4242 4242
Expiry  : 12/34
CVC     : 123
```
