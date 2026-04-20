-- Backfill published_resources archive from historical storage PDFs.
-- Prior publish flow UPDATEd the active row instead of inserting, so the
-- archive page had no history. Insert one row per (liturgy_id, resource_type)
-- using the latest storage object and metadata joined from liturgias.
-- All backfilled rows are is_active=false (the two currently-active rows stay).

WITH parsed AS (
  SELECT
    name,
    created_at,
    (metadata->>'size')::bigint AS size_bytes,
    CASE WHEN name LIKE 'cuentacuentos/%' THEN 'cuentacuento'
         WHEN name LIKE 'reflexiones/%' THEN 'reflexion'
    END AS resource_type,
    substring(name FROM '(?:cuentacuento|reflexion)_([0-9a-f-]{36})_') AS liturgy_id_str
  FROM storage.objects
  WHERE bucket_id = 'liturgy-published' AND name LIKE '%.pdf'
),
latest AS (
  SELECT DISTINCT ON (liturgy_id_str, resource_type)
    liturgy_id_str, resource_type, name, created_at, size_bytes
  FROM parsed
  WHERE liturgy_id_str IS NOT NULL
  ORDER BY liturgy_id_str, resource_type, created_at DESC
)
INSERT INTO published_resources (
  resource_type, liturgy_id, liturgy_date, title, description,
  pdf_url, pdf_filename, file_size_bytes, is_active, published_at, created_at, updated_at
)
SELECT
  l.resource_type::varchar,
  l.liturgy_id_str::uuid,
  lit.fecha,
  lit.titulo,
  CASE WHEN l.resource_type = 'cuentacuento'
       THEN 'Cuento ilustrado para familias: ' || lit.titulo
       ELSE 'Reflexion pastoral: ' || lit.titulo END,
  'https://mulsqxfhxxdsadxsljss.supabase.co/storage/v1/object/public/liturgy-published/' || l.name,
  split_part(l.name, '/', 2),
  l.size_bytes::integer,
  false,
  l.created_at,
  l.created_at,
  l.created_at
FROM latest l
INNER JOIN liturgias lit ON lit.id = l.liturgy_id_str::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM published_resources pr
  WHERE pr.resource_type = l.resource_type
    AND pr.liturgy_id = l.liturgy_id_str::uuid
);
