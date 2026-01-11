-- ============================================
-- Migración: Hacer bucket cuentacuentos-drafts público
-- Fecha: 2026-01-11
-- Descripción: Las signed URLs expiran en 24 horas, causando que las imágenes
--              no carguen después de ese tiempo. Al hacer el bucket público,
--              las imágenes son accesibles sin expiración.
-- ============================================

-- Actualizar el bucket a público
UPDATE storage.buckets 
SET public = true 
WHERE id = 'cuentacuentos-drafts';

-- Agregar política para lectura pública (anónima)
CREATE POLICY "Public can read cuentacuentos images"
ON storage.objects FOR SELECT
USING (bucket_id = 'cuentacuentos-drafts');
