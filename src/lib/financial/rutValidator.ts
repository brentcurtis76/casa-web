/**
 * Chilean RUT (Rol Único Tributario) Validation
 *
 * Format: XX.XXX.XXX-V where V is check digit (0-9 or K)
 *
 * Algorithm (modulo 11):
 * 1. Strip dots and dash, separate body from check digit
 * 2. Multiply each digit of body by weights [2,3,4,5,6,7] cycling from right
 * 3. Sum products, compute 11 - (sum % 11)
 * 4. If result is 11 → check digit is '0', if 10 → 'K', else the digit
 */

/**
 * Strips all dots and dashes from a RUT string, returns digits + check digit.
 * e.g., "12.345.678-5" → "123456785"
 */
export function cleanRut(rut: string): string {
  return rut.replace(/[.\-]/g, '').trim().toUpperCase();
}

/**
 * Formats a clean RUT string into "XX.XXX.XXX-V" format.
 * Input can be with or without dots/dashes.
 */
export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const checkDigit = clean.slice(-1);

  // Add dots every 3 digits from the right
  let formatted = '';
  for (let i = body.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = body[i] + formatted;
  }

  return `${formatted}-${checkDigit}`;
}

/**
 * Calculates the expected check digit for a RUT body.
 */
function calculateCheckDigit(body: string): string {
  const weights = [2, 3, 4, 5, 6, 7];
  let sum = 0;

  for (let i = body.length - 1, w = 0; i >= 0; i--, w++) {
    sum += parseInt(body[i], 10) * weights[w % weights.length];
  }

  const remainder = 11 - (sum % 11);

  if (remainder === 11) return '0';
  if (remainder === 10) return 'K';
  return String(remainder);
}

/**
 * Validates a Chilean RUT using the modulo 11 algorithm.
 * Accepts formats: "12.345.678-5", "12345678-5", "123456785"
 */
export function validateRut(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false;

  const clean = cleanRut(rut);

  // Must have at least 2 characters (1 digit body + 1 check digit)
  if (clean.length < 2) return false;

  // Check digit is the last character
  const body = clean.slice(0, -1);
  const providedCheck = clean.slice(-1).toUpperCase();

  // Body must be all digits
  if (!/^\d+$/.test(body)) return false;

  // Check digit must be a digit or 'K'
  if (!/^[0-9K]$/.test(providedCheck)) return false;

  // Calculate expected check digit
  const expectedCheck = calculateCheckDigit(body);

  return providedCheck === expectedCheck;
}
