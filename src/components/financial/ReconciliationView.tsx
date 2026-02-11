/**
 * ReconciliationView — Two-column reconciliation layout for bank import.
 *
 * Displays imported bank transactions vs existing transactions,
 * with color-coded match confidence and action buttons.
 */

import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Check, X, Plus, Undo2, Loader2 } from 'lucide-react';
import { formatCLP } from '@/types/financial';
import type { BankTransaction, FinancialTransaction } from '@/types/financial';
import type { MatchResult } from '@/lib/financial/transactionMatcher';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ReconciliationViewProps {
  bankTransactions: BankTransaction[];
  existingTransactions: FinancialTransaction[];
  matchResults: MatchResult[];
  onConfirmMatch: (bankTxId: string) => void;
  onUndoMatch: (bankTxId: string) => void;
  onIgnore: (bankTxId: string) => void;
  onCreateTransaction: (bankTxId: string) => void;
  onBulkConfirm: () => void;
  isPending: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

const ReconciliationView = ({
  bankTransactions,
  existingTransactions,
  matchResults,
  onConfirmMatch,
  onUndoMatch,
  onIgnore,
  onCreateTransaction,
  onBulkConfirm,
  isPending,
}: ReconciliationViewProps) => {
  // Build a map from index to bank transaction
  const txMap = useMemo(() => {
    const map = new Map<string, FinancialTransaction>();
    for (const tx of existingTransactions) {
      map.set(tx.id, tx);
    }
    return map;
  }, [existingTransactions]);

  // Build match result map keyed by bank transaction index
  const matchMap = useMemo(() => {
    const map = new Map<number, MatchResult>();
    for (const result of matchResults) {
      map.set(result.bankTransactionIndex, result);
    }
    return map;
  }, [matchResults]);

  // Summary counts
  const summary = useMemo(() => {
    let autoMatched = 0;
    let suggested = 0;
    let unmatched = 0;

    for (const bt of bankTransactions) {
      if (bt.status === 'matched') {
        autoMatched++;
      } else if (bt.status === 'ignored') {
        // count as handled
      } else if (bt.status === 'created') {
        // count as handled
      } else if (bt.match_confidence !== null && bt.match_confidence >= 0.9) {
        autoMatched++;
      } else if (bt.match_confidence !== null && bt.match_confidence >= 0.6) {
        suggested++;
      } else {
        unmatched++;
      }
    }

    return { autoMatched, suggested, unmatched };
  }, [bankTransactions]);

  // Get row color class
  const getRowColorClass = useCallback((bt: BankTransaction): string => {
    if (bt.status === 'matched' || bt.status === 'created') return 'bg-green-50';
    if (bt.status === 'ignored') return 'bg-gray-50 opacity-60';
    if (bt.match_confidence !== null && bt.match_confidence >= 0.9) return 'bg-green-50';
    if (bt.match_confidence !== null && bt.match_confidence >= 0.6) return 'bg-amber-50';
    return 'bg-gray-50';
  }, []);

  // Get confidence badge
  const getConfidenceBadge = useCallback((bt: BankTransaction) => {
    if (bt.status === 'matched') {
      return <Badge className="bg-green-100 text-green-800">Confirmado</Badge>;
    }
    if (bt.status === 'created') {
      return <Badge className="bg-blue-100 text-blue-800">Creado</Badge>;
    }
    if (bt.status === 'ignored') {
      return <Badge variant="secondary">Ignorado</Badge>;
    }
    if (bt.match_confidence === null || bt.match_confidence < 0.6) {
      return <Badge variant="outline">Sin coincidencia</Badge>;
    }
    if (bt.match_confidence >= 0.9) {
      return <Badge className="bg-green-100 text-green-800">Auto ({Math.round(bt.match_confidence * 100)}%)</Badge>;
    }
    return <Badge className="bg-amber-100 text-amber-800">Sugerido ({Math.round(bt.match_confidence * 100)}%)</Badge>;
  }, []);

  // Get matched transaction details
  const getMatchedTx = useCallback((bt: BankTransaction): FinancialTransaction | undefined => {
    if (!bt.matched_transaction_id) return undefined;
    return txMap.get(bt.matched_transaction_id);
  }, [txMap]);

  // Actions for each row
  const renderActions = useCallback((bt: BankTransaction) => {
    const isHandled = bt.status === 'matched' || bt.status === 'created' || bt.status === 'ignored';

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

    // Unhandled rows
    const hasMatch = bt.match_confidence !== null && bt.match_confidence >= 0.6;

    return (
      <div className="flex gap-1">
        {hasMatch && (
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
        {!hasMatch && (
          <Button
            variant="outline"
            size="sm"
            className="text-blue-600"
            onClick={() => onCreateTransaction(bt.id)}
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
  }, [onConfirmMatch, onUndoMatch, onIgnore, onCreateTransaction, isPending]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <span className="text-green-600 font-medium">{summary.autoMatched} coincidencias automáticas</span>
          {', '}
          <span className="text-amber-600 font-medium">{summary.suggested} sugeridas</span>
          {', '}
          <span className="text-gray-600 font-medium">{summary.unmatched} sin coincidencia</span>
        </div>

        <Button
          size="sm"
          onClick={onBulkConfirm}
          disabled={isPending || (summary.autoMatched === 0 && summary.suggested === 0)}
        >
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Confirmar Todas las Coincidencias
        </Button>
      </div>

      {/* Reconciliation Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead colSpan={4} className="text-center bg-blue-50 text-blue-700 border-r">
                    Transacciones Importadas
                  </TableHead>
                  <TableHead colSpan={3} className="text-center bg-purple-50 text-purple-700">
                    Transacciones Existentes
                  </TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="border-r">Ref.</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-center">Confianza</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankTransactions.map((bt) => {
                  const matchedTx = getMatchedTx(bt);
                  return (
                    <TableRow key={bt.id} className={getRowColorClass(bt)}>
                      {/* Bank transaction columns */}
                      <TableCell className="whitespace-nowrap text-sm">{bt.date}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">{bt.description}</TableCell>
                      <TableCell className={`text-right font-mono text-sm ${bt.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCLP(Math.abs(bt.amount))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground border-r">
                        {bt.reference ?? '-'}
                      </TableCell>

                      {/* Matched transaction columns */}
                      {matchedTx ? (
                        <>
                          <TableCell className="whitespace-nowrap text-sm">{matchedTx.date}</TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">{matchedTx.description}</TableCell>
                          <TableCell className={`text-right font-mono text-sm ${matchedTx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCLP(matchedTx.amount)}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-sm text-muted-foreground">-</TableCell>
                          <TableCell className="text-sm text-muted-foreground">-</TableCell>
                          <TableCell className="text-sm text-muted-foreground">-</TableCell>
                        </>
                      )}

                      {/* Confidence badge */}
                      <TableCell className="text-center">{getConfidenceBadge(bt)}</TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">{renderActions(bt)}</TableCell>
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
