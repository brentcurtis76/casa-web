/**
 * BudgetManager — Main budget view for the Presupuesto tab.
 *
 * Year/month selectors, budget table with inline editing,
 * copy from previous month, subtotals, budget vs actual chart.
 */

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Plus, Target } from 'lucide-react';
import CLPInput from './CLPInput';
import BudgetForm from './BudgetForm';
import BudgetVsActualChart from './BudgetVsActualChart';
import { formatCLP, MONTH_LABELS_FULL } from '@/types/financial';
import type { FinancialCategory, CategoryType } from '@/types/financial';
import {
  useActiveCategories,
  useBudgetVsActual,
  useUpsertBudgets,
  useCopyBudgets,
} from '@/lib/financial/hooks';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BudgetManagerProps {
  canWrite: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const BudgetManager = ({ canWrite }: BudgetManagerProps) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [formOpen, setFormOpen] = useState(false);

  // Data hooks
  const { data: categories = [], isLoading: categoriesLoading } = useActiveCategories();
  const { data: budgetVsActual = [], isLoading: budgetLoading } = useBudgetVsActual(selectedYear, selectedMonth);
  const upsertMutation = useUpsertBudgets();
  const copyMutation = useCopyBudgets();

  // Build budget map for inline editing
  const budgetMap = useMemo(() => {
    const map = new Map<string, { budgeted: number; actual: number; difference: number; percentage: number }>();
    for (const item of budgetVsActual) {
      map.set(item.category_id, {
        budgeted: item.budgeted,
        actual: item.actual,
        difference: item.difference,
        percentage: item.percentage,
      });
    }
    return map;
  }, [budgetVsActual]);

  // Group categories by type
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  // Year options: current year +/- 2
  const currentYear = now.getFullYear();
  const yearOptions = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, [currentYear]);

  // Check if any budgets exist
  const hasBudgets = budgetVsActual.length > 0;

  // Handle inline budget edit
  const handleBudgetChange = useCallback(
    (categoryId: string, amount: number) => {
      upsertMutation.mutate([{
        year: selectedYear,
        month: selectedMonth,
        category_id: categoryId,
        amount,
      }]);
    },
    [selectedYear, selectedMonth, upsertMutation]
  );

  // Handle copy from previous month
  const handleCopyFromPrevious = useCallback(() => {
    copyMutation.mutate({ year: selectedYear, month: selectedMonth });
  }, [selectedYear, selectedMonth, copyMutation]);

  // Compute section subtotals
  const computeSubtotals = useCallback(
    (cats: FinancialCategory[]) => {
      let totalBudgeted = 0;
      let totalActual = 0;
      for (const cat of cats) {
        const data = budgetMap.get(cat.id);
        totalBudgeted += data?.budgeted ?? 0;
        totalActual += data?.actual ?? 0;
      }
      return { totalBudgeted, totalActual, difference: totalBudgeted - totalActual };
    },
    [budgetMap]
  );

  const incomeSubtotals = useMemo(
    () => computeSubtotals(incomeCategories),
    [computeSubtotals, incomeCategories]
  );
  const expenseSubtotals = useMemo(
    () => computeSubtotals(expenseCategories),
    [computeSubtotals, expenseCategories]
  );

  const grandTotals = useMemo(() => ({
    totalBudgeted: incomeSubtotals.totalBudgeted + expenseSubtotals.totalBudgeted,
    totalActual: incomeSubtotals.totalActual + expenseSubtotals.totalActual,
    difference: (incomeSubtotals.totalBudgeted + expenseSubtotals.totalBudgeted) -
                (incomeSubtotals.totalActual + expenseSubtotals.totalActual),
  }), [incomeSubtotals, expenseSubtotals]);

  const isLoading = categoriesLoading || budgetLoading;

  // Progress bar color based on percentage
  const getProgressColor = (percentage: number): string => {
    if (percentage > 100) return 'h-2 [&>div]:bg-red-500';
    if (percentage >= 80) return 'h-2 [&>div]:bg-amber-500';
    return 'h-2 [&>div]:bg-green-500';
  };

  // Render a category row
  const renderCategoryRow = (category: FinancialCategory) => {
    const data = budgetMap.get(category.id);
    const budgeted = data?.budgeted ?? 0;
    const actual = data?.actual ?? 0;
    const difference = budgeted - actual;
    const percentage = budgeted > 0 ? Math.round((actual / budgeted) * 100) : (actual > 0 ? 100 : 0);

    return (
      <TableRow key={category.id}>
        <TableCell className="font-medium">{category.name}</TableCell>
        <TableCell className="w-[160px]">
          {canWrite ? (
            <CLPInput
              value={budgeted}
              onChange={(value) => handleBudgetChange(category.id, value)}
              className="h-8 text-sm"
            />
          ) : (
            <span className="font-mono">{formatCLP(budgeted)}</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-right">{formatCLP(actual)}</TableCell>
        <TableCell className={`font-mono text-right ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCLP(Math.abs(difference))}
          {difference < 0 ? ' (-)' : ''}
        </TableCell>
        <TableCell className="w-[140px]">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Progress
                value={Math.min(percentage, 100)}
                className={getProgressColor(percentage)}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right">
              {percentage}%
            </span>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Render subtotal row
  const renderSubtotalRow = (label: string, totals: { totalBudgeted: number; totalActual: number; difference: number }) => (
    <TableRow className="bg-muted/50 font-semibold">
      <TableCell>{label}</TableCell>
      <TableCell className="font-mono">{formatCLP(totals.totalBudgeted)}</TableCell>
      <TableCell className="font-mono text-right">{formatCLP(totals.totalActual)}</TableCell>
      <TableCell className={`font-mono text-right ${totals.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatCLP(Math.abs(totals.difference))}
        {totals.difference < 0 ? ' (-)' : ''}
      </TableCell>
      <TableCell />
    </TableRow>
  );

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Año</label>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Mes</label>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_LABELS_FULL.map((label, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canWrite && (
          <div className="flex gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyFromPrevious}
              disabled={copyMutation.isPending}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copiar del Mes Anterior
            </Button>
            <Button
              size="sm"
              onClick={() => setFormOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              {hasBudgets ? 'Editar Presupuesto' : 'Crear Presupuesto'}
            </Button>
          </div>
        )}
      </div>

      {/* Budget Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !hasBudgets && categories.length > 0 ? (
        /* Empty State */
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Sin presupuesto para {MONTH_LABELS_FULL[selectedMonth - 1]} {selectedYear}</p>
            <p className="text-sm mt-1 mb-4">Aún no se ha definido presupuesto para este período</p>
            {canWrite && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Crear Presupuesto
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Presupuesto vs Ejecución - {MONTH_LABELS_FULL[selectedMonth - 1]} {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="w-[160px]">Presupuesto</TableHead>
                  <TableHead className="text-right">Gastado</TableHead>
                  <TableHead className="text-right">Diferencia</TableHead>
                  <TableHead className="w-[140px]">% Ejecutado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Income Section */}
                {incomeCategories.length > 0 && (
                  <>
                    <TableRow className="bg-green-50/50">
                      <TableCell colSpan={5} className="font-semibold text-green-700">
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
                      <TableCell colSpan={5} className="font-semibold text-red-700">
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
                  <TableCell className="font-mono">{formatCLP(grandTotals.totalBudgeted)}</TableCell>
                  <TableCell className="font-mono text-right">{formatCLP(grandTotals.totalActual)}</TableCell>
                  <TableCell className={`font-mono text-right ${grandTotals.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCLP(Math.abs(grandTotals.difference))}
                    {grandTotals.difference < 0 ? ' (-)' : ''}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Budget vs Actual Chart */}
      {budgetVsActual.length > 0 && (
        <BudgetVsActualChart data={budgetVsActual} />
      )}

      {/* Budget Form Dialog */}
      <BudgetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        year={selectedYear}
        month={selectedMonth}
        canWrite={canWrite}
      />
    </div>
  );
};

export default BudgetManager;
