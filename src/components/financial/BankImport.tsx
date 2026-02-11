/**
 * BankImport — Multi-step wizard for the Importar tab.
 *
 * 4 steps: Upload -> Column Mapping -> Preview -> Reconciliation
 * Parses CSV/XLSX files client-side, auto-detects Chilean bank columns,
 * matches against existing transactions, provides reconciliation UI.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Loader2, Upload, FileText, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/AuthContext';
import { formatCLP } from '@/types/financial';
import type { BankTransaction, FinancialTransaction, BankFileType } from '@/types/financial';
import ColumnMapper from './ColumnMapper';
import ReconciliationView from './ReconciliationView';
import {
  validateFile,
  getFileExtension,
  parseCSV,
  parseXLSX,
  autoDetectColumns,
  transformRows,
} from '@/lib/financial/bankImportParser';
import type { ColumnMapping, ParsedRow, ParseFileResult } from '@/lib/financial/bankImportParser';
import { matchTransactions } from '@/lib/financial/transactionMatcher';
import type { MatchResult } from '@/lib/financial/transactionMatcher';
import {
  useTransactions,
  useImportBankStatement,
  useImportBankTransactions,
  useUpdateMatch,
  useBulkConfirmMatches,
  useCreateTransaction,
} from '@/lib/financial/hooks';

// ─── Props ──────────────────────────────────────────────────────────────────

interface BankImportProps {
  canWrite: boolean;
}

// ─── Step Labels ────────────────────────────────────────────────────────────

const STEPS = [
  'Subir Archivo',
  'Mapear Columnas',
  'Vista Previa',
  'Conciliación',
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

const BankImport = ({ canWrite }: BankImportProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bankName, setBankName] = useState('');
  const [statementDate, setStatementDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isDragging, setIsDragging] = useState(false);

  // Step 2: Column mapping state
  const [fileData, setFileData] = useState<ParseFileResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: null,
    description: null,
    amount: null,
    reference: null,
    confidence: 0,
  });
  const [isParsing, setIsParsing] = useState(false);

  // Step 3: Preview state
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // Step 4: Reconciliation state
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Data hooks
  const { data: transactionData } = useTransactions({ pageSize: 1000 });
  const existingTransactions = useMemo(
    () => transactionData?.transactions ?? [],
    [transactionData]
  );

  const importStatementMutation = useImportBankStatement();
  const importTransactionsMutation = useImportBankTransactions();
  const updateMatchMutation = useUpdateMatch();
  const bulkConfirmMutation = useBulkConfirmMatches();
  const createTransactionMutation = useCreateTransaction();

  // ─── Step 1: File Handling ────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      toast({ title: validation.error ?? 'Archivo no válido', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const canProceedStep1 = selectedFile && bankName.length >= 2 && statementDate;

  // ─── Step 2: Parse and Map Columns ────────────────────────────────────

  const handleParseFile = useCallback(async () => {
    if (!selectedFile) return;

    setIsParsing(true);
    try {
      const ext = getFileExtension(selectedFile);
      const result = ext === 'xlsx'
        ? await parseXLSX(selectedFile)
        : await parseCSV(selectedFile);

      if (result.headers.length === 0) {
        toast({ title: 'El archivo no contiene datos', variant: 'destructive' });
        setIsParsing(false);
        return;
      }

      if (result.rows.length === 0) {
        toast({ title: 'El archivo no contiene filas de datos', variant: 'destructive' });
        setIsParsing(false);
        return;
      }

      setFileData(result);

      // Auto-detect columns
      const detected = autoDetectColumns(result.headers);
      setColumnMapping(detected);

      setCurrentStep(1);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al leer el archivo';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsParsing(false);
    }
  }, [selectedFile, toast]);

  // ─── Step 3: Transform and Preview ────────────────────────────────────

  const handleTransformRows = useCallback(() => {
    if (!fileData) return;

    // Validate mapping
    const hasAmount = columnMapping.amount ||
      (columnMapping.amountDebit && columnMapping.amountCredit);

    if (!columnMapping.date || !columnMapping.description || !hasAmount) {
      toast({
        title: 'Mapeo incompleto',
        description: 'Debes mapear al menos las columnas de Fecha, Descripción y Monto',
        variant: 'destructive',
      });
      return;
    }

    const rows = transformRows(fileData.rows, columnMapping);
    setParsedRows(rows);
    setCurrentStep(2);
  }, [fileData, columnMapping, toast]);

  const previewRows = useMemo(() => parsedRows.slice(0, 20), [parsedRows]);

  // ─── Step 4: Import and Reconcile ─────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!selectedFile || parsedRows.length === 0) return;

    setIsImporting(true);
    try {
      const ext = getFileExtension(selectedFile);
      const fileUrl = `local://${selectedFile.name}`;

      // Create bank statement record
      const statementResult = await importStatementMutation.mutateAsync({
        bankName,
        statementDate,
        fileUrl,
        fileType: ext as BankFileType,
      });

      if (!statementResult.data) {
        toast({ title: 'Error al crear el registro del estado de cuenta', variant: 'destructive' });
        setIsImporting(false);
        return;
      }

      const statementId = statementResult.data.id;

      // Bulk insert parsed rows
      const txResult = await importTransactionsMutation.mutateAsync({
        statementId,
        rows: parsedRows.map((r) => ({
          date: r.date,
          description: r.description,
          amount: r.amount,
          reference: r.reference,
        })),
      });

      if (!txResult.data) {
        toast({ title: 'Error al importar las transacciones', variant: 'destructive' });
        setIsImporting(false);
        return;
      }

      const importedBankTxs = txResult.data;
      setBankTransactions(importedBankTxs);

      // Run matching algorithm
      const matches = matchTransactions(parsedRows, existingTransactions);
      setMatchResults(matches);

      // Auto-update bank transactions with match results
      for (let i = 0; i < matches.length && i < importedBankTxs.length; i++) {
        const match = matches[i];
        if (match.matchedTransactionId && match.confidence >= 0.6) {
          const status = match.confidence >= 0.9 ? 'matched' : 'unmatched';
          await updateMatchMutation.mutateAsync({
            id: importedBankTxs[i].id,
            matchedTransactionId: match.matchedTransactionId,
            confidence: match.confidence,
            status: status as 'matched' | 'unmatched',
          });

          // Update local state
          importedBankTxs[i] = {
            ...importedBankTxs[i],
            matched_transaction_id: match.matchedTransactionId,
            match_confidence: match.confidence,
            status: status as 'matched' | 'unmatched',
          };
        }
      }

      setBankTransactions([...importedBankTxs]);
      setCurrentStep(3);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error durante la importación';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  }, [
    selectedFile, parsedRows, bankName, statementDate, existingTransactions,
    importStatementMutation, importTransactionsMutation, updateMatchMutation, toast,
  ]);

  // ─── Reconciliation Actions ───────────────────────────────────────────

  const handleConfirmMatch = useCallback(async (bankTxId: string) => {
    const bt = bankTransactions.find((t) => t.id === bankTxId);
    if (!bt || !bt.matched_transaction_id) return;

    await updateMatchMutation.mutateAsync({
      id: bankTxId,
      matchedTransactionId: bt.matched_transaction_id,
      confidence: bt.match_confidence,
      status: 'matched',
    });

    setBankTransactions((prev) =>
      prev.map((t) => t.id === bankTxId ? { ...t, status: 'matched' } : t)
    );
  }, [bankTransactions, updateMatchMutation]);

  const handleUndoMatch = useCallback(async (bankTxId: string) => {
    await updateMatchMutation.mutateAsync({
      id: bankTxId,
      matchedTransactionId: null,
      confidence: null,
      status: 'unmatched',
    });

    setBankTransactions((prev) =>
      prev.map((t) => t.id === bankTxId
        ? { ...t, status: 'unmatched', matched_transaction_id: null, match_confidence: null }
        : t
      )
    );
  }, [updateMatchMutation]);

  const handleIgnore = useCallback(async (bankTxId: string) => {
    await updateMatchMutation.mutateAsync({
      id: bankTxId,
      matchedTransactionId: null,
      confidence: null,
      status: 'ignored',
    });

    setBankTransactions((prev) =>
      prev.map((t) => t.id === bankTxId ? { ...t, status: 'ignored' } : t)
    );
  }, [updateMatchMutation]);

  const handleCreateTransaction = useCallback(async (bankTxId: string) => {
    const bt = bankTransactions.find((t) => t.id === bankTxId);
    if (!bt) return;

    const result = await createTransactionMutation.mutateAsync({
      date: bt.date,
      description: bt.description,
      amount: Math.abs(bt.amount),
      type: bt.amount >= 0 ? 'income' : 'expense',
      category_id: null,
      account_id: null,
      reference: bt.reference,
      notes: `Importado desde estado bancario`,
      created_by: user?.id ?? null,
    });

    if (result.data) {
      await updateMatchMutation.mutateAsync({
        id: bankTxId,
        matchedTransactionId: result.data.id,
        confidence: 1.0,
        status: 'created',
      });

      setBankTransactions((prev) =>
        prev.map((t) => t.id === bankTxId
          ? { ...t, status: 'created', matched_transaction_id: result.data!.id, match_confidence: 1.0 }
          : t
        )
      );
    }
  }, [bankTransactions, createTransactionMutation, updateMatchMutation, user]);

  const handleBulkConfirm = useCallback(async () => {
    const toConfirm = bankTransactions
      .filter((bt) =>
        bt.status !== 'matched' && bt.status !== 'created' && bt.status !== 'ignored' &&
        bt.match_confidence !== null && bt.match_confidence >= 0.6 &&
        bt.matched_transaction_id
      )
      .map((bt) => bt.id);

    if (toConfirm.length === 0) return;

    await bulkConfirmMutation.mutateAsync(toConfirm);

    setBankTransactions((prev) =>
      prev.map((t) =>
        toConfirm.includes(t.id) ? { ...t, status: 'matched' } : t
      )
    );
  }, [bankTransactions, bulkConfirmMutation]);

  // ─── Reset wizard ─────────────────────────────────────────────────────

  const handleFinish = useCallback(() => {
    setCurrentStep(0);
    setSelectedFile(null);
    setBankName('');
    setStatementDate(new Date().toISOString().split('T')[0]);
    setFileData(null);
    setColumnMapping({ date: null, description: null, amount: null, reference: null, confidence: 0 });
    setParsedRows([]);
    setBankTransactions([]);
    setMatchResults([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const isMutating = importStatementMutation.isPending || importTransactionsMutation.isPending ||
    updateMatchMutation.isPending || bulkConfirmMutation.isPending ||
    createTransactionMutation.isPending;

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, idx) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                idx === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : idx < currentStep
                    ? 'bg-green-100 text-green-700'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {idx < currentStep ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-background/20 text-xs">
                  {idx + 1}
                </span>
              )}
              <span className="hidden sm:inline">{step}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {currentStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subir Archivo de Cartola Bancaria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag and Drop Zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              {selectedFile ? (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">Arrastra un archivo aquí o haz clic para seleccionar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formatos aceptados: CSV, XLSX (máximo 10 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Bank Name */}
            <div className="space-y-1">
              <Label htmlFor="bank-name">Nombre del Banco</Label>
              <Input
                id="bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ej: Banco Estado, Santander, BCI"
              />
            </div>

            {/* Statement Date */}
            <div className="space-y-1">
              <Label htmlFor="statement-date">Fecha del Estado de Cuenta</Label>
              <Input
                id="statement-date"
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
              />
            </div>

            {/* Next Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleParseFile}
                disabled={!canProceedStep1 || isParsing}
              >
                {isParsing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-1" />
                )}
                Siguiente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Column Mapping */}
      {currentStep === 1 && fileData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapear Columnas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColumnMapper
              headers={fileData.headers}
              rows={fileData.rows}
              initialMapping={columnMapping}
              onMappingChange={setColumnMapping}
            />

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button onClick={handleTransformRows}>
                <ChevronRight className="h-4 w-4 mr-1" />
                Siguiente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vista Previa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <Badge variant="secondary">{parsedRows.length} transacciones encontradas</Badge>
            </div>

            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Referencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                      <TableCell className={`text-right font-mono ${row.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCLP(Math.abs(row.amount))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.reference ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {parsedRows.length > 20 && (
              <p className="text-xs text-muted-foreground text-center">
                Mostrando las primeras 20 de {parsedRows.length} transacciones
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button onClick={handleImport} disabled={isImporting || !canWrite}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-1" />
                )}
                Importar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Reconciliation */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <ReconciliationView
            bankTransactions={bankTransactions}
            existingTransactions={existingTransactions}
            matchResults={matchResults}
            onConfirmMatch={handleConfirmMatch}
            onUndoMatch={handleUndoMatch}
            onIgnore={handleIgnore}
            onCreateTransaction={handleCreateTransaction}
            onBulkConfirm={handleBulkConfirm}
            isPending={isMutating}
          />

          <div className="flex justify-end">
            <Button onClick={handleFinish}>
              <Check className="h-4 w-4 mr-1" />
              Finalizar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankImport;
