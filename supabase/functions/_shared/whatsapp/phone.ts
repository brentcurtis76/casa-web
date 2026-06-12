// Chile phone normalization — Deno-side copy of src/lib/whatsapp/phone.ts.
// Pure helpers, no imports. Keep in sync with src/lib/whatsapp/phone.ts.

export type NormalizedPhone = {
  ok: true;
  e164: string;
  display: string;
};

export type NormalizationError = {
  ok: false;
  reason: string;
};

export type PhoneResult = NormalizedPhone | NormalizationError;

const DIGITS_ONLY = /[^\d]/g;

export function normalizeChilePhone(input: string | null | undefined): PhoneResult {
  if (!input) return { ok: false, reason: "Sin número de teléfono" };

  const digits = String(input).replace(DIGITS_ONLY, "");

  if (digits.length === 0) {
    return { ok: false, reason: "Sin dígitos en el número" };
  }

  let e164: string;

  if (digits.startsWith("569") && digits.length === 11) {
    e164 = digits;
  } else if (digits.startsWith("56") && digits.length === 11) {
    if (digits[2] !== "9") {
      return {
        ok: false,
        reason: "Solo se aceptan móviles chilenos (deben empezar con 9)",
      };
    }
    e164 = digits;
  } else if (digits.startsWith("9") && digits.length === 9) {
    e164 = `56${digits}`;
  } else if (digits.length === 8) {
    return { ok: false, reason: "Número incompleto, falta el prefijo móvil 9" };
  } else {
    return { ok: false, reason: `Formato no reconocido (${digits.length} dígitos)` };
  }

  if (!/^569\d{8}$/.test(e164)) {
    return { ok: false, reason: "No se pudo normalizar a +56 9 XXXX XXXX" };
  }

  const a = e164.slice(3, 7);
  const b = e164.slice(7);
  return { ok: true, e164, display: `+56 9 ${a} ${b}` };
}
