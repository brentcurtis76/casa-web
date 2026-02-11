-- =====================================================
-- CASA Financial Module Schema
-- Migration: 20260212000000_casa_financial_schema
-- Created: 2026-02-12
-- Description: Creates the 8 financial module tables
--   (church_fin_accounts, church_fin_categories,
--    church_fin_transactions, church_fin_budgets,
--    church_fin_bank_statements, church_fin_bank_transactions,
--    church_fin_personnel, church_fin_payroll) with RLS
--   policies, indexes, triggers, and seed data.
-- Safety: All operations are additive (CREATE IF NOT EXISTS,
--   CREATE OR REPLACE, INSERT ON CONFLICT DO NOTHING).
--   No DROP, TRUNCATE, or ALTER DROP. Idempotent.
-- Depends on: 20260209000000_casa_rbac_schema.sql
--   (has_permission function must exist)
-- SHARED DATABASE: This Supabase instance is shared with
--   Life OS. Only church_fin_* tables are created here.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. TABLES
-- =====================================================

-- -----------------------------------------------------
-- 1.1 church_fin_accounts -- Chart of accounts
-- Supports hierarchical account structures via
-- self-referencing parent_id.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_accounts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  account_number TEXT,
  type        TEXT        NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_id   UUID        REFERENCES church_fin_accounts(id),
  description TEXT,
  is_active   BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.2 church_fin_categories -- Transaction categories
-- Hierarchical via self-referencing parent_id.
-- Used for income/expense classification.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('income', 'expense')),
  parent_id   UUID        REFERENCES church_fin_categories(id),
  icon        TEXT,
  sort_order  INTEGER     DEFAULT 0,
  is_active   BOOLEAN     DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.3 church_fin_transactions -- Core income/expense records
-- All monetary amounts in INTEGER (CLP, no decimals).
-- created_by uses ON DELETE SET NULL per architect review
-- to prevent blocking user deletion.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_transactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE        NOT NULL,
  description TEXT        NOT NULL,
  amount      INTEGER     NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category_id UUID        REFERENCES church_fin_categories(id),
  account_id  UUID        REFERENCES church_fin_accounts(id),
  reference   TEXT,
  notes       TEXT,
  reconciled  BOOLEAN     DEFAULT false,
  source      TEXT        DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'recurring', 'payroll')),
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.4 church_fin_budgets -- Monthly budget per category
-- UNIQUE constraint prevents duplicate budget entries
-- for the same category in the same month/year.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_budgets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  year        INTEGER     NOT NULL,
  month       INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  category_id UUID        NOT NULL REFERENCES church_fin_categories(id),
  amount      INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year, month, category_id)
);

-- -----------------------------------------------------
-- 1.5 church_fin_bank_statements -- Uploaded bank files
-- uploaded_by uses ON DELETE SET NULL per architect review.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_bank_statements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name      TEXT        NOT NULL,
  statement_date DATE        NOT NULL,
  file_url       TEXT        NOT NULL,
  file_type      TEXT        CHECK (file_type IN ('csv', 'xlsx')),
  processed      BOOLEAN     DEFAULT false,
  uploaded_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.6 church_fin_bank_transactions -- Parsed rows from
-- uploaded bank statements. ON DELETE CASCADE on
-- statement_id ensures cleanup when statement is removed.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_bank_transactions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id            UUID        NOT NULL REFERENCES church_fin_bank_statements(id) ON DELETE CASCADE,
  date                    DATE        NOT NULL,
  description             TEXT        NOT NULL,
  amount                  INTEGER     NOT NULL,
  reference               TEXT,
  matched_transaction_id  UUID        REFERENCES church_fin_transactions(id),
  match_confidence        NUMERIC(3,2),
  status                  TEXT        DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'matched', 'created', 'ignored')),
  created_at              TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.7 church_fin_personnel -- Employee/contractor records
-- Chilean payroll model: RUT, AFP, ISAPRE, contract types.
-- UNIQUE on rut per architect review to prevent duplicates.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_personnel (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  rut                 TEXT        NOT NULL UNIQUE,
  role_position       TEXT        NOT NULL,
  contract_type       TEXT        NOT NULL CHECK (contract_type IN ('indefinido', 'plazo_fijo', 'honorarios')),
  gross_salary        INTEGER     NOT NULL,
  afp_name            TEXT,
  isapre_name         TEXT,
  bank_name           TEXT,
  bank_account_number TEXT,
  start_date          DATE,
  is_active           BOOLEAN     DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------
-- 1.8 church_fin_payroll -- Monthly payroll entries
-- All deduction/amount fields in INTEGER (CLP).
-- UNIQUE constraint prevents duplicate entries per
-- person per month.
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS church_fin_payroll (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id      UUID        NOT NULL REFERENCES church_fin_personnel(id),
  year              INTEGER     NOT NULL,
  month             INTEGER     NOT NULL CHECK (month BETWEEN 1 AND 12),
  status            TEXT        DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'paid')),
  gross             INTEGER     NOT NULL,
  afp_deduction     INTEGER     DEFAULT 0,
  isapre_deduction  INTEGER     DEFAULT 0,
  impuesto_unico    INTEGER     DEFAULT 0,
  other_deductions  INTEGER     DEFAULT 0,
  net               INTEGER     NOT NULL,
  paid_at           TIMESTAMPTZ,
  transaction_id    UUID        REFERENCES church_fin_transactions(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(personnel_id, year, month)
);


-- =====================================================
-- 2. INDEXES
-- =====================================================

-- Transaction indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_church_fin_transactions_date
  ON church_fin_transactions(date);

CREATE INDEX IF NOT EXISTS idx_church_fin_transactions_type
  ON church_fin_transactions(type);

CREATE INDEX IF NOT EXISTS idx_church_fin_transactions_category
  ON church_fin_transactions(category_id);

CREATE INDEX IF NOT EXISTS idx_church_fin_transactions_account
  ON church_fin_transactions(account_id);

-- Category indexes for filtering and hierarchy traversal
CREATE INDEX IF NOT EXISTS idx_church_fin_categories_type
  ON church_fin_categories(type);

CREATE INDEX IF NOT EXISTS idx_church_fin_categories_parent
  ON church_fin_categories(parent_id);

-- Budget period lookup
CREATE INDEX IF NOT EXISTS idx_church_fin_budgets_period
  ON church_fin_budgets(year, month);

-- Bank transaction statement lookup
CREATE INDEX IF NOT EXISTS idx_church_fin_bank_transactions_statement
  ON church_fin_bank_transactions(statement_id);

-- Payroll period and personnel lookups
CREATE INDEX IF NOT EXISTS idx_church_fin_payroll_period
  ON church_fin_payroll(year, month);

CREATE INDEX IF NOT EXISTS idx_church_fin_payroll_personnel
  ON church_fin_payroll(personnel_id);

-- Personnel active status filter
CREATE INDEX IF NOT EXISTS idx_church_fin_personnel_active
  ON church_fin_personnel(is_active);


-- =====================================================
-- 3. TRIGGER FUNCTION -- updated_at
-- Applied to the 4 tables that have updated_at columns.
-- =====================================================

CREATE OR REPLACE FUNCTION update_church_fin_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to church_fin_transactions
DROP TRIGGER IF EXISTS trg_church_fin_transactions_updated_at ON church_fin_transactions;
CREATE TRIGGER trg_church_fin_transactions_updated_at
  BEFORE UPDATE ON church_fin_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_church_fin_updated_at();

-- Apply trigger to church_fin_budgets
DROP TRIGGER IF EXISTS trg_church_fin_budgets_updated_at ON church_fin_budgets;
CREATE TRIGGER trg_church_fin_budgets_updated_at
  BEFORE UPDATE ON church_fin_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_church_fin_updated_at();

-- Apply trigger to church_fin_personnel
DROP TRIGGER IF EXISTS trg_church_fin_personnel_updated_at ON church_fin_personnel;
CREATE TRIGGER trg_church_fin_personnel_updated_at
  BEFORE UPDATE ON church_fin_personnel
  FOR EACH ROW
  EXECUTE FUNCTION update_church_fin_updated_at();

-- Apply trigger to church_fin_payroll
DROP TRIGGER IF EXISTS trg_church_fin_payroll_updated_at ON church_fin_payroll;
CREATE TRIGGER trg_church_fin_payroll_updated_at
  BEFORE UPDATE ON church_fin_payroll
  FOR EACH ROW
  EXECUTE FUNCTION update_church_fin_updated_at();


-- =====================================================
-- 4. ROW LEVEL SECURITY
-- Uses public.has_permission() from RBAC migration.
-- 4 policies per table: SELECT, INSERT, UPDATE, DELETE.
-- =====================================================

-- -----------------------------------------------------
-- 4.1 church_fin_accounts
-- -----------------------------------------------------
ALTER TABLE church_fin_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_fin_accounts_select" ON church_fin_accounts
  FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));

CREATE POLICY "church_fin_accounts_insert" ON church_fin_accounts
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_accounts_update" ON church_fin_accounts
  FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_accounts_delete" ON church_fin_accounts
  FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));

-- -----------------------------------------------------
-- 4.2 church_fin_categories
-- -----------------------------------------------------
ALTER TABLE church_fin_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_fin_categories_select" ON church_fin_categories
  FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));

CREATE POLICY "church_fin_categories_insert" ON church_fin_categories
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_categories_update" ON church_fin_categories
  FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_categories_delete" ON church_fin_categories
  FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));

-- -----------------------------------------------------
-- 4.3 church_fin_transactions
-- -----------------------------------------------------
ALTER TABLE church_fin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_fin_transactions_select" ON church_fin_transactions
  FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));

CREATE POLICY "church_fin_transactions_insert" ON church_fin_transactions
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_transactions_update" ON church_fin_transactions
  FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_transactions_delete" ON church_fin_transactions
  FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));

-- -----------------------------------------------------
-- 4.4 church_fin_budgets
-- -----------------------------------------------------
ALTER TABLE church_fin_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_fin_budgets_select" ON church_fin_budgets
  FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));

CREATE POLICY "church_fin_budgets_insert" ON church_fin_budgets
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_budgets_update" ON church_fin_budgets
  FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_budgets_delete" ON church_fin_budgets
  FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));

-- -----------------------------------------------------
-- 4.5 church_fin_bank_statements
-- -----------------------------------------------------
ALTER TABLE church_fin_bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_fin_bank_statements_select" ON church_fin_bank_statements
  FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));

CREATE POLICY "church_fin_bank_statements_insert" ON church_fin_bank_statements
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_bank_statements_update" ON church_fin_bank_statements
  FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_bank_statements_delete" ON church_fin_bank_statements
  FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));

-- -----------------------------------------------------
-- 4.6 church_fin_bank_transactions
-- -----------------------------------------------------
ALTER TABLE church_fin_bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_fin_bank_transactions_select" ON church_fin_bank_transactions
  FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));

CREATE POLICY "church_fin_bank_transactions_insert" ON church_fin_bank_transactions
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_bank_transactions_update" ON church_fin_bank_transactions
  FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_bank_transactions_delete" ON church_fin_bank_transactions
  FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));

-- -----------------------------------------------------
-- 4.7 church_fin_personnel
-- -----------------------------------------------------
ALTER TABLE church_fin_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_fin_personnel_select" ON church_fin_personnel
  FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));

CREATE POLICY "church_fin_personnel_insert" ON church_fin_personnel
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_personnel_update" ON church_fin_personnel
  FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_personnel_delete" ON church_fin_personnel
  FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));

-- -----------------------------------------------------
-- 4.8 church_fin_payroll
-- -----------------------------------------------------
ALTER TABLE church_fin_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_fin_payroll_select" ON church_fin_payroll
  FOR SELECT USING (public.has_permission(auth.uid(), 'financial', 'read'));

CREATE POLICY "church_fin_payroll_insert" ON church_fin_payroll
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_payroll_update" ON church_fin_payroll
  FOR UPDATE USING (public.has_permission(auth.uid(), 'financial', 'write'));

CREATE POLICY "church_fin_payroll_delete" ON church_fin_payroll
  FOR DELETE USING (public.has_permission(auth.uid(), 'financial', 'write'));


-- =====================================================
-- 5. SEED DATA -- Default Chilean church categories
-- Uses a SELECT-based approach for parent_id references
-- per architect recommendation (robust on re-runs since
-- ON CONFLICT DO NOTHING on the parent means a CTE
-- INSERT...RETURNING would not return a row).
-- =====================================================

-- -----------------------------------------------------
-- 5.1 Income categories (top-level, no parent)
-- -----------------------------------------------------
INSERT INTO church_fin_categories (name, type, icon, sort_order) VALUES
  ('Diezmos',              'income', 'heart',       1),
  ('Ofrendas',             'income', 'hand-heart',  2),
  ('Donaciones Especiales','income', 'gift',         3),
  ('Arriendo Templo',      'income', 'building',    4),
  ('Otros Ingresos',       'income', 'plus-circle', 5)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------
-- 5.2 Expense categories (top-level, no parent)
-- -----------------------------------------------------
INSERT INTO church_fin_categories (name, type, icon, sort_order) VALUES
  ('Sueldos',                  'expense', 'users',          1),
  ('Servicios Basicos',        'expense', 'zap',            2),
  ('Arriendo / Hipoteca',      'expense', 'home',           3),
  ('Materiales',               'expense', 'package',        4),
  ('Mantencion',               'expense', 'wrench',         5),
  ('Actividades Comunitarias', 'expense', 'users-round',    6),
  ('Diaconia',                 'expense', 'hand-helping',   7),
  ('Transporte',               'expense', 'car',            8),
  ('Otros Gastos',             'expense', 'more-horizontal',9)
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------
-- 5.3 Expense sub-categories (children of Servicios Basicos)
-- Uses SELECT to look up parent_id robustly, even on
-- re-runs where the parent was already inserted.
-- -----------------------------------------------------
INSERT INTO church_fin_categories (name, type, parent_id, sort_order)
SELECT 'Luz', 'expense', id, 1
FROM church_fin_categories
WHERE name = 'Servicios Basicos' AND type = 'expense'
ON CONFLICT DO NOTHING;

INSERT INTO church_fin_categories (name, type, parent_id, sort_order)
SELECT 'Agua', 'expense', id, 2
FROM church_fin_categories
WHERE name = 'Servicios Basicos' AND type = 'expense'
ON CONFLICT DO NOTHING;

INSERT INTO church_fin_categories (name, type, parent_id, sort_order)
SELECT 'Gas', 'expense', id, 3
FROM church_fin_categories
WHERE name = 'Servicios Basicos' AND type = 'expense'
ON CONFLICT DO NOTHING;

INSERT INTO church_fin_categories (name, type, parent_id, sort_order)
SELECT 'Internet', 'expense', id, 4
FROM church_fin_categories
WHERE name = 'Servicios Basicos' AND type = 'expense'
ON CONFLICT DO NOTHING;


-- =====================================================
-- 6. TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE church_fin_accounts IS
  'CASA Financial: Chart of accounts with hierarchical structure (asset, liability, equity, income, expense)';

COMMENT ON TABLE church_fin_categories IS
  'CASA Financial: Transaction categories (income/expense) with hierarchical parent-child relationships';

COMMENT ON TABLE church_fin_transactions IS
  'CASA Financial: Core income, expense, and transfer records. All amounts in CLP (integer)';

COMMENT ON TABLE church_fin_budgets IS
  'CASA Financial: Monthly budget allocations per category. UNIQUE on (year, month, category_id)';

COMMENT ON TABLE church_fin_bank_statements IS
  'CASA Financial: Uploaded bank statement files for reconciliation';

COMMENT ON TABLE church_fin_bank_transactions IS
  'CASA Financial: Parsed rows from bank statements. CASCADE delete with parent statement';

COMMENT ON TABLE church_fin_personnel IS
  'CASA Financial: Employee and contractor records for Chilean payroll (RUT, AFP, ISAPRE)';

COMMENT ON TABLE church_fin_payroll IS
  'CASA Financial: Monthly payroll entries with Chilean deduction breakdown. UNIQUE on (personnel_id, year, month)';

COMMENT ON FUNCTION update_church_fin_updated_at() IS
  'CASA Financial: Trigger function to auto-update updated_at timestamp on row modification';


-- =====================================================
-- COMPLETION
-- =====================================================

COMMIT;
