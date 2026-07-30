/**
 * PB / G6 — DIVERGENCIAS DECLARADAS respecto del comportamiento base 185c370.
 *
 * Cada entrada es case-local y dice tres cosas, tal como exige G6:
 *   - `oldValue`: el resultado que el fixture base capturó (NO se edita jamás:
 *     si el fixture ya no lo contiene, el comparador falla);
 *   - `newValue`: el resultado que PB EXIGE después del cambio;
 *   - `reason`: la regla de G2/G3/G4 que la autoriza.
 *
 * Todo lo que no esté acá debe coincidir byte a byte con la base. Una
 * diferencia no declarada es un FINDING, no una divergencia.
 *
 * Este archivo se llena al ejecutar la fase (commit del rewire), no en el
 * commit de captura: en el momento de capturar, producción es la base y no hay
 * ninguna divergencia todavía.
 */

export interface DeclaredDivergence {
  /** Id exacto del caso en el fixture. */
  case: string;
  /** Path con puntos dentro del `CaseRecord`. */
  path: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

export const DIVERGENCES: DeclaredDivergence[] = [];
