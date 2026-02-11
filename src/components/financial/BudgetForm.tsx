/**
 * BudgetForm — Bulk budget entry dialog.
 *
 * Shows all active categories grouped by type with CLPInput for each.
 * Pre-populated with existing values if editing. Saves all at once via upsert.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Copy } from 'lucide-react';
import CLPInput from './CLPInput';
import { MONTH_LABELS_FULL } from '@/types/financial';
import type { FinancialCategory } from '@/types/financial';
import {
  useActiveCategories,
  useBudgetVsActual,
  useUpsertBudgets,
  useCopyBudgets,
} from '@/lib/financial/hooks';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BudgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  month: number;
  canWrite: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const BudgetForm = ({ open, onOpenChange, year, month, canWrite }: BudgetFormProps) => {
  const { data: categories = [] } = useActiveCategories();
  const { data: budgetVsActual = [] } = useBudgetVsActual(year, month);
  const upsertMutation = useUpsertBudgets();
  const copyMutation = useCopyBudgets();

  // Local state for amounts keyed by category ID
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  // Group categories by type
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income'),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  // Pre-populate amounts from existing budgets when dialog opens
  useEffect(() => {
    if (open) {
      const initialAmounts: Record<string, number> = {};
      for (const cat of categories) {
        initialAmounts[cat.id] = 0;
      }
      for (const item of budgetVsActual) {
        initialAmounts[item.category_id] = item.budgeted;
      }
      setAmounts(initialAmounts);
    }
  }, [open, categories, budgetVsActual]);

  const handleAmountChange = useCallback((categoryId: string, value: number) => {
    setAmounts((prev) => ({ ...prev, [categoryId]: value }));
  }, []);

  const handleCopyFromPrevious = useCallback(() => {
    copyMutation.mutate(
      { year, month },
      {
        onSuccess: () => {
          // The query cache will be invalidated, which updates budgetVsActual.
          // However, since we use local state, we need to close and reopen
          // or refetch. For simplicity, close the dialog so it re-populates on reopen.
          onOpenChange(false);
        },
      }
    );
  }, [year, month, copyMutation, onOpenChange]);

  const handleSave = useCallback(async () => {
    const entries = Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(([categoryId, amount]) => ({
        year,
        month,
        category_id: categoryId,
        amount,
      }));

    await upsertMutation.mutateAsync(entries);
    onOpenChange(false);
  }, [amounts, year, month, upsertMutation, onOpenChange]);

  const renderCategoryGroup = (title: string, cats: FinancialCategory[], colorClass: string) => (
    <div className="space-y-2">
      <h4 className={`font-semibold text-sm ${colorClass}`}>{title}</h4>
      <div className="space-y-2">
        {cats.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm">{cat.name}</span>
            <div className="w-[160px]">
              <CLPInput
                value={amounts[cat.id] ?? 0}
                onChange={(value) => handleAmountChange(cat.id, value)}
                disabled={!canWrite}
                className="h-8 text-sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Presupuesto - {MONTH_LABELS_FULL[month - 1]} {year}
          </DialogTitle>
          <DialogDescription>
            Ingresa el monto presupuestado para cada categoría. Los montos existentes se actualizarán.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Copy from previous month button */}
          {canWrite && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleCopyFromPrevious}
              disabled={copyMutation.isPending}
            >
              {copyMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 mr-1" />
              )}
              Copiar del Mes Anterior
            </Button>
          )}

          {/* Income categories */}
          {incomeCategories.length > 0 &&
            renderCategoryGroup('Ingresos', incomeCategories, 'text-green-700')
          }

          {/* Expense categories */}
          {expenseCategories.length > 0 &&
            renderCategoryGroup('Gastos', expenseCategories, 'text-red-700')
          }
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={upsertMutation.isPending}
          >
            Cancelar
          </Button>
          {canWrite && (
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Guardar Presupuesto
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BudgetForm;
