-- =====================================================
-- CASA Financial Module: Annual Budgets
-- Migration: 20260212300000_casa_annual_budgets
-- Created: 2026-02-12
-- Description: Creates the church_fin_annual_budgets
--   table for storing intentional annual budget ceilings
--   per category. Supports the "monthly conversation"
--   feature where monthly allocations are visually
--   compared against annual targets.
-- Safety: All operations are additive (CREATE IF NOT
--   EXISTS, DO $$ guards for policies). No DROP,
--   TRUNCATE, or ALTER DROP. Idempotent.
-- Depends on: 20260212000000_casa_financial_schema.sql
--   (church_fin_categories table, has_permission
--   function, update_church_fin_updated_at() trigger
--   function must all exist)
-- SHARED DATABASE: This Supabase instance is shared
--   with Life OS. Only church_fin_* tables are created.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLE
-- =====================================================

-- -----------------------------------------------------
-- 1.1 church_fin_annual_budgets -- Annual budget ceilings
-- Stores one annual budget amount per category per year.
-- UNIQUE(year, category_id) prevents duplicates and
-- enables upsert via ON CONFLICT.
-- All monetary amounts in INTEGER (CLP, no decimals).
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_annual_budgets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INTEGER     NOT NULL CHECK (year >= 2000 AND year <= 2100),
  category_id UUID        NOT NULL REFERENCES church_fin_categories(id),
  amount      INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year, category_id)
);


-- =====================================================
-- 2. INDEXES
-- =====================================================

-- Year lookup for annual budget queries
CREATE INDEX IF NOT EXISTS idx_church_fin_annual_budgets_year
  ON church_fin_annual_budgets(year);


-- =====================================================
-- 3. TRIGGER -- updated_at
-- Reuses the existing update_church_fin_updated_at()
-- function from the base financial schema migration.
-- =====================================================

DROP TRIGGER IF EXISTS trg_church_fin_annual_budgets_updated_at ON church_fin_annual_budgets;
CREATE TRIGGER trg_church_fin_annual_budgets_updated_at
  BEFORE UPDATE ON church_fin_annual_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_church_fin_updated_at();


-- =====================================================
-- 4. ROW LEVEL SECURITY
-- Uses public.has_permission() from RBAC migration.
-- 4 policies: SELECT, INSERT, UPDATE, DELETE.
-- Wrapped in DO $$ blocks for idempotency — if
-- policies already exist, the exception is caught
-- and execution continues.
-- =====================================================

ALTER TABLE church_fin_annual_budgets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "church_fin_annual_budgets_select" ON church_fin_annual_budgets
    FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "church_fin_annual_budgets_insert" ON church_fin_annual_budgets
    FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "church_fin_annual_budgets_update" ON church_fin_annual_budgets
    FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "church_fin_annual_budgets_delete" ON church_fin_annual_budgets
    FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =====================================================
-- 5. TABLE COMMENT
-- =====================================================

COMMENT ON TABLE church_fin_annual_budgets IS
  'CASA Financial: Annual budget ceilings per category. UNIQUE on (year, category_id). Supports monthly-to-annual budget conversation feature';


-- =====================================================
-- COMPLETION
-- =====================================================

COMMIT;
