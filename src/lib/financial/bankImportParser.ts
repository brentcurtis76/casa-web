/**
 * Financial Module — Bank Import Parser
 *
 * Client-side parsing for CSV and XLSX bank statement files.
 * Handles Chilean number formats (dots for thousands, comma for decimal).
 * Auto-detects common Chilean bank column names.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  reference?: string;
  rawData: Record<string, string>;
}

export interface ColumnMapping {
  date: string | null;
  description: string | null;
  amount: string | null;
  amountDebit?: string | null;  // Cargo column
  amountCredit?: string | null; // Abono column
  reference: string | null;
  confidence: number;
}

export interface ParseFileResult {
  headers: string[];
  rows: Array<Record<string, string>>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DATE_PATTERNS = ['fecha', 'fecha operacion', 'fecha operación', 'fecha contable', 'date'];
const DESCRIPTION_PATTERNS = ['descripcion', 'descripción', 'detalle', 'glosa', 'concepto', 'description'];
const AMOUNT_PATTERNS = ['monto', 'importe', 'amount', 'valor'];
const DEBIT_PATTERNS = ['cargo', 'débito', 'debito'];
const CREDIT_PATTERNS = ['abono', 'crédito', 'credito'];
const REFERENCE_PATTERNS = ['referencia', 'no documento', 'nº documento', 'comprobante', 'reference', 'numero', 'número'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = ['csv', 'xlsx'];
const ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream', // Some browsers report XLSX as this
];

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'El archivo excede el tamaño máximo de 10 MB' };
  }

  // Check extension
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'Solo se aceptan archivos .csv y .xlsx' };
  }

  // Check MIME type (with fallback for unknown types)
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Tipo de archivo no válido: ${file.type}` };
  }

  if (file.size === 0) {
    return { valid: false, error: 'El archivo está vacío' };
  }

  return { valid: true };
}

export function getFileExtension(file: File): 'csv' | 'xlsx' {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return extension === 'xlsx' ? 'xlsx' : 'csv';
}

// ─── Amount Normalization ───────────────────────────────────────────────────

/**
 * Normalize a Chilean-formatted amount string to an integer.
 * "1.234.567" -> 1234567
 * "1.234,56" -> 1235 (rounded)
 * "1234567" -> 1234567
 * "-1.234" -> -1234
 */
export function normalizeAmount(value: string | number): number {
  if (typeof value === 'number') {
    return Math.round(value);
  }

  if (!value || value.trim() === '') return 0;

  let cleaned = value.trim();

  // Remove currency symbols and spaces
  cleaned = cleaned.replace(/[$\s]/g, '');

  // Handle negative values with parentheses: (1.234) -> -1234
  const isNegativeParens = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegativeParens) {
    cleaned = '-' + cleaned.slice(1, -1);
  }

  // Determine if dots are thousands separators or decimal separator
  // Chilean format: dots for thousands, comma for decimal
  const hasDotAndComma = cleaned.includes('.') && cleaned.includes(',');
  const dotCount = (cleaned.match(/\./g) ?? []).length;

  if (hasDotAndComma) {
    // "1.234.567,89" format — dots are thousands, comma is decimal
    cleaned = cleaned.replace(/\./g, ''); // strip dots (thousands)
    cleaned = cleaned.replace(',', '.'); // comma -> period (decimal)
  } else if (dotCount > 1) {
    // Multiple dots: "1.234.567" — all dots are thousands separators
    cleaned = cleaned.replace(/\./g, '');
  } else if (cleaned.includes(',')) {
    // Single comma, no dots: "1234,56" — comma is decimal
    cleaned = cleaned.replace(',', '.');
  }
  // Single dot: could be decimal (1234.56) — leave as is

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed);
}

// ─── CSV Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a CSV file. Handles Chilean number format.
 * Tries UTF-8 first, falls back to Latin-1 if garbled characters detected.
 */
export async function parseCSV(file: File): Promise<ParseFileResult> {
  let text = await readFileAsText(file, 'UTF-8');

  // Check for garbled characters (common with Latin-1 files read as UTF-8)
  if (text.includes('\uFFFD') || /Ã[¡-¿]/.test(text)) {
    text = await readFileAsText(file, 'ISO-8859-1');
  }

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Detect separator: try semicolon first (common in Chilean exports), then comma, then tab
  const firstLine = lines[0];
  const separator = detectSeparator(firstLine);

  const headers = parseCSVLine(firstLine, separator).map((h) => h.trim());

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i], separator);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? '').trim();
    }
    rows.push(row);
  }

  return { headers, rows };
}

function readFileAsText(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file, encoding);
  });
}

function detectSeparator(line: string): string {
  const semicolonCount = (line.match(/;/g) ?? []).length;
  const commaCount = (line.match(/,/g) ?? []).length;
  const tabCount = (line.match(/\t/g) ?? []).length;

  if (semicolonCount >= commaCount && semicolonCount >= tabCount) return ';';
  if (tabCount >= commaCount) return '\t';
  return ',';
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === separator) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

// ─── XLSX Parser ────────────────────────────────────────────────────────────

/**
 * Parse an XLSX file using the xlsx library (loaded dynamically).
 */
export async function parseXLSX(file: File): Promise<ParseFileResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Use the first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    defval: '',
  });

  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }

  // First row is headers
  const rawHeaders = jsonData[0] as unknown[];
  const headers = rawHeaders.map((h) => String(h ?? '').trim());

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < jsonData.length; i++) {
    const rawRow = jsonData[i] as unknown[];
    const row: Record<string, string> = {};
    let hasData = false;

    for (let j = 0; j < headers.length; j++) {
      const cellValue = rawRow[j];
      const strValue = cellValue !== null && cellValue !== undefined ? String(cellValue).trim() : '';
      row[headers[j]] = strValue;
      if (strValue.length > 0) hasData = true;
    }

    // Skip empty rows
    if (hasData) {
      rows.push(row);
    }
  }

  return { headers, rows };
}

// ─── Column Auto-Detection ──────────────────────────────────────────────────

/**
 * Auto-detect column mapping based on Chilean bank column name patterns.
 */
export function autoDetectColumns(headers: string[]): ColumnMapping {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  let confidence = 0;
  let matchCount = 0;

  function findMatch(patterns: string[]): string | null {
    for (const pattern of patterns) {
      const idx = lowerHeaders.findIndex((h) => h === pattern || h.includes(pattern));
      if (idx >= 0) {
        matchCount++;
        return headers[idx];
      }
    }
    return null;
  }

  const dateCol = findMatch(DATE_PATTERNS);
  const descCol = findMatch(DESCRIPTION_PATTERNS);
  const amountCol = findMatch(AMOUNT_PATTERNS);
  const debitCol = findMatch(DEBIT_PATTERNS);
  const creditCol = findMatch(CREDIT_PATTERNS);
  const refCol = findMatch(REFERENCE_PATTERNS);

  // Calculate confidence based on number of matches
  const totalRequired = 3; // date, description, amount (or debit+credit)
  const hasAmount = amountCol !== null || (debitCol !== null && creditCol !== null);
  const requiredMatched = (dateCol ? 1 : 0) + (descCol ? 1 : 0) + (hasAmount ? 1 : 0);
  confidence = requiredMatched / totalRequired;

  return {
    date: dateCol,
    description: descCol,
    amount: amountCol && !debitCol && !creditCol ? amountCol : null,
    amountDebit: debitCol,
    amountCredit: creditCol,
    reference: refCol,
    confidence,
  };
}

// ─── Row Transformation ─────────────────────────────────────────────────────

/**
 * Transform raw rows into ParsedRows using the column mapping.
 */
export function transformRows(
  rows: Array<Record<string, string>>,
  mapping: ColumnMapping
): ParsedRow[] {
  const results: ParsedRow[] = [];

  for (const row of rows) {
    const dateVal = mapping.date ? (row[mapping.date] ?? '') : '';
    const descVal = mapping.description ? (row[mapping.description] ?? '') : '';

    let amount = 0;
    if (mapping.amount) {
      amount = normalizeAmount(row[mapping.amount] ?? '');
    } else if (mapping.amountDebit && mapping.amountCredit) {
      const credit = normalizeAmount(row[mapping.amountCredit] ?? '');
      const debit = normalizeAmount(row[mapping.amountDebit] ?? '');
      // Abono (credit) positive, Cargo (debit) negative
      amount = credit > 0 ? credit : (debit > 0 ? -debit : 0);
    }

    const refVal = mapping.reference ? (row[mapping.reference] ?? '') : '';

    // Skip rows with no meaningful data
    if (!dateVal && !descVal && amount === 0) continue;

    // Normalize date format to YYYY-MM-DD
    const normalizedDate = normalizeDate(dateVal);

    results.push({
      date: normalizedDate,
      description: descVal.substring(0, 500).trim(),
      amount,
      reference: refVal || undefined,
      rawData: { ...row },
    });
  }

  return results;
}

/**
 * Normalize various date formats to YYYY-MM-DD.
 * Handles: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD.MM.YYYY
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';

  const trimmed = dateStr.trim();

  // Already YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Try parsing with Date object as fallback
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return trimmed;
}

// ─── Raw Parsing (for bank detection) ───────────────────────────────────────

/**
 * Parse an XLSX file into raw array-of-arrays (no header extraction).
 * Used by bank profile detection to inspect all rows including metadata headers.
 */
export async function parseXLSXRaw(file: File): Promise<unknown[][]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
}

/**
 * Parse a CSV file into raw array-of-arrays (no header extraction).
 * Used by bank profile detection to inspect all rows including metadata headers.
 */
export async function parseCSVRaw(file: File): Promise<string[][]> {
  let text = await readFileAsText(file, 'UTF-8');
  if (text.includes('\uFFFD') || /Ã[¡-¿]/.test(text)) {
    text = await readFileAsText(file, 'ISO-8859-1');
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const separator = detectSeparator(lines[0]);
  return lines.map((line) => parseCSVLine(line, separator));
}
