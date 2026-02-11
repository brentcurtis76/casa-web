/**
 * Financial Module Types
 *
 * TypeScript interfaces for all 8 church_fin_* tables,
 * type unions for constrained columns, and CLP formatting helpers.
 *
 * These are application-level types — the auto-generated Supabase types
 * file (src/integrations/supabase/types.ts) is NOT modified.
 */

// ─── Type Unions ─────────────────────────────────────────────────────────────

export type TransactionType = 'income' | 'expense' | 'transfer';
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type CategoryType = 'income' | 'expense';
export type ContractType = 'indefinido' | 'plazo_fijo' | 'honorarios';
export type TransactionSource = 'manual' | 'import' | 'recurring' | 'payroll';
export type BankTransactionStatus = 'unmatched' | 'matched' | 'created' | 'ignored';
export type PayrollStatus = 'draft' | 'processed' | 'paid';
export type BankFileType = 'csv' | 'xlsx';

// ─── Interfaces (one per table) ──────────────────────────────────────────────

/** Mirrors church_fin_accounts */
export interface FinancialAccount {
  id: string;
  name: string;
  account_number: string | null;
  type: AccountType;
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

/** Mirrors church_fin_categories */
export interface FinancialCategory {
  id: string;
  name: string;
  type: CategoryType;
  parent_id: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

/** Mirrors church_fin_transactions */
export interface FinancialTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  category_id: string | null;
  account_id: string | null;
  reference: string | null;
  notes: string | null;
  reconciled: boolean;
  source: TransactionSource;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors church_fin_budgets */
export interface FinancialBudget {
  id: string;
  year: number;
  month: number;
  category_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

/** Mirrors church_fin_bank_statements */
export interface BankStatement {
  id: string;
  bank_name: string;
  statement_date: string;
  file_url: string;
  file_type: BankFileType | null;
  processed: boolean;
  uploaded_by: string | null;
  created_at: string;
}

/** Mirrors church_fin_bank_transactions */
export interface BankTransaction {
  id: string;
  statement_id: string;
  date: string;
  description: string;
  amount: number;
  reference: string | null;
  matched_transaction_id: string | null;
  match_confidence: number | null;
  status: BankTransactionStatus;
  created_at: string;
}

/** Mirrors church_fin_personnel */
export interface Personnel {
  id: string;
  name: string;
  rut: string;
  role_position: string;
  contract_type: ContractType;
  gross_salary: number;
  afp_name: string | null;
  isapre_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  start_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Mirrors church_fin_payroll */
export interface PayrollEntry {
  id: string;
  personnel_id: string;
  year: number;
  month: number;
  status: PayrollStatus;
  gross: number;
  afp_deduction: number;
  isapre_deduction: number;
  impuesto_unico: number;
  other_deductions: number;
  net: number;
  paid_at: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors church_fin_annual_budgets */
export interface AnnualBudget {
  id: string;
  year: number;
  category_id: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

// ─── CLP Formatting Helpers ──────────────────────────────────────────────────

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
});

/** Formats a CLP integer amount to "$1.234.567" */
export function formatCLP(amount: number): string {
  return clpFormatter.format(amount);
}

/** Parses a CLP formatted string back to an integer. Returns 0 on failure. */
export function parseCLP(formatted: string): number {
  const cleaned = formatted
    .replace(/\u2212/g, '-')   // Unicode minus → ASCII minus
    .replace(/[^0-9-]/g, ''); // Strip everything except digits and minus
  return parseInt(cleaned, 10) || 0;
}

// ─── Month Label Constants ───────────────────────────────────────────────────

export const MONTH_LABELS_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

export const MONTH_LABELS_FULL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

// ─── RUT Masking ────────────────────────────────────────────────────────────

/**
 * Mask a RUT for display, showing only the last 5 characters.
 * "12.345.678-9" → "**.***.678-9"
 */
export function maskRut(rut: string): string {
  if (!rut || rut.length < 5) return rut ?? '';
  const visible = rut.slice(-5);
  const masked = rut.slice(0, -5).replace(/\d/g, '*');
  return masked + visible;
}
