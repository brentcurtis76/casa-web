/**
 * Chilean Tax Tables — Constants for payroll calculation
 *
 * IMPORTANT: UTM and UF values must be updated monthly.
 * UTM is published by the SII (Servicio de Impuestos Internos) each month.
 * UF is published by the Central Bank of Chile (Banco Central) daily.
 *
 * Current values: February 2026
 * - UTM: $66.584
 * - UF: $38.846
 *
 * Source: https://www.sii.cl
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AfpRate {
  name: string;
  rate: number;
}

export interface TaxBracket {
  /** Lower bound in UTM (inclusive) */
  fromUtm: number;
  /** Upper bound in UTM (exclusive, Infinity for last bracket) */
  toUtm: number;
  /** Marginal rate */
  rate: number;
  /** Label for display */
  label: string;
}

export interface EmployerRates {
  /** AFC for indefinido contracts */
  afcIndefinido: number;
  /** AFC for plazo_fijo contracts */
  afcPlazoFijo: number;
  /** Seguro de Invalidez y Sobrevivencia */
  sis: number;
  /** Mutual de Seguridad */
  mutual: number;
}

export interface ChileanTaxTables {
  /** AFP contribution rates by fund name */
  afpRates: AfpRate[];
  /** Mandatory health deduction rate (Fonasa) */
  healthRate: number;
  /** Impuesto Único de Segunda Categoría brackets */
  taxBrackets: TaxBracket[];
  /** Unidad Tributaria Mensual value in CLP */
  utmValue: number;
  /** Unidad de Fomento value in CLP */
  ufValue: number;
  /** Tope imponible in UF for AFP and health */
  topeImponibleUf: number;
  /** Employer contribution rates */
  employerRates: EmployerRates;
  /** Honorarios retention rate */
  honorariosRate: number;
}

// ─── Default Values (February 2026) ────────────────────────────────────────

export const DEFAULT_TAX_TABLES: ChileanTaxTables = {
  afpRates: [
    { name: 'ProVida', rate: 0.1145 },
    { name: 'Habitat', rate: 0.1127 },
    { name: 'Capital', rate: 0.1144 },
    { name: 'Cuprum', rate: 0.1144 },
    { name: 'Modelo', rate: 0.1058 },
    { name: 'Planvital', rate: 0.1116 },
    { name: 'Uno', rate: 0.1069 },
  ],
  healthRate: 0.07,
  taxBrackets: [
    { fromUtm: 0, toUtm: 13.5, rate: 0, label: '0 – 13,5 UTM: Exento' },
    { fromUtm: 13.5, toUtm: 30, rate: 0.04, label: '13,5 – 30 UTM: 4%' },
    { fromUtm: 30, toUtm: 50, rate: 0.08, label: '30 – 50 UTM: 8%' },
    { fromUtm: 50, toUtm: 70, rate: 0.135, label: '50 – 70 UTM: 13,5%' },
    { fromUtm: 70, toUtm: 90, rate: 0.23, label: '70 – 90 UTM: 23%' },
    { fromUtm: 90, toUtm: 120, rate: 0.304, label: '90 – 120 UTM: 30,4%' },
    { fromUtm: 120, toUtm: 310, rate: 0.35, label: '120 – 310 UTM: 35%' },
    { fromUtm: 310, toUtm: Infinity, rate: 0.40, label: '310+ UTM: 40%' },
  ],
  utmValue: 66584,
  ufValue: 38846,
  topeImponibleUf: 81.6,
  employerRates: {
    afcIndefinido: 0.024,
    afcPlazoFijo: 0.03,
    sis: 0.0153,
    mutual: 0.0095,
  },
  honorariosRate: 0.1375,
};

// ─── Local Storage Persistence ──────────────────────────────────────────────

const STORAGE_KEY = 'casa_tax_tables';

/**
 * Load tax tables from localStorage. Returns DEFAULT_TAX_TABLES if not found
 * or if the stored data is invalid.
 */
export function loadTaxTables(): ChileanTaxTables {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_TAX_TABLES;

    const parsed = JSON.parse(stored) as Partial<ChileanTaxTables>;

    // Validate that essential fields exist
    if (
      !parsed.afpRates ||
      !parsed.taxBrackets ||
      typeof parsed.utmValue !== 'number' ||
      typeof parsed.ufValue !== 'number'
    ) {
      return DEFAULT_TAX_TABLES;
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...DEFAULT_TAX_TABLES,
      ...parsed,
      employerRates: {
        ...DEFAULT_TAX_TABLES.employerRates,
        ...(parsed.employerRates ?? {}),
      },
    };
  } catch {
    return DEFAULT_TAX_TABLES;
  }
}

/**
 * Save tax tables to localStorage.
 */
export function saveTaxTables(tables: ChileanTaxTables): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
}
