/**
 * Canonical "materiales disponibles" list — front-end implementation of the
 * M-D5 algorithm (PLAN-MATERIALES).
 *
 * This is the product contract: it runs BEFORE invoke and BEFORE persistence,
 * so the UI's effective list, the Edge Function body and the per-lesson
 * snapshot are the same list. The Deno twin in
 * `supabase/functions/_shared/availableMaterials.ts` stays the trust boundary
 * (it additionally tolerates malformed payloads and drops non-string entries);
 * both implement the same algorithm and pass the same conformance vectors.
 *
 * Applied per item IN THIS ORDER:
 *   1. replace control chars U+0000–U+001F / U+007F–U+009F with a space
 *   2. collapse whitespace runs to a single space
 *   3. trim
 *   4. drop empties
 *   5. truncate to MAX_MATERIAL_NAME_LENGTH UTF-16 code units, then trim again
 *      and drop if empty
 *   6. case-insensitive dedupe on the truncated value via locale-less
 *      toLowerCase(), first occurrence wins
 *   7. cap the list at MAX_AVAILABLE_MATERIALS
 *
 * Input order is preserved throughout, and the function is a fixed point:
 * buildEffectiveMaterialsList(buildEffectiveMaterialsList(x)) equals
 * buildEffectiveMaterialsList(x).
 */

/** Hard cap on how many materials reach the prompt. */
export const MAX_AVAILABLE_MATERIALS = 60;

/** Hard cap on a single material name, in UTF-16 code units. */
export const MAX_MATERIAL_NAME_LENGTH = 120;

const WHITESPACE_RUNS = /\s+/g;

// Step 1. Written as an explicit code-unit scan rather than a character-class
// regex: the range is exactly U+0000–U+001F / U+007F–U+009F, and a regex
// literal spelling it out trips `no-control-regex`. Scanning UTF-16 code units
// also matches the unit M-D5 freezes for truncation — surrogate halves start at
// U+D800 and so are never touched.
function replaceControlCharsWithSpace(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const isControl = code <= 0x1f || (code >= 0x7f && code <= 0x9f);
    out += isControl ? ' ' : value[i];
  }
  return out;
}

/**
 * Reduce a list of material names to the canonical effective list. Callers are
 * responsible for handing in strings — the untrusted-payload cases (non-array
 * input, non-string entries) belong to the Edge Function copy.
 */
export function buildEffectiveMaterialsList(names: string[]): string[] {
  const seen = new Set<string>();
  const canonical: string[] = [];

  for (const entry of names) {
    // Steps 1–4.
    const normalized = replaceControlCharsWithSpace(entry).replace(WHITESPACE_RUNS, ' ').trim();
    if (!normalized) continue;

    // Step 5 — truncation can land on a space, so re-trim and re-drop.
    const truncated = normalized.slice(0, MAX_MATERIAL_NAME_LENGTH).trim();
    if (!truncated) continue;

    // Step 6.
    const key = truncated.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    canonical.push(truncated);
  }

  // Step 7.
  return canonical.slice(0, MAX_AVAILABLE_MATERIALS);
}
