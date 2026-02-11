/**
 * Financial Module — Zod Validation Schemas
 *
 * Defines validation rules for transaction, category, and budget forms.
 * All validation messages are in Spanish.
 */

import { z } from 'zod';

// ─── Transaction Schema ──────────────────────────────────────────────────────

export const transactionSchema = z.object({
  date: z.string().min(1, 'Fecha es requerida'),
  description: z.string().min(3, 'Descripción debe tener al menos 3 caracteres'),
  amount: z.number().int('Monto debe ser un número entero').positive('Monto debe ser positivo'),
  type: z.enum(['income', 'expense', 'transfer'], {
    errorMap: () => ({ message: 'Tipo de transacción inválido' }),
  }),
  category_id: z.string().uuid('ID de categoría inválido').optional().nullable(),
  account_id: z.string().uuid('ID de cuenta inválido').optional().nullable(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

// ─── Category Schema ─────────────────────────────────────────────────────────

export const categorySchema = z.object({
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  type: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: 'Tipo de categoría inválido' }),
  }),
  parent_id: z.string().uuid('ID de categoría padre inválido').optional().nullable(),
  icon: z.string().optional().nullable(),
  sort_order: z.number().int('Orden debe ser un número entero').optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

// ─── Budget Schema ───────────────────────────────────────────────────────────

export const budgetSchema = z.object({
  year: z
    .number()
    .int('Año debe ser un número entero')
    .min(2020, 'Año mínimo es 2020')
    .max(2100, 'Año máximo es 2100'),
  month: z
    .number()
    .int('Mes debe ser un número entero')
    .min(1, 'Mes debe estar entre 1 y 12')
    .max(12, 'Mes debe estar entre 1 y 12'),
  category_id: z.string().uuid('ID de categoría inválido'),
  amount: z
    .number()
    .int('Monto debe ser un número entero')
    .min(0, 'Monto no puede ser negativo'),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;

// ─── Budget Entry Schema (for bulk entry rows) ─────────────────────────────

export const budgetEntrySchema = z.object({
  category_id: z.string().uuid('ID de categoría inválido'),
  amount: z
    .number()
    .int('Monto debe ser un número entero')
    .min(0, 'Monto no puede ser negativo'),
});

export type BudgetEntryFormData = z.infer<typeof budgetEntrySchema>;

// ─── Budget Form Schema (bulk budget form) ──────────────────────────────────

export const budgetFormSchema = z.object({
  year: z
    .number()
    .int('Año debe ser un número entero')
    .min(2020, 'Año mínimo es 2020')
    .max(2100, 'Año máximo es 2100'),
  month: z
    .number()
    .int('Mes debe ser un número entero')
    .min(1, 'Mes debe estar entre 1 y 12')
    .max(12, 'Mes debe estar entre 1 y 12'),
  entries: z.array(budgetEntrySchema),
});

export type BudgetFormSchemaData = z.infer<typeof budgetFormSchema>;

// ─── Bank Import Schema ─────────────────────────────────────────────────────

export const bankImportSchema = z.object({
  bank_name: z.string().min(2, 'Nombre del banco debe tener al menos 2 caracteres'),
  statement_date: z.string().min(1, 'Fecha del estado de cuenta es requerida'),
});

export type BankImportFormData = z.infer<typeof bankImportSchema>;

// ─── Column Mapping Schema ──────────────────────────────────────────────────

export const columnMappingSchema = z.object({
  date: z.string().min(1, 'Columna de fecha es requerida'),
  description: z.string().min(1, 'Columna de descripción es requerida'),
  amount: z.string().nullable().optional(),
  amountDebit: z.string().nullable().optional(),
  amountCredit: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
}).refine(
  (data) => {
    // Either amount is set, or both amountDebit and amountCredit are set
    if (data.amount && data.amount.length > 0) return true;
    if (data.amountDebit && data.amountDebit.length > 0 &&
        data.amountCredit && data.amountCredit.length > 0) return true;
    return false;
  },
  { message: 'Se requiere columna de monto, o columnas de cargo y abono' }
);

export type ColumnMappingFormData = z.infer<typeof columnMappingSchema>;

// ─── Personnel Schema ──────────────────────────────────────────────────────

import { validateRut } from './rutValidator';

export const personnelSchema = z.object({
  name: z.string().min(3, 'Nombre debe tener al menos 3 caracteres'),
  rut: z.string().refine(validateRut, 'RUT inválido'),
  role_position: z.string().min(2, 'Cargo requerido'),
  contract_type: z.enum(['indefinido', 'plazo_fijo', 'honorarios'], {
    errorMap: () => ({ message: 'Tipo de contrato inválido' }),
  }),
  gross_salary: z
    .number()
    .int('Sueldo debe ser un número entero')
    .positive('Sueldo debe ser positivo'),
  afp_name: z.string().optional().nullable(),
  isapre_name: z.string().optional().nullable(),
  bank_name: z.string().max(100, 'Nombre del banco muy largo').optional().nullable(),
  bank_account_number: z.string()
    .regex(/^\d{1,20}$/, 'Número de cuenta debe contener solo dígitos (máximo 20)')
    .optional()
    .nullable(),
  start_date: z.string().optional().nullable(),
});

export type PersonnelFormData = z.infer<typeof personnelSchema>;

// ─── Payroll Schema ─────────────────────────────────────────────────────────

export const payrollOtherDeductionsSchema = z.object({
  personnel_id: z.string().uuid(),
  other_deductions: z.number().int().min(0),
  description: z.string().optional(),
});
