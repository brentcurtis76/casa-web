// Conformance suite for the edge-function canonical materials list (M-D5).
//
// V1–V11 are implemented verbatim from "PLAN-MATERIALES §Conformance vectors".
// Beyond the vectors this suite proves the two properties the plan freezes:
//   * fixed point   — sanitize(sanitize(x)) === sanitize(x) for EVERY vector input
//   * idempotence   — sanitize(v) === v for every canonical OUTPUT
// plus the trust-boundary rules that are Deno-only (lenient input, non-strings).

import { assertEquals, assertNotEquals } from "@std/assert";

import {
  MAX_AVAILABLE_MATERIALS,
  MAX_MATERIAL_NAME_LENGTH,
  sanitizeAvailableMaterials,
} from "./availableMaterials.ts";

// Built, never pasted: a literal NUL does not survive round-tripping through
// editing tools, and a U+0000 escape is not guaranteed to survive either.
const NUL = String.fromCharCode(0);

const m = (n: number) => `m${String(n).padStart(2, "0")}`;

interface Vector {
  id: string;
  input: unknown[];
  expected: string[];
}

const VECTORS: Vector[] = [
  {
    id: "V1 — 61 distinct names m01…m61 keep the first 60 in order",
    input: Array.from({ length: 61 }, (_, i) => m(i + 1)),
    expected: Array.from({ length: 60 }, (_, i) => m(i + 1)),
  },
  {
    id: "V2 — a 121-code-unit name keeps its first 120 code units",
    input: ["a".repeat(121)],
    expected: ["a".repeat(120)],
  },
  {
    id: "V3 — an embedded newline becomes a space",
    input: ["témpera\n## Nueva Sección"],
    expected: ["témpera ## Nueva Sección"],
  },
  {
    id: "V4 — case-insensitive dedupe keeps the first occurrence",
    input: ["Papel", "papel", " PAPEL "],
    expected: ["Papel"],
  },
  {
    id: "V5 — whitespace runs collapse and the value is trimmed",
    input: ["  lápices   de   colores  "],
    expected: ["lápices de colores"],
  },
  {
    id: "V6 — whitespace-only entries are dropped",
    input: ["   ", "\t\n"],
    expected: [],
  },
  {
    id: "V7 — empty strings are dropped, survivors keep their order",
    input: ["papel", "", "tijeras"],
    expected: ["papel", "tijeras"],
  },
  {
    id: "V8 — the list is never sorted",
    input: ["c", "a", "b"],
    expected: ["c", "a", "b"],
  },
  {
    id: "V9 — truncation landing on a space is re-trimmed away",
    input: ["a".repeat(119) + " bc"],
    expected: ["a".repeat(119)],
  },
  {
    id: "V10 — a control char becomes a space (whitespace collapse alone cannot)",
    input: ["papel" + NUL + "rojo"],
    expected: ["papel rojo"],
  },
  {
    id: "V11 — accented case pair folds via locale-less toLowerCase()",
    input: ["Témpera", "témpera"],
    expected: ["Témpera"],
  },
];

Deno.test("[A6] exported caps match the frozen M-D5 constants", () => {
  assertEquals(MAX_AVAILABLE_MATERIALS, 60);
  assertEquals(MAX_MATERIAL_NAME_LENGTH, 120);
});

Deno.test("[A6] V9 input really is 122 UTF-16 code units in ONE string", () => {
  const [only] = VECTORS.find((v) => v.id.startsWith("V9"))!.input as string[];
  assertEquals(only.length, 122);
});

Deno.test("[A6] V10 input really carries a U+0000 control char", () => {
  const [only] = VECTORS.find((v) => v.id.startsWith("V10"))!.input as string[];
  assertEquals(only.charCodeAt(5), 0);
  // The char is not whitespace, so step 2 alone provably cannot produce the
  // canonical output — this is what makes V10 the control-step mutation witness.
  assertNotEquals(only.replace(/\s+/g, " ").trim(), "papel rojo");
});

for (const vector of VECTORS) {
  Deno.test(`[A6] ${vector.id}`, () => {
    assertEquals(sanitizeAvailableMaterials(vector.input), vector.expected);
  });

  Deno.test(`[A6] fixed point — sanitize(sanitize(x)) === sanitize(x) for ${vector.id}`, () => {
    const once = sanitizeAvailableMaterials(vector.input);
    assertEquals(sanitizeAvailableMaterials(once), once);
  });

  Deno.test(`[A6] idempotence — sanitize(canonical output) === canonical output for ${vector.id}`, () => {
    assertEquals(sanitizeAvailableMaterials(vector.expected), vector.expected);
  });
}

Deno.test("[A6] undefined / null / non-array input yields an empty list", () => {
  assertEquals(sanitizeAvailableMaterials(undefined), []);
  assertEquals(sanitizeAvailableMaterials(null), []);
  assertEquals(sanitizeAvailableMaterials("papel"), []);
  assertEquals(sanitizeAvailableMaterials(7), []);
  assertEquals(sanitizeAvailableMaterials({ 0: "papel", length: 1 }), []);
});

Deno.test("[A6] non-string entries are dropped, strings around them survive", () => {
  assertEquals(
    sanitizeAvailableMaterials(["papel", 7, null, undefined, { name: "tijeras" }, ["cinta"], "goma"]),
    ["papel", "goma"],
  );
  assertEquals(sanitizeAvailableMaterials([1, 2, 3]), []);
});

Deno.test("[A6] the cap counts canonical entries, not raw ones", () => {
  // 60 distinct names + 60 case variants of the same names: dedupe must run
  // BEFORE the cap, so all 60 distinct names survive.
  const distinct = Array.from({ length: 60 }, (_, i) => m(i + 1));
  const withDuplicates = [...distinct, ...distinct.map((name) => name.toUpperCase())];
  assertEquals(sanitizeAvailableMaterials(withDuplicates), distinct);
});
