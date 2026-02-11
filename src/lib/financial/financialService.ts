/**
 * Financial Module — Service Layer
 *
 * Supabase CRUD functions for transactions, categories, and accounts.
 * Each function receives the Supabase client as its first parameter
 * (dependency injection for testability).
 *
 * Returns { data, error } to align with Supabase convention.
 * Mutations include audit log writes (fire-and-forget).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FinancialTransaction,
  FinancialCategory,
  FinancialAccount,
  BankStatement,
  BankTransaction,
  BankFileType,
  BankTransactionStatus,
} from '@/types/financial';

// ─── Update Field Whitelists ────────────────────────────────────────────────

export type TransactionUpdateFields = Pick<FinancialTransaction,
  'date' | 'description' | 'amount' | 'type' | 'category_id' | 'account_id' |
  'reference' | 'notes' | 'reconciled'
>;

export type CategoryUpdateFields = Pick<FinancialCategory,
  'name' | 'type' | 'parent_id' | 'icon' | 'sort_order' | 'is_active'
>;

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  type?: 'income' | 'expense' | 'transfer';
  category_id?: string;
  reconciled?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'date' | 'amount';
  sortOrder?: 'asc' | 'desc';
}

// ─── Audit Log Helper ───────────────────────────────────────────────────────

export async function writeAuditLog(
  client: SupabaseClient,
  userId: string,
  actionType: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await client.from('church_audit_log').insert({
      user_id: userId,
      action_type: actionType,
      details,
    });
  } catch {
    // Fire-and-forget: audit failure must not block the mutation
  }
}

// ─── Transaction Functions ───────────────────────────────────────────────────

export async function getTransactions(
  client: SupabaseClient,
  filters?: TransactionFilters
): Promise<{ data: FinancialTransaction[] | null; count: number; error: Error | null }> {
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 20;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const sortBy = filters?.sortBy ?? 'date';
  const sortOrder = filters?.sortOrder ?? 'desc';

  let query = client
    .from('church_fin_transactions')
    .select('*', { count: 'exact' })
    .order(sortBy, { ascending: sortOrder === 'asc' });

  // Secondary sort by created_at for stable ordering when primary sort values match
  if (sortBy !== 'date') {
    query = query.order('date', { ascending: false });
  }

  if (filters?.startDate) {
    query = query.gte('date', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('date', filters.endDate);
  }
  if (filters?.type) {
    query = query.eq('type', filters.type);
  }
  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id);
  }
  if (filters?.reconciled !== undefined) {
    query = query.eq('reconciled', filters.reconciled);
  }

  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) return { data: null, count: 0, error };
  return { data: data as FinancialTransaction[], count: count ?? 0, error: null };
}

export async function createTransaction(
  client: SupabaseClient,
  data: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at' | 'reconciled' | 'source'>,
  userId?: string
): Promise<{ data: FinancialTransaction | null; error: Error | null }> {
  const insertData = {
    ...data,
    created_by: userId ?? data.created_by,
  };

  const { data: result, error } = await client
    .from('church_fin_transactions')
    .insert(insertData)
    .select()
    .single();

  if (error) return { data: null, error };

  // Audit log: fire-and-forget
  if (userId) {
    writeAuditLog(client, userId, 'fin_transaction_create', {
      resource_type: 'fin_transaction',
      resource_id: (result as FinancialTransaction).id,
      transaction: {
        description: data.description,
        amount: data.amount,
        type: data.type,
        date: data.date,
      },
    });
  }

  return { data: result as FinancialTransaction, error: null };
}

export async function updateTransaction(
  client: SupabaseClient,
  id: string,
  data: Partial<TransactionUpdateFields>,
  userId?: string
): Promise<{ data: FinancialTransaction | null; error: Error | null }> {
  const { data: result, error } = await client
    .from('church_fin_transactions')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error };

  // Audit log: fire-and-forget
  if (userId) {
    writeAuditLog(client, userId, 'fin_transaction_update', {
      resource_type: 'fin_transaction',
      resource_id: id,
      changes: data,
    });
  }

  return { data: result as FinancialTransaction, error: null };
}

export async function deleteTransaction(
  client: SupabaseClient,
  id: string,
  userId?: string,
  description?: string
): Promise<{ error: Error | null }> {
  // Audit log before deleting (fire-and-forget)
  if (userId) {
    writeAuditLog(client, userId, 'fin_transaction_delete', {
      resource_type: 'fin_transaction',
      resource_id: id,
      deleted: { id, description: description ?? '' },
    });
  }

  const { error } = await client
    .from('church_fin_transactions')
    .delete()
    .eq('id', id);

  return { error: error ?? null };
}

// ─── Category Functions ──────────────────────────────────────────────────────

export async function getCategories(
  client: SupabaseClient,
  activeOnly?: boolean
): Promise<{ data: FinancialCategory[] | null; error: Error | null }> {
  let query = client
    .from('church_fin_categories')
    .select('*')
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) return { data: null, error };
  return { data: data as FinancialCategory[], error: null };
}

export async function createCategory(
  client: SupabaseClient,
  data: Omit<FinancialCategory, 'id' | 'created_at'>
): Promise<{ data: FinancialCategory | null; error: Error | null }> {
  const { data: result, error } = await client
    .from('church_fin_categories')
    .insert(data)
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: result as FinancialCategory, error: null };
}

export async function updateCategory(
  client: SupabaseClient,
  id: string,
  data: Partial<CategoryUpdateFields>
): Promise<{ data: FinancialCategory | null; error: Error | null }> {
  const { data: result, error } = await client
    .from('church_fin_categories')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: result as FinancialCategory, error: null };
}

// ─── Account Functions ───────────────────────────────────────────────────────

export async function getAccounts(
  client: SupabaseClient
): Promise<{ data: FinancialAccount[] | null; error: Error | null }> {
  const { data, error } = await client
    .from('church_fin_accounts')
    .select('*')
    .order('name', { ascending: true });

  if (error) return { data: null, error };
  return { data: data as FinancialAccount[], error: null };
}

export async function createAccount(
  client: SupabaseClient,
  data: Omit<FinancialAccount, 'id' | 'created_at'>
): Promise<{ data: FinancialAccount | null; error: Error | null }> {
  const { data: result, error } = await client
    .from('church_fin_accounts')
    .insert(data)
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: result as FinancialAccount, error: null };
}

// ─── Bank Import Functions ──────────────────────────────────────────────────

/**
 * Create a bank statement record.
 * Uses a placeholder URL (local://filename) since we parse client-side.
 */
export async function importBankStatement(
  client: SupabaseClient,
  bankName: string,
  statementDate: string,
  fileUrl: string,
  fileType: BankFileType,
  userId?: string
): Promise<{ data: BankStatement | null; error: Error | null }> {
  const { data: result, error } = await client
    .from('church_fin_bank_statements')
    .insert({
      bank_name: bankName,
      statement_date: statementDate,
      file_url: fileUrl,
      file_type: fileType,
      uploaded_by: userId ?? null,
      processed: false,
    })
    .select()
    .single();

  if (error) return { data: null, error };

  // Audit log: fire-and-forget
  if (userId) {
    writeAuditLog(client, userId, 'fin_bank_statement_import', {
      resource_type: 'fin_bank_statement',
      resource_id: (result as BankStatement).id,
      bank_name: bankName,
      statement_date: statementDate,
      file_type: fileType,
    });
  }

  return { data: result as BankStatement, error: null };
}

/**
 * Bulk insert parsed bank transaction rows.
 * Batches in groups of 100 to avoid request size limits.
 */
export async function importBankTransactions(
  client: SupabaseClient,
  statementId: string,
  rows: Array<{
    date: string;
    description: string;
    amount: number;
    reference?: string;
  }>,
  userId?: string
): Promise<{ data: BankTransaction[] | null; error: Error | null }> {
  if (rows.length === 0) return { data: [], error: null };

  const insertRows = rows.map((row) => ({
    statement_id: statementId,
    date: row.date,
    description: row.description.substring(0, 500).trim(),
    amount: row.amount,
    reference: row.reference?.substring(0, 200).trim() ?? null,
    status: 'unmatched' as BankTransactionStatus,
  }));

  // Batch insert in groups of 100
  const BATCH_SIZE = 100;
  const allResults: BankTransaction[] = [];

  for (let i = 0; i < insertRows.length; i += BATCH_SIZE) {
    const batch = insertRows.slice(i, i + BATCH_SIZE);
    const { data, error } = await client
      .from('church_fin_bank_transactions')
      .insert(batch)
      .select();

    if (error) return { data: null, error };
    if (data) {
      allResults.push(...(data as BankTransaction[]));
    }
  }

  // Audit log: fire-and-forget
  if (userId) {
    writeAuditLog(client, userId, 'fin_bank_transactions_import', {
      resource_type: 'fin_bank_transaction',
      statement_id: statementId,
      row_count: allResults.length,
    });
  }

  return { data: allResults, error: null };
}

/**
 * Update a bank transaction's match status.
 */
export async function updateBankTransactionMatch(
  client: SupabaseClient,
  id: string,
  matchedTransactionId: string | null,
  confidence: number | null,
  status: BankTransactionStatus
): Promise<{ data: BankTransaction | null; error: Error | null }> {
  const { data: result, error } = await client
    .from('church_fin_bank_transactions')
    .update({
      matched_transaction_id: matchedTransactionId,
      match_confidence: confidence,
      status,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return { data: null, error };
  return { data: result as BankTransaction, error: null };
}

/**
 * Bulk confirm matches — set all specified bank transactions to 'matched' status.
 */
export async function bulkConfirmMatches(
  client: SupabaseClient,
  ids: string[],
  userId?: string
): Promise<{ error: Error | null }> {
  if (ids.length === 0) return { error: null };

  const { error } = await client
    .from('church_fin_bank_transactions')
    .update({ status: 'matched' as BankTransactionStatus })
    .in('id', ids);

  if (error) return { error };

  // Audit log: fire-and-forget
  if (userId) {
    writeAuditLog(client, userId, 'fin_bank_bulk_confirm', {
      resource_type: 'fin_bank_transaction',
      confirmed_count: ids.length,
    });
  }

  return { error: null };
}

/**
 * Fetch bank transactions for a given statement.
 */
export async function getBankTransactions(
  client: SupabaseClient,
  statementId: string
): Promise<{ data: BankTransaction[] | null; error: Error | null }> {
  const { data, error } = await client
    .from('church_fin_bank_transactions')
    .select('*')
    .eq('statement_id', statementId)
    .order('date', { ascending: true });

  if (error) return { data: null, error };
  return { data: data as BankTransaction[], error: null };
}

/**
 * Mark a bank statement as processed.
 */
export async function markStatementProcessed(
  client: SupabaseClient,
  statementId: string
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from('church_fin_bank_statements')
    .update({ processed: true })
    .eq('id', statementId);

  return { error: error ?? null };
}
