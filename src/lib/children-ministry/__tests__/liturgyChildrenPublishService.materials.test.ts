/**
 * Liturgy Children Publish Service — `availableMaterials` contract
 *
 * The one thing this suite proves is the [B1] equality: for a single publish
 * call the UI's list, the Edge Function body and the persisted snapshot are the
 * SAME canonical list, and for a refine the stored snapshot and the refine body
 * are the SAME canonical list. It therefore mocks ONLY the persistence
 * collaborators and the Supabase client — the service and `materialsList` under
 * test are the real ones, so a canonicalization that only happened in a mock
 * would not be able to make these assertions pass.
 *
 * The orchestration behaviour itself (multi-group, partial failure, idempotency)
 * is covered by `liturgyChildrenPublishService.test.ts`; this file only adds the
 * materials leg (PLAN-MATERIALES M-D2/M-D3/M-D5/M-D11).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildrenAgeGroupRow } from '@/types/childrenMinistry';
import type {
  GenerateChildrenLessonResponse,
  RefinementType,
} from '@/types/childrenPublicationState';

// ─── Mocks for collaborator modules ─────────────────────────────────────────

vi.mock('@/lib/children-ministry/childrenPublicationStateService', () => ({
  getPublicationByLiturgyAndAgeGroup: vi.fn(),
  createPublication: vi.fn(),
  incrementPublishVersion: vi.fn(),
}));

vi.mock('@/lib/children-ministry/lessonService', () => ({
  getLesson: vi.fn(),
  getLessonByLiturgyAndAgeGroup: vi.fn(),
  createLesson: vi.fn(),
  updateLesson: vi.fn(),
  upsertLessonMaterialByType: vi.fn(),
}));

vi.mock('@/lib/children-ministry/calendarService', () => ({
  getSessionByDateAndAgeGroup: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
}));

// Override the global supabase mock from src/test/setup.ts with one that
// exposes the exact shape this service touches.
// Each mock declares the signature the service actually calls it with: a bare
// `vi.fn()` infers a zero-argument type, which makes every wrapper below a tsc
// error even though the runtime behaviour is fine.
const invokeMock =
  vi.fn<(name: string, options: { body: Record<string, unknown> }) => Promise<unknown>>();
const getUserMock = vi.fn();
const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();
const maybeSingleMock = vi.fn();
const eqMock = vi.fn<(column: string, value: string) => { maybeSingle: () => unknown }>(() => ({
  maybeSingle: () => maybeSingleMock(),
}));
const selectMock = vi.fn<
  (columns: string) => { eq: (column: string, value: string) => unknown }
>(() => ({
  eq: (column: string, value: string) => eqMock(column, value),
}));
const fromMock = vi.fn<(table: string) => { select: (columns: string) => unknown }>(() => ({
  select: (columns: string) => selectMock(columns),
}));

// The arrow wrappers are load-bearing: `vi.mock` factories are hoisted above
// these consts, so the factory may only READ them when it is finally invoked.
// Each wrapper mirrors the arity the service actually calls, which also keeps
// the spread-typing noise of `(...args: unknown[])` out of the tsc gate.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => getUserMock(),
      getSession: () => getSessionMock(),
      refreshSession: () => refreshSessionMock(),
    },
    functions: {
      invoke: (name: string, options: { body: Record<string, unknown> }) =>
        invokeMock(name, options),
    },
    from: (table: string) => fromMock(table),
  },
}));

import {
  publishChildrenActivities,
  refineChildrenActivity,
} from '@/lib/children-ministry/liturgyChildrenPublishService';
import { buildEffectiveMaterialsList } from '@/lib/children-ministry/materialsList';
import { getPublicationByLiturgyAndAgeGroup } from '@/lib/children-ministry/childrenPublicationStateService';
import {
  getLesson,
  getLessonByLiturgyAndAgeGroup,
  createLesson,
  updateLesson,
  upsertLessonMaterialByType,
} from '@/lib/children-ministry/lessonService';
import {
  getSessionByDateAndAgeGroup,
  createSession,
} from '@/lib/children-ministry/calendarService';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const ageGroups: ChildrenAgeGroupRow[] = [
  {
    id: 'ag-peq',
    name: 'Pequenos',
    min_age: 0,
    max_age: 4,
    display_order: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'ag-med',
    name: 'Medianos',
    min_age: 5,
    max_age: 8,
    display_order: 2,
    created_at: '2026-01-01T00:00:00Z',
  },
];

/**
 * A raw list whose canonical form provably differs from it (V4 dedupe + V5
 * whitespace collapse): if anything downstream forwarded the raw param instead
 * of the canonical list, these assertions could not pass.
 */
const RAW_MATERIALS = ['  Papel   Lustre  ', 'papel lustre', 'Tijeras'];
const CANONICAL_MATERIALS = ['Papel Lustre', 'Tijeras'];

/** V1-style over-cap input: 61 distinct names, of which exactly 60 may survive. */
const m = (n: number) => `m${String(n).padStart(2, '0')}`;
const OVER_CAP_MATERIALS = Array.from({ length: 61 }, (_, i) => m(i + 1));
const OVER_CAP_CANONICAL = Array.from({ length: 60 }, (_, i) => m(i + 1));

const ALL_REFINEMENT_TYPES: RefinementType[] = [
  'general',
  'materials',
  'duration',
  'adaptations',
  'phases',
  'spiritual',
  'volunteer',
  'tone',
];

function buildPublishParams(overrides?: {
  selectedAgeGroupIds?: string[];
  availableMaterials?: string[];
}) {
  return {
    liturgyId: 'lit-1',
    liturgyTitle: 'Domingo de Ramos',
    liturgySummary: 'Resumen',
    bibleText: 'Mateo 21',
    liturgyDate: '2026-03-29T00:00:00Z',
    storyData: {
      title: 'El Sembrador',
      summary: 'Una semilla',
      spiritualConnection: 'La fe',
      scenes: [{ text: 'Sembrador sale' }],
    },
    selectedAgeGroupIds: overrides?.selectedAgeGroupIds ?? ['ag-peq'],
    ageGroups,
    ...(overrides && 'availableMaterials' in overrides
      ? { availableMaterials: overrides.availableMaterials }
      : {}),
  };
}

function makeGeneratedResponse(): GenerateChildrenLessonResponse {
  return {
    success: true,
    activityName: 'Actividad generada',
    materials: ['semillas', 'macetas'],
    sequence: [
      { phase: 'movimiento', title: 'Mover', description: 'Mover', minutes: 8 },
      {
        phase: 'expresion_conversacion',
        title: 'Hablar',
        description: 'Hablar',
        minutes: 10,
      },
      {
        phase: 'reflexion_metaprendizaje',
        title: 'Reflexionar',
        description: 'Reflexionar',
        minutes: 8,
      },
    ],
    adaptations: { small: 's', medium: 'm', large: 'l', mixed: 'x' },
    volunteerPlan: { leader: 'L', support: 'S' },
    estimatedTotalMinutes: 26,
  };
}

/** The refined payload the EF returns; deliberately different from the stored one. */
function makeRefinedResponse() {
  return {
    success: true,
    activityName: 'Actividad refinada',
    materials: ['semillas'],
    sequence: [
      { phase: 'movimiento', title: 'Mover+', description: 'Mover+', minutes: 9 },
      {
        phase: 'expresion_conversacion',
        title: 'Hablar+',
        description: 'Hablar+',
        minutes: 9,
      },
      {
        phase: 'reflexion_metaprendizaje',
        title: 'Reflexionar+',
        description: 'Reflexionar+',
        minutes: 9,
      },
    ],
    adaptations: { small: 'S+', medium: 'M+', large: 'L+', mixed: 'X+' },
    volunteerPlan: { leader: 'L+', support: 'S+' },
    estimatedTotalMinutes: 27,
    refinementNotes: 'notas',
  };
}

/**
 * Stored lesson row for the refine path. `content` is passed as a raw object so
 * each test can describe exactly what the historical JSON looks like — including
 * hand-edited shapes the FE never wrote itself.
 */
function makeStoredLesson(content: unknown) {
  return {
    id: 'lesson-1',
    title: 'Actividad guardada',
    age_group_id: 'ag-peq',
    age_group: { name: 'Pequenos' },
    liturgy_id: 'lit-1',
    duration_minutes: 26,
    materials_needed: 'semillas\nmacetas',
    content: JSON.stringify(content),
  };
}

function storedContent(extra: Record<string, unknown> = {}) {
  return {
    sequence: makeGeneratedResponse().sequence,
    adaptations: makeGeneratedResponse().adaptations,
    volunteerPlan: makeGeneratedResponse().volunteerPlan,
    ...extra,
  };
}

// ─── Capture helpers ────────────────────────────────────────────────────────

/** The body handed to `functions.invoke` on call `index`. */
function invokeBody(index = 0): Record<string, unknown> {
  const call = invokeMock.mock.calls[index];
  return (call[1] as { body: Record<string, unknown> }).body;
}

/** The content JSON actually persisted by the create path. */
function persistedContent(): Record<string, unknown> {
  const insert = vi.mocked(createLesson).mock.calls[0][0];
  return JSON.parse(insert.content as string);
}

/** The content JSON actually persisted by the refine path. */
function rewrittenContent(): Record<string, unknown> {
  const patch = vi.mocked(updateLesson).mock.calls[0][1] as { content: string };
  return JSON.parse(patch.content);
}

// ─── Default happy-path stubs ───────────────────────────────────────────────

function installHappyPath() {
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  maybeSingleMock.mockResolvedValue({ data: { id: 'lit-1' }, error: null });
  getSessionMock.mockResolvedValue({
    data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } },
    error: null,
  });
  refreshSessionMock.mockResolvedValue({ error: null });

  vi.mocked(getLessonByLiturgyAndAgeGroup).mockResolvedValue(null);
  vi.mocked(getSessionByDateAndAgeGroup).mockResolvedValue(null);
  vi.mocked(getPublicationByLiturgyAndAgeGroup).mockResolvedValue(null);

  vi.mocked(createLesson).mockImplementation(
    async (insert) => ({ id: `lesson-${insert.age_group_id}` }) as never,
  );
  vi.mocked(updateLesson).mockImplementation(async (id) => ({ id }) as never);
  vi.mocked(upsertLessonMaterialByType).mockResolvedValue({ id: 'mat-1' } as never);
  vi.mocked(createSession).mockImplementation(async () => ({ id: 'cal-1' }) as never);

  invokeMock.mockResolvedValue({ data: makeGeneratedResponse(), error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  installHappyPath();
});

// ─── [A3] the invoke body carries the canonical list ─────────────────────────

describe('[A3] publishChildrenActivities — the Edge Function receives the CANONICAL list', () => {
  it('canonicalizes the raw param before invoking, never forwarding it as given', async () => {
    await publishChildrenActivities(
      buildPublishParams({ availableMaterials: RAW_MATERIALS }),
    );

    expect(invokeBody().availableMaterials).toEqual(CANONICAL_MATERIALS);
    // Guard the guard: the raw param really is a different list, so the
    // assertion above cannot be satisfied by forwarding it unchanged.
    expect(RAW_MATERIALS).not.toEqual(CANONICAL_MATERIALS);
    expect(invokeBody().availableMaterials).not.toEqual(RAW_MATERIALS);
  });

  it('caps an over-cap list at 60 before invoking', async () => {
    await publishChildrenActivities(
      buildPublishParams({ availableMaterials: OVER_CAP_MATERIALS }),
    );

    expect(invokeBody().availableMaterials).toEqual(OVER_CAP_CANONICAL);
    expect(invokeBody().availableMaterials).toHaveLength(60);
  });

  it('runs canonicalization ONCE per call and shares one identical list across groups', async () => {
    await publishChildrenActivities(
      buildPublishParams({
        selectedAgeGroupIds: ['ag-peq', 'ag-med'],
        availableMaterials: RAW_MATERIALS,
      }),
    );

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeBody(0).availableMaterials).toEqual(CANONICAL_MATERIALS);
    // Same array instance for every group: one canonicalization, not one per group.
    expect(invokeBody(1).availableMaterials).toBe(invokeBody(0).availableMaterials);
  });
});

// ─── [A4] snapshot === canonical === invoke body ─────────────────────────────

describe('[A4] publishChildrenActivities — persisted snapshot equals the invoke body', () => {
  it('persists the same canonical list it sent, asserted on both captures', async () => {
    await publishChildrenActivities(
      buildPublishParams({ availableMaterials: RAW_MATERIALS }),
    );

    const sent = invokeBody().availableMaterials;
    const stored = persistedContent().availableMaterials;

    expect(sent).toEqual(CANONICAL_MATERIALS);
    expect(stored).toEqual(CANONICAL_MATERIALS);
    // The [B1] equality itself, on the two real captures.
    expect(stored).toEqual(sent);
  });

  it('keeps the three model-owned keys alongside the snapshot', async () => {
    await publishChildrenActivities(
      buildPublishParams({ availableMaterials: RAW_MATERIALS }),
    );

    expect(Object.keys(persistedContent()).sort()).toEqual([
      'adaptations',
      'availableMaterials',
      'sequence',
      'volunteerPlan',
    ]);
  });
});

// ─── [A5] absent / empty / canonically-empty ⇒ no key at all ─────────────────

describe('[A5] publishChildrenActivities — no key when there is nothing to constrain with', () => {
  const emptyCases: Array<{ label: string; params: ReturnType<typeof buildPublishParams> }> = [
    { label: 'the param is omitted entirely', params: buildPublishParams() },
    {
      label: 'the param is an empty array',
      params: buildPublishParams({ availableMaterials: [] }),
    },
    {
      label: 'the param canonicalizes to empty (whitespace-only entries)',
      params: buildPublishParams({ availableMaterials: ['   ', '\t\n'] }),
    },
  ];

  for (const { label, params } of emptyCases) {
    it(`omits the key from the invoke body AND the content JSON when ${label}`, async () => {
      await publishChildrenActivities(params);

      expect(invokeBody()).not.toHaveProperty('availableMaterials');
      expect(persistedContent()).not.toHaveProperty('availableMaterials');
      // Absent, not present-and-undefined: M-D2 requires a byte-identical prompt.
      expect(Object.keys(invokeBody())).not.toContain('availableMaterials');
      expect(Object.keys(persistedContent())).not.toContain('availableMaterials');
    });
  }

  it('proves the canonically-empty case is not vacuous — that input really is non-empty', () => {
    expect(['   ', '\t\n']).toHaveLength(2);
    expect(buildEffectiveMaterialsList(['   ', '\t\n'])).toEqual([]);
  });
});

// ─── [A6] refine sends the canonical usable snapshot ─────────────────────────

describe('[A6] refineChildrenActivity — the usable snapshot reaches the Edge Function', () => {
  beforeEach(() => {
    invokeMock.mockResolvedValue({ data: makeRefinedResponse(), error: null });
  });

  it('sends the canonical snapshot for EVERY refinementType', async () => {
    for (const refinementType of ALL_REFINEMENT_TYPES) {
      vi.clearAllMocks();
      installHappyPath();
      invokeMock.mockResolvedValue({ data: makeRefinedResponse(), error: null });
      vi.mocked(getLesson).mockResolvedValue(
        makeStoredLesson(storedContent({ availableMaterials: RAW_MATERIALS })) as never,
      );

      const result = await refineChildrenActivity({
        lessonId: 'lesson-1',
        feedback: 'más movimiento',
        refinementType,
      });

      expect(result.success).toBe(true);
      expect(invokeBody().refinementType).toBe(refinementType);
      expect(invokeBody().availableMaterials).toEqual(CANONICAL_MATERIALS);
    }

    expect(ALL_REFINEMENT_TYPES).toHaveLength(8);
  });

  it('refine body === rewritten snapshot for a valid-but-noncanonical stored list', async () => {
    vi.mocked(getLesson).mockResolvedValue(
      makeStoredLesson(storedContent({ availableMaterials: RAW_MATERIALS })) as never,
    );

    await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    const sent = invokeBody().availableMaterials;
    const rewritten = rewrittenContent().availableMaterials;

    expect(sent).toEqual(CANONICAL_MATERIALS);
    expect(rewritten).toEqual(CANONICAL_MATERIALS);
    expect(rewritten).toEqual(sent);
    // The stored form was genuinely noncanonical, so this is not a no-op.
    expect(RAW_MATERIALS).not.toEqual(CANONICAL_MATERIALS);
  });

  it('refine body === rewritten snapshot for an over-cap stored list (exactly 60 reach both)', async () => {
    vi.mocked(getLesson).mockResolvedValue(
      makeStoredLesson(storedContent({ availableMaterials: OVER_CAP_MATERIALS })) as never,
    );

    await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    const sent = invokeBody().availableMaterials;
    const rewritten = rewrittenContent().availableMaterials;

    expect(OVER_CAP_MATERIALS).toHaveLength(61);
    expect(sent).toHaveLength(60);
    expect(rewritten).toHaveLength(60);
    expect(sent).toEqual(OVER_CAP_CANONICAL);
    expect(rewritten).toEqual(sent);
  });

  const unusableCases: Array<{ label: string; stored: unknown }> = [
    { label: 'a scalar string ("papel")', stored: 'papel' },
    { label: 'a mixed array (["papel", 7])', stored: ['papel', 7] },
    { label: 'an empty array', stored: [] },
    { label: 'a whitespace-only array (["   "])', stored: ['   '] },
  ];

  for (const { label, stored } of unusableCases) {
    it(`neither sends nor rewrites the snapshot when it is ${label}`, async () => {
      vi.mocked(getLesson).mockResolvedValue(
        makeStoredLesson(storedContent({ availableMaterials: stored })) as never,
      );

      const result = await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

      expect(result.success).toBe(true);
      expect(invokeBody()).not.toHaveProperty('availableMaterials');
      expect(rewrittenContent()).not.toHaveProperty('availableMaterials');
    });
  }

  it('sends no key when the stored content has no snapshot at all', async () => {
    vi.mocked(getLesson).mockResolvedValue(makeStoredLesson(storedContent()) as never);

    await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    expect(invokeBody()).not.toHaveProperty('availableMaterials');
    expect(rewrittenContent()).not.toHaveProperty('availableMaterials');
  });
});

// ─── [A7] additive-key-safe content writes ───────────────────────────────────

describe('[A7] refineChildrenActivity — the content rewrite is additive-key-safe', () => {
  beforeEach(() => {
    invokeMock.mockResolvedValue({ data: makeRefinedResponse(), error: null });
  });

  it('preserves unknown sibling keys and re-serializes the canonical snapshot', async () => {
    vi.mocked(getLesson).mockResolvedValue(
      makeStoredLesson(
        storedContent({
          availableMaterials: RAW_MATERIALS,
          notaDelEquipo: 'centinela',
          anexos: { nested: true, list: [1, 2] },
        }),
      ) as never,
    );

    await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    const written = rewrittenContent();

    // Sentinels survive untouched — the base three-key rebuild dropped them.
    expect(written.notaDelEquipo).toBe('centinela');
    expect(written.anexos).toEqual({ nested: true, list: [1, 2] });
    // The canonical snapshot is re-serialized, not merely carried over raw.
    expect(written.availableMaterials).toEqual(CANONICAL_MATERIALS);
    // The three model-owned keys are overwritten with the refined payload.
    expect(written.sequence).toEqual(makeRefinedResponse().sequence);
    expect(written.adaptations).toEqual(makeRefinedResponse().adaptations);
    expect(written.volunteerPlan).toEqual(makeRefinedResponse().volunteerPlan);
  });

  it('keeps sentinels while removing the key when the snapshot is unusable', async () => {
    vi.mocked(getLesson).mockResolvedValue(
      makeStoredLesson(
        storedContent({
          availableMaterials: ['papel', 7],
          notaDelEquipo: 'centinela',
        }),
      ) as never,
    );

    await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    const written = rewrittenContent();

    expect(written.notaDelEquipo).toBe('centinela');
    expect(written).not.toHaveProperty('availableMaterials');
    expect(Object.keys(written).sort()).toEqual([
      'adaptations',
      'notaDelEquipo',
      'sequence',
      'volunteerPlan',
    ]);
  });
});
