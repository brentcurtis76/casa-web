/**
 * PayrollSummary — Summary cards + pie chart for payroll month.
 *
 * Cards: Total Bruto, Total Descuentos, Total Líquido, Total Costo Empleador.
 * PieChart: cost composition breakdown.
 * Comparison with previous month if data exists.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCLP } from '@/types/financial';
import type { PayrollWithPersonnel } from '@/lib/financial/payrollService';
import type { PayrollSummary as PayrollSummaryType } from '@/lib/financial/payrollService';
import { calculatePayroll } from '@/lib/financial/payrollCalculator';
import type { ChileanTaxTables } from '@/lib/financial/chileanTaxTables';

// ─── Props ──────────────────────────────────────────────────────────────────

interface PayrollSummaryProps {
  entries: PayrollWithPersonnel[];
  taxTables: ChileanTaxTables;
  previousSummary?: PayrollSummaryType | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PIE_COLORS = ['#D4A853', '#6B7280', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];

// ─── Component ──────────────────────────────────────────────────────────────

const PayrollSummary = ({ entries, taxTables, previousSummary }: PayrollSummaryProps) => {
  // Calculate totals from entries
  const totals = useMemo(() => {
    let totalGross = 0;
    let totalAfp = 0;
    let totalHealth = 0;
    let totalTax = 0;
    let totalOther = 0;
    let totalNet = 0;
    let totalEmployerAfc = 0;
    let totalEmployerSis = 0;
    let totalEmployerMutual = 0;
    let totalEmployerCost = 0;

    for (const entry of entries) {
      totalGross += entry.gross;
      totalAfp += entry.afp_deduction;
      totalHealth += entry.isapre_deduction;
      totalTax += entry.impuesto_unico;
      totalOther += entry.other_deductions;
      totalNet += entry.net;

      // Calculate employer costs
      const calc = calculatePayroll(
        {
          grossSalary: entry.gross,
          afpName: entry.personnel_afp_name ?? '',
          healthProvider: 'Fonasa',
          contractType: entry.personnel_contract_type as 'indefinido' | 'plazo_fijo' | 'honorarios',
          otherDeductions: entry.other_deductions,
        },
        taxTables
      );
      totalEmployerAfc += calc.employerAfc;
      totalEmployerSis += calc.employerSis;
      totalEmployerMutual += calc.employerMutual;
      totalEmployerCost += calc.totalEmployerCost;
    }

    const totalDeductions = totalAfp + totalHealth + totalTax + totalOther;

    return {
      totalGross,
      totalAfp,
      totalHealth,
      totalTax,
      totalOther,
      totalDeductions,
      totalNet,
      totalEmployerAfc,
      totalEmployerSis,
      totalEmployerMutual,
      totalEmployerCost,
    };
  }, [entries, taxTables]);

  // Pie chart data
  const pieData = useMemo(() => {
    const data = [
      { name: 'Sueldo Líquido', value: totals.totalNet },
      { name: 'AFP', value: totals.totalAfp },
      { name: 'Salud', value: totals.totalHealth },
      { name: 'Impuesto', value: totals.totalTax },
      { name: 'AFC Empleador', value: totals.totalEmployerAfc },
      { name: 'SIS + Mutual', value: totals.totalEmployerSis + totals.totalEmployerMutual },
    ].filter((d) => d.value > 0);
    return data;
  }, [totals]);

  // Comparison with previous month
  const comparison = useMemo(() => {
    if (!previousSummary) return null;
    const grossDiff = totals.totalGross - previousSummary.totalGross;
    const netDiff = totals.totalNet - previousSummary.totalNet;
    return { grossDiff, netDiff };
  }, [totals, previousSummary]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Bruto</p>
            <p className="text-2xl font-bold font-mono">{formatCLP(totals.totalGross)}</p>
            {comparison && (
              <p className={`text-xs mt-1 ${comparison.grossDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {comparison.grossDiff >= 0 ? '+' : ''}{formatCLP(comparison.grossDiff)} vs mes anterior
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Descuentos</p>
            <p className="text-2xl font-bold font-mono">{formatCLP(totals.totalDeductions)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {entries.length} {entries.length === 1 ? 'empleado' : 'empleados'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Líquido</p>
            <p className="text-2xl font-bold font-mono text-amber-700">{formatCLP(totals.totalNet)}</p>
            {comparison && (
              <p className={`text-xs mt-1 ${comparison.netDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {comparison.netDiff >= 0 ? '+' : ''}{formatCLP(comparison.netDiff)} vs mes anterior
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Costo Empleador</p>
            <p className="text-2xl font-bold font-mono">{formatCLP(totals.totalEmployerCost)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pie Chart */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Composición del Costo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCLP(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayrollSummary;
