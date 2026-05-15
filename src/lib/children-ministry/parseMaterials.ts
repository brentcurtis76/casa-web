/**
 * Materials serialization/parsing helpers for children's lessons.
 *
 * `materials_needed` is stored as a single text column in the DB. New writes
 * use a newline delimiter so items containing commas (e.g. "papel (rojo, azul)")
 * round-trip cleanly. Legacy rows use a comma-joined format and must still
 * parse correctly — including items with commas inside parentheses.
 */

export function serializeMaterials(materials: readonly string[]): string | null {
  const cleaned = materials.map((m) => m.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join('\n') : null;
}

export function parseMaterials(raw: string | null | undefined): string[] {
  if (!raw) return [];

  if (raw.includes('\n')) {
    return raw.split(/\r?\n/).map((m) => m.trim()).filter(Boolean);
  }

  // Legacy comma-joined format. Walk char-by-char so commas inside
  // parentheses (any depth) are not treated as separators.
  const items: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of raw) {
    if (ch === '(') {
      depth++;
      buf += ch;
    } else if (ch === ')') {
      if (depth > 0) depth--;
      buf += ch;
    } else if (ch === ',' && depth === 0) {
      items.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  items.push(buf);

  return items.map((m) => m.trim()).filter(Boolean);
}
