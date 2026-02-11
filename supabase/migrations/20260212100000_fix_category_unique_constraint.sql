-- Fix: Add unique constraint on church_fin_categories (name, type, parent_id)
--
-- The base migration (20260212000000) used ON CONFLICT DO NOTHING on seed inserts,
-- but without a UNIQUE constraint on (name, type, parent_id), PostgreSQL has no
-- conflict target and silently inserts every time. This migration adds a unique
-- index using COALESCE to handle NULLable parent_id (since NULL != NULL in
-- PostgreSQL unique constraints).

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_church_fin_categories_unique_name
  ON church_fin_categories (name, type, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'));

COMMIT;
