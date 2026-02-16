import { describe, it, expect } from 'vitest';
import { detectBank, getBankProfile, BANK_PROFILES } from '../bankProfiles';

// ─── Test Data: Santander ───────────────────────────────────────────────────

function makeSantanderRows(): unknown[][] {
  return [
    ['Consulta de movimientos de Cuentas Corrientes', 'Consulta de movimientos de Cuentas Corrientes', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['Sr. (a):', 'Eugenia Riffo Contreras', '', '', 'Fecha:', '16 de febrero de 2026', ''],
    ['Empresa:', 'CORP ANGLICANA DE CHILE', '', '', 'Hora:', '12:31', ''],
    ['RUT empresa:', '70.043.500-8', '', '', '', '', ''],
    ['Datos cuenta', '', '', '', '', '', ''],
    ['Cuenta Corriente N°: 0-000-7392219-4', '', 'Moneda: PESOS DE CHILE', '', '', '', ''],
    ['Datos ejecutivo', '', '', '', '', '', ''],
    ['Ejecutivo de cuentas: GONZALEZ', '', '', '', '', '', ''],
    ['Detalle movimientos', '', '', '', '', '', ''],
    ['', '', '', '', 'Fecha desde: 01/01/2026', 'Fecha hasta: 31/01/2026', ''],
    ['MONTO', 'DESCRIPCIÓN MOVIMIENTO', 'FECHA', 'SALDO', 'N° DOCUMENTO', 'SUCURSAL', 'CARGO/ABONO'],
    ['40,000', '0091969580 Transf. Leyla Soraya Gaibur Becerra', '30/01/2026', '3,593,621', '000000000', 'AGUSTINAS', 'A'],
    ['-100,000', '0650843843 Transf a FUNDACION CAMDES', '28/01/2026', '2,915,151', '000000000', 'AGUSTINAS', 'C'],
    ['98,470', 'Depósito en Efectivo', '29/01/2026', '3,278,621', '123456789', 'PRINCIPE DE GALES', 'A'],
    ['', '', '', '', '', '', ''],
  ];
}

// ─── Test Data: Banco de Chile ──────────────────────────────────────────────

function makeBancoChileRows(): unknown[][] {
  return [
    ['BANCO EDWARDS | Citi', '', '', '', '', '', ''],
    ['Estado de Cuenta', '', '', '', '', '', ''],
    ['SR(A)(ES)', '', '', '', '', '', ''],
    ['CORPORACION ANGLICANA DE CHILE', '', '', '', '', '', ''],
    ['EJECUTIVO DE CUENTA', ':', 'Esteban Ignacio Carballal Rome', '', 'N° DE CUENTA', ':', '3868907153'],
    ['SUCURSAL', ':', 'OFICINA MONEDA', '', 'MONEDA', ':', 'PESOS'],
    ['TELEFONO', ':', '56224681410', '', 'DESDE', ':', '30/12/2025'],
    ['', '', '', '', 'HASTA', ':', '30/01/2026'],
    ['FECHA DIA/MES', 'DETALLE DE TRANSACCION', 'SUCURSAL', 'N° DOCTO', 'MONTO CHEQUES O CARGOS', 'MONTO DEPOSITOS O ABONOS', 'SALDO'],
    ['30/12', 'SALDO INICIAL', '', '', '', '', '9.575.509'],
    ['02/01', 'TRASPASO DE:Daniel Esteban Jaque S', 'INTERNET', '', '', '10.000', '9.585.509'],
    ['05/01', 'TRASPASO DE:Philip Gordon Brundell', 'INTERNET', '', '', '45.000', '9.630.509'],
    ['05/01', 'TRASPASO DE:MARIOLY LOURDES LOPEZ', 'INTERNET', '', '', '10.000', '9.640.509'],
    ['23/01', 'PAC ENEL DISTRIBUCION CHILE S.A.', 'CENTRAL', '', '121.742', '', '9.518.767'],
    ['30/01', 'SALDO FINAL', '', '', '', '', '9.518.767'],
    ['', '', '', '', '', '', ''],
    ['RETENCION A 1 DIA', '', '', 'RETENCION A MAS DE 1 DIA', '', 'SALDO DISPONIBLE A LA FECHA', ''],
    ['DEPOSITOS', 'CHEQUES', '', 'OTROS ABONOS', 'OTROS CARGOS', 'GIROS CAJERO AUTOMATICO', 'IMPUESTOS'],
  ];
}

// ─── Test Data: Generic/Unknown ─────────────────────────────────────────────

function makeGenericRows(): unknown[][] {
  return [
    ['Fecha', 'Descripcion', 'Monto', 'Referencia'],
    ['01/01/2026', 'Pago servicio', '50000', 'REF001'],
    ['02/01/2026', 'Deposito', '100000', 'REF002'],
  ];
}

// ─── Detection Tests ────────────────────────────────────────────────────────

describe('detectBank', () => {
  it('detects Santander from content signatures', () => {
    const result = detectBank(makeSantanderRows());
    expect(result).not.toBeNull();
    expect(result!.profile.id).toBe('santander');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects Banco de Chile from content signatures', () => {
    const result = detectBank(makeBancoChileRows());
    expect(result).not.toBeNull();
    expect(result!.profile.id).toBe('banco_chile');
    expect(result!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('returns null for unknown/generic files', () => {
    const result = detectBank(makeGenericRows());
    expect(result).toBeNull();
  });

  it('returns null for empty data', () => {
    expect(detectBank([])).toBeNull();
  });

  it('returns null for very short data', () => {
    expect(detectBank([['hello']])).toBeNull();
  });
});

describe('getBankProfile', () => {
  it('returns Santander profile by id', () => {
    const profile = getBankProfile('santander');
    expect(profile).toBeDefined();
    expect(profile!.displayName).toBe('Banco Santander');
  });

  it('returns Banco de Chile profile by id', () => {
    const profile = getBankProfile('banco_chile');
    expect(profile).toBeDefined();
    expect(profile!.displayName).toBe('Banco de Chile');
  });

  it('returns undefined for unknown id', () => {
    expect(getBankProfile('bci')).toBeUndefined();
  });
});

// ─── Santander Preprocessing Tests ──────────────────────────────────────────

describe('Santander preprocessor', () => {
  const profile = BANK_PROFILES.find((p) => p.id === 'santander')!;

  it('strips metadata header rows and extracts data', () => {
    const result = profile.preprocess(makeSantanderRows());
    // Should have 3 data rows (the empty row at end is skipped)
    expect(result.rows.length).toBe(3);
  });

  it('produces correct output headers', () => {
    const result = profile.preprocess(makeSantanderRows());
    expect(result.headers).toEqual(['FECHA', 'DESCRIPCION', 'MONTO', 'REFERENCIA']);
  });

  it('normalizes comma-thousands amounts correctly', () => {
    const result = profile.preprocess(makeSantanderRows());
    // First row: 40,000 Abono → +40000
    expect(parseInt(result.rows[0].MONTO, 10)).toBe(40000);
    // Second row: -100,000 Cargo → -100000
    expect(parseInt(result.rows[1].MONTO, 10)).toBe(-100000);
    // Third row: 98,470 Abono → +98470
    expect(parseInt(result.rows[2].MONTO, 10)).toBe(98470);
  });

  it('applies CARGO/ABONO sign correctly', () => {
    const result = profile.preprocess(makeSantanderRows());
    // Abono row should be positive
    expect(parseInt(result.rows[0].MONTO, 10)).toBeGreaterThan(0);
    // Cargo row should be negative
    expect(parseInt(result.rows[1].MONTO, 10)).toBeLessThan(0);
  });

  it('normalizes dates to YYYY-MM-DD', () => {
    const result = profile.preprocess(makeSantanderRows());
    expect(result.rows[0].FECHA).toBe('2026-01-30');
    expect(result.rows[1].FECHA).toBe('2026-01-28');
  });

  it('extracts metadata', () => {
    const result = profile.preprocess(makeSantanderRows());
    expect(result.metadata.bankName).toBe('Banco Santander');
    expect(result.metadata.rut).toBe('70.043.500-8');
  });

  it('strips all-zero document references', () => {
    const result = profile.preprocess(makeSantanderRows());
    // First two rows have 000000000 — should be empty
    expect(result.rows[0].REFERENCIA).toBe('');
    expect(result.rows[1].REFERENCIA).toBe('');
    // Third row has 123456789 — should be preserved
    expect(result.rows[2].REFERENCIA).toBe('123456789');
  });

  it('provides pre-computed column mapping with confidence 1.0', () => {
    const result = profile.preprocess(makeSantanderRows());
    expect(result.columnMapping.confidence).toBe(1.0);
    expect(result.columnMapping.date).toBe('FECHA');
    expect(result.columnMapping.description).toBe('DESCRIPCION');
    expect(result.columnMapping.amount).toBe('MONTO');
  });

  it('throws when header row is not found', () => {
    const badRows = [['Random data', 'more stuff'], ['foo', 'bar']];
    expect(() => profile.preprocess(badRows)).toThrow('cabeceras de Banco Santander');
  });
});

// ─── Banco de Chile Preprocessing Tests ─────────────────────────────────────

describe('Banco de Chile preprocessor', () => {
  const profile = BANK_PROFILES.find((p) => p.id === 'banco_chile')!;

  it('strips metadata and extracts data rows', () => {
    const result = profile.preprocess(makeBancoChileRows(), 2026);
    // 4 real transactions: 3 transfers + 1 PAC (SALDO INICIAL/FINAL + footer rows skipped)
    expect(result.rows.length).toBe(4);
  });

  it('produces correct output headers', () => {
    const result = profile.preprocess(makeBancoChileRows(), 2026);
    expect(result.headers).toEqual(['FECHA', 'DESCRIPCION', 'CARGO', 'ABONO', 'REFERENCIA']);
  });

  it('skips SALDO INICIAL and SALDO FINAL rows', () => {
    const result = profile.preprocess(makeBancoChileRows(), 2026);
    const descriptions = result.rows.map((r) => r.DESCRIPCION);
    expect(descriptions).not.toContain('SALDO INICIAL');
    expect(descriptions).not.toContain('SALDO FINAL');
  });

  it('injects year into DD/MM dates', () => {
    const result = profile.preprocess(makeBancoChileRows(), 2026);
    // 02/01 with fallback year 2026 → 2026-01-02
    expect(result.rows[0].FECHA).toBe('2026-01-02');
    expect(result.rows[1].FECHA).toBe('2026-01-05');
  });

  it('maps debit amounts to CARGO column', () => {
    const result = profile.preprocess(makeBancoChileRows(), 2026);
    // PAC ENEL has 121.742 in cargo column
    const enelRow = result.rows.find((r) => r.DESCRIPCION.includes('PAC ENEL'));
    expect(enelRow).toBeDefined();
    expect(enelRow!.CARGO).toBe('121.742');
    expect(enelRow!.ABONO).toBe('');
  });

  it('maps credit amounts to ABONO column', () => {
    const result = profile.preprocess(makeBancoChileRows(), 2026);
    // First data row (Daniel Esteban) has 10.000 in abono column
    expect(result.rows[0].ABONO).toBe('10.000');
    expect(result.rows[0].CARGO).toBe('');
  });

  it('provides pre-computed column mapping with split debit/credit', () => {
    const result = profile.preprocess(makeBancoChileRows(), 2026);
    expect(result.columnMapping.confidence).toBe(1.0);
    expect(result.columnMapping.amount).toBeNull();
    expect(result.columnMapping.amountDebit).toBe('CARGO');
    expect(result.columnMapping.amountCredit).toBe('ABONO');
  });

  it('infers year from file content when HASTA date is present', () => {
    const result = profile.preprocess(makeBancoChileRows());
    // The HASTA row has 30/01/2026 so inferredYear should be 2026
    expect(result.metadata.inferredYear).toBe(2026);
  });

  it('throws when header row is not found', () => {
    const badRows = [['Random data'], ['foo']];
    expect(() => profile.preprocess(badRows)).toThrow('cabeceras de Banco de Chile');
  });
});

// ─── BANK_PROFILES Registry Tests ───────────────────────────────────────────

describe('BANK_PROFILES registry', () => {
  it('contains at least 2 profiles', () => {
    expect(BANK_PROFILES.length).toBeGreaterThanOrEqual(2);
  });

  it('all profiles have unique ids', () => {
    const ids = BANK_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all profiles have displayName', () => {
    for (const profile of BANK_PROFILES) {
      expect(profile.displayName.length).toBeGreaterThan(0);
    }
  });
});
