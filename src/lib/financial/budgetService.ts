/**
 * Financial Module — Budget Service Layer
 *
 * Supabase CRUD and aggregate functions for budget management.
 * Each function receives the Supabase client as its first parameter
 * (dependency injection for testability).
 *
 * Budget amounts are stored as integers (CLP, no decimals).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialBudget, FinancialCategory, AnnualBudget, CategoryType } from '@/types/financial';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BudgetWithCategory extends FinancialBudget {
  category_name: string;
  category_type: CategoryType;
  category_sort_order: number;
}

export interface BudgetVsActualItem {
  category_id: string;
  categoryName: string;
  categoryType: CategoryType;
  budgeted: number;
  actual: number;
  difference: number;
  percentage: number;
}

export interface BudgetUpsertEntry {
  year: number;
  month: number;
  category_id: string;
  amount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

// ─── Budget Functions ───────────────────────────────────────────────────────

/**
 * Fetch all budgets for a given year/month, joined with category names and types.
 */
export async function getBudgets(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<{ data: BudgetWithCategory[] | null; error: Error | null }> {
  const { data: budgets, error: budgetError } = await client
    .from('church_fin_budgets')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  if (budgetError) return { data: null, error: budgetError };
  if (!budgets || budgets.length === 0) return { data: [], error: null };

  // Fetch categories for joining
  const { data: categories, error: catError } = await client
    .from('church_fin_categories')
    .select('id, name, type, sort_order');

  if (catError) return { data: null, error: catError };

  const categoryMap = new Map<string, { name: string; type: CategoryType; sort_order: number }>();
  if (categories) {
    for (const cat of categories) {
      categoryMap.set(cat.id, {
        name: cat.name,
        type: cat.type as CategoryType,
        sort_order: cat.sort_order ?? 0,
      });
    }
  }

  const result: BudgetWithCategory[] = budgets.map((b) => {
    const cat = categoryMap.get(b.category_id);
    return {
      ...(b as FinancialBudget),
      category_name: cat?.name ?? 'Desconocida',
      category_type: cat?.type ?? 'expense',
      category_sort_order: cat?.sort_order ?? 0,
    };
  });

  // Sort by type (income first), then sort_order
  result.sort((a, b) => {
    if (a.category_type !== b.category_type) {
      return a.category_type === 'income' ? -1 : 1;
    }
    return a.category_sort_order - b.category_sort_order;
  });

  return { data: result, error: null };
}

/**
 * Bulk upsert budget entries. Leverages UNIQUE(year, month, category_id) constraint.
 */
export async function upsertBudgets(
  client: SupabaseClient,
  entries: BudgetUpsertEntry[]
): Promise<{ error: Error | null }> {
  if (entries.length === 0) return { error: null };

  const { error } = await client
    .from('church_fin_budgets')
    .upsert(entries, { onConflict: 'year,month,category_id' });

  return { error: error ?? null };
}

/**
 * Copy all budget amounts from the previous month into the current month.
 * Only copies categories that don't already have a budget for the target month.
 * Handles January -> December year rollback.
 */
export async function copyFromPreviousMonth(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<{ copied: number; error: Error | null }> {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  // Get previous month budgets
  const { data: prevBudgets, error: prevError } = await client
    .from('church_fin_budgets')
    .select('category_id, amount')
    .eq('year', prevYear)
    .eq('month', prevMonth);

  if (prevError) return { copied: 0, error: prevError };
  if (!prevBudgets || prevBudgets.length === 0) return { copied: 0, error: null };

  // Get current month budgets to know which categories already have budgets
  const { data: currentBudgets, error: curError } = await client
    .from('church_fin_budgets')
    .select('category_id')
    .eq('year', year)
    .eq('month', month);

  if (curError) return { copied: 0, error: curError };

  const existingCategoryIds = new Set(
    (currentBudgets ?? []).map((b) => b.category_id as string)
  );

  // Filter to only categories without existing budgets
  const toCopy: BudgetUpsertEntry[] = prevBudgets
    .filter((b) => !existingCategoryIds.has(b.category_id as string))
    .map((b) => ({
      year,
      month,
      category_id: b.category_id as string,
      amount: b.amount as number,
    }));

  if (toCopy.length === 0) return { copied: 0, error: null };

  const { error: insertError } = await client
    .from('church_fin_budgets')
    .insert(toCopy);

  if (insertError) return { copied: 0, error: insertError };
  return { copied: toCopy.length, error: null };
}

/**
 * Get budget vs actual data per category for a given month.
 * Returns each active category with budgeted amount and actual transaction totals.
 */
export async function getBudgetVsActual(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<{ data: BudgetVsActualItem[]; error: Error | null }> {
  const { start, end } = getMonthRange(year, month);

  // Fetch all active categories
  const { data: categories, error: catError } = await client
    .from('church_fin_categories')
    .select('id, name, type, sort_order, is_active')
    .eq('is_active', true)
    .order('type', { ascending: true })
    .order('sort_order', { ascending: true });

  if (catError) return { data: [], error: catError };

  // Fetch budgets for this month
  const { data: budgets, error: budgetError } = await client
    .from('church_fin_budgets')
    .select('category_id, amount')
    .eq('year', year)
    .eq('month', month);

  if (budgetError) return { data: [], error: budgetError };

  // Fetch transactions for this month
  const { data: transactions, error: txError } = await client
    .from('church_fin_transactions')
    .select('category_id, amount, type')
    .gte('date', start)
    .lte('date', end);

  if (txError) return { data: [], error: txError };

  // Build budget map
  const budgetMap = new Map<string, number>();
  for (const b of budgets ?? []) {
    budgetMap.set(b.category_id as string, b.amount as number);
  }

  // Build actual spending map (income and expense separate)
  const actualMap = new Map<string, number>();
  for (const tx of transactions ?? []) {
    const catId = tx.category_id as string | null;
    if (!catId) continue;
    const current = actualMap.get(catId) ?? 0;
    actualMap.set(catId, current + (tx.amount as number));
  }

  // Build result with all active categories
  const result: BudgetVsActualItem[] = [];
  for (const cat of categories ?? []) {
    const typedCat = cat as FinancialCategory;
    const budgeted = budgetMap.get(typedCat.id) ?? 0;
    const actual = actualMap.get(typedCat.id) ?? 0;

    // Only include categories that have either a budget or actual spending
    if (budgeted === 0 && actual === 0) continue;

    const difference = budgeted - actual;
    const percentage = budgeted > 0 ? Math.round((actual / budgeted) * 100) : (actual > 0 ? 100 : 0);

    result.push({
      category_id: typedCat.id,
      categoryName: typedCat.name,
      categoryType: typedCat.type,
      budgeted,
      actual,
      difference,
      percentage,
    });
  }

  return { data: result, error: null };
}

// ─── Annual Budget Types ────────────────────────────────────────────────────

export interface AnnualBudgetWithCategory extends AnnualBudget {
  category_name: string;
  category_type: CategoryType;
  category_sort_order: number;
  monthlyAllocated: number;
  remaining: number;
  allocationPercentage: number;
  yearActual: number;
  allocatedMonths: number;
}

export interface AnnualBudgetUpsertEntry {
  year: number;
  category_id: string;
  amount: number;
}

export interface MonthlyBudgetAnnualContext {
  annualBudget: number;
  monthlyAllocated: number;
  remaining: number;
  allocationPercentage: number;
  allocatedMonths: number;
}

// ─── Annual Budget Functions ────────────────────────────────────────────────

/**
 * Fetch all annual budgets for a year, joined with category info.
 * Computes monthly allocation totals, remaining, and YTD actuals.
 */
export async function getAnnualBudgets(
  client: SupabaseClient,
  year: number
): Promise<{ data: AnnualBudgetWithCategory[]; error: Error | null }> {
  const { data: annuals, error: annualErr } = await client
    .from('church_fin_annual_budgets')
    .select('*')
    .eq('year', year);

  if (annualErr) return { data: [], error: annualErr };
  if (!annuals || annuals.length === 0) return { data: [], error: null };

  // Fetch categories
  const { data: categories, error: catErr } = await client
    .from('church_fin_categories')
    .select('id, name, type, sort_order');

  if (catErr) return { data: [], error: catErr };

  const categoryMap = new Map<string, { name: string; type: CategoryType; sort_order: number }>();
  for (const cat of categories ?? []) {
    categoryMap.set(cat.id, {
      name: cat.name,
      type: cat.type as CategoryType,
      sort_order: cat.sort_order ?? 0,
    });
  }

  // Fetch all monthly budgets for this year
  const { data: monthlyBudgets, error: monthErr } = await client
    .from('church_fin_budgets')
    .select('category_id, amount, month')
    .eq('year', year);

  if (monthErr) return { data: [], error: monthErr };

  // Sum monthly allocations per category + count distinct months
  const monthlyMap = new Map<string, { total: number; months: Set<number> }>();
  for (const mb of monthlyBudgets ?? []) {
    const catId = mb.category_id as string;
    const existing = monthlyMap.get(catId) ?? { total: 0, months: new Set<number>() };
    existing.total += mb.amount as number;
    existing.months.add(mb.month as number);
    monthlyMap.set(catId, existing);
  }

  // Fetch yearly actuals
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const { data: transactions, error: txErr } = await client
    .from('church_fin_transactions')
    .select('category_id, amount')
    .gte('date', yearStart)
    .lte('date', yearEnd);

  if (txErr) return { data: [], error: txErr };

  const actualMap = new Map<string, number>();
  for (const tx of transactions ?? []) {
    const catId = tx.category_id as string | null;
    if (!catId) continue;
    actualMap.set(catId, (actualMap.get(catId) ?? 0) + (tx.amount as number));
  }

  // Build result
  const result: AnnualBudgetWithCategory[] = annuals.map((ab) => {
    const cat = categoryMap.get(ab.category_id);
    const monthly = monthlyMap.get(ab.category_id) ?? { total: 0, months: new Set() };
    const amount = ab.amount as number;
    const monthlyAllocated = monthly.total;
    const remaining = amount - monthlyAllocated;
    const allocationPercentage = amount > 0
      ? Math.round((monthlyAllocated / amount) * 100)
      : (monthlyAllocated > 0 ? 100 : 0);
    const yearActual = actualMap.get(ab.category_id) ?? 0;

    return {
      id: ab.id as string,
      year: ab.year as number,
      category_id: ab.category_id as string,
      amount,
      created_at: ab.created_at as string,
      updated_at: ab.updated_at as string,
      category_name: cat?.name ?? 'Desconocida',
      category_type: cat?.type ?? 'expense',
      category_sort_order: cat?.sort_order ?? 0,
      monthlyAllocated,
      remaining,
      allocationPercentage,
      yearActual,
      allocatedMonths: monthly.months.size,
    };
  });

  result.sort((a, b) => {
    if (a.category_type !== b.category_type) return a.category_type === 'income' ? -1 : 1;
    return a.category_sort_order - b.category_sort_order;
  });

  return { data: result, error: null };
}

/**
 * Bulk upsert annual budget entries. Leverages UNIQUE(year, category_id).
 */
export async function upsertAnnualBudgets(
  client: SupabaseClient,
  entries: AnnualBudgetUpsertEntry[]
): Promise<{ error: Error | null }> {
  if (entries.length === 0) return { error: null };

  const { error } = await client
    .from('church_fin_annual_budgets')
    .upsert(entries, { onConflict: 'year,category_id' });

  return { error: error ?? null };
}

/**
 * Get annual budget context for the monthly view.
 * Returns a Map of category_id → annual context info.
 */
export async function getAnnualContextForMonth(
  client: SupabaseClient,
  year: number
): Promise<{ data: Map<string, MonthlyBudgetAnnualContext>; error: Error | null }> {
  // Fetch annual budgets for the year
  const { data: annuals, error: annualErr } = await client
    .from('church_fin_annual_budgets')
    .select('category_id, amount')
    .eq('year', year);

  if (annualErr) return { data: new Map(), error: annualErr };
  if (!annuals || annuals.length === 0) return { data: new Map(), error: null };

  // Fetch all monthly budgets for this year
  const { data: monthlyBudgets, error: monthErr } = await client
    .from('church_fin_budgets')
    .select('category_id, amount, month')
    .eq('year', year);

  if (monthErr) return { data: new Map(), error: monthErr };

  // Build monthly allocation map
  const monthlyMap = new Map<string, { total: number; months: Set<number> }>();
  for (const mb of monthlyBudgets ?? []) {
    const catId = mb.category_id as string;
    const existing = monthlyMap.get(catId) ?? { total: 0, months: new Set<number>() };
    existing.total += mb.amount as number;
    existing.months.add(mb.month as number);
    monthlyMap.set(catId, existing);
  }

  const contextMap = new Map<string, MonthlyBudgetAnnualContext>();
  for (const ab of annuals) {
    const catId = ab.category_id as string;
    const annualAmount = ab.amount as number;
    const monthly = monthlyMap.get(catId) ?? { total: 0, months: new Set() };

    contextMap.set(catId, {
      annualBudget: annualAmount,
      monthlyAllocated: monthly.total,
      remaining: annualAmount - monthly.total,
      allocationPercentage: annualAmount > 0
        ? Math.round((monthly.total / annualAmount) * 100)
        : (monthly.total > 0 ? 100 : 0),
      allocatedMonths: monthly.months.size,
    });
  }

  return { data: contextMap, error: null };
}
