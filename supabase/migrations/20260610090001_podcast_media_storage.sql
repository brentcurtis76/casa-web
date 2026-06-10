-- ============================================
-- Migración: Storage para Podcast CASA
-- Fecha: 2026-06-10
-- Descripción: Bucket público podcast-media para audio y arte del show.
--
-- Layout de objetos:
--   episodes/{episode_id}/audio.mp3   -- audio del episodio
--   episodes/{episode_id}/cover.jpg   -- arte por episodio (opcional)
--   show/cover.jpg                    -- arte del canal (channel artwork)
--
-- NOTA: este bucket es independiente de los antiguos sermon-audio /
-- sermon-covers (huérfanos del flujo legacy) y no los toca.
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'podcast-media',
  'podcast-media',
  true,
  209715200, -- 200 MB
  ARRAY['audio/mpeg', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Storage policies
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Anyone can view podcast media'
  ) THEN
    CREATE POLICY "Anyone can view podcast media"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'podcast-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Liturgia admins can upload podcast media'
  ) THEN
    CREATE POLICY "Liturgia admins can upload podcast media"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'podcast-media'
        AND is_liturgia_admin(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Liturgia admins can update podcast media'
  ) THEN
    CREATE POLICY "Liturgia admins can update podcast media"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'podcast-media'
        AND is_liturgia_admin(auth.uid())
      )
      WITH CHECK (
        bucket_id = 'podcast-media'
        AND is_liturgia_admin(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Liturgia admins can delete podcast media'
  ) THEN
    CREATE POLICY "Liturgia admins can delete podcast media"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'podcast-media'
        AND is_liturgia_admin(auth.uid())
      );
  END IF;
END $$;
