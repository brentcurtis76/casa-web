/**
 * Financial Module — Dashboard Aggregate Queries
 *
 * Functions that fetch and aggregate financial data for the dashboard.
 * Each function receives the Supabase client as its first parameter
 * (same pattern as financialService.ts).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialTransaction, TransactionType } from '@/types/financial';
import { MONTH_LABELS_SHORT, formatCLP } from '@/types/financial';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlySummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export interface CategoryBreakdownItem {
  category_id: string;
  category_name: string;
  total: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  year: number;
  month: number;
  label: string;
  income: number;
  expenses: number;
}

export interface RecentTransaction extends FinancialTransaction {
  category_name: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Fetch transactions for a given month, sum by type, return totals.
 */
export async function getMonthlySummary(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<MonthlySummary> {
  const { start, end } = getMonthRange(year, month);

  const { data, error } = await client
    .from('church_fin_transactions')
    .select('amount, type')
    .gte('date', start)
    .lte('date', end);

  if (error || !data) {
    return { totalIncome: 0, totalExpenses: 0, balance: 0 };
  }

  const totalIncome = data
    .filter((t: { type: string }) => t.type === 'income')
    .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

  const totalExpenses = data
    .filter((t: { type: string }) => t.type === 'expense')
    .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);

  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
  };
}

/**
 * Fetch transactions for a month filtered by type, group by category, calculate percentages.
 */
export async function getCategoryBreakdown(
  client: SupabaseClient,
  year: number,
  month: number,
  type: TransactionType
): Promise<CategoryBreakdownItem[]> {
  const { start, end } = getMonthRange(year, month);

  const { data: transactions, error: txError } = await client
    .from('church_fin_transactions')
    .select('amount, category_id')
    .gte('date', start)
    .lte('date', end)
    .eq('type', type);

  if (txError || !transactions || transactions.length === 0) {
    return [];
  }

  // Fetch all categories to get names
  const { data: categories } = await client
    .from('church_fin_categories')
    .select('id, name');

  const categoryMap = new Map<string, string>();
  if (categories) {
    for (const cat of categories) {
      categoryMap.set(cat.id, cat.name);
    }
  }

  // Group by category
  const groupedMap = new Map<string, number>();
  let total = 0;

  for (const tx of transactions) {
    const catId = tx.category_id ?? 'sin_categoria';
    const current = groupedMap.get(catId) ?? 0;
    groupedMap.set(catId, current + tx.amount);
    total += tx.amount;
  }

  const result: CategoryBreakdownItem[] = [];
  for (const [catId, catTotal] of groupedMap) {
    result.push({
      category_id: catId,
      category_name: catId === 'sin_categoria'
        ? 'Sin Categoría'
        : (categoryMap.get(catId) ?? 'Desconocida'),
      total: catTotal,
      percentage: total > 0 ? Math.round((catTotal / total) * 100) : 0,
    });
  }

  // Sort by total descending
  result.sort((a, b) => b.total - a.total);
  return result;
}

/**
 * Fetch last N months of transactions, aggregate income/expenses per month.
 */
export async function getMonthlyTrend(
  client: SupabaseClient,
  months: number = 6
): Promise<MonthlyTrendItem[]> {
  const now = new Date();
  const items: MonthlyTrendItem[] = [];

  // Build list of months (from oldest to newest)
  const monthList: Array<{ year: number; month: number }> = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthList.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }

  // Get the date range for the entire period
  const first = monthList[0];
  const last = monthList[monthList.length - 1];
  const { start } = getMonthRange(first.year, first.month);
  const { end } = getMonthRange(last.year, last.month);

  const { data, error } = await client
    .from('church_fin_transactions')
    .select('date, amount, type')
    .gte('date', start)
    .lte('date', end);

  if (error || !data) {
    // Return empty items for each month
    return monthList.map(({ year, month }) => ({
      year,
      month,
      label: MONTH_LABELS_SHORT[month - 1],
      income: 0,
      expenses: 0,
    }));
  }

  // Aggregate per month
  const aggregates = new Map<string, { income: number; expenses: number }>();
  for (const { year, month } of monthList) {
    aggregates.set(`${year}-${month}`, { income: 0, expenses: 0 });
  }

  for (const tx of data) {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const agg = aggregates.get(key);
    if (agg) {
      if (tx.type === 'income') {
        agg.income += tx.amount;
      } else if (tx.type === 'expense') {
        agg.expenses += tx.amount;
      }
    }
  }

  for (const { year, month } of monthList) {
    const key = `${year}-${month}`;
    const agg = aggregates.get(key) ?? { income: 0, expenses: 0 };
    items.push({
      year,
      month,
      label: MONTH_LABELS_SHORT[month - 1],
      income: agg.income,
      expenses: agg.expenses,
    });
  }

  return items;
}

/**
 * Fetch the last N transactions with category name.
 */
export async function getRecentTransactions(
  client: SupabaseClient,
  limit: number = 10
): Promise<RecentTransaction[]> {
  const { data, error } = await client
    .from('church_fin_transactions')
    .select('*, church_fin_categories(name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row: Record<string, unknown>) => {
    const catData = row.church_fin_categories as { name: string } | null;
    return {
      ...(row as unknown as FinancialTransaction),
      category_name: catData?.name ?? null,
    };
  });
}

/**
 * Fetch budget totals and expenses for a month, return remaining budget.
 */
export async function getRemainingBudget(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<number> {
  // Get budget total for the month
  const { data: budgets, error: budgetError } = await client
    .from('church_fin_budgets')
    .select('amount')
    .eq('year', year)
    .eq('month', month);

  if (budgetError || !budgets || budgets.length === 0) {
    return 0;
  }

  const totalBudget = budgets.reduce(
    (sum: number, b: { amount: number }) => sum + b.amount,
    0
  );

  // Get expense total for the month
  const { start, end } = getMonthRange(year, month);
  const { data: expenses, error: expError } = await client
    .from('church_fin_transactions')
    .select('amount')
    .eq('type', 'expense')
    .gte('date', start)
    .lte('date', end);

  if (expError || !expenses) {
    return totalBudget;
  }

  const totalExpenses = expenses.reduce(
    (sum: number, t: { amount: number }) => sum + t.amount,
    0
  );

  return totalBudget - totalExpenses;
}

// ─── Report Query Functions ───────────────────────────────────────────────

export interface MonthlySummaryReportData {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  incomeBreakdown: CategoryBreakdownItem[];
  expenseBreakdown: CategoryBreakdownItem[];
  previousMonth: {
    incomeBreakdown: CategoryBreakdownItem[];
    expenseBreakdown: CategoryBreakdownItem[];
  };
}

export interface CategoryReportItem {
  name: string;
  monthlyData: Array<{ month: string; amount: number; change: number }>;
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface CategoryReportData {
  categories: CategoryReportItem[];
}

export interface BudgetReportItem {
  categoryName: string;
  budgeted: number;
  actual: number;
  difference: number;
  percentage: number;
}

export interface BudgetReportData {
  totalBudget: number;
  totalActual: number;
  totalDifference: number;
  totalPercentage: number;
  items: BudgetReportItem[];
  notes: string[];
}

/**
 * Fetch all data needed for the monthly summary report.
 */
export async function getMonthlySummaryReport(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<MonthlySummaryReportData> {
  const summary = await getMonthlySummary(client, year, month);
  const incomeBreakdown = await getCategoryBreakdown(client, year, month, 'income');
  const expenseBreakdown = await getCategoryBreakdown(client, year, month, 'expense');

  // Previous month data for comparison
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevIncomeBreakdown = await getCategoryBreakdown(client, prevYear, prevMonth, 'income');
  const prevExpenseBreakdown = await getCategoryBreakdown(client, prevYear, prevMonth, 'expense');

  return {
    ...summary,
    incomeBreakdown,
    expenseBreakdown,
    previousMonth: {
      incomeBreakdown: prevIncomeBreakdown,
      expenseBreakdown: prevExpenseBreakdown,
    },
  };
}

/**
 * Fetch category-level data over a date range for selected categories.
 */
export async function getCategoryReport(
  client: SupabaseClient,
  categoryIds: string[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number
): Promise<CategoryReportData> {
  if (categoryIds.length === 0) return { categories: [] };

  // Build list of months in range
  const months: Array<{ year: number; month: number }> = [];
  let y = startYear;
  let m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  // Fetch category names
  const { data: cats } = await client
    .from('church_fin_categories')
    .select('id, name')
    .in('id', categoryIds);

  const catNameMap = new Map<string, string>();
  for (const c of cats ?? []) {
    catNameMap.set(c.id, c.name);
  }

  // Fetch all transactions in the range
  const { start } = getMonthRange(startYear, startMonth);
  const { end } = getMonthRange(endYear, endMonth);

  const { data: transactions } = await client
    .from('church_fin_transactions')
    .select('date, amount, category_id')
    .in('category_id', categoryIds)
    .gte('date', start)
    .lte('date', end);

  // Group by category + month
  const dataMap = new Map<string, Map<string, number>>();
  for (const catId of categoryIds) {
    dataMap.set(catId, new Map());
  }

  for (const tx of transactions ?? []) {
    const d = new Date(tx.date as string);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const catId = tx.category_id as string;
    const catMap = dataMap.get(catId);
    if (catMap) {
      catMap.set(key, (catMap.get(key) ?? 0) + (tx.amount as number));
    }
  }

  // Build result
  const categories: CategoryReportItem[] = categoryIds.map((catId) => {
    const catMap = dataMap.get(catId) ?? new Map();
    const monthlyData: Array<{ month: string; amount: number; change: number }> = [];
    let prevAmount = 0;
    let totalAmount = 0;

    for (const { year: my, month: mm } of months) {
      const key = `${my}-${mm}`;
      const amount = catMap.get(key) ?? 0;
      const change = prevAmount > 0
        ? Math.round(((amount - prevAmount) / prevAmount) * 100)
        : 0;

      monthlyData.push({
        month: `${MONTH_LABELS_SHORT[mm - 1]} ${my}`,
        amount,
        change: monthlyData.length === 0 ? 0 : change,
      });
      prevAmount = amount;
      totalAmount += amount;
    }

    const average = months.length > 0 ? Math.round(totalAmount / months.length) : 0;

    // Determine trend from first half vs second half
    const halfIdx = Math.floor(monthlyData.length / 2);
    const firstHalf = monthlyData.slice(0, halfIdx).reduce((s, d) => s + d.amount, 0);
    const secondHalf = monthlyData.slice(halfIdx).reduce((s, d) => s + d.amount, 0);
    const trend: 'increasing' | 'decreasing' | 'stable' =
      secondHalf > firstHalf * 1.1 ? 'increasing' :
      secondHalf < firstHalf * 0.9 ? 'decreasing' :
      'stable';

    return {
      name: catNameMap.get(catId) ?? 'Desconocida',
      monthlyData,
      average,
      trend,
    };
  });

  return { categories };
}

/**
 * Fetch budget vs actual report data with variance analysis.
 */
export async function getBudgetReport(
  client: SupabaseClient,
  year: number,
  month: number
): Promise<BudgetReportData> {
  const { start, end } = getMonthRange(year, month);

  // Fetch active categories
  const { data: categories } = await client
    .from('church_fin_categories')
    .select('id, name, type, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  // Fetch budgets for this month
  const { data: budgets } = await client
    .from('church_fin_budgets')
    .select('category_id, amount')
    .eq('year', year)
    .eq('month', month);

  // Fetch transactions for this month
  const { data: transactions } = await client
    .from('church_fin_transactions')
    .select('category_id, amount')
    .gte('date', start)
    .lte('date', end);

  const budgetMap = new Map<string, number>();
  for (const b of budgets ?? []) {
    budgetMap.set(b.category_id as string, b.amount as number);
  }

  const actualMap = new Map<string, number>();
  for (const tx of transactions ?? []) {
    const catId = tx.category_id as string | null;
    if (!catId) continue;
    actualMap.set(catId, (actualMap.get(catId) ?? 0) + (tx.amount as number));
  }

  const items: BudgetReportItem[] = [];
  let totalBudget = 0;
  let totalActual = 0;

  for (const cat of categories ?? []) {
    const budgeted = budgetMap.get(cat.id) ?? 0;
    const actual = actualMap.get(cat.id) ?? 0;
    if (budgeted === 0 && actual === 0) continue;

    const difference = budgeted - actual;
    const percentage = budgeted > 0 ? Math.round((actual / budgeted) * 100) : (actual > 0 ? 100 : 0);

    items.push({
      categoryName: cat.name,
      budgeted,
      actual,
      difference,
      percentage,
    });

    totalBudget += budgeted;
    totalActual += actual;
  }

  // Sort by variance (highest absolute difference first)
  items.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

  const totalDifference = totalBudget - totalActual;
  const totalPercentage = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  // Auto-generated notes for significant variances
  const notes: string[] = [];
  for (const item of items) {
    if (item.budgeted === 0) continue;
    const variance = Math.abs(item.percentage - 100);
    if (variance > 20) {
      if (item.percentage > 120) {
        notes.push(
          `${item.categoryName}: Excede el presupuesto en ${item.percentage - 100}% (${formatCLP(Math.abs(item.difference))} sobre lo presupuestado)`
        );
      } else if (item.percentage < 80) {
        notes.push(
          `${item.categoryName}: Sub-ejecutado en ${100 - item.percentage}% (${formatCLP(Math.abs(item.difference))} por debajo del presupuesto)`
        );
      }
    }
  }

  return { totalBudget, totalActual, totalDifference, totalPercentage, items, notes };
}
