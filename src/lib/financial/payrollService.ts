/**
 * Financial Module — Payroll Service Layer
 *
 * Supabase CRUD functions for payroll (church_fin_payroll).
 * Each function receives the Supabase client as its first parameter
 * (dependency injection for testability).
 *
 * All amounts are integers (CLP). Mutations include audit log writes (fire-and-forget).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PayrollEntry, Personnel, PayrollStatus } from '@/types/financial';
import { MONTH_LABELS_FULL } from '@/types/financial';
import { writeAuditLog } from './financialService';
import { calculatePayroll } from './payrollCalculator';
import type { ChileanTaxTables } from './chileanTaxTables';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PayrollWithPersonnel extends PayrollEntry {
  personnel_name: string;
  personnel_rut: string;
  personnel_role: string;
  personnel_contract_type: string;
  personnel_afp_name: string | null;
}

export interface PayrollSummary {
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
  employeeCount: number;
  status: PayrollStatus | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getLastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// ─── Service Functions ──────────────────────────────────────────────────────

/**
 * Fetch payroll entries for a given year/month, joined with personnel names.
 * Uses client-side join (like budgetService pattern).
 */
export async function getPayrollForMonth(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<{ data: PayrollWithPersonnel[] | null; error: Error | null }> {
  // Fetch payroll entries
  const { data: payrollData, error: payrollError } = await client
    .from('church_fin_payroll')
    .select('id, personnel_id, year, month, status, gross, afp_deduction, isapre_deduction, impuesto_unico, other_deductions, net, transaction_id, paid_at, created_at')
    .eq('year', year)
    .eq('month', month)
    .order('created_at', { ascending: true });

  if (payrollError) return { data: null, error: payrollError };
  if (!payrollData || payrollData.length === 0) return { data: [], error: null };

  // Fetch personnel for joining
  const personnelIds = payrollData.map((p) => (p as PayrollEntry).personnel_id);
  const { data: personnel, error: personnelError } = await client
    .from('church_fin_personnel')
    .select('id, name, rut, role_position, contract_type, afp_name')
    .in('id', personnelIds);

  if (personnelError) return { data: null, error: personnelError };

  // Build personnel map
  const personnelMap = new Map<string, Personnel>();
  if (personnel) {
    for (const p of personnel) {
      personnelMap.set((p as Personnel).id, p as Personnel);
    }
  }

  // Join payroll with personnel
  const result: PayrollWithPersonnel[] = payrollData.map((entry) => {
    const pe = entry as PayrollEntry;
    const person = personnelMap.get(pe.personnel_id);
    return {
      ...pe,
      personnel_name: person?.name ?? 'Desconocido',
      personnel_rut: person?.rut ?? '',
      personnel_role: person?.role_position ?? '',
      personnel_contract_type: person?.contract_type ?? '',
      personnel_afp_name: person?.afp_name ?? null,
    };
  });

  // Sort by name
  result.sort((a, b) => a.personnel_name.localeCompare(b.personnel_name));

  return { data: result, error: null };
}

/**
 * Calculate payroll for all active personnel and upsert as draft entries.
 * Deletes existing drafts first to allow recalculation.
 */
export async function calculateAndSavePayroll(
  client: SupabaseClient,
  year: number,
  month: number,
  taxTables: ChileanTaxTables,
  userId?: string
): Promise<{ data: PayrollEntry[] | null; error: Error | null }> {
  // Delete existing drafts for recalculation
  const { error: deleteError } = await client
    .from('church_fin_payroll')
    .delete()
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'draft');

  if (deleteError) return { data: null, error: deleteError };

  // Check if non-draft entries exist (processed/paid)
  const { data: existing, error: existingError } = await client
    .from('church_fin_payroll')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .limit(1);

  if (existingError) return { data: null, error: existingError };
  if (existing && existing.length > 0) {
    return { data: null, error: new Error('Ya existe nómina procesada o pagada para este período') };
  }

  // Get active personnel
  const { data: personnel, error: personnelError } = await client
    .from('church_fin_personnel')
    .select('id, name, rut, role_position, contract_type, gross_salary, afp_name, isapre_name')
    .eq('is_active', true);

  if (personnelError) return { data: null, error: personnelError };
  if (!personnel || personnel.length === 0) {
    return { data: null, error: new Error('No hay personal activo para calcular nómina') };
  }

  // Calculate payroll for each employee
  const payrollEntries = personnel.map((p) => {
    const person = p as Personnel;
    const calc = calculatePayroll(
      {
        grossSalary: person.gross_salary,
        afpName: person.afp_name ?? '',
        healthProvider: person.isapre_name ?? 'Fonasa',
        contractType: person.contract_type,
        otherDeductions: 0,
      },
      taxTables
    );

    return {
      personnel_id: person.id,
      year,
      month,
      status: 'draft' as PayrollStatus,
      gross: calc.gross,
      afp_deduction: calc.afpDeduction,
      isapre_deduction: calc.healthDeduction,
      impuesto_unico: calc.impuestoUnico,
      other_deductions: calc.otherDeductions,
      net: calc.net,
    };
  });

  // Insert all payroll entries
  const { data: inserted, error: insertError } = await client
    .from('church_fin_payroll')
    .insert(payrollEntries)
    .select();

  if (insertError) return { data: null, error: insertError };

  // Audit log: fire-and-forget
  if (userId) {
    writeAuditLog(client, userId, 'fin_payroll_calculate', {
      resource_type: 'fin_payroll',
      year,
      month,
      employee_count: payrollEntries.length,
    });
  }

  return { data: (inserted as PayrollEntry[]) ?? [], error: null };
}

/**
 * Process payroll: update all draft entries to 'processed' status.
 */
export async function processPayroll(
  client: SupabaseClient,
  year: number,
  month: number,
  userId?: string
): Promise<{ error: Error | null }> {
  const { data: drafts, error: fetchError } = await client
    .from('church_fin_payroll')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'draft');

  if (fetchError) return { error: fetchError };
  if (!drafts || drafts.length === 0) {
    return { error: new Error('No hay borradores de nómina para procesar') };
  }

  const ids = drafts.map((d) => (d as { id: string }).id);

  const { error: updateError } = await client
    .from('church_fin_payroll')
    .update({ status: 'processed' as PayrollStatus })
    .in('id', ids);

  if (updateError) return { error: updateError };

  // Audit log: fire-and-forget
  if (userId) {
    writeAuditLog(client, userId, 'fin_payroll_process', {
      resource_type: 'fin_payroll',
      year,
      month,
      processed_count: ids.length,
    });
  }

  return { error: null };
}

/**
 * Mark payroll as paid: update processed entries to 'paid', create expense
 * transactions, and link transaction IDs. Handles rollback on failure.
 */
export async function markPayrollPaid(
  client: SupabaseClient,
  year: number,
  month: number,
  userId?: string
): Promise<{ error: Error | null }> {
  // Fetch processed entries with personnel info
  const { data: entries, error: fetchError } = await client
    .from('church_fin_payroll')
    .select('id, personnel_id, year, month, status, gross, afp_deduction, isapre_deduction, impuesto_unico, other_deductions, net, transaction_id, paid_at, created_at')
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'processed');

  if (fetchError) return { error: fetchError };
  if (!entries || entries.length === 0) {
    return { error: new Error('No hay nómina procesada para marcar como pagada') };
  }

  // Fetch personnel names for transaction descriptions
  const personnelIds = entries.map((e) => (e as PayrollEntry).personnel_id);
  const { data: personnel, error: pError } = await client
    .from('church_fin_personnel')
    .select('id, name')
    .in('id', personnelIds);

  if (pError) return { error: pError };

  const nameMap = new Map<string, string>();
  if (personnel) {
    for (const p of personnel) {
      nameMap.set(p.id as string, p.name as string);
    }
  }

  const monthName = MONTH_LABELS_FULL[month - 1];
  const lastDay = getLastDayOfMonth(year, month);
  const createdTransactionIds: string[] = [];
  const updatedEntryIds: string[] = [];

  // Create one expense transaction per employee
  for (const entry of entries) {
    const pe = entry as PayrollEntry;
    const name = nameMap.get(pe.personnel_id) ?? 'Empleado';

    const { data: tx, error: txError } = await client
      .from('church_fin_transactions')
      .insert({
        date: lastDay,
        description: `Nómina ${monthName} ${year} — ${name}`,
        amount: pe.net,
        type: 'expense',
        source: 'payroll',
        created_by: userId ?? null,
      })
      .select('id')
      .single();

    if (txError) {
      // Rollback: revert already-updated payroll entries back to 'processed'
      if (updatedEntryIds.length > 0) {
        await client
          .from('church_fin_payroll')
          .update({ status: 'processed' as PayrollStatus, transaction_id: null, paid_at: null })
          .in('id', updatedEntryIds);
      }
      // Rollback: delete all created transactions
      if (createdTransactionIds.length > 0) {
        await client
          .from('church_fin_transactions')
          .delete()
          .in('id', createdTransactionIds);
      }
      return { error: txError };
    }

    createdTransactionIds.push((tx as { id: string }).id);

    // Update payroll entry with transaction_id and paid_at
    const { error: updateError } = await client
      .from('church_fin_payroll')
      .update({
        status: 'paid' as PayrollStatus,
        transaction_id: (tx as { id: string }).id,
        paid_at: new Date().toISOString(),
      })
      .eq('id', pe.id);

    if (updateError) {
      // Rollback: revert already-updated payroll entries back to 'processed'
      if (updatedEntryIds.length > 0) {
        await client
          .from('church_fin_payroll')
          .update({ status: 'processed' as PayrollStatus, transaction_id: null, paid_at: null })
          .in('id', updatedEntryIds);
      }
      // Rollback: delete all created transactions
      if (createdTransactionIds.length > 0) {
        await client
          .from('church_fin_transactions')
          .delete()
          .in('id', createdTransactionIds);
      }
      return { error: updateError };
    }

    updatedEntryIds.push(pe.id);
  }

  // Audit log: fire-and-forget
  if (userId) {
    writeAuditLog(client, userId, 'fin_payroll_paid', {
      resource_type: 'fin_payroll',
      year,
      month,
      paid_count: entries.length,
      transaction_ids: createdTransactionIds,
    });
  }

  return { error: null };
}

/**
 * Get aggregate payroll summary for a given month.
 */
export async function getPayrollSummary(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<{ data: PayrollSummary | null; error: Error | null }> {
  const { data: entries, error } = await client
    .from('church_fin_payroll')
    .select('id, personnel_id, year, month, status, gross, afp_deduction, isapre_deduction, impuesto_unico, other_deductions, net, transaction_id, paid_at, created_at')
    .eq('year', year)
    .eq('month', month);

  if (error) return { data: null, error };
  if (!entries || entries.length === 0) {
    return { data: null, error: null };
  }

  const payrollEntries = entries as PayrollEntry[];
  let totalGross = 0;
  let totalDeductions = 0;
  let totalNet = 0;

  for (const pe of payrollEntries) {
    totalGross += pe.gross;
    totalDeductions += pe.afp_deduction + pe.isapre_deduction + pe.impuesto_unico + pe.other_deductions;
    totalNet += pe.net;
  }

  // Employer overhead: AFC indefinido 2.4% + SIS 1.53% + Mutual 0.95% = 4.88%
  // Approximation for summary (exact per-employee calc done in PayrollSummary component)
  const totalEmployerCost = totalGross + Math.round(totalGross * 0.0488);

  // All entries should have the same status for a given period
  const status = payrollEntries[0]?.status ?? null;

  return {
    data: {
      totalGross,
      totalDeductions,
      totalNet,
      totalEmployerCost,
      employeeCount: payrollEntries.length,
      status,
    },
    error: null,
  };
}

/**
 * Delete all draft payroll entries for a given month (for recalculation).
 */
export async function deletePayrollDraft(
  client: SupabaseClient,
  year: number,
  month: number,
  userId?: string
): Promise<{ error: Error | null }> {
  const { error } = await client
    .from('church_fin_payroll')
    .delete()
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'draft');

  if (!error && userId) {
    writeAuditLog(client, userId, 'fin_payroll_delete_draft', {
      resource_type: 'fin_payroll',
      year,
      month,
    });
  }

  return { error: error ?? null };
}
