/**
 * Financial Module — React Query Hooks
 *
 * NOTE: This is a deliberate architectural decision for Phase 4.
 * The financial module is the first CASA module to adopt React Query
 * (@tanstack/react-query) for data fetching. Existing modules continue
 * to use raw Supabase + useState/useEffect. See the Phase 4 spec
 * "Data Fetching Pattern Override" section for rationale.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import type { FinancialTransaction, FinancialCategory, FinancialAccount, TransactionType, BankFileType, BankTransactionStatus } from '@/types/financial';
import * as financialService from './financialService';
import * as financialQueries from './financialQueries';
import * as budgetService from './budgetService';
import * as personnelService from './personnelService';
import * as payrollService from './payrollService';
import type { TransactionFilters, TransactionUpdateFields, CategoryUpdateFields } from './financialService';
import type { BudgetUpsertEntry, AnnualBudgetUpsertEntry } from './budgetService';
import type { PersonnelFilters, PersonnelCreateData, PersonnelUpdateData } from './personnelService';
import type { ChileanTaxTables } from './chileanTaxTables';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const FINANCIAL_KEYS = {
  all: ['financial'] as const,
  transactions: (filters?: TransactionFilters) =>
    ['financial', 'transactions', filters] as const,
  categories: () => ['financial', 'categories'] as const,
  activeCategories: () => ['financial', 'categories', 'active'] as const,
  accounts: () => ['financial', 'accounts'] as const,
  // Dashboard query keys
  monthlySummary: (year: number, month: number) =>
    ['financial', 'summary', year, month] as const,
  categoryBreakdown: (year: number, month: number, type: TransactionType) =>
    ['financial', 'breakdown', year, month, type] as const,
  monthlyTrend: (months: number) =>
    ['financial', 'trend', months] as const,
  recentTransactions: (limit: number) =>
    ['financial', 'recent', limit] as const,
  remainingBudget: (year: number, month: number) =>
    ['financial', 'budget-remaining', year, month] as const,
  // Budget query keys
  budgets: (year: number, month: number) =>
    ['financial', 'budgets', year, month] as const,
  budgetVsActual: (year: number, month: number) =>
    ['financial', 'budgetVsActual', year, month] as const,
  // Annual budget query keys
  annualBudgets: (year: number) =>
    ['financial', 'annualBudgets', year] as const,
  annualContext: (year: number) =>
    ['financial', 'annualContext', year] as const,
  // Bank import query keys
  bankStatements: () => ['financial', 'bankStatements'] as const,
  bankTransactions: (statementId: string) =>
    ['financial', 'bankTransactions', statementId] as const,
  // Report query keys
  monthlySummaryReport: (year: number, month: number) =>
    ['financial', 'report', 'monthly', year, month] as const,
  categoryReport: (categoryIds: string[], startYear: number, startMonth: number, endYear: number, endMonth: number) =>
    ['financial', 'report', 'category', categoryIds, startYear, startMonth, endYear, endMonth] as const,
  budgetReport: (year: number, month: number) =>
    ['financial', 'report', 'budget', year, month] as const,
  // Personnel query keys
  personnel: (filters?: PersonnelFilters) =>
    ['financial', 'personnel', filters] as const,
  // Payroll query keys
  payroll: (year: number, month: number) =>
    ['financial', 'payroll', year, month] as const,
  payrollSummary: (year: number, month: number) =>
    ['financial', 'payrollSummary', year, month] as const,
};

// ─── Transaction Hooks ───────────────────────────────────────────────────────

export function useTransactions(filters?: TransactionFilters) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.transactions(filters),
    queryFn: () => financialService.getTransactions(supabase, filters),
    select: (result) => ({
      transactions: result.data ?? [],
      count: result.count,
    }),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (
      data: Omit<FinancialTransaction, 'id' | 'created_at' | 'updated_at' | 'reconciled' | 'source'>
    ) => financialService.createTransaction(supabase, data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Transacción creada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear la transacción',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TransactionUpdateFields>;
    }) => financialService.updateTransaction(supabase, id, data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Transacción actualizada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar la transacción',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, description }: { id: string; description?: string }) =>
      financialService.deleteTransaction(supabase, id, user?.id, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Transacción eliminada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar la transacción',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Category Hooks ──────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: FINANCIAL_KEYS.categories(),
    queryFn: () => financialService.getCategories(supabase),
    select: (result) => result.data ?? [],
  });
}

export function useActiveCategories() {
  return useQuery({
    queryKey: FINANCIAL_KEYS.activeCategories(),
    queryFn: () => financialService.getCategories(supabase, true),
    select: (result) => result.data ?? [],
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (
      data: Omit<FinancialCategory, 'id' | 'created_at'>
    ) => financialService.createCategory(supabase, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Categoría creada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear la categoría',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CategoryUpdateFields>;
    }) => financialService.updateCategory(supabase, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Categoría actualizada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar la categoría',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCategoryDependencies(categoryId: string | null) {
  return useQuery({
    queryKey: ['financial', 'categoryDeps', categoryId],
    queryFn: () => financialService.getCategoryDependencies(supabase, categoryId!),
    select: (result) => result.data,
    enabled: !!categoryId,
    staleTime: 0,
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name?: string }) =>
      financialService.deleteCategory(supabase, id, user?.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Categoría eliminada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar la categoría',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Account Hooks ───────────────────────────────────────────────────────────

export function useAccounts() {
  return useQuery({
    queryKey: FINANCIAL_KEYS.accounts(),
    queryFn: () => financialService.getAccounts(supabase),
    select: (result) => result.data ?? [],
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (
      data: Omit<FinancialAccount, 'id' | 'created_at'>
    ) => financialService.createAccount(supabase, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Cuenta creada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear la cuenta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Dashboard Hooks ─────────────────────────────────────────────────────────

export function useMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.monthlySummary(year, month),
    queryFn: () => financialQueries.getMonthlySummary(supabase, year, month),
  });
}

export function useCategoryBreakdown(year: number, month: number, type: TransactionType) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.categoryBreakdown(year, month, type),
    queryFn: () => financialQueries.getCategoryBreakdown(supabase, year, month, type),
  });
}

export function useMonthlyTrend(months: number = 6) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.monthlyTrend(months),
    queryFn: () => financialQueries.getMonthlyTrend(supabase, months),
  });
}

export function useRecentTransactions(limit: number = 10) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.recentTransactions(limit),
    queryFn: () => financialQueries.getRecentTransactions(supabase, limit),
  });
}

export function useRemainingBudget(year: number, month: number) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.remainingBudget(year, month),
    queryFn: () => financialQueries.getRemainingBudget(supabase, year, month),
  });
}

// ─── Budget Hooks ───────────────────────────────────────────────────────────

export function useBudgets(year: number, month: number) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.budgets(year, month),
    queryFn: () => budgetService.getBudgets(supabase, year, month),
    select: (result) => result.data ?? [],
  });
}

export function useUpsertBudgets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (entries: BudgetUpsertEntry[]) =>
      budgetService.upsertBudgets(supabase, entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Presupuesto actualizado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar el presupuesto',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useCopyBudgets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      budgetService.copyFromPreviousMonth(supabase, year, month),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      if (result.copied > 0) {
        toast({ title: `${result.copied} presupuestos copiados del mes anterior` });
      } else {
        toast({ title: 'No hay presupuestos para copiar del mes anterior' });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al copiar presupuestos',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBudgetVsActual(year: number, month: number) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.budgetVsActual(year, month),
    queryFn: () => budgetService.getBudgetVsActual(supabase, year, month),
    select: (result) => result.data ?? [],
  });
}

// ─── Annual Budget Hooks ────────────────────────────────────────────────────

export function useAnnualBudgets(year: number) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.annualBudgets(year),
    queryFn: () => budgetService.getAnnualBudgets(supabase, year),
    select: (result) => result.data ?? [],
  });
}

export function useUpsertAnnualBudgets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (entries: AnnualBudgetUpsertEntry[]) =>
      budgetService.upsertAnnualBudgets(supabase, entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Presupuestos anuales guardados' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al guardar presupuestos anuales',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useAnnualContext(year: number) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.annualContext(year),
    queryFn: () => budgetService.getAnnualContextForMonth(supabase, year),
    select: (result) => result.data,
  });
}

// ─── Bank Import Hooks ──────────────────────────────────────────────────────

export function useImportBankStatement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      bankName,
      statementDate,
      fileUrl,
      fileType,
    }: {
      bankName: string;
      statementDate: string;
      fileUrl: string;
      fileType: BankFileType;
    }) =>
      financialService.importBankStatement(
        supabase, bankName, statementDate, fileUrl, fileType, user?.id
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Estado de cuenta importado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al importar estado de cuenta',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useImportBankTransactions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      statementId,
      rows,
    }: {
      statementId: string;
      rows: Array<{
        date: string;
        description: string;
        amount: number;
        reference?: string;
      }>;
    }) => financialService.importBankTransactions(supabase, statementId, rows, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
    },
  });
}

export function useBankTransactions(statementId: string) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.bankTransactions(statementId),
    queryFn: () => financialService.getBankTransactions(supabase, statementId),
    select: (result) => result.data ?? [],
    enabled: !!statementId,
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({
      id,
      matchedTransactionId,
      confidence,
      status,
    }: {
      id: string;
      matchedTransactionId: string | null;
      confidence: number | null;
      status: BankTransactionStatus;
    }) =>
      financialService.updateBankTransactionMatch(
        supabase, id, matchedTransactionId, confidence, status
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar coincidencia',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useBulkConfirmMatches() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (ids: string[]) =>
      financialService.bulkConfirmMatches(supabase, ids, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Coincidencias confirmadas correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al confirmar coincidencias',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Report Hooks ──────────────────────────────────────────────────────────

export function useMonthlySummaryReport(year: number, month: number, enabled: boolean = false) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.monthlySummaryReport(year, month),
    queryFn: () => financialQueries.getMonthlySummaryReport(supabase, year, month),
    enabled,
  });
}

export function useCategoryReport(
  categoryIds: string[],
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
  enabled: boolean = false
) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.categoryReport(categoryIds, startYear, startMonth, endYear, endMonth),
    queryFn: () => financialQueries.getCategoryReport(supabase, categoryIds, startYear, startMonth, endYear, endMonth),
    enabled: enabled && categoryIds.length > 0,
  });
}

export function useBudgetReport(year: number, month: number, enabled: boolean = false) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.budgetReport(year, month),
    queryFn: () => financialQueries.getBudgetReport(supabase, year, month),
    enabled,
  });
}

// ─── Personnel Hooks ──────────────────────────────────────────────────────

export function usePersonnel(filters?: PersonnelFilters) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.personnel(filters),
    queryFn: () => personnelService.getPersonnel(supabase, filters),
    select: (result) => result.data ?? [],
  });
}

export function useCreatePersonnel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: PersonnelCreateData) =>
      personnelService.createPersonnel(supabase, data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.personnel() });
      toast({ title: 'Personal creado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al crear personal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdatePersonnel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PersonnelUpdateData }) =>
      personnelService.updatePersonnel(supabase, id, data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.personnel() });
      toast({ title: 'Personal actualizado correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al actualizar personal',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useTogglePersonnelActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      personnelService.togglePersonnelActive(supabase, id, is_active, user?.id),
    onSuccess: (_, { is_active }) => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.personnel() });
      toast({ title: is_active ? 'Personal activado' : 'Personal desactivado' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al cambiar estado',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ─── Payroll Hooks ──────────────────────────────────────────────────────────

export function usePayroll(year: number, month: number) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.payroll(year, month),
    queryFn: () => payrollService.getPayrollForMonth(supabase, year, month),
    select: (result) => result.data ?? [],
  });
}

export function useCalculatePayroll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({
      year,
      month,
      taxTables,
    }: {
      year: number;
      month: number;
      taxTables: ChileanTaxTables;
    }) => payrollService.calculateAndSavePayroll(supabase, year, month, taxTables, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Nómina calculada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al calcular nómina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useProcessPayroll() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      payrollService.processPayroll(supabase, year, month, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Nómina procesada correctamente' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al procesar nómina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useMarkPayrollPaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      payrollService.markPayrollPaid(supabase, year, month, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Nómina marcada como pagada' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al marcar nómina como pagada',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeletePayrollDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ year, month }: { year: number; month: number }) =>
      payrollService.deletePayrollDraft(supabase, year, month, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FINANCIAL_KEYS.all });
      toast({ title: 'Borradores de nómina eliminados' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error al eliminar borradores',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function usePayrollSummary(year: number, month: number) {
  return useQuery({
    queryKey: FINANCIAL_KEYS.payrollSummary(year, month),
    queryFn: () => payrollService.getPayrollSummary(supabase, year, month),
    select: (result) => result.data,
  });
}
