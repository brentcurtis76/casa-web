/**
 * ReconciliationView — Import review & categorization for bank transactions.
 *
 * Simplified table: Fecha | Descripción (full width) | Monto | Categoría | Acciones.
 * Rows with suggested matches show a sub-row with the match details.
 * Bulk create toolbar lets you create all unmatched rows at once.
 */

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, X, Plus, Undo2, Loader2, ListPlus } from 'lucide-react';
import { formatCLP } from '@/types/financial';
import type { BankTransaction, FinancialTransaction, FinancialCategory } from '@/types/financial';
import type { MatchResult } from '@/lib/financial/transactionMatcher';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ReconciliationViewProps {
  bankTransactions: BankTransaction[];
  existingTransactions: FinancialTransaction[];
  matchResults: MatchResult[];
  categories: FinancialCategory[];
  onConfirmMatch: (bankTxId: string) => void;
  onUndoMatch: (bankTxId: string) => void;
  onIgnore: (bankTxId: string) => void;
  onCreateTransaction: (bankTxId: string, categoryId: string | null) => void;
  onBulkCreate: (bankTxIds: string[], categoryId: string | null) => void;
  onBulkConfirm: () => void;
  isPending: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const ReconciliationView = ({
  bankTransactions,
  existingTransactions,
  matchResults,
  categories,
  onConfirmMatch,
  onUndoMatch,
  onIgnore,
  onCreateTransaction,
  onBulkCreate,
  onBulkConfirm,
  isPending,
}: ReconciliationViewProps) => {
  // Per-row category selection for unmatched transactions
  const [rowCategories, setRowCategories] = useState<Record<string, string | null>>({});
  // Global default category for bulk create
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null);

  // Build a map from id to existing transaction
  const txMap = useMemo(() => {
    const map = new Map<string, FinancialTransaction>();
    for (const tx of existingTransactions) {
      map.set(tx.id, tx);
    }
    return map;
  }, [existingTransactions]);

  // Split categories by type for the selectors
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === 'income' && c.is_active),
    [categories]
  );
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' && c.is_active),
    [categories]
  );

  const getCategoriesForAmount = useCallback(
    (amount: number) => (amount >= 0 ? incomeCategories : expenseCategories),
    [incomeCategories, expenseCategories]
  );

  const parentCategoriesFor = useCallback(
    (cats: FinancialCategory[]) => cats.filter((c) => !c.parent_id),
    []
  );

  // Summary counts
  const summary = useMemo(() => {
    let autoMatched = 0;
    let suggested = 0;
    let unmatched = 0;
    let created = 0;
    let ignored = 0;

    for (const bt of bankTransactions) {
      if (bt.status === 'matched') {
        autoMatched++;
      } else if (bt.status === 'created') {
        created++;
      } else if (bt.status === 'ignored') {
        ignored++;
      } else if (bt.match_confidence !== null && bt.match_confidence >= 0.9) {
        autoMatched++;
      } else if (bt.match_confidence !== null && bt.match_confidence >= 0.6) {
        suggested++;
      } else {
        unmatched++;
      }
    }

    return { autoMatched, suggested, unmatched, created, ignored, total: bankTransactions.length };
  }, [bankTransactions]);

  // Get row color class
  const getRowColorClass = useCallback((bt: BankTransaction): string => {
    if (bt.status === 'matched' || bt.status === 'created') return 'bg-green-50';
    if (bt.status === 'ignored') return 'bg-gray-50 opacity-60';
    if (bt.match_confidence !== null && bt.match_confidence >= 0.9) return 'bg-green-50';
    if (bt.match_confidence !== null && bt.match_confidence >= 0.6) return 'bg-amber-50';
    return '';
  }, []);

  // Get matched transaction details
  const getMatchedTx = useCallback((bt: BankTransaction): FinancialTransaction | undefined => {
    if (!bt.matched_transaction_id) return undefined;
    return txMap.get(bt.matched_transaction_id);
  }, [txMap]);

  // Does this row have a suggested or confirmed match?
  const hasMatch = useCallback(
    (bt: BankTransaction) => bt.match_confidence !== null && bt.match_confidence >= 0.6,
    []
  );

  // Unmatched row IDs for bulk create
  const unmatchedIds = useMemo(
    () =>
      bankTransactions
        .filter(
          (bt) =>
            bt.status !== 'matched' &&
            bt.status !== 'created' &&
            bt.status !== 'ignored' &&
            !hasMatch(bt)
        )
        .map((bt) => bt.id),
    [bankTransactions, hasMatch]
  );

  const handleBulkCreateClick = useCallback(() => {
    if (unmatchedIds.length === 0) return;
    onBulkCreate(unmatchedIds, bulkCategoryId);
  }, [unmatchedIds, bulkCategoryId, onBulkCreate]);

  // Render category select for a category list
  const renderCategoryOptions = useCallback(
    (cats: FinancialCategory[]) => {
      const parents = parentCategoriesFor(cats);
      return parents.map((parent) => {
        const children = cats.filter((c) => c.parent_id === parent.id);
        if (children.length === 0) {
          return (
            <SelectItem key={parent.id} value={parent.id}>
              {parent.name}
            </SelectItem>
          );
        }
        return (
          <SelectGroup key={parent.id}>
            <SelectLabel>{parent.name}</SelectLabel>
            <SelectItem value={parent.id}>{parent.name} (general)</SelectItem>
            {children.map((child) => (
              <SelectItem key={child.id} value={child.id}>
                &nbsp;&nbsp;{child.name}
              </SelectItem>
            ))}
          </SelectGroup>
        );
      });
    },
    [parentCategoriesFor]
  );

  // Inline category selector for a given bank transaction
  const renderCategorySelect = useCallback(
    (bt: BankTransaction) => {
      const isHandled = bt.status === 'matched' || bt.status === 'created' || bt.status === 'ignored';
      if (isHandled || hasMatch(bt)) return null;

      const cats = getCategoriesForAmount(bt.amount);
      const selected = rowCategories[bt.id] ?? '__none__';

      return (
        <Select
          value={selected}
          onValueChange={(val) =>
            setRowCategories((prev) => ({ ...prev, [bt.id]: val === '__none__' ? null : val }))
          }
        >
          <SelectTrigger className="h-7 text-xs w-[160px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin categoría</SelectItem>
            {renderCategoryOptions(cats)}
          </SelectContent>
        </Select>
      );
    },
    [getCategoriesForAmount, hasMatch, rowCategories, renderCategoryOptions]
  );

  // Actions for each row
  const renderActions = useCallback((bt: BankTransaction) => {
    if (bt.status === 'matched' || bt.status === 'created') {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUndoMatch(bt.id)}
          disabled={isPending}
        >
          <Undo2 className="h-3 w-3 mr-1" />
          Deshacer
        </Button>
      );
    }

    if (bt.status === 'ignored') {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onUndoMatch(bt.id)}
          disabled={isPending}
        >
          <Undo2 className="h-3 w-3 mr-1" />
          Restaurar
        </Button>
      );
    }

    const matched = hasMatch(bt);

    return (
      <div className="flex gap-1">
        {matched && (
          <Button
            variant="outline"
            size="sm"
            className="text-green-600"
            onClick={() => onConfirmMatch(bt.id)}
            disabled={isPending}
          >
            <Check className="h-3 w-3 mr-1" />
            Confirmar
          </Button>
        )}
        {!matched && (
          <Button
            variant="outline"
            size="sm"
            className="text-blue-600"
            onClick={() => onCreateTransaction(bt.id, rowCategories[bt.id] ?? null)}
            disabled={isPending}
          >
            <Plus className="h-3 w-3 mr-1" />
            Crear
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onIgnore(bt.id)}
          disabled={isPending}
        >
          <X className="h-3 w-3 mr-1" />
          Ignorar
        </Button>
      </div>
    );
  }, [onConfirmMatch, onUndoMatch, onIgnore, onCreateTransaction, isPending, rowCategories, hasMatch]);

  // Category select for the bulk toolbar
  const allCategories = useMemo(
    () => categories.filter((c) => c.is_active),
    [categories]
  );

  // Progress bar segments
  const handled = summary.created + summary.ignored + summary.autoMatched;
  const progressPct = summary.total > 0 ? Math.round((handled / summary.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium">{summary.total} transacciones</span>
          {summary.created > 0 && (
            <Badge className="bg-blue-100 text-blue-800">{summary.created} creadas</Badge>
          )}
          {summary.autoMatched > 0 && (
            <Badge className="bg-green-100 text-green-800">{summary.autoMatched} coincidencias</Badge>
          )}
          {summary.suggested > 0 && (
            <Badge className="bg-amber-100 text-amber-800">{summary.suggested} sugeridas</Badge>
          )}
          {summary.ignored > 0 && (
            <Badge variant="secondary">{summary.ignored} ignoradas</Badge>
          )}
          {summary.unmatched > 0 && (
            <span className="text-muted-foreground">{summary.unmatched} pendientes</span>
          )}
        </div>

        {(summary.autoMatched > 0 || summary.suggested > 0) && (
          <Button
            size="sm"
            variant="outline"
            onClick={onBulkConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Coincidencias
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {handled > 0 && (
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Bulk Create Toolbar — only visible when there are unmatched rows */}
      {unmatchedIds.length > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">
                {unmatchedIds.length} transacciones pendientes
              </span>
              <Select
                value={bulkCategoryId ?? '__none__'}
                onValueChange={(val) => setBulkCategoryId(val === '__none__' ? null : val)}
              >
                <SelectTrigger className="h-8 w-[200px] text-sm">
                  <SelectValue placeholder="Categoría por defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin categoría</SelectItem>
                  {renderCategoryOptions(allCategories)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleBulkCreateClick}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ListPlus className="h-4 w-4 mr-1" />
                )}
                Crear Todas ({unmatchedIds.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right w-[110px]">Monto</TableHead>
                  <TableHead className="w-[170px]">Categoría</TableHead>
                  <TableHead className="text-right w-[160px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankTransactions.map((bt) => {
                  const matchedTx = getMatchedTx(bt);
                  const isCreated = bt.status === 'created';
                  const isIgnored = bt.status === 'ignored';
                  const isMatched = bt.status === 'matched';
                  const isSuggested = !isCreated && !isIgnored && !isMatched && hasMatch(bt);

                  return (
                    <TableRow key={bt.id} className={getRowColorClass(bt)}>
                      <TableCell className="whitespace-nowrap text-sm align-top pt-3">{bt.date}</TableCell>
                      <TableCell className="text-sm align-top pt-3">
                        <div>{bt.description}</div>
                        {bt.reference && (
                          <div className="text-xs text-muted-foreground mt-0.5">Ref: {bt.reference}</div>
                        )}
                        {/* Match sub-line for suggested/confirmed matches */}
                        {isSuggested && matchedTx && (
                          <div className="mt-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs">
                            <span className="text-amber-700 font-medium">
                              Coincidencia ({Math.round(bt.match_confidence! * 100)}%):
                            </span>{' '}
                            {matchedTx.description} — {formatCLP(matchedTx.amount)}
                          </div>
                        )}
                        {isMatched && matchedTx && (
                          <div className="mt-1 px-2 py-1 bg-green-50 border border-green-200 rounded text-xs">
                            <span className="text-green-700 font-medium">Confirmado:</span>{' '}
                            {matchedTx.description}
                          </div>
                        )}
                        {isCreated && (
                          <div className="mt-1 text-xs text-blue-600">Transacción creada</div>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm whitespace-nowrap align-top pt-3 ${bt.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {bt.amount < 0 ? '-' : ''}{formatCLP(Math.abs(bt.amount))}
                      </TableCell>
                      <TableCell className="align-top pt-2">{renderCategorySelect(bt)}</TableCell>
                      <TableCell className="text-right align-top pt-2">{renderActions(bt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReconciliationView;
