/**
 * PayrollManager — Main payroll UI component.
 *
 * Year/month selectors, payroll table, status workflow,
 * tax settings dialog, and expandable detail per employee.
 */

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Calculator,
  RefreshCw,
  CheckCircle,
  Banknote,
  Settings,
  Receipt,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { formatCLP, MONTH_LABELS_FULL, maskRut } from '@/types/financial';
import type { PayrollStatus } from '@/types/financial';
import {
  usePayroll,
  useCalculatePayroll,
  useProcessPayroll,
  useMarkPayrollPaid,
  usePayrollSummary,
} from '@/lib/financial/hooks';
import { loadTaxTables, saveTaxTables, DEFAULT_TAX_TABLES } from '@/lib/financial/chileanTaxTables';
import type { ChileanTaxTables } from '@/lib/financial/chileanTaxTables';
import type { PayrollWithPersonnel } from '@/lib/financial/payrollService';
import PayrollDetail from './PayrollDetail';
import PayrollSummary from './PayrollSummary';

// ─── Props ──────────────────────────────────────────────────────────────────

interface PayrollManagerProps {
  canWrite: boolean;
}

// ─── Status Helpers ─────────────────────────────────────────────────────────

const STATUS_BADGE_MAP: Record<PayrollStatus, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-amber-100 text-amber-800 border-amber-300' },
  processed: { label: 'Procesado', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  paid: { label: 'Pagado', className: 'bg-green-100 text-green-800 border-green-300' },
};

const CONTRACT_LABELS: Record<string, string> = {
  indefinido: 'Indefinido',
  plazo_fijo: 'Plazo Fijo',
  honorarios: 'Honorarios',
};

// ─── Tax Settings Dialog ────────────────────────────────────────────────────

interface TaxSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taxTables: ChileanTaxTables;
  onSave: (tables: ChileanTaxTables) => void;
}

const TaxSettingsDialog = ({ open, onOpenChange, taxTables, onSave }: TaxSettingsDialogProps) => {
  const [utmValue, setUtmValue] = useState(String(taxTables.utmValue));
  const [ufValue, setUfValue] = useState(String(taxTables.ufValue));
  const [afcIndefinido, setAfcIndefinido] = useState(String(taxTables.employerRates.afcIndefinido * 100));
  const [afcPlazoFijo, setAfcPlazoFijo] = useState(String(taxTables.employerRates.afcPlazoFijo * 100));
  const [sis, setSis] = useState(String(taxTables.employerRates.sis * 100));
  const [mutual, setMutual] = useState(String(taxTables.employerRates.mutual * 100));
  const [honorariosRate, setHonorariosRate] = useState(String(taxTables.honorariosRate * 100));

  const handleSave = () => {
    const updated: ChileanTaxTables = {
      ...taxTables,
      utmValue: parseInt(utmValue, 10) || taxTables.utmValue,
      ufValue: parseInt(ufValue, 10) || taxTables.ufValue,
      employerRates: {
        afcIndefinido: (parseFloat(afcIndefinido) || taxTables.employerRates.afcIndefinido * 100) / 100,
        afcPlazoFijo: (parseFloat(afcPlazoFijo) || taxTables.employerRates.afcPlazoFijo * 100) / 100,
        sis: (parseFloat(sis) || taxTables.employerRates.sis * 100) / 100,
        mutual: (parseFloat(mutual) || taxTables.employerRates.mutual * 100) / 100,
      },
      honorariosRate: (parseFloat(honorariosRate) || DEFAULT_TAX_TABLES.honorariosRate * 100) / 100,
    };
    onSave(updated);
    onOpenChange(false);
  };

  const handleRestore = () => {
    setUtmValue(String(DEFAULT_TAX_TABLES.utmValue));
    setUfValue(String(DEFAULT_TAX_TABLES.ufValue));
    setAfcIndefinido(String(DEFAULT_TAX_TABLES.employerRates.afcIndefinido * 100));
    setAfcPlazoFijo(String(DEFAULT_TAX_TABLES.employerRates.afcPlazoFijo * 100));
    setSis(String(DEFAULT_TAX_TABLES.employerRates.sis * 100));
    setMutual(String(DEFAULT_TAX_TABLES.employerRates.mutual * 100));
    setHonorariosRate(String(DEFAULT_TAX_TABLES.honorariosRate * 100));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuración de Tablas Impositivas</DialogTitle>
          <DialogDescription>
            Valores UTM, UF, tasas empleador y retención de honorarios. Los tramos impositivos y tasas AFP son de solo lectura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* UTM / UF */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Valores Tributarios</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">UTM (CLP)</label>
                <Input value={utmValue} onChange={(e) => setUtmValue(e.target.value)} type="number" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">UF (CLP)</label>
                <Input value={ufValue} onChange={(e) => setUfValue(e.target.value)} type="number" />
              </div>
            </div>
          </div>

          {/* AFP Rates (read-only) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Tasas AFP (Solo lectura)</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 text-xs">AFP</TableHead>
                  <TableHead className="h-8 text-xs text-right">Tasa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxTables.afpRates.map((afp) => (
                  <TableRow key={afp.name}>
                    <TableCell className="py-1 text-sm">{afp.name}</TableCell>
                    <TableCell className="py-1 text-sm text-right">{(afp.rate * 100).toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Tax Brackets (read-only) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Tramos Impuesto Único (Solo lectura)</h4>
            <div className="text-xs text-gray-500 space-y-1">
              {taxTables.taxBrackets.map((bracket, idx) => (
                <p key={idx}>{bracket.label}</p>
              ))}
            </div>
          </div>

          {/* Employer Rates (editable) */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Tasas Empleador (%)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">AFC Indefinido</label>
                <Input value={afcIndefinido} onChange={(e) => setAfcIndefinido(e.target.value)} type="number" step="0.01" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">AFC Plazo Fijo</label>
                <Input value={afcPlazoFijo} onChange={(e) => setAfcPlazoFijo(e.target.value)} type="number" step="0.01" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">SIS</label>
                <Input value={sis} onChange={(e) => setSis(e.target.value)} type="number" step="0.01" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Mutual</label>
                <Input value={mutual} onChange={(e) => setMutual(e.target.value)} type="number" step="0.01" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Retención Honorarios (%)</label>
                <Input value={honorariosRate} onChange={(e) => setHonorariosRate(e.target.value)} type="number" step="0.01" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={handleRestore}>
            Restaurar Valores por Defecto
          </Button>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── PayrollManager Component ───────────────────────────────────────────────

const PayrollManager = ({ canWrite }: PayrollManagerProps) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [taxSettingsOpen, setTaxSettingsOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'process' | 'pay' | null>(null);

  // Tax tables from localStorage
  const [taxTables, setTaxTables] = useState<ChileanTaxTables>(() => loadTaxTables());

  // Data hooks
  const { data: payrollEntries = [], isLoading } = usePayroll(selectedYear, selectedMonth);
  const { data: previousSummary } = usePayrollSummary(
    selectedMonth === 1 ? selectedYear - 1 : selectedYear,
    selectedMonth === 1 ? 12 : selectedMonth - 1
  );

  // Mutation hooks
  const calculateMutation = useCalculatePayroll();
  const processMutation = useProcessPayroll();
  const markPaidMutation = useMarkPayrollPaid();

  // Year options: current year +/- 2
  const currentYear = now.getFullYear();
  const yearOptions = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  }, [currentYear]);

  // Determine overall payroll status for the period
  const payrollStatus: PayrollStatus | null = useMemo(() => {
    if (payrollEntries.length === 0) return null;
    return payrollEntries[0].status;
  }, [payrollEntries]);

  // Compute totals for summary row
  const totals = useMemo(() => {
    let gross = 0;
    let afp = 0;
    let health = 0;
    let tax = 0;
    let other = 0;
    let net = 0;

    for (const entry of payrollEntries) {
      gross += entry.gross;
      afp += entry.afp_deduction;
      health += entry.isapre_deduction;
      tax += entry.impuesto_unico;
      other += entry.other_deductions;
      net += entry.net;
    }

    return { gross, afp, health, tax, other, net };
  }, [payrollEntries]);

  // Handlers
  const handleCalculate = useCallback(() => {
    calculateMutation.mutate({
      year: selectedYear,
      month: selectedMonth,
      taxTables,
    });
  }, [selectedYear, selectedMonth, taxTables, calculateMutation]);

  const handleProcess = useCallback(() => {
    setConfirmAction('process');
  }, []);

  const handleMarkPaid = useCallback(() => {
    setConfirmAction('pay');
  }, []);

  const confirmActionHandler = useCallback(() => {
    if (confirmAction === 'process') {
      processMutation.mutate({ year: selectedYear, month: selectedMonth });
    } else if (confirmAction === 'pay') {
      markPaidMutation.mutate({ year: selectedYear, month: selectedMonth });
    }
    setConfirmAction(null);
  }, [confirmAction, selectedYear, selectedMonth, processMutation, markPaidMutation]);

  const handleSaveTaxTables = useCallback((tables: ChileanTaxTables) => {
    saveTaxTables(tables);
    setTaxTables(tables);
  }, []);

  const toggleRow = useCallback((id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  }, []);

  const isMutating = calculateMutation.isPending || processMutation.isPending || markPaidMutation.isPending;

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

        {/* Status badge */}
        {payrollStatus && (
          <Badge
            variant="outline"
            className={STATUS_BADGE_MAP[payrollStatus].className}
          >
            {STATUS_BADGE_MAP[payrollStatus].label}
          </Badge>
        )}

        {/* Action Buttons */}
        {canWrite && (
          <div className="flex gap-2 ml-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTaxSettingsOpen(true)}
              title="Configuración impositiva"
              aria-label="Configuración impositiva"
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* No payroll: Calculate */}
            {!payrollStatus && (
              <Button
                size="sm"
                onClick={handleCalculate}
                disabled={isMutating}
              >
                <Calculator className="h-4 w-4 mr-1" />
                Calcular Nómina
              </Button>
            )}

            {/* Draft: Recalculate + Process */}
            {payrollStatus === 'draft' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCalculate}
                  disabled={isMutating}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Recalcular
                </Button>
                <Button
                  size="sm"
                  onClick={handleProcess}
                  disabled={isMutating}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Procesar
                </Button>
              </>
            )}

            {/* Processed: Mark as Paid */}
            {payrollStatus === 'processed' && (
              <Button
                size="sm"
                onClick={handleMarkPaid}
                disabled={isMutating}
              >
                <Banknote className="h-4 w-4 mr-1" />
                Marcar como Pagada
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && payrollEntries.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">
              Sin nómina para {MONTH_LABELS_FULL[selectedMonth - 1]} {selectedYear}
            </p>
            <p className="text-sm mt-1 mb-4">
              Aún no se ha calculado la nómina para este período
            </p>
            {canWrite && (
              <Button onClick={handleCalculate} disabled={isMutating}>
                <Calculator className="h-4 w-4 mr-1" />
                Calcular Nómina
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payroll Table */}
      {!isLoading && payrollEntries.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Nómina — {MONTH_LABELS_FULL[selectedMonth - 1]} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30px]" />
                    <TableHead>Nombre</TableHead>
                    <TableHead>RUT</TableHead>
                    <TableHead className="text-right">Sueldo Bruto</TableHead>
                    <TableHead className="text-right">AFP</TableHead>
                    <TableHead className="text-right">Salud</TableHead>
                    <TableHead className="text-right">Imp. Único</TableHead>
                    <TableHead className="text-right">Otros</TableHead>
                    <TableHead className="text-right">Sueldo Líquido</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollEntries.map((entry: PayrollWithPersonnel) => (
                    <PayrollTableRow
                      key={entry.id}
                      entry={entry}
                      isExpanded={expandedRow === entry.id}
                      onToggle={() => toggleRow(entry.id)}
                      taxTables={taxTables}
                      year={selectedYear}
                      month={selectedMonth}
                    />
                  ))}

                  {/* Summary Row */}
                  <TableRow className="bg-muted font-bold border-t-2">
                    <TableCell />
                    <TableCell>Total ({payrollEntries.length})</TableCell>
                    <TableCell />
                    <TableCell className="font-mono text-right">{formatCLP(totals.gross)}</TableCell>
                    <TableCell className="font-mono text-right">{formatCLP(totals.afp)}</TableCell>
                    <TableCell className="font-mono text-right">{formatCLP(totals.health)}</TableCell>
                    <TableCell className="font-mono text-right">{formatCLP(totals.tax)}</TableCell>
                    <TableCell className="font-mono text-right">{formatCLP(totals.other)}</TableCell>
                    <TableCell className="font-mono text-right text-amber-700">
                      {formatCLP(totals.net)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          {/* Summary Section */}
          <PayrollSummary
            entries={payrollEntries}
            taxTables={taxTables}
            previousSummary={previousSummary}
          />
        </>
      )}

      {/* Tax Settings Dialog */}
      <TaxSettingsDialog
        open={taxSettingsOpen}
        onOpenChange={setTaxSettingsOpen}
        taxTables={taxTables}
        onSave={handleSaveTaxTables}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'process' ? 'Procesar Nómina' : 'Marcar como Pagada'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'process'
                ? 'Al procesar la nómina, los borradores pasarán a estado "Procesado". No se podrá recalcular después. ¿Desea continuar?'
                : 'Al marcar como pagada, se crearán transacciones de gasto para cada empleado y los registros pasarán a estado "Pagado". ¿Desea continuar?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmActionHandler}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ─── Payroll Table Row (extracted for expandability) ────────────────────────

interface PayrollTableRowProps {
  entry: PayrollWithPersonnel;
  isExpanded: boolean;
  onToggle: () => void;
  taxTables: ChileanTaxTables;
  year: number;
  month: number;
}

const PayrollTableRow = ({ entry, isExpanded, onToggle, taxTables, year, month }: PayrollTableRowProps) => {
  const statusInfo = STATUS_BADGE_MAP[entry.status];

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        <TableCell className="w-[30px]">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </TableCell>
        <TableCell className="font-medium">{entry.personnel_name}</TableCell>
        <TableCell className="text-sm text-gray-500">{maskRut(entry.personnel_rut)}</TableCell>
        <TableCell className="font-mono text-right">{formatCLP(entry.gross)}</TableCell>
        <TableCell className="font-mono text-right">{formatCLP(entry.afp_deduction)}</TableCell>
        <TableCell className="font-mono text-right">{formatCLP(entry.isapre_deduction)}</TableCell>
        <TableCell className="font-mono text-right">{formatCLP(entry.impuesto_unico)}</TableCell>
        <TableCell className="font-mono text-right">{formatCLP(entry.other_deductions)}</TableCell>
        <TableCell className="font-mono text-right font-semibold">{formatCLP(entry.net)}</TableCell>
        <TableCell>
          <Badge variant="outline" className={statusInfo.className}>
            {statusInfo.label}
          </Badge>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={10} className="p-0">
            <PayrollDetail
              entry={entry}
              taxTables={taxTables}
              year={year}
              month={month}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

export default PayrollManager;
