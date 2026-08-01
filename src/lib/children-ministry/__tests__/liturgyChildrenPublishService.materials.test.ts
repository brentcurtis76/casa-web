/**
 * Liturgy Children Publish Service — `availableMaterials` contract
 *
 * The one thing this suite proves is the [B1] equality: for a single publish
 * call the UI's list, the Edge Function body and the persisted snapshot are the
 * SAME canonical list, and for a refine the stored snapshot and the refine body
 * are the SAME canonical list.
 *
 * The ONLY mocked module is `@/integrations/supabase/client`. The publish
 * service, `materialsList`, `lessonService`, `calendarService` and
 * `childrenPublicationStateService` are all the real ones, so the "persisted"
 * content asserted below is the JSON the real `lessonService` hands to the
 * database client — not an argument intercepted from a mocked collaborator.
 * A canonicalization that only happened inside a stub could not make these
 * assertions pass.
 *
 * The orchestration behaviour itself (multi-group, partial failure, idempotency)
 * is covered by `liturgyChildrenPublishService.test.ts`; this file only adds the
 * materials leg (PLAN-MATERIALES M-D2/M-D3/M-D5/M-D11).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildrenAgeGroupRow } from '@/types/childrenMinistry';
import type {
  GenerateChildrenLessonResponse,
  PublishChildrenActivitiesResult,
  RefinementType,
} from '@/types/childrenPublicationState';

// ─── The single mock boundary: the Supabase client ──────────────────────────
//
// Every table access below is a call shape taken from the real services:
//   lessonService            church_children_lessons, church_children_lesson_materials
//   calendarService          church_children_calendar
//   publicationStateService  church_children_publication_state
//   publish service          liturgias (pre-flight), auth, functions.invoke
// A table this dispatcher does not model throws instead of quietly resolving,
// so an unmodelled call shape fails the suite rather than passing vacuously.

type MockError = { message: string } | null;

interface MockResult {
  data: unknown;
  error: MockError;
}

/** One terminal query as the real services actually issued it. */
interface RecordedQuery {
  table: string;
  op: 'select' | 'insert' | 'update';
  columns: string | null;
  payload: Record<string, unknown> | null;
  filters: Array<{ column: string; value: unknown }>;
  terminal: 'single' | 'maybeSingle';
}

/** Chainable stub: mirrors the postgrest builder for the shapes in use. */
interface ChainQuery {
  select: (columns: string) => ChainQuery;
  insert: (payload: Record<string, unknown>) => ChainQuery;
  update: (payload: Record<string, unknown>) => ChainQuery;
  eq: (column: string, value: unknown) => ChainQuery;
  single: () => Promise<MockResult>;
  maybeSingle: () => Promise<MockResult>;
}

/** Rows the mocked database hands back; each test sets only what it needs. */
interface MockDbState {
  liturgyRow: { id: string } | null;
  liturgyError: MockError;
  existingLesson: { id: string } | null;
  storedLesson: Record<string, unknown> | null;
  existingLessonMaterial: { id: string } | null;
  existingSession: { id: string } | null;
  existingPublication: { id: string; publish_version: number } | null;
}

const queries: RecordedQuery[] = [];

const dbState: MockDbState = {
  liturgyRow: null,
  liturgyError: null,
  existingLesson: null,
  storedLesson: null,
  existingLessonMaterial: null,
  existingSession: null,
  existingPublication: null,
};

function filterValue(query: RecordedQuery, column: string): unknown {
  return query.filters.find((filter) => filter.column === column)?.value;
}

function resolveQuery(query: RecordedQuery): MockResult {
  switch (query.table) {
    case 'liturgias':
      return { data: dbState.liturgyRow, error: dbState.liturgyError };

    case 'church_children_lessons':
      if (query.op === 'insert') {
        return {
          data: { id: `lesson-${String(query.payload?.age_group_id ?? 'new')}` },
          error: null,
        };
      }
      if (query.op === 'update') {
        return { data: { id: filterValue(query, 'id') }, error: null };
      }
      // `single()` is getLesson(id) on the refine path; `maybeSingle()` is the
      // (liturgy_id, age_group_id) idempotency lookup on the publish path.
      return query.terminal === 'single'
        ? { data: dbState.storedLesson, error: null }
        : { data: dbState.existingLesson, error: null };

    case 'church_children_lesson_materials':
      if (query.op === 'select') {
        return { data: dbState.existingLessonMaterial, error: null };
      }
      return { data: { id: 'mat-1' }, error: null };

    case 'church_children_calendar':
      if (query.op === 'select') {
        return { data: dbState.existingSession, error: null };
      }
      if (query.op === 'insert') {
        return { data: { id: 'cal-1' }, error: null };
      }
      return { data: { id: filterValue(query, 'id') }, error: null };

    case 'church_children_publication_state':
      if (query.op === 'select') {
        // incrementPublishVersion reads only the version column, by id.
        if (query.columns === 'publish_version') {
          return {
            data: { publish_version: dbState.existingPublication?.publish_version ?? 1 },
            error: null,
          };
        }
        return { data: dbState.existingPublication, error: null };
      }
      if (query.op === 'insert') {
        return { data: { id: 'pub-1' }, error: null };
      }
      return { data: { id: filterValue(query, 'id') }, error: null };

    default:
      throw new Error(
        `Unstubbed Supabase table reached by the real services: "${query.table}"`,
      );
  }
}

// A function declaration, so the hoisted `vi.mock` factory below can reference
// it safely; the consts it closes over are only read once a test runs.
function createTableQuery(table: string): ChainQuery {
  const query: RecordedQuery = {
    table,
    op: 'select',
    columns: null,
    payload: null,
    filters: [],
    terminal: 'single',
  };

  function finish(terminal: RecordedQuery['terminal']): Promise<MockResult> {
    query.terminal = terminal;
    queries.push(query);
    return Promise.resolve(resolveQuery(query));
  }

  const chain: ChainQuery = {
    select: (columns) => {
      query.columns = columns;
      return chain;
    },
    insert: (payload) => {
      query.op = 'insert';
      query.payload = payload;
      return chain;
    },
    update: (payload) => {
      query.op = 'update';
      query.payload = payload;
      return chain;
    },
    eq: (column, value) => {
      query.filters.push({ column, value });
      return chain;
    },
    single: () => finish('single'),
    maybeSingle: () => finish('maybeSingle'),
  };

  return chain;
}

// Each mock declares the signature the service actually calls it with: a bare
// `vi.fn()` infers a zero-argument type, which makes every wrapper below a tsc
// error even though the runtime behaviour is fine.
const invokeMock =
  vi.fn<(name: string, options: { body: Record<string, unknown> }) => Promise<unknown>>();
const getUserMock = vi.fn();
const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();

// The arrow wrappers are load-bearing: `vi.mock` factories are hoisted above
// these consts, so the factory may only READ them when it is finally invoked.
// This override replaces the global supabase mock from src/test/setup.ts.
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
    from: (table: string) => createTableQuery(table),
  },
}));

import {
  publishChildrenActivities,
  refineChildrenActivity,
} from '@/lib/children-ministry/liturgyChildrenPublishService';
import { buildEffectiveMaterialsList } from '@/lib/children-ministry/materialsList';

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
 * Stored lesson row for the refine path, served to the REAL `getLesson`.
 * `content` is passed as a raw object so each test can describe exactly what
 * the historical JSON looks like — including hand-edited shapes the FE never
 * wrote itself.
 */
function makeStoredLesson(content: unknown): Record<string, unknown> {
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

// ─── Capture helpers — all at the Supabase boundary ─────────────────────────

/** The body handed to `functions.invoke` on call `index`. */
function invokeBody(index = 0): Record<string, unknown> {
  const call = invokeMock.mock.calls[index];
  if (!call) throw new Error(`No functions.invoke call at index ${index}`);
  return call[1].body;
}

function queriesFor(table: string, op: RecordedQuery['op']): RecordedQuery[] {
  return queries.filter((query) => query.table === table && query.op === op);
}

/** The lesson row the REAL lessonService sent to the client, INSERT path. */
function lessonInsertPayload(index = 0): Record<string, unknown> {
  const payload = queriesFor('church_children_lessons', 'insert')[index]?.payload;
  if (!payload) throw new Error(`No church_children_lessons INSERT at index ${index}`);
  return payload;
}

/** The lesson patch the REAL lessonService sent to the client, UPDATE path. */
function lessonUpdatePayload(index = 0): Record<string, unknown> {
  const payload = queriesFor('church_children_lessons', 'update')[index]?.payload;
  if (!payload) throw new Error(`No church_children_lessons UPDATE at index ${index}`);
  return payload;
}

/** The content JSON persisted by the create path, read off the INSERT payload. */
function persistedContent(index = 0): Record<string, unknown> {
  return JSON.parse(String(lessonInsertPayload(index).content));
}

/** The content JSON persisted by the refine path, read off the UPDATE payload. */
function rewrittenContent(index = 0): Record<string, unknown> {
  return JSON.parse(String(lessonUpdatePayload(index).content));
}

// ─── Default happy-path stubs ───────────────────────────────────────────────

function installHappyPath() {
  queries.length = 0;

  dbState.liturgyRow = { id: 'lit-1' };
  dbState.liturgyError = null;
  dbState.existingLesson = null;
  dbState.storedLesson = null;
  dbState.existingLessonMaterial = null;
  dbState.existingSession = null;
  dbState.existingPublication = null;

  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  getSessionMock.mockResolvedValue({
    data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } },
    error: null,
  });
  refreshSessionMock.mockResolvedValue({ error: null });

  invokeMock.mockResolvedValue({ data: makeGeneratedResponse(), error: null });
}

/**
 * Publish and refuse to continue unless the run actually persisted everything.
 * A captured payload from a flow that then died downstream is not evidence, so
 * every publish-based assertion in this file goes through here.
 */
async function publishExpectingSuccess(
  params: ReturnType<typeof buildPublishParams>,
): Promise<PublishChildrenActivitiesResult> {
  const result = await publishChildrenActivities(params);

  expect(result.warnings).toEqual([]);
  expect(result.results.map((group) => group.success)).toEqual(
    params.selectedAgeGroupIds.map(() => true),
  );
  expect(result.publicationCount).toBe(params.selectedAgeGroupIds.length);

  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  installHappyPath();
});

// ─── [A3] the invoke body carries the canonical list ─────────────────────────

describe('[A3] publishChildrenActivities — the Edge Function receives the CANONICAL list', () => {
  it('canonicalizes the raw param before invoking, never forwarding it as given', async () => {
    const result = await publishExpectingSuccess(
      buildPublishParams({ availableMaterials: RAW_MATERIALS }),
    );

    expect(result.success).toBe(true);
    expect(result.totalActivitiesGenerated).toBe(1);
    expect(invokeBody().availableMaterials).toEqual(CANONICAL_MATERIALS);
    // Guard the guard: the raw param really is a different list, so the
    // assertion above cannot be satisfied by forwarding it unchanged.
    expect(RAW_MATERIALS).not.toEqual(CANONICAL_MATERIALS);
    expect(invokeBody().availableMaterials).not.toEqual(RAW_MATERIALS);
  });

  it('caps an over-cap list at 60 before invoking', async () => {
    const result = await publishExpectingSuccess(
      buildPublishParams({ availableMaterials: OVER_CAP_MATERIALS }),
    );

    expect(result.success).toBe(true);
    expect(result.totalActivitiesGenerated).toBe(1);
    expect(invokeBody().availableMaterials).toEqual(OVER_CAP_CANONICAL);
    expect(invokeBody().availableMaterials).toHaveLength(60);
  });

  it('runs canonicalization ONCE per call and shares one identical list across groups', async () => {
    const result = await publishExpectingSuccess(
      buildPublishParams({
        selectedAgeGroupIds: ['ag-peq', 'ag-med'],
        availableMaterials: RAW_MATERIALS,
      }),
    );

    expect(result.success).toBe(true);
    expect(result.totalActivitiesGenerated).toBe(2);
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(invokeBody(0).availableMaterials).toEqual(CANONICAL_MATERIALS);
    // Same array instance for every group: one canonicalization, not one per group.
    expect(invokeBody(1).availableMaterials).toBe(invokeBody(0).availableMaterials);
    // Both groups really did persist, through the real lessonService.
    expect(persistedContent(0).availableMaterials).toEqual(CANONICAL_MATERIALS);
    expect(persistedContent(1).availableMaterials).toEqual(CANONICAL_MATERIALS);
  });
});

// ─── [A4] snapshot === canonical === invoke body ─────────────────────────────

describe('[A4] publishChildrenActivities — persisted snapshot equals the invoke body', () => {
  it('persists the same canonical list it sent, asserted on both captures', async () => {
    const result = await publishExpectingSuccess(
      buildPublishParams({ availableMaterials: RAW_MATERIALS }),
    );

    const sent = invokeBody().availableMaterials;
    const stored = persistedContent().availableMaterials;

    expect(result.success).toBe(true);
    expect(sent).toEqual(CANONICAL_MATERIALS);
    expect(stored).toEqual(CANONICAL_MATERIALS);
    // The [B1] equality itself, on the two real captures.
    expect(stored).toEqual(sent);
  });

  it('keeps the three model-owned keys alongside the snapshot', async () => {
    const result = await publishExpectingSuccess(
      buildPublishParams({ availableMaterials: RAW_MATERIALS }),
    );

    expect(result.success).toBe(true);
    expect(Object.keys(persistedContent()).sort()).toEqual([
      'adaptations',
      'availableMaterials',
      'sequence',
      'volunteerPlan',
    ]);
  });

  it('persists the same canonical list when republishing over existing rows', async () => {
    dbState.existingLesson = { id: 'lesson-existing' };
    dbState.existingSession = { id: 'cal-existing' };
    dbState.existingPublication = { id: 'pub-existing', publish_version: 3 };

    const result = await publishExpectingSuccess(
      buildPublishParams({ availableMaterials: RAW_MATERIALS }),
    );

    expect(result.success).toBe(true);
    // The republish leg writes through UPDATE, not INSERT.
    expect(queriesFor('church_children_lessons', 'insert')).toHaveLength(0);
    expect(rewrittenContent().availableMaterials).toEqual(CANONICAL_MATERIALS);
    expect(rewrittenContent().availableMaterials).toEqual(invokeBody().availableMaterials);
    // The REAL publication service computed the next version from the row it read.
    expect(
      queriesFor('church_children_publication_state', 'update')[0]?.payload?.publish_version,
    ).toBe(4);
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
      const result = await publishExpectingSuccess(params);

      expect(result.success).toBe(true);
      expect(result.totalActivitiesGenerated).toBe(1);
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
      dbState.storedLesson = makeStoredLesson(
        storedContent({ availableMaterials: RAW_MATERIALS }),
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
    dbState.storedLesson = makeStoredLesson(
      storedContent({ availableMaterials: RAW_MATERIALS }),
    );

    const result = await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    const sent = invokeBody().availableMaterials;
    const rewritten = rewrittenContent().availableMaterials;

    expect(result.success).toBe(true);
    expect(sent).toEqual(CANONICAL_MATERIALS);
    expect(rewritten).toEqual(CANONICAL_MATERIALS);
    expect(rewritten).toEqual(sent);
    // The stored form was genuinely noncanonical, so this is not a no-op.
    expect(RAW_MATERIALS).not.toEqual(CANONICAL_MATERIALS);
  });

  it('refine body === rewritten snapshot for an over-cap stored list (exactly 60 reach both)', async () => {
    dbState.storedLesson = makeStoredLesson(
      storedContent({ availableMaterials: OVER_CAP_MATERIALS }),
    );

    const result = await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    const sent = invokeBody().availableMaterials;
    const rewritten = rewrittenContent().availableMaterials;

    expect(result.success).toBe(true);
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
      dbState.storedLesson = makeStoredLesson(storedContent({ availableMaterials: stored }));

      const result = await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

      expect(result.success).toBe(true);
      expect(invokeBody()).not.toHaveProperty('availableMaterials');
      expect(rewrittenContent()).not.toHaveProperty('availableMaterials');
    });
  }

  it('sends no key when the stored content has no snapshot at all', async () => {
    dbState.storedLesson = makeStoredLesson(storedContent());

    const result = await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    expect(result.success).toBe(true);
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
    dbState.storedLesson = makeStoredLesson(
      storedContent({
        availableMaterials: RAW_MATERIALS,
        notaDelEquipo: 'centinela',
        anexos: { nested: true, list: [1, 2] },
      }),
    );

    const result = await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    const written = rewrittenContent();

    expect(result.success).toBe(true);
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
    dbState.storedLesson = makeStoredLesson(
      storedContent({
        availableMaterials: ['papel', 7],
        notaDelEquipo: 'centinela',
      }),
    );

    const result = await refineChildrenActivity({ lessonId: 'lesson-1', feedback: 'f' });

    const written = rewrittenContent();

    expect(result.success).toBe(true);
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
