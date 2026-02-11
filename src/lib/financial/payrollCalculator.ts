/**
 * Payroll Calculator — Pure function calculation engine
 *
 * NO React imports. NO Supabase imports.
 * All amounts are integers (CLP). Uses Math.round() for all results.
 */

import type { ChileanTaxTables } from './chileanTaxTables';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PayrollInput {
  grossSalary: number;
  afpName: string;
  healthProvider: string;
  contractType: 'indefinido' | 'plazo_fijo' | 'honorarios';
  otherDeductions?: number;
}

export interface PayrollCalculation {
  gross: number;
  afpDeduction: number;
  afpRate: number;
  afpName: string;
  healthDeduction: number;
  taxableIncome: number;
  impuestoUnico: number;
  otherDeductions: number;
  totalDeductions: number;
  net: number;
  employerAfc: number;
  employerSis: number;
  employerMutual: number;
  totalEmployerCost: number;
  taxBracketApplied: string;
  contractType: string;
}

// ─── Impuesto Unico Calculation ─────────────────────────────────────────────

/**
 * Calculate Impuesto Unico de Segunda Categoria using progressive brackets.
 * 1. Convert taxableIncome to UTM
 * 2. Apply marginal rates to each bracket
 * 3. Sum and round to integer
 */
function calculateImpuestoUnico(
  taxableIncome: number,
  tables: ChileanTaxTables
): { tax: number; bracketLabel: string } {
  const incomeInUtm = taxableIncome / tables.utmValue;

  let totalTaxUtm = 0;
  let appliedBracketLabel = tables.taxBrackets[0].label;

  for (const bracket of tables.taxBrackets) {
    if (incomeInUtm <= bracket.fromUtm) break;

    const taxableInBracket = Math.min(incomeInUtm, bracket.toUtm) - bracket.fromUtm;
    if (taxableInBracket > 0) {
      totalTaxUtm += taxableInBracket * bracket.rate;
      if (bracket.rate > 0) {
        appliedBracketLabel = bracket.label;
      }
    }
  }

  // Convert back to CLP and round
  const tax = Math.round(totalTaxUtm * tables.utmValue);

  return { tax, bracketLabel: appliedBracketLabel };
}

// ─── Main Calculator ────────────────────────────────────────────────────────

/**
 * Calculate a single employee's payroll. Pure function, no side effects.
 */
export function calculatePayroll(
  input: PayrollInput,
  tables: ChileanTaxTables
): PayrollCalculation {
  const { grossSalary, afpName, contractType, otherDeductions = 0 } = input;

  // ── Honorarios: simplified calculation ────────────────────────────────
  if (contractType === 'honorarios') {
    const retention = Math.round(grossSalary * tables.honorariosRate);
    const totalDed = retention + otherDeductions;
    return {
      gross: grossSalary,
      afpDeduction: 0,
      afpRate: 0,
      afpName: '',
      healthDeduction: 0,
      taxableIncome: grossSalary,
      impuestoUnico: retention,
      otherDeductions,
      totalDeductions: totalDed,
      net: grossSalary - totalDed,
      employerAfc: 0,
      employerSis: 0,
      employerMutual: 0,
      totalEmployerCost: grossSalary,
      taxBracketApplied: `Retención honorarios ${(tables.honorariosRate * 100).toFixed(2)}%`,
      contractType,
    };
  }

  // ── Tope imponible ────────────────────────────────────────────────────
  const topeImponible = Math.round(tables.topeImponibleUf * tables.ufValue);
  const deductionBase = Math.min(grossSalary, topeImponible);

  // ── AFP deduction ─────────────────────────────────────────────────────
  const afpEntry = tables.afpRates.find(
    (a) => a.name.toLowerCase() === afpName.toLowerCase()
  );
  const afpRate = afpEntry?.rate ?? 0;
  const afpDeduction = Math.round(deductionBase * afpRate);

  // ── Health deduction ──────────────────────────────────────────────────
  const healthDeduction = Math.round(deductionBase * tables.healthRate);

  // ── Taxable income for Impuesto Unico ─────────────────────────────────
  const taxableIncome = grossSalary - afpDeduction - healthDeduction;

  // ── Impuesto Unico ────────────────────────────────────────────────────
  const { tax: impuestoUnico, bracketLabel } = calculateImpuestoUnico(
    taxableIncome,
    tables
  );

  // ── Total deductions & net ────────────────────────────────────────────
  const totalDeductions = afpDeduction + healthDeduction + impuestoUnico + otherDeductions;
  const net = grossSalary - totalDeductions;

  // ── Employer costs ────────────────────────────────────────────────────
  const afcRate = contractType === 'indefinido'
    ? tables.employerRates.afcIndefinido
    : tables.employerRates.afcPlazoFijo;
  const employerAfc = Math.round(deductionBase * afcRate);
  const employerSis = Math.round(deductionBase * tables.employerRates.sis);
  const employerMutual = Math.round(deductionBase * tables.employerRates.mutual);
  const totalEmployerCost = grossSalary + employerAfc + employerSis + employerMutual;

  return {
    gross: grossSalary,
    afpDeduction,
    afpRate,
    afpName: afpEntry?.name ?? afpName,
    healthDeduction,
    taxableIncome,
    impuestoUnico,
    otherDeductions,
    totalDeductions,
    net,
    employerAfc,
    employerSis,
    employerMutual,
    totalEmployerCost,
    taxBracketApplied: bracketLabel,
    contractType,
  };
}
