/**
 * ColumnMapper — Column mapping interface for bank statement import.
 *
 * Maps file column headers to required fields (Fecha, Descripción, Monto, Referencia).
 * Auto-detects common Chilean bank column names.
 * Handles Cargo/Abono split for debit/credit columns.
 */

import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { ColumnMapping } from '@/lib/financial/bankImportParser';

// ─── Props ──────────────────────────────────────────────────────────────────

interface ColumnMapperProps {
  headers: string[];
  rows: Array<Record<string, string>>;
  initialMapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

const ColumnMapper = ({ headers, rows, initialMapping, onMappingChange }: ColumnMapperProps) => {
  const [dateCol, setDateCol] = useState(initialMapping.date ?? '');
  const [descCol, setDescCol] = useState(initialMapping.description ?? '');
  const [amountCol, setAmountCol] = useState(initialMapping.amount ?? '');
  const [debitCol, setDebitCol] = useState(initialMapping.amountDebit ?? '');
  const [creditCol, setCreditCol] = useState(initialMapping.amountCredit ?? '');
  const [refCol, setRefCol] = useState(initialMapping.reference ?? '');
  const [useCargoAbono, setUseCargoAbono] = useState(
    !!(initialMapping.amountDebit && initialMapping.amountCredit)
  );

  // Initialize from auto-detection
  useEffect(() => {
    setDateCol(initialMapping.date ?? '');
    setDescCol(initialMapping.description ?? '');
    if (initialMapping.amountDebit && initialMapping.amountCredit) {
      setUseCargoAbono(true);
      setDebitCol(initialMapping.amountDebit);
      setCreditCol(initialMapping.amountCredit);
      setAmountCol('');
    } else {
      setAmountCol(initialMapping.amount ?? '');
      setUseCargoAbono(false);
    }
    setRefCol(initialMapping.reference ?? '');
  }, [initialMapping]);

  // Propagate changes back to parent
  useEffect(() => {
    const mapping: ColumnMapping = {
      date: dateCol || null,
      description: descCol || null,
      amount: useCargoAbono ? null : (amountCol || null),
      amountDebit: useCargoAbono ? (debitCol || null) : null,
      amountCredit: useCargoAbono ? (creditCol || null) : null,
      reference: refCol || null,
      confidence: initialMapping.confidence,
    };
    onMappingChange(mapping);
  }, [dateCol, descCol, amountCol, debitCol, creditCol, refCol, useCargoAbono, initialMapping.confidence, onMappingChange]);

  // Preview first 5 rows
  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const selectOptions = useMemo(() => {
    return headers.map((h) => ({ value: h, label: h }));
  }, [headers]);

  const renderColumnSelect = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    required: boolean = true
  ) => (
    <div className="space-y-1">
      <Label className="text-sm font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Seleccionar columna de ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none_">-- No mapear --</SelectItem>
          {selectOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Auto-detection confidence badge */}
      {initialMapping.confidence > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant={initialMapping.confidence >= 0.8 ? 'default' : 'secondary'}>
            {Math.round(initialMapping.confidence * 100)}% confianza en auto-detección
          </Badge>
          <span className="text-xs text-muted-foreground">
            Verifica que las columnas están correctamente mapeadas
          </span>
        </div>
      )}

      {/* Column Mapping Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderColumnSelect('Fecha', dateCol, setDateCol)}
        {renderColumnSelect('Descripción', descCol, setDescCol)}

        {/* Amount mode toggle */}
        <div className="md:col-span-2">
          <div className="flex items-center space-x-2 mb-2">
            <Checkbox
              id="cargo-abono"
              checked={useCargoAbono}
              onCheckedChange={(checked) => setUseCargoAbono(!!checked)}
            />
            <Label htmlFor="cargo-abono" className="text-sm">
              Usar columnas separadas de Cargo y Abono
            </Label>
          </div>
        </div>

        {useCargoAbono ? (
          <>
            {renderColumnSelect('Cargo (débito)', debitCol, setDebitCol)}
            {renderColumnSelect('Abono (crédito)', creditCol, setCreditCol)}
          </>
        ) : (
          renderColumnSelect('Monto', amountCol, setAmountCol)
        )}

        {renderColumnSelect('Referencia', refCol, setRefCol, false)}
      </div>

      {/* Preview Table */}
      {previewRows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Vista previa (primeras 5 filas)</h4>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => (
                    <TableHead key={h} className="text-xs whitespace-nowrap">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, idx) => (
                  <TableRow key={idx}>
                    {headers.map((h) => (
                      <TableCell key={h} className="text-xs whitespace-nowrap">
                        {row[h] ?? ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnMapper;
