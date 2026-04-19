-- ═══════════════════════════════════════════════════════════════
-- AETERNA CORP — Schéma Liens Trophées v1.0
-- Tables : users, links, transactions
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── USERS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT,
  avatar_url      TEXT,

  -- Niveau d'abonnement
  plan            TEXT NOT NULL DEFAULT 'essence'
                  CHECK (plan IN ('essence', 'heritage', 'diamond')),
  plan_started_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,  -- NULL = Diamond actif en continu

  -- Stripe
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,

  -- Metadata
  timezone        TEXT DEFAULT 'Europe/Paris',
  locale          TEXT DEFAULT 'fr',
  is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_cust    ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_plan           ON users(plan);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── LINKS (Liens Trophées) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Propriétaire
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Identité du lien
  slug            TEXT UNIQUE NOT NULL,           -- URL-safe, 8 chars
  title           TEXT NOT NULL,
  message         TEXT NOT NULL DEFAULT '',
  protocol        TEXT NOT NULL DEFAULT 'ESSENCE'
                  CHECK (protocol IN ('ESSENCE', 'HERITAGE', 'DIAMOND')),

  -- Protagonistes
  sender_name     TEXT NOT NULL,
  recipient_name  TEXT NOT NULL,
  recipient_email TEXT,

  -- Contenu riche (Heritage + Diamond)
  audio_url       TEXT,                           -- Stocké dans Supabase Storage
  audio_filename  TEXT,
  audio_duration_s INT,
  audio_waveform  JSONB,                          -- [{x, y}] pour la visualisation
  custom_bg       TEXT,                           -- Couleur hex personnalisée
  video_url       TEXT,                           -- Diamond uniquement

  -- Impact écologique
  eco_trees       INT NOT NULL DEFAULT 2,
  eco_kg_offset   NUMERIC(10,4) DEFAULT 0.48,
  eco_certificate TEXT,

  -- Accès & sécurité
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('draft', 'active', 'archived', 'locked')),
  is_private      BOOLEAN NOT NULL DEFAULT false,
  access_code     TEXT,                           -- PIN optionnel chiffré

  -- Métriques
  view_count      INT NOT NULL DEFAULT 0,
  audio_play_count INT NOT NULL DEFAULT 0,
  share_count     INT NOT NULL DEFAULT 0,
  last_viewed_at  TIMESTAMPTZ,

  -- Expiration
  expires_at      TIMESTAMPTZ DEFAULT NULL        -- NULL = éternel
);

CREATE INDEX IF NOT EXISTS idx_links_slug       ON links(slug);
CREATE INDEX IF NOT EXISTS idx_links_user_id    ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_status     ON links(status);
CREATE INDEX IF NOT EXISTS idx_links_protocol   ON links(protocol);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at DESC);

CREATE TRIGGER links_updated_at
  BEFORE UPDATE ON links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Fonction : incrémenter les vues de façon atomique
CREATE OR REPLACE FUNCTION increment_link_view(link_slug TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE links SET
    view_count = view_count + 1,
    last_viewed_at = NOW()
  WHERE slug = link_slug AND status = 'active';
END; $$;

-- ─── TRANSACTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  user_id               UUID REFERENCES users(id) ON DELETE SET NULL,
  link_id               UUID REFERENCES links(id) ON DELETE SET NULL,

  -- Type d'opération
  type                  TEXT NOT NULL
                        CHECK (type IN (
                          'one_time',          -- Achat unique Essence/Heritage
                          'subscription_start', -- Début Diamond
                          'subscription_renew', -- Renouvellement mensuel
                          'subscription_cancel',-- Annulation
                          'refund'             -- Remboursement
                        )),

  -- Stripe
  stripe_session_id     TEXT UNIQUE,
  stripe_payment_intent TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id     TEXT,

  -- Montant
  amount_eur            NUMERIC(8,2) NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'eur',
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),

  -- Produit
  plan                  TEXT NOT NULL CHECK (plan IN ('essence', 'heritage', 'diamond')),
  stripe_price_id       TEXT,

  -- Metadata
  metadata              JSONB DEFAULT '{}',
  failed_at             TIMESTAMPTZ,
  refunded_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tx_user_id   ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_link_id   ON transactions(link_id);
CREATE INDEX IF NOT EXISTS idx_tx_status    ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_stripe_si ON transactions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_tx_stripe_pi ON transactions(stripe_payment_intent);
CREATE INDEX IF NOT EXISTS idx_tx_type      ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_created   ON transactions(created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────────
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE links        ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users : lecture/écriture de son propre profil
CREATE POLICY "users_self_read"   ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_self_update" ON users FOR UPDATE USING (auth.uid() = id);

-- Links : lecture publique des liens actifs, écriture par le propriétaire
CREATE POLICY "links_public_read"
  ON links FOR SELECT
  USING (status = 'active' AND (is_private = false OR auth.uid() = user_id));

CREATE POLICY "links_owner_write"
  ON links FOR ALL
  USING (auth.uid() = user_id);

-- Transactions : lecture par l'utilisateur concerné
CREATE POLICY "tx_user_read"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role : accès total
CREATE POLICY "service_all_users" ON users        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_links" ON links        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_tx"    ON transactions FOR ALL USING (auth.role() = 'service_role');

-- ─── STORAGE ────────────────────────────────────────────────────
-- Bucket pour les fichiers audio (Heritage + Diamond)
-- À créer dans Supabase Dashboard > Storage > New bucket
-- Nom : "audio" — Public : false — Max file size : 50MB

-- ─── VÉRIFICATION ───────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM users)        AS users_count,
  (SELECT COUNT(*) FROM links)        AS links_count,
  (SELECT COUNT(*) FROM transactions) AS tx_count;

-- Fonction : incrémenter les écoutes audio de façon atomique
CREATE OR REPLACE FUNCTION increment_audio_play(link_slug TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE links SET audio_play_count = audio_play_count + 1 WHERE slug = link_slug;
END; $$;

-- ─── LOG EVENTS (analytics RGPD-friendly) ────────────────────────
-- Créée séparément car référencée partout dans le code
CREATE TABLE IF NOT EXISTS log_events (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at     TIMESTAMPTZ NOT NULL    DEFAULT NOW(),

  -- Référence optionnelle vers un lien (pour les rappels J+30)
  experience_id  UUID        REFERENCES links(id)  ON DELETE SET NULL,
  user_id        UUID        REFERENCES users(id)  ON DELETE SET NULL,

  -- Type d'événement
  event_type     TEXT        NOT NULL,
  -- experience_view | audio_play | gift_loop_click | create_start
  -- protocol_select | link_archived | link_restored | auto_archived
  -- reminder_sent | gift_loop_referral

  -- Données libres (pas de PII directes)
  payload        JSONB       DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_log_type       ON log_events(event_type);
CREATE INDEX IF NOT EXISTS idx_log_exp_type   ON log_events(experience_id, event_type);
CREATE INDEX IF NOT EXISTS idx_log_created    ON log_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_log_user       ON log_events(user_id);

-- RLS : pas de lecture par les clients (admin only)
ALTER TABLE log_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "log_service_only" ON log_events FOR ALL USING (auth.role() = 'service_role');
