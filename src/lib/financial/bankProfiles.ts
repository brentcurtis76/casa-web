/**
 * Financial Module — Bank Profile Preprocessors
 *
 * Bank-specific logic for detecting and preprocessing Chilean bank cartolas.
 * Sits between raw file parsing and the generic column detection pipeline.
 *
 * Supported banks:
 * - Banco Santander (XLSX)
 * - Banco de Chile / Edwards / Citi (CSV/XLSX)
 *
 * Unknown formats fall through to the generic import flow.
 */

import type { ColumnMapping } from './bankImportParser';
import { normalizeDate } from './bankImportParser';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BankProfile {
  id: string;
  displayName: string;
  /** Examine raw rows and return confidence 0–1 that this file matches. */
  detect: (rawRows: unknown[][]) => number;
  /** Strip metadata, normalize data, return clean rows + pre-computed mapping. */
  preprocess: (rawRows: unknown[][], fallbackYear?: number) => BankPreprocessResult;
}

export interface BankPreprocessResult {
  headers: string[];
  rows: Array<Record<string, string>>;
  metadata: BankFileMetadata;
  columnMapping: ColumnMapping;
}

export interface BankFileMetadata {
  bankName: string;
  accountHolder?: string;
  rut?: string;
  statementPeriod?: { start: string; end: string };
  inferredYear?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function cellStr(row: unknown[], col: number): string {
  if (!row || col >= row.length) return '';
  const val = row[col];
  return val !== null && val !== undefined ? String(val).trim() : '';
}

function rowContains(row: unknown[], needle: string): boolean {
  if (!row) return false;
  const lower = needle.toLowerCase();
  return row.some(
    (cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(lower)
  );
}

/**
 * Normalize Santander comma-thousands format.
 * "40,000" → 40000, "-1,500,000" → -1500000
 */
function normalizeSantanderAmount(value: string | number): number {
  if (typeof value === 'number') return Math.round(value);
  if (!value || String(value).trim() === '') return 0;
  let cleaned = String(value).trim().replace(/[$\s]/g, '');
  // Commas are thousands separators in Santander (CLP integers, no decimal)
  cleaned = cleaned.replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.round(parsed);
}

/**
 * Parse a DD/MM date string, injecting the given year.
 * "02/01" + 2026 → "2026-01-02"
 */
function normalizeDateWithYear(dateStr: string, year: number): string {
  const trimmed = (dateStr ?? '').trim();
  // DD/MM (no year)
  const shortMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})$/);
  if (shortMatch) {
    const [, day, month] = shortMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Already has year — use generic normalizer
  return normalizeDate(dateStr);
}

/**
 * Try to parse "DD/MM/YYYY" or "DD de mes de YYYY" from a string.
 */
function extractDateFromText(text: string): string | null {
  // DD/MM/YYYY
  const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

// ─── Santander Profile ──────────────────────────────────────────────────────

const SANTANDER_TITLE = 'consulta de movimientos de cuentas corrientes';
const SANTANDER_FLAG = 'cargo/abono';

const PROFILE_SANTANDER: BankProfile = {
  id: 'santander',
  displayName: 'Banco Santander',

  detect(rawRows) {
    if (rawRows.length < 12) return 0;
    let score = 0;
    // Check title row
    const firstCell = cellStr(rawRows[0], 0).toLowerCase();
    if (firstCell.includes(SANTANDER_TITLE)) score += 0.5;
    // Check for CARGO/ABONO in any of the first 15 rows
    for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
      if (rowContains(rawRows[i], SANTANDER_FLAG)) {
        score += 0.45;
        break;
      }
    }
    return Math.min(score, 1);
  },

  preprocess(rawRows, fallbackYear) {
    // Find header row by scanning for MONTO + CARGO/ABONO
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
      const row = rawRows[i];
      if (rowContains(row, 'MONTO') && rowContains(row, SANTANDER_FLAG)) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) {
      throw new Error('No se encontraron las cabeceras de Banco Santander en el archivo');
    }

    // Extract metadata from rows above header
    const metadata: BankFileMetadata = { bankName: 'Banco Santander' };
    for (let i = 0; i < headerRowIdx; i++) {
      const row = rawRows[i];
      const c0 = cellStr(row, 0).toLowerCase();
      const c1 = cellStr(row, 1);
      if (c0.startsWith('sr')) {
        metadata.accountHolder = c1;
      } else if (c0.startsWith('empresa')) {
        metadata.accountHolder = metadata.accountHolder || c1;
      } else if (c0.startsWith('rut')) {
        metadata.rut = c1;
      }
      // Look for date range in any cell
      for (let j = 0; j < (row?.length ?? 0); j++) {
        const cell = cellStr(row, j);
        if (cell.toLowerCase().includes('fecha desde')) {
          const startDate = extractDateFromText(cell);
          // Look at next cell for end date or parse from same cell
          const nextCell = cellStr(row, j + 1);
          const endDate = extractDateFromText(nextCell) || extractDateFromText(cell.replace(/.*fecha hasta[:\s]*/i, ''));
          if (startDate) {
            metadata.statementPeriod = {
              start: startDate,
              end: endDate || startDate,
            };
          }
        }
      }
    }

    // Also scan for date range in a different pattern: separate cells
    for (let i = 0; i < headerRowIdx; i++) {
      const row = rawRows[i];
      for (let j = 0; j < (row?.length ?? 0); j++) {
        const cell = cellStr(row, j);
        if (cell.toLowerCase().includes('fecha desde:')) {
          const d = extractDateFromText(cell.split(':').pop() || '');
          if (d && metadata.statementPeriod) metadata.statementPeriod.start = d;
          else if (d) metadata.statementPeriod = { start: d, end: d };
        }
        if (cell.toLowerCase().includes('fecha hasta:')) {
          const d = extractDateFromText(cell.split(':').pop() || '');
          if (d && metadata.statementPeriod) metadata.statementPeriod.end = d;
        }
      }
    }

    // Parse column headers
    const rawHeaders = rawRows[headerRowIdx] as unknown[];
    const headers = rawHeaders.map((h) => String(h ?? '').trim());

    // Find column indices
    const montoIdx = headers.findIndex((h) => h.toUpperCase() === 'MONTO');
    const descIdx = headers.findIndex((h) => h.toUpperCase().includes('DESCRIPCI'));
    const fechaIdx = headers.findIndex((h) => h.toUpperCase() === 'FECHA');
    const cargoAbonoIdx = headers.findIndex((h) => h.toUpperCase().includes('CARGO/ABONO'));
    const docIdx = headers.findIndex((h) => h.toUpperCase().includes('DOCUMENTO'));
    const saldoIdx = headers.findIndex((h) => h.toUpperCase() === 'SALDO');
    const sucursalIdx = headers.findIndex((h) => h.toUpperCase() === 'SUCURSAL');

    // Build normalized output headers (stable names for column mapping)
    const outputHeaders = ['FECHA', 'DESCRIPCION', 'MONTO', 'REFERENCIA'];

    // Process data rows
    const rows: Array<Record<string, string>> = [];
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || !Array.isArray(row)) continue;

      const fechaVal = fechaIdx >= 0 ? cellStr(row, fechaIdx) : '';
      const descVal = descIdx >= 0 ? cellStr(row, descIdx) : '';
      const montoRaw = montoIdx >= 0 ? cellStr(row, montoIdx) : '';
      const cargoAbono = cargoAbonoIdx >= 0 ? cellStr(row, cargoAbonoIdx).toUpperCase() : '';
      const docVal = docIdx >= 0 ? cellStr(row, docIdx) : '';

      // Skip empty rows
      if (!fechaVal && !descVal && !montoRaw) continue;

      // Normalize amount: apply sign from CARGO/ABONO flag
      let amount = normalizeSantanderAmount(montoRaw);
      if (cargoAbono === 'C' && amount > 0) {
        amount = -amount;
      } else if (cargoAbono === 'A' && amount < 0) {
        amount = Math.abs(amount);
      }

      // Normalize date
      const normalizedDate = normalizeDate(fechaVal);

      rows.push({
        FECHA: normalizedDate,
        DESCRIPCION: descVal.substring(0, 500).trim(),
        MONTO: String(amount),
        REFERENCIA: docVal === '000000000' ? '' : docVal,
      });
    }

    const columnMapping: ColumnMapping = {
      date: 'FECHA',
      description: 'DESCRIPCION',
      amount: 'MONTO',
      amountDebit: null,
      amountCredit: null,
      reference: 'REFERENCIA',
      confidence: 1.0,
    };

    return { headers: outputHeaders, rows, metadata, columnMapping };
  },
};

// ─── Banco de Chile Profile ─────────────────────────────────────────────────

const BCHILE_SIGNATURES = [
  'detalle de transaccion',
  'monto cheques o cargos',
  'monto depositos o abonos',
  'fecha dia/mes',
];

const PROFILE_BANCO_CHILE: BankProfile = {
  id: 'banco_chile',
  displayName: 'Banco de Chile',

  detect(rawRows) {
    if (rawRows.length < 5) return 0;
    let matches = 0;
    for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
      for (const sig of BCHILE_SIGNATURES) {
        if (rowContains(rawRows[i], sig)) {
          matches++;
        }
      }
    }
    if (matches >= 3) return 0.95;
    if (matches >= 2) return 0.8;
    if (matches >= 1) return 0.6;
    return 0;
  },

  preprocess(rawRows, fallbackYear) {
    // Find header row: contains "FECHA" and "DETALLE"
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 30); i++) {
      const row = rawRows[i];
      if (
        rowContains(row, 'FECHA') &&
        (rowContains(row, 'DETALLE') || rowContains(row, 'TRANSACCION'))
      ) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) {
      throw new Error('No se encontraron las cabeceras de Banco de Chile en el archivo');
    }

    // Extract metadata
    const metadata: BankFileMetadata = { bankName: 'Banco de Chile' };
    let inferredYear = fallbackYear || new Date().getFullYear();

    for (let i = 0; i < headerRowIdx; i++) {
      const row = rawRows[i];
      for (let j = 0; j < (row?.length ?? 0); j++) {
        const cell = cellStr(row, j);
        const cellLower = cell.toLowerCase();
        if (cellLower.includes('sr(a)') || cellLower.includes('sr.(a)')) {
          // Next meaningful cell or same line may have the name
          const next = cellStr(row, j + 1);
          if (next) metadata.accountHolder = next;
        }
        if (cellLower.includes('desde') || cellLower.includes('hasta')) {
          const d = extractDateFromText(cell);
          if (d) {
            const year = parseInt(d.substring(0, 4), 10);
            if (year > 2000) inferredYear = year;
            if (cellLower.includes('desde')) {
              metadata.statementPeriod = metadata.statementPeriod || { start: d, end: d };
              metadata.statementPeriod.start = d;
            }
            if (cellLower.includes('hasta')) {
              metadata.statementPeriod = metadata.statementPeriod || { start: d, end: d };
              metadata.statementPeriod.end = d;
            }
          }
        }
        // Try to extract dates from standalone cells
        const dateMatch = cell.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dateMatch) {
          const [, , , y] = dateMatch;
          const year = parseInt(y, 10);
          if (year > 2000) inferredYear = year;
        }
      }
    }
    metadata.inferredYear = inferredYear;

    // Parse column headers
    const rawHeaders = rawRows[headerRowIdx] as unknown[];
    const headers = rawHeaders.map((h) => String(h ?? '').trim());

    // Find column indices (case-insensitive, partial match)
    const findCol = (patterns: string[]) =>
      headers.findIndex((h) => {
        const hl = h.toLowerCase();
        return patterns.some((p) => hl.includes(p));
      });

    const fechaIdx = findCol(['fecha']);
    const detalleIdx = findCol(['detalle', 'transaccion']);
    const sucursalIdx = findCol(['sucursal']);
    const docIdx = findCol(['docto', 'documento']);
    const cargoIdx = findCol(['cheques', 'cargos']);
    const abonoIdx = findCol(['depositos', 'abonos']);
    const saldoIdx = findCol(['saldo']);

    // Build normalized output headers
    const outputHeaders = ['FECHA', 'DESCRIPCION', 'CARGO', 'ABONO', 'REFERENCIA'];

    // Skip patterns
    const skipPatterns = ['saldo inicial', 'saldo final'];

    // Process data rows
    const rows: Array<Record<string, string>> = [];
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || !Array.isArray(row)) continue;

      const detalleVal = detalleIdx >= 0 ? cellStr(row, detalleIdx) : '';
      const detalleValLower = detalleVal.toLowerCase();

      // Skip special rows
      if (skipPatterns.some((p) => detalleValLower.includes(p))) continue;

      const fechaVal = fechaIdx >= 0 ? cellStr(row, fechaIdx) : '';
      const cargoVal = cargoIdx >= 0 ? cellStr(row, cargoIdx) : '';
      const abonoVal = abonoIdx >= 0 ? cellStr(row, abonoIdx) : '';
      const docVal = docIdx >= 0 ? cellStr(row, docIdx) : '';

      // Skip empty rows
      if (!fechaVal && !detalleVal && !cargoVal && !abonoVal) continue;

      // Skip footer/summary rows: check ALL cells for known footer patterns
      const rowText = row.map((c: unknown) => String(c ?? '').toLowerCase()).join(' ');
      if (
        rowText.includes('retencion') ||
        rowText.includes('depositos') && rowText.includes('cheques') ||
        rowText.includes('saldo disponible')
      ) continue;

      // Skip rows without a date-like value in the fecha column
      if (fechaVal && !/\d{1,2}[/\-.]/.test(fechaVal)) continue;

      // Normalize date with inferred year
      const normalizedDate = normalizeDateWithYear(fechaVal, inferredYear);

      rows.push({
        FECHA: normalizedDate,
        DESCRIPCION: detalleVal.substring(0, 500).trim(),
        CARGO: cargoVal,
        ABONO: abonoVal,
        REFERENCIA: docVal,
      });
    }

    const columnMapping: ColumnMapping = {
      date: 'FECHA',
      description: 'DESCRIPCION',
      amount: null,
      amountDebit: 'CARGO',
      amountCredit: 'ABONO',
      reference: 'REFERENCIA',
      confidence: 1.0,
    };

    return { headers: outputHeaders, rows, metadata, columnMapping };
  },
};

// ─── Registry ───────────────────────────────────────────────────────────────

export const BANK_PROFILES: BankProfile[] = [PROFILE_SANTANDER, PROFILE_BANCO_CHILE];

/**
 * Detect which bank a file belongs to based on content signatures.
 * Returns the best-matching profile and its confidence, or null.
 */
export function detectBank(
  rawRows: unknown[][]
): { profile: BankProfile; confidence: number } | null {
  let bestProfile: BankProfile | null = null;
  let bestConfidence = 0;

  for (const profile of BANK_PROFILES) {
    const confidence = profile.detect(rawRows);
    if (confidence > bestConfidence && confidence >= 0.5) {
      bestProfile = profile;
      bestConfidence = confidence;
    }
  }

  return bestProfile ? { profile: bestProfile, confidence: bestConfidence } : null;
}

/**
 * Get a bank profile by ID.
 */
export function getBankProfile(id: string): BankProfile | undefined {
  return BANK_PROFILES.find((p) => p.id === id);
}
