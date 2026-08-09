// D6 — the canonical main-dish rule lives in supabase/functions/_shared and the
// front end imports THAT file, by relative path, rather than keeping a second
// copy of the quota in sync by hand.
//
// This is the front-end half of the proof: the module is a zero-import leaf, so
// Vite and tsc resolve it with no alias, no tsconfig entry and no build step.
// The `vite build` proof belongs to P6, the first production consumer (D6).
//
// The case table below is test 1 of supabase/functions/_shared/mainDish_test.ts,
// verbatim. If the two ever disagree, the rule has been forked — which is the
// one thing D6 exists to prevent.

import { describe, expect, it } from 'vitest';

import {
  requiredMainDishes,
  SIDE_FOODS,
} from '../../../../supabase/functions/_shared/mainDish.ts';

const CASES: Array<[people: number, required: number]> = [
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 1],
  [5, 1],
  [6, 2],
  [7, 2],
  [8, 2],
  [9, 2],
  [10, 2],
  [11, 3],
  [12, 3],
  [13, 3],
  [14, 3],
  [15, 3],
];

describe('mainDish — regla canónica compartida (D6)', () => {
  it('la regla es importable desde el frontend y coincide con la tabla de casos del test 1', () => {
    for (const [people, required] of CASES) {
      expect(requiredMainDishes(people)).toBe(required);
    }

    const sides: readonly string[] = SIDE_FOODS;
    expect(sides).not.toContain('main_course');
    expect(sides).toHaveLength(3);
  });
});
