/**
 * Deterministic FNV-1a hash helper for DraftPatch snapshots (A3/S4).
 *
 * Pure, dependency-free. Produces the same hash for structurally equal
 * inputs regardless of JS key insertion order by sorting keys before
 * serializing. Used by CuentacuentoEditor builder closures to compute
 * the contentHash passed to enqueueGeneratedSnapshot.provenance.
 */

/**
 * JSON.stringify with keys sorted recursively. Ensures structural equality
 * produces identical strings regardless of key insertion order.
 */
export function sortedJsonStringify(value: unknown): string {
  // JSON.stringify(undefined) returns undefined (not a string); emit the
  // literal token 'undefined' so null and undefined hash distinctly.
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map(sortedJsonStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
  const pairs = sortedKeys.map(
    (k) =>
      JSON.stringify(k) +
      ':' +
      sortedJsonStringify((value as Record<string, unknown>)[k])
  );
  return '{' + pairs.join(',') + '}';
}

/**
 * FNV-1a 32-bit hash of a snapshot value. Keys are sorted before
 * serialization so hash(a) === hash(b) whenever a and b are structurally
 * equal (same keys and values, any insertion order).
 *
 * Returns an 8-character lowercase hex string.
 */
export function hashSnapshot(snapshot: unknown): string {
  const str = sortedJsonStringify(snapshot);
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    // FNV prime 0x01000193 with 32-bit unsigned wrapping
    hash = (Math.imul(hash, 0x01000193) >>> 0);
  }
  return hash.toString(16).padStart(8, '0');
}
