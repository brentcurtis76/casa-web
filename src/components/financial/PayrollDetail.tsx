/**
 * PayrollDetail — Expandable detail view for one employee's payroll.
 *
 * Shows: Haberes, Descuentos (AFP with name+rate, Salud, Impuesto Único, Otros),
 * Sueldo Líquido, Costo Empleador (AFC, SIS, Mutual).
 * "Descargar Liquidación" button triggers PDF generation.
 */

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { formatCLP } from '@/types/financial';
import type { PayrollWithPersonnel } from '@/lib/financial/payrollService';
import { calculatePayroll } from '@/lib/financial/payrollCalculator';
import type { ChileanTaxTables } from '@/lib/financial/chileanTaxTables';
import { generatePayrollSlipPDF } from './PayrollSlipPDF';

// ─── Props ──────────────────────────────────────────────────────────────────

interface PayrollDetailProps {
  entry: PayrollWithPersonnel;
  taxTables: ChileanTaxTables;
  year: number;
  month: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

const PayrollDetail = ({ entry, taxTables, year, month }: PayrollDetailProps) => {
  // Recalculate to get full detail (rates, employer costs, etc.)
  const calc = useMemo(() => {
    return calculatePayroll(
      {
        grossSalary: entry.gross,
        afpName: entry.personnel_afp_name ?? '',
        healthProvider: 'Fonasa',
        contractType: entry.personnel_contract_type as 'indefinido' | 'plazo_fijo' | 'honorarios',
        otherDeductions: entry.other_deductions,
      },
      taxTables
    );
  }, [entry, taxTables]);

  const isHonorarios = entry.personnel_contract_type === 'honorarios';

  const handleDownloadPDF = () => {
    generatePayrollSlipPDF(
      {
        name: entry.personnel_name,
        rut: entry.personnel_rut,
        position: entry.personnel_role,
        contractType: entry.personnel_contract_type,
      },
      calc,
      { year, month }
    );
  };

  return (
    <div className="bg-gray-50 p-4 border-t space-y-4">
      {/* Haberes */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Haberes</h4>
        <div className="grid grid-cols-2 gap-1 text-sm">
          <span className="text-gray-500">Sueldo Base</span>
          <span className="text-right font-mono">{formatCLP(entry.gross)}</span>
        </div>
      </div>

      {/* Descuentos */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Descuentos</h4>
        <div className="grid grid-cols-2 gap-1 text-sm">
          {isHonorarios ? (
            <>
              <span className="text-gray-500">
                Retención Honorarios ({(taxTables.honorariosRate * 100).toFixed(2)}%)
              </span>
              <span className="text-right font-mono">{formatCLP(entry.impuesto_unico)}</span>
            </>
          ) : (
            <>
              {entry.afp_deduction > 0 && (
                <>
                  <span className="text-gray-500">
                    AFP {calc.afpName} ({(calc.afpRate * 100).toFixed(2)}%)
                  </span>
                  <span className="text-right font-mono">{formatCLP(entry.afp_deduction)}</span>
                </>
              )}
              {entry.isapre_deduction > 0 && (
                <>
                  <span className="text-gray-500">Salud (7,00%)</span>
                  <span className="text-right font-mono">{formatCLP(entry.isapre_deduction)}</span>
                </>
              )}
              {entry.impuesto_unico > 0 && (
                <>
                  <span className="text-gray-500">
                    Impuesto Único ({calc.taxBracketApplied})
                  </span>
                  <span className="text-right font-mono">{formatCLP(entry.impuesto_unico)}</span>
                </>
              )}
            </>
          )}

          {entry.other_deductions > 0 && (
            <>
              <span className="text-gray-500">Otros Descuentos</span>
              <span className="text-right font-mono">{formatCLP(entry.other_deductions)}</span>
            </>
          )}

          <span className="text-gray-700 font-semibold border-t pt-1">Total Descuentos</span>
          <span className="text-right font-mono font-semibold border-t pt-1">
            {formatCLP(entry.afp_deduction + entry.isapre_deduction + entry.impuesto_unico + entry.other_deductions)}
          </span>
        </div>
      </div>

      {/* Sueldo Líquido */}
      <div className="bg-amber-50 p-3 rounded-md">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-gray-800">Sueldo Líquido</span>
          <span className="text-lg font-bold text-amber-700 font-mono">{formatCLP(entry.net)}</span>
        </div>
      </div>

      {/* Costo Empleador (only for non-honorarios) */}
      {!isHonorarios && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Costo Empleador (Informativo)</h4>
          <div className="grid grid-cols-2 gap-1 text-sm text-gray-400">
            <span>AFC (Seguro de Cesantía)</span>
            <span className="text-right font-mono">{formatCLP(calc.employerAfc)}</span>

            <span>SIS (Seguro Invalidez y Sobrevivencia)</span>
            <span className="text-right font-mono">{formatCLP(calc.employerSis)}</span>

            <span>Mutual de Seguridad</span>
            <span className="text-right font-mono">{formatCLP(calc.employerMutual)}</span>

            <span className="font-semibold border-t pt-1">Costo Total Empleador</span>
            <span className="text-right font-mono font-semibold border-t pt-1">
              {formatCLP(calc.totalEmployerCost)}
            </span>
          </div>
        </div>
      )}

      {/* Download Button */}
      <div className="pt-2 border-t">
        <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
          <Download className="mr-2 h-4 w-4" />
          Descargar Liquidación
        </Button>
      </div>
    </div>
  );
};

export default PayrollDetail;
