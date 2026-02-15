/**
 * TransactionList — Full transaction table for the Transacciones tab.
 *
 * Features: filter row (date range, type, category, reconciled, clear),
 * action buttons, sortable columns (Fecha, Monto), server-side pagination,
 * row actions (edit, delete with confirmation), empty state.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ArrowUpDown,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCLP } from '@/types/financial';
import type { FinancialTransaction } from '@/types/financial';
import type { TransactionFilters } from '@/lib/financial/financialService';
import {
  useTransactions,
  useActiveCategories,
  useDeleteTransaction,
  useUpdateTransaction,
} from '@/lib/financial/hooks';
import TransactionForm from './TransactionForm';

// ─── Props ──────────────────────────────────────────────────────────────────

interface TransactionListProps {
  canWrite: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Component ──────────────────────────────────────────────────────────────

const TransactionList = ({ canWrite }: TransactionListProps) => {
  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [reconciledFilter, setReconciledFilter] = useState<string>('all');

  // Sorting
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(0);

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense'>('income');
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<FinancialTransaction | null>(null);

  // Data
  const { data: categories = [] } = useActiveCategories();
  const deleteMutation = useDeleteTransaction();
  const updateMutation = useUpdateTransaction();

  // Build filters
  const filters: TransactionFilters = useMemo(() => {
    const f: TransactionFilters = {
      page,
      pageSize: PAGE_SIZE,
      sortBy,
      sortOrder,
    };
    if (startDate) f.startDate = startDate;
    if (endDate) f.endDate = endDate;
    if (typeFilter !== 'all') f.type = typeFilter as 'income' | 'expense' | 'transfer';
    if (categoryFilter !== 'all') f.category_id = categoryFilter;
    if (reconciledFilter !== 'all') f.reconciled = reconciledFilter === 'reconciled';
    return f;
  }, [page, sortBy, sortOrder, startDate, endDate, typeFilter, categoryFilter, reconciledFilter]);

  const { data, isLoading } = useTransactions(filters);
  const transactions = data?.transactions ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Category name lookup
  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) {
      map.set(cat.id, cat.name);
    }
    return map;
  }, [categories]);

  // Handlers
  const handleSort = useCallback(
    (column: 'date' | 'amount') => {
      if (sortBy === column) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(column);
        setSortOrder('desc');
      }
      setPage(0);
    },
    [sortBy]
  );

  const handleClearFilters = useCallback(() => {
    setStartDate('');
    setEndDate('');
    setTypeFilter('all');
    setCategoryFilter('all');
    setReconciledFilter('all');
    setPage(0);
  }, []);

  const handleNewTransaction = useCallback((type: 'income' | 'expense') => {
    setEditingTransaction(null);
    setFormType(type);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((tx: FinancialTransaction) => {
    setEditingTransaction(tx);
    setFormType(tx.type === 'income' ? 'income' : 'expense');
    setFormOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync({
      id: deleteTarget.id,
      description: deleteTarget.description,
    });
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation]);

  const handleToggleReconciled = useCallback(
    (tx: FinancialTransaction) => {
      updateMutation.mutate({
        id: tx.id,
        data: { reconciled: !tx.reconciled },
      });
    },
    [updateMutation]
  );

  const hasActiveFilters =
    startDate || endDate || typeFilter !== 'all' || categoryFilter !== 'all' || reconciledFilter !== 'all';

  // Pagination range
  const paginationItems = useMemo(() => {
    const items: Array<{ type: 'page'; value: number } | { type: 'ellipsis' }> = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) {
        items.push({ type: 'page', value: i });
      }
    } else {
      items.push({ type: 'page', value: 0 });
      if (page > 2) items.push({ type: 'ellipsis' });
      const start = Math.max(1, page - 1);
      const end = Math.min(totalPages - 2, page + 1);
      for (let i = start; i <= end; i++) {
        items.push({ type: 'page', value: i });
      }
      if (page < totalPages - 3) items.push({ type: 'ellipsis' });
      items.push({ type: 'page', value: totalPages - 1 });
    }
    return items;
  }, [totalPages, page]);

  return (
    <div className="space-y-4">
      {/* Filter Row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="filter-start-date" className="text-xs text-muted-foreground">Desde</label>
          <Input
            id="filter-start-date"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
            className="w-[170px]"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-end-date" className="text-xs text-muted-foreground">Hasta</label>
          <Input
            id="filter-end-date"
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
            className="w-[170px]"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(0); }}>
            <SelectTrigger id="filter-type" className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Ingresos</SelectItem>
              <SelectItem value="expense">Gastos</SelectItem>
              <SelectItem value="transfer">Transferencias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-category" className="text-xs text-muted-foreground">Categoría</label>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(0); }}>
            <SelectTrigger id="filter-category" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.parent_id ? `  ${cat.name}` : cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-reconciled" className="text-xs text-muted-foreground">Conciliado</label>
          <Select value={reconciledFilter} onValueChange={(v) => { setReconciledFilter(v); setPage(0); }}>
            <SelectTrigger id="filter-reconciled" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="reconciled">Reconciliados</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpiar filtros
          </Button>
        )}

        {canWrite && (
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => handleNewTransaction('income')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo Ingreso
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleNewTransaction('expense')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nuevo Gasto
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">No hay transacciones</p>
            <p className="text-sm mt-1">
              {hasActiveFilters
                ? 'No hay transacciones para el período seleccionado'
                : 'Aún no se han registrado transacciones'}
            </p>
            {canWrite && (
              <div className="mt-6 flex gap-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => handleNewTransaction('income')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Registrar transacción
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort('date')}
                  role="button"
                  tabIndex={0}
                  aria-label="Ordenar por fecha"
                  aria-sort={sortBy === 'date' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-1">
                    Fecha
                    <ArrowUpDown className="h-3 w-3" />
                    {sortBy === 'date' && (
                      <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-right"
                  onClick={() => handleSort('amount')}
                  role="button"
                  tabIndex={0}
                  aria-label="Ordenar por monto"
                  aria-sort={sortBy === 'amount' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-1 justify-end">
                    Monto
                    <ArrowUpDown className="h-3 w-3" />
                    {sortBy === 'amount' && (
                      <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-center hidden md:table-cell">Conciliado</TableHead>
                {canWrite && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap">{tx.date}</TableCell>
                  <TableCell className="max-w-[300px] truncate" title={tx.description}>{tx.description}</TableCell>
                  <TableCell>
                    {tx.category_id && categoryNameMap.has(tx.category_id) ? (
                      <Badge variant="secondary" className="text-xs">
                        {categoryNameMap.get(tx.category_id)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <span
                      className={`font-mono font-medium ${
                        tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}{formatCLP(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center hidden md:table-cell">
                    <Checkbox
                      checked={tx.reconciled}
                      onCheckedChange={() => canWrite && handleToggleReconciled(tx)}
                      disabled={!canWrite}
                    />
                  </TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(tx)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(tx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination aria-label="Paginación de transacciones">
                <PaginationContent>
                  <PaginationItem>
                    <button
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </button>
                  </PaginationItem>
                  {paginationItems.map((item, idx) =>
                    item.type === 'ellipsis' ? (
                      <PaginationItem key={`e-${idx}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item.value}>
                        <PaginationLink
                          isActive={page === item.value}
                          onClick={() => setPage(item.value)}
                          style={{ cursor: 'pointer' }}
                          aria-label={`Página ${item.value + 1}`}
                          aria-current={page === item.value ? 'page' : undefined}
                        >
                          {item.value + 1}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  )}
                  <PaginationItem>
                    <button
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      aria-label="Página siguiente"
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}

            <div className="text-xs text-muted-foreground text-center" aria-label={`Página ${page + 1} de ${totalPages}`}>
              Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount} transacciones
            </div>
          </>
        )}
      </div>

      {/* Transaction Form Dialog */}
      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        transactionType={formType}
        editTransaction={editingTransaction}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Transacción</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente la transacción
              &quot;{deleteTarget?.description}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TransactionList;
