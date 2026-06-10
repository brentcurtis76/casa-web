-- ============================================
-- Migración: Episodios del Podcast CASA (Reflexiones)
-- Fecha: 2026-06-10
-- Descripción: Tabla church_podcast_episodes que respalda el feed RSS
--              autohospedado servido por la edge function podcast-rss.
--              Sustituye al RSS de Spotify (será reemplazado vía
--              Settings → Redirect your podcast tras el backfill).
-- ============================================

CREATE TABLE IF NOT EXISTS church_podcast_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liturgy_id UUID REFERENCES liturgias(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT CHECK (char_length(description) <= 4000),
  speaker TEXT,
  episode_date DATE NOT NULL,
  audio_url TEXT,
  audio_size_bytes BIGINT,
  duration_seconds INTEGER,
  mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  cover_url TEXT,
  guid TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  episode_number INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT published_episode_complete CHECK (
    status <> 'published' OR (
      audio_url IS NOT NULL AND audio_size_bytes IS NOT NULL
      AND duration_seconds IS NOT NULL AND published_at IS NOT NULL
    )
  )
);

-- ============================================
-- Índices
-- ============================================

-- Feed público: episodios publicados ordenados por fecha de publicación desc
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_feed
  ON church_podcast_episodes (published_at DESC)
  WHERE status = 'published';

-- Lookup por liturgia origen
CREATE INDEX IF NOT EXISTS idx_podcast_episodes_liturgy
  ON church_podcast_episodes (liturgy_id);

-- Número de episodio único (cuando está asignado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_podcast_episodes_number
  ON church_podcast_episodes (episode_number)
  WHERE episode_number IS NOT NULL;

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE church_podcast_episodes ENABLE ROW LEVEL SECURITY;

-- Admins (vía is_liturgia_admin) tienen acceso total
CREATE POLICY podcast_episodes_admin_all
  ON church_podcast_episodes
  FOR ALL
  USING (is_liturgia_admin(auth.uid()))
  WITH CHECK (is_liturgia_admin(auth.uid()));

-- Lectura pública únicamente de episodios publicados
CREATE POLICY podcast_episodes_public_read
  ON church_podcast_episodes
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- ============================================
-- Trigger updated_at
-- ============================================

CREATE OR REPLACE FUNCTION set_podcast_episode_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_podcast_episodes_updated
  BEFORE UPDATE ON church_podcast_episodes
  FOR EACH ROW
  EXECUTE FUNCTION set_podcast_episode_updated_at();

-- ============================================
-- Comentarios de documentación
-- ============================================

COMMENT ON TABLE church_podcast_episodes IS
  'Episodios del podcast CASA (Reflexiones), servidos vía edge function podcast-rss';

COMMENT ON COLUMN church_podcast_episodes.guid IS
  'GUID inmutable después de publish — Spotify y otros agregadores deduplican episodios por este valor; cambiarlo crearía un episodio duplicado en sus catálogos.';

COMMENT ON COLUMN church_podcast_episodes.status IS
  'draft = borrador interno (no aparece en el feed); published = visible en feed RSS y storage público.';

COMMENT ON COLUMN church_podcast_episodes.published_at IS
  'Fecha de publicación pública (pubDate del item RSS). Editable para backfill de episodios históricos de Spotify.';
