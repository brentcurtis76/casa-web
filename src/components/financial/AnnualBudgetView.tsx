/**
 * AnnualBudgetView — Annual budget management view.
 *
 * Shows a table of all active categories with annual budget amounts,
 * monthly allocation totals, remaining, YTD actuals, and variance.
 * Grouped into Income and Expense sections with subtotals.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, Target, AlertTriangle } from 'lucide-react';
import CLPInput from './CLPInput';
import { formatCLP } from '@/types/financial';
import type { FinancialCategory } from '@/types/financial';
import {
  useActiveCategories,
  useAnnualBudgets,
  useUpsertAnnualBudgets,
} from '@/lib/financial/hooks';

// ─── Props ──────────────────────────────────────────────────────────────────

interface AnnualBudgetViewProps {
  year: number;
  canWrite: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAllocationProgressColor(percentage: number): string {
  if (percentage > 100) return 'h-2 [&>div]:bg-red-500';
  if (percentage >= 80) return 'h-2 [&>div]:bg-amber-500';
  return 'h-2 [&>div]:bg-green-500';
}

// ─── Component ──────────────────────────────────────────────────────────────

const AnnualBudgetView = ({ year, canWrite }: AnnualBudgetViewProps) => {
  const { data: categories = [], isLoading: categoriesLoading } = useActiveCategories();
  const { data: annualBudgets = [], isLoading: budgetsLoading } = useAnnualBudgets(year);
  const upsertMutation = useUpsertAnnualBudgets();

  // Local state for editable amounts
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Build existing budget map from server data
  const existingBudgetMap = useMemo(() => {
    const map = new Map<string, typeof annualBudgets[0]>();
    for (const ab of annualBudgets) {
      map.set(ab.category_id, ab);
    }
    return map;
  }, [annualBudgets]);

  // Initialize amounts from server data
  useEffect(() => {
    const initial: Record<string, number> = {};
    for (const cat of categories) {
      const existing = existingBudgetMap.get(cat.id);
      initial[cat.id] = existing?.amount ?? 0;
    }
    setAmounts(initial);
    setHasChanges(false);
  }, [categories, existingBudgetMap]);

  // Group categories by type
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  const handleAmountChange = useCallback((categoryId: string, value: number) => {
    setAmounts((prev) => ({ ...prev, [categoryId]: value }));
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    const entries = Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(([categoryId, amount]) => ({
        year,
        category_id: categoryId,
        amount,
      }));

    await upsertMutation.mutateAsync(entries);
    setHasChanges(false);
  }, [amounts, year, upsertMutation]);

  // Compute section subtotals
  const computeSubtotals = useCallback(
    (cats: FinancialCategory[]) => {
      let totalAnnual = 0;
      let totalAllocated = 0;
      let totalActual = 0;
      for (const cat of cats) {
        const budget = existingBudgetMap.get(cat.id);
        totalAnnual += amounts[cat.id] ?? 0;
        totalAllocated += budget?.monthlyAllocated ?? 0;
        totalActual += budget?.yearActual ?? 0;
      }
      return {
        totalAnnual,
        totalAllocated,
        remaining: totalAnnual - totalAllocated,
        totalActual,
      };
    },
    [amounts, existingBudgetMap]
  );

  const incomeSubtotals = useMemo(() => computeSubtotals(incomeCategories), [computeSubtotals, incomeCategories]);
  const expenseSubtotals = useMemo(() => computeSubtotals(expenseCategories), [computeSubtotals, expenseCategories]);

  const isLoading = categoriesLoading || budgetsLoading;

  const renderCategoryRow = (category: FinancialCategory) => {
    const budget = existingBudgetMap.get(category.id);
    const annualAmount = amounts[category.id] ?? 0;
    const monthlyAllocated = budget?.monthlyAllocated ?? 0;
    const remaining = annualAmount - monthlyAllocated;
    const allocationPct = annualAmount > 0
      ? Math.round((monthlyAllocated / annualAmount) * 100)
      : (monthlyAllocated > 0 ? 100 : 0);
    const yearActual = budget?.yearActual ?? 0;
    const yearVariance = annualAmount - yearActual;
    const overAllocated = monthlyAllocated > annualAmount && annualAmount > 0;

    return (
      <TableRow key={category.id}>
        <TableCell className="font-medium">{category.name}</TableCell>
        <TableCell className="w-[160px]">
          {canWrite ? (
            <CLPInput
              value={annualAmount}
              onChange={(value) => handleAmountChange(category.id, value)}
              className="h-8 text-sm"
            />
          ) : (
            <span className="font-mono">{formatCLP(annualAmount)}</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-right">
          <div className="flex items-center justify-end gap-2">
            <span>{formatCLP(monthlyAllocated)}</span>
            {overAllocated && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Excede
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className={`font-mono text-right ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCLP(Math.abs(remaining))}
          {remaining < 0 ? ' (-)' : ''}
        </TableCell>
        <TableCell className="w-[120px]">
          {annualAmount > 0 ? (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Progress
                  value={Math.min(allocationPct, 100)}
                  className={getAllocationProgressColor(allocationPct)}
                />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {allocationPct}%
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-right">{formatCLP(yearActual)}</TableCell>
        <TableCell className={`font-mono text-right ${yearVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCLP(Math.abs(yearVariance))}
          {yearVariance < 0 ? ' (-)' : ''}
        </TableCell>
      </TableRow>
    );
  };

  const renderSubtotalRow = (
    label: string,
    totals: { totalAnnual: number; totalAllocated: number; remaining: number; totalActual: number }
  ) => (
    <TableRow className="bg-muted/50 font-semibold">
      <TableCell>{label}</TableCell>
      <TableCell className="font-mono">{formatCLP(totals.totalAnnual)}</TableCell>
      <TableCell className="font-mono text-right">{formatCLP(totals.totalAllocated)}</TableCell>
      <TableCell className={`font-mono text-right ${totals.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatCLP(Math.abs(totals.remaining))}
        {totals.remaining < 0 ? ' (-)' : ''}
      </TableCell>
      <TableCell />
      <TableCell className="font-mono text-right">{formatCLP(totals.totalActual)}</TableCell>
      <TableCell className={`font-mono text-right ${(totals.totalAnnual - totals.totalActual) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatCLP(Math.abs(totals.totalAnnual - totals.totalActual))}
        {(totals.totalAnnual - totals.totalActual) < 0 ? ' (-)' : ''}
      </TableCell>
    </TableRow>
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-medium">Sin categorías activas</p>
          <p className="text-sm mt-1">Crea categorías primero para establecer el presupuesto anual.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Presupuesto Anual - {year}
          </CardTitle>
          {canWrite && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || upsertMutation.isPending}
            >
              {upsertMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Guardar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="w-[160px]">Presupuesto Anual</TableHead>
                <TableHead className="text-right">Asignado (Meses)</TableHead>
                <TableHead className="text-right">Restante</TableHead>
                <TableHead className="w-[120px]">% Asignado</TableHead>
                <TableHead className="text-right">Ejecutado (Año)</TableHead>
                <TableHead className="text-right">Variación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Income Section */}
              {incomeCategories.length > 0 && (
                <>
                  <TableRow className="bg-green-50/50">
                    <TableCell colSpan={7} className="font-semibold text-green-700">
                      Ingresos
                    </TableCell>
                  </TableRow>
                  {incomeCategories.map(renderCategoryRow)}
                  {renderSubtotalRow('Subtotal Ingresos', incomeSubtotals)}
                </>
              )}

              {/* Expense Section */}
              {expenseCategories.length > 0 && (
                <>
                  <TableRow className="bg-red-50/50">
                    <TableCell colSpan={7} className="font-semibold text-red-700">
                      Gastos
                    </TableCell>
                  </TableRow>
                  {expenseCategories.map(renderCategoryRow)}
                  {renderSubtotalRow('Subtotal Gastos', expenseSubtotals)}
                </>
              )}

              {/* Grand Total */}
              <TableRow className="bg-muted font-bold border-t-2">
                <TableCell>Total General</TableCell>
                <TableCell className="font-mono">
                  {formatCLP(incomeSubtotals.totalAnnual + expenseSubtotals.totalAnnual)}
                </TableCell>
                <TableCell className="font-mono text-right">
                  {formatCLP(incomeSubtotals.totalAllocated + expenseSubtotals.totalAllocated)}
                </TableCell>
                <TableCell className={`font-mono text-right ${
                  (incomeSubtotals.remaining + expenseSubtotals.remaining) >= 0
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCLP(Math.abs(incomeSubtotals.remaining + expenseSubtotals.remaining))}
                  {(incomeSubtotals.remaining + expenseSubtotals.remaining) < 0 ? ' (-)' : ''}
                </TableCell>
                <TableCell />
                <TableCell className="font-mono text-right">
                  {formatCLP(incomeSubtotals.totalActual + expenseSubtotals.totalActual)}
                </TableCell>
                <TableCell className={`font-mono text-right ${
                  ((incomeSubtotals.totalAnnual + expenseSubtotals.totalAnnual) -
                   (incomeSubtotals.totalActual + expenseSubtotals.totalActual)) >= 0
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCLP(Math.abs(
                    (incomeSubtotals.totalAnnual + expenseSubtotals.totalAnnual) -
                    (incomeSubtotals.totalActual + expenseSubtotals.totalActual)
                  ))}
                  {((incomeSubtotals.totalAnnual + expenseSubtotals.totalAnnual) -
                    (incomeSubtotals.totalActual + expenseSubtotals.totalActual)) < 0 ? ' (-)' : ''}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnualBudgetView;
