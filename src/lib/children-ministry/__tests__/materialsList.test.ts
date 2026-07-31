/**
 * Conformance suite for the front-end canonical materials list (M-D5).
 *
 * V1–V11 are implemented verbatim from "PLAN-MATERIALES §Conformance vectors",
 * mirroring the Deno suite in `supabase/functions/_shared/availableMaterials_test.ts`
 * so the two implementations of the one algorithm are provably in agreement.
 * Beyond the vectors this suite proves the FE fixed point
 * `canonical(canonical(x)) === canonical(x)` for EVERY vector input.
 */

import { describe, it, expect } from 'vitest';

import {
  MAX_AVAILABLE_MATERIALS,
  MAX_MATERIAL_NAME_LENGTH,
  buildEffectiveMaterialsList,
} from '@/lib/children-ministry/materialsList';

// Built, never pasted: a literal NUL does not survive round-tripping through
// editing tools, and a U+0000 escape is not guaranteed to survive either.
const NUL = String.fromCharCode(0);

const m = (n: number) => `m${String(n).padStart(2, '0')}`;

interface Vector {
  id: string;
  input: string[];
  expected: string[];
}

const VECTORS: Vector[] = [
  {
    id: 'V1 — 61 distinct names m01…m61 keep the first 60 in order',
    input: Array.from({ length: 61 }, (_, i) => m(i + 1)),
    expected: Array.from({ length: 60 }, (_, i) => m(i + 1)),
  },
  {
    id: 'V2 — a 121-code-unit name keeps its first 120 code units',
    input: ['a'.repeat(121)],
    expected: ['a'.repeat(120)],
  },
  {
    id: 'V3 — an embedded newline becomes a space',
    input: ['témpera\n## Nueva Sección'],
    expected: ['témpera ## Nueva Sección'],
  },
  {
    id: 'V4 — case-insensitive dedupe keeps the first occurrence',
    input: ['Papel', 'papel', ' PAPEL '],
    expected: ['Papel'],
  },
  {
    id: 'V5 — whitespace runs collapse and the value is trimmed',
    input: ['  lápices   de   colores  '],
    expected: ['lápices de colores'],
  },
  {
    id: 'V6 — whitespace-only entries are dropped',
    input: ['   ', '\t\n'],
    expected: [],
  },
  {
    id: 'V7 — empty strings are dropped, survivors keep their order',
    input: ['papel', '', 'tijeras'],
    expected: ['papel', 'tijeras'],
  },
  {
    id: 'V8 — the list is never sorted',
    input: ['c', 'a', 'b'],
    expected: ['c', 'a', 'b'],
  },
  {
    id: 'V9 — truncation landing on a space is re-trimmed away',
    input: ['a'.repeat(119) + ' bc'],
    expected: ['a'.repeat(119)],
  },
  {
    id: 'V10 — a control char becomes a space (whitespace collapse alone cannot)',
    input: ['papel' + NUL + 'rojo'],
    expected: ['papel rojo'],
  },
  {
    id: 'V11 — accented case pair folds via locale-less toLowerCase()',
    input: ['Témpera', 'témpera'],
    expected: ['Témpera'],
  },
];

describe('[A2] buildEffectiveMaterialsList — §Conformance vectors', () => {
  it('exports caps that match the frozen M-D5 constants', () => {
    expect(MAX_AVAILABLE_MATERIALS).toBe(60);
    expect(MAX_MATERIAL_NAME_LENGTH).toBe(120);
  });

  it('V9 input really is 122 UTF-16 code units in ONE string', () => {
    const [only] = VECTORS.find((v) => v.id.startsWith('V9'))!.input;
    expect(only.length).toBe(122);
  });

  it('V10 input really carries a U+0000 control char', () => {
    const [only] = VECTORS.find((v) => v.id.startsWith('V10'))!.input;
    expect(only.charCodeAt(5)).toBe(0);
    // The char is not whitespace, so step 2 alone provably cannot produce the
    // canonical output — this is what makes V10 the control-step mutation witness.
    expect(only.replace(/\s+/g, ' ').trim()).not.toBe('papel rojo');
  });

  for (const vector of VECTORS) {
    it(vector.id, () => {
      expect(buildEffectiveMaterialsList(vector.input)).toEqual(vector.expected);
    });

    it(`fixed point — canonical(canonical(x)) === canonical(x) for ${vector.id}`, () => {
      const once = buildEffectiveMaterialsList(vector.input);
      expect(buildEffectiveMaterialsList(once)).toEqual(once);
    });

    it(`idempotence — canonical(expected output) === expected output for ${vector.id}`, () => {
      expect(buildEffectiveMaterialsList(vector.expected)).toEqual(vector.expected);
    });
  }

  it('an empty input list yields an empty canonical list', () => {
    expect(buildEffectiveMaterialsList([])).toEqual([]);
  });

  it('the cap counts canonical entries, not raw ones', () => {
    // A duplicate sits AHEAD of the last distinct name, so a raw-first-60 cap
    // would drop `m60` — only a dedupe-before-cap implementation keeps all 60.
    const distinct = Array.from({ length: 60 }, (_, i) => m(i + 1));
    const withDuplicates = [...distinct.slice(0, 59), 'M01', distinct[59]];
    expect(withDuplicates).toHaveLength(61);
    expect(buildEffectiveMaterialsList(withDuplicates)).toEqual(distinct);
  });
});
