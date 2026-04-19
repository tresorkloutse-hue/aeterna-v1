-- ═══════════════════════════════════════════════════════════════
-- AETERNA v2 — Migration complémentaire
-- Fonctions atomiques + index manquants + colonnes supplementaires
-- Idempotent — sans risque si ré-appliqué
-- ═══════════════════════════════════════════════════════════════

-- ─── Fonction : incrémenter les partages ────────────────────────
CREATE OR REPLACE FUNCTION increment_share_count(link_slug TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE links SET share_count = share_count + 1 WHERE slug = link_slug;
END; $$;

-- ─── Fonction : incrémenter les écoutes audio ───────────────────
CREATE OR REPLACE FUNCTION increment_audio_play(link_slug TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE links SET audio_play_count = audio_play_count + 1 WHERE slug = link_slug;
END; $$;

-- ─── Colonne message sur links (si absente) ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='links' AND column_name='message'
  ) THEN
    ALTER TABLE links ADD COLUMN message TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- ─── Colonne sender_email sur transactions metadata ─────────────
-- (stocké dans metadata JSONB, pas de migration DDL nécessaire)

-- ─── Index supplémentaires ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_links_user_status   ON links(user_id, status);
CREATE INDEX IF NOT EXISTS idx_links_created_active ON links(created_at DESC) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_tx_link_id          ON transactions(link_id);
CREATE INDEX IF NOT EXISTS idx_log_exp_type        ON log_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_stripe_sub    ON users(stripe_subscription_id);

-- ─── Vue analytique (lecture seule, admin) ──────────────────────
CREATE OR REPLACE VIEW link_stats AS
SELECT
  l.id,
  l.slug,
  l.title,
  l.protocol,
  l.status,
  l.sender_name,
  l.recipient_name,
  l.view_count,
  l.audio_play_count,
  l.share_count,
  l.created_at,
  l.eco_trees,
  t.amount_eur,
  t.plan
FROM links l
LEFT JOIN transactions t ON t.link_id = l.id AND t.status = 'succeeded';

-- ─── Politique RLS pour la vue ───────────────────────────────────
ALTER VIEW link_stats SET (security_invoker = true);

-- ─── Données de démonstration ────────────────────────────────────
DO $$
DECLARE
  demo_user_id UUID;
BEGIN
  -- Créer un utilisateur démo
  INSERT INTO users (email, plan, full_name)
  VALUES ('demo@aeterna.co', 'heritage', 'AETERNA Démo')
  ON CONFLICT (email) DO UPDATE SET full_name = 'AETERNA Démo'
  RETURNING id INTO demo_user_id;

  -- Créer 3 liens démo
  INSERT INTO links (user_id, slug, title, message, protocol, sender_name, recipient_name, status, eco_trees)
  VALUES
    (demo_user_id, 'demo-essence',  'Pour toi qui as tout changé',      'Parce que certaines personnes changent tout, sans même le savoir. Tu es de celles-là.',     'ESSENCE',  'Thomas', 'Sophie',  'active', 2),
    (demo_user_id, 'demo-heritage', 'La mémoire de nos commencements',   'Il y a des instants qui méritent d''être gravés pour toujours. Celui-ci en fait partie.',     'HERITAGE', 'Marie',  'Lucas',   'active', 2),
    (demo_user_id, 'demo-diamond',  'Parce que tu es l''exception',      'Je n''ai pas les mots, alors je leur ai trouvé un endroit où vivre pour toujours. C''est ici.','DIAMOND',  'Julien', 'Camille', 'active', 2)
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- ─── Vérification ────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM users)          AS users,
  (SELECT COUNT(*) FROM links)          AS links,
  (SELECT COUNT(*) FROM transactions)   AS transactions,
  (SELECT COUNT(*) FROM links WHERE status='active') AS active_links;
