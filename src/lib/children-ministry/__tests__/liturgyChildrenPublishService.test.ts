/**
 * Liturgy Children Publish Service — real integration tests
 *
 * Mocks the lesson / calendar / publication-state helpers and the Supabase
 * client surface used directly by the orchestrator (auth + functions.invoke)
 * so we exercise the real per-group orchestration, partial-failure handling,
 * and idempotency logic instead of static snapshots.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChildrenAgeGroupRow } from '@/types/childrenMinistry';
import type { GenerateChildrenLessonResponse } from '@/types/childrenPublicationState';

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
const invokeMock = vi.fn();
const getUserMock = vi.fn();
const getSessionMock = vi.fn();
const refreshSessionMock = vi.fn();
// Backs supabase.from('liturgias').select('id').eq('id', ...).maybeSingle()
// used by the verify_liturgy fail-fast step. Each link is module-scoped so
// tests can assert the query targets the right column and liturgy id.
const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({
  maybeSingle: (...args: unknown[]) => maybeSingleMock(...args),
}));
const selectMock = vi.fn(() => ({
  eq: (...args: unknown[]) => eqMock(...args),
}));
const fromMock = vi.fn(() => ({
  select: (...args: unknown[]) => selectMock(...args),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      getSession: (...args: unknown[]) => getSessionMock(...args),
      refreshSession: (...args: unknown[]) => refreshSessionMock(...args),
    },
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { publishChildrenActivities } from '@/lib/children-ministry/liturgyChildrenPublishService';
import {
  getPublicationByLiturgyAndAgeGroup,
  createPublication,
  incrementPublishVersion,
} from '@/lib/children-ministry/childrenPublicationStateService';
import {
  getLessonByLiturgyAndAgeGroup,
  createLesson,
  updateLesson,
  upsertLessonMaterialByType,
} from '@/lib/children-ministry/lessonService';
import {
  getSessionByDateAndAgeGroup,
  createSession,
  updateSession,
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
  {
    id: 'ag-gra',
    name: 'Grandes',
    min_age: 9,
    max_age: 12,
    display_order: 3,
    created_at: '2026-01-01T00:00:00Z',
  },
];

function buildPublishParams(overrides?: { selectedAgeGroupIds?: string[] }) {
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
      scenes: [{ text: 'Sembrador sale' }, { text: 'Cae en buena tierra' }],
    },
    selectedAgeGroupIds: overrides?.selectedAgeGroupIds ?? ['ag-peq', 'ag-med', 'ag-gra'],
    ageGroups,
  };
}

function makeGeneratedResponse(
  overrides?: Partial<GenerateChildrenLessonResponse>,
): GenerateChildrenLessonResponse {
  return {
    success: true,
    activityName: 'Actividad generada',
    materials: ['semillas', 'macetas'],
    sequence: [
      { phase: 'movimiento', title: 'Mover', description: 'Mover', minutes: 8 },
      { phase: 'expresion_conversacion', title: 'Hablar', description: 'Hablar', minutes: 10 },
      { phase: 'reflexion_metaprendizaje', title: 'Reflexionar', description: 'Reflexionar', minutes: 8 },
    ],
    adaptations: { small: 's', medium: 'm', large: 'l', mixed: 'x' },
    volunteerPlan: { leader: 'L', support: 'S' },
    estimatedTotalMinutes: 26,
    ...overrides,
  };
}

// ─── Default happy-path stubs ───────────────────────────────────────────────

function installHappyPath() {
  getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  // The liturgy row exists by default so the verify_liturgy guard passes.
  maybeSingleMock.mockResolvedValue({ data: { id: 'lit-1' }, error: null });
  getSessionMock.mockResolvedValue({
    data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } },
    error: null,
  });
  refreshSessionMock.mockResolvedValue({ error: null });

  // No existing lessons / sessions / publications by default → create path.
  vi.mocked(getLessonByLiturgyAndAgeGroup).mockResolvedValue(null);
  vi.mocked(getSessionByDateAndAgeGroup).mockResolvedValue(null);
  vi.mocked(getPublicationByLiturgyAndAgeGroup).mockResolvedValue(null);

  // createLesson returns a stable id per call.
  vi.mocked(createLesson).mockImplementation(async (insert) => ({
    id: `lesson-${insert.age_group_id}`,
    title: insert.title ?? '',
    description: insert.description ?? null,
    age_group_id: insert.age_group_id ?? null,
    bible_reference: null,
    objectives: null,
    content: insert.content ?? null,
    materials_needed: insert.materials_needed ?? null,
    duration_minutes: insert.duration_minutes ?? 30,
    status: 'ready',
    tags: null,
    liturgy_id: insert.liturgy_id ?? null,
    created_by: insert.created_by ?? null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);

  vi.mocked(updateLesson).mockImplementation(async (id) => ({ id }) as never);

  vi.mocked(upsertLessonMaterialByType).mockResolvedValue({ id: 'mat-1' } as never);

  vi.mocked(createSession).mockImplementation(async (insert) => ({
    id: `cal-${insert.age_group_id}`,
  }) as never);
  vi.mocked(updateSession).mockImplementation(async (id) => ({ id }) as never);

  vi.mocked(createPublication).mockImplementation(async (data) => ({
    id: `pub-${data.age_group_id}`,
  }) as never);
  vi.mocked(incrementPublishVersion).mockImplementation(async (id) => ({ id }) as never);

  invokeMock.mockResolvedValue({ data: makeGeneratedResponse(), error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  installHappyPath();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('publishChildrenActivities — multi-group orchestration', () => {
  it('invokes the edge function once per requested age group and returns one success result per group', async () => {
    const result = await publishChildrenActivities(buildPublishParams());

    // 1 EF call per group, exactly 3 for the 3 selected groups.
    expect(invokeMock).toHaveBeenCalledTimes(3);
    expect(result.results).toHaveLength(3);
    expect(result.publicationCount).toBe(3);
    expect(result.totalActivitiesGenerated).toBe(3);
    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([]);

    // Each result corresponds 1:1 with the requested age group ids, in order.
    expect(result.results.map((r) => r.ageGroupId)).toEqual(['ag-peq', 'ag-med', 'ag-gra']);
    expect(result.results.every((r) => r.success)).toBe(true);
  });

  it('maps DB age group names (with diacritics) to the EF age group enum', async () => {
    const groupsWithDiacritics: ChildrenAgeGroupRow[] = [
      { ...ageGroups[0], name: 'Pequeños' },
      { ...ageGroups[1], name: 'Medianos' },
      { ...ageGroups[2], name: 'Grandes' },
    ];

    await publishChildrenActivities({
      ...buildPublishParams(),
      ageGroups: groupsWithDiacritics,
    });

    const bodies = invokeMock.mock.calls.map(
      (c) => (c[1] as { body: { ageGroup: string; ageGroupLabel: string } }).body,
    );
    expect(bodies.map((b) => b.ageGroup)).toEqual(['nursery', 'preschool', 'elementary']);
    expect(bodies.map((b) => b.ageGroupLabel)).toEqual(['Pequeños', 'Medianos', 'Grandes']);
  });

  it('persists results before a later group fails — a partial failure does not erase prior successes', async () => {
    // First two calls succeed, third one fails at the EF layer.
    invokeMock
      .mockResolvedValueOnce({ data: makeGeneratedResponse({ activityName: 'A1' }), error: null })
      .mockResolvedValueOnce({ data: makeGeneratedResponse({ activityName: 'A2' }), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } });

    const result = await publishChildrenActivities(buildPublishParams());

    expect(result.results).toHaveLength(3);
    expect(result.publicationCount).toBe(2);
    expect(result.totalActivitiesGenerated).toBe(2);
    expect(result.success).toBe(true); // at least one group succeeded
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(true);
    expect(result.results[2].success).toBe(false);
    expect(result.results[2].error).toMatch(/timeout/i);
    expect(result.warnings).toHaveLength(1);

    // Side effects must have happened for the two successes and NOT for the
    // failing third group.
    expect(vi.mocked(createLesson)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createSession)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createPublication)).toHaveBeenCalledTimes(2);

    // The lessons that were created must still reference the first two groups.
    const created = vi.mocked(createLesson).mock.calls.map((c) => c[0].age_group_id);
    expect(created).toEqual(['ag-peq', 'ag-med']);
  });

  it('isolates groups: a failure in the middle does not skip later groups', async () => {
    invokeMock
      .mockResolvedValueOnce({ data: makeGeneratedResponse(), error: null })
      .mockResolvedValueOnce({ data: { success: false, error: 'modelo no disponible' }, error: null })
      .mockResolvedValueOnce({ data: makeGeneratedResponse(), error: null });

    const result = await publishChildrenActivities(buildPublishParams());

    expect(result.results.map((r) => r.success)).toEqual([true, false, true]);
    expect(result.publicationCount).toBe(2);
    // The EF was still called for the third group after the second one failed.
    expect(invokeMock).toHaveBeenCalledTimes(3);
  });

  it('reports total failure (success=false) when every group fails', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'network' } });

    const result = await publishChildrenActivities(buildPublishParams());

    expect(result.success).toBe(false);
    expect(result.publicationCount).toBe(0);
    expect(result.totalActivitiesGenerated).toBe(0);
    expect(result.results.every((r) => !r.success)).toBe(true);
    expect(result.warnings).toHaveLength(3);
    // No persistence side-effects should have occurred.
    expect(vi.mocked(createLesson)).not.toHaveBeenCalled();
    expect(vi.mocked(createPublication)).not.toHaveBeenCalled();
  });

  it('records an "Unknown" result when a selected id is missing from ageGroups (still publishes the rest)', async () => {
    const params = {
      ...buildPublishParams(),
      selectedAgeGroupIds: ['ag-peq', 'does-not-exist', 'ag-gra'],
    };

    const result = await publishChildrenActivities(params);

    expect(result.results).toHaveLength(3);
    expect(result.results[1].success).toBe(false);
    expect(result.results[1].ageGroupLabel).toBe('Unknown');
    expect(result.results[1].error).toMatch(/no encontrado/i);

    // The other two groups must still have been published.
    expect(result.results[0].success).toBe(true);
    expect(result.results[2].success).toBe(true);
    expect(result.publicationCount).toBe(2);
    // EF only invoked for the resolvable groups.
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});

describe('publishChildrenActivities — idempotency', () => {
  it('updates existing lesson / session / publication instead of duplicating on re-publish', async () => {
    vi.mocked(getLessonByLiturgyAndAgeGroup).mockResolvedValue({
      id: 'lesson-existing',
      age_group_id: 'ag-peq',
      liturgy_id: 'lit-1',
    } as never);
    vi.mocked(getSessionByDateAndAgeGroup).mockResolvedValue({
      id: 'cal-existing',
    } as never);
    vi.mocked(getPublicationByLiturgyAndAgeGroup).mockResolvedValue({
      id: 'pub-existing',
    } as never);

    vi.mocked(updateLesson).mockResolvedValue({ id: 'lesson-existing' } as never);
    vi.mocked(updateSession).mockResolvedValue({ id: 'cal-existing' } as never);
    vi.mocked(incrementPublishVersion).mockResolvedValue({ id: 'pub-existing' } as never);

    const result = await publishChildrenActivities({
      ...buildPublishParams(),
      selectedAgeGroupIds: ['ag-peq'],
    });

    expect(result.publicationCount).toBe(1);
    expect(result.results[0].lessonId).toBe('lesson-existing');
    expect(result.results[0].calendarId).toBe('cal-existing');
    expect(result.results[0].publishVersionId).toBe('pub-existing');

    // Update paths fired, create paths did not.
    expect(vi.mocked(updateLesson)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateSession)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(incrementPublishVersion)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createLesson)).not.toHaveBeenCalled();
    expect(vi.mocked(createSession)).not.toHaveBeenCalled();
    expect(vi.mocked(createPublication)).not.toHaveBeenCalled();
  });

  it('normalises ISO datetime liturgy dates to YYYY-MM-DD for calendar lookups', async () => {
    await publishChildrenActivities({
      ...buildPublishParams(),
      selectedAgeGroupIds: ['ag-peq'],
      liturgyDate: '2026-03-29T15:30:00Z',
    });

    expect(vi.mocked(getSessionByDateAndAgeGroup)).toHaveBeenCalledWith('2026-03-29', 'ag-peq');
  });
});

describe('publishChildrenActivities — session handling', () => {
  it('refreshes the supabase auth session before each long EF invocation', async () => {
    await publishChildrenActivities(buildPublishParams());

    // Once per group.
    expect(getSessionMock).toHaveBeenCalledTimes(3);
  });

  it('proactively refreshes when the token is close to expiry', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { expires_at: Math.floor(Date.now() / 1000) + 10 } },
      error: null,
    });

    await publishChildrenActivities({
      ...buildPublishParams(),
      selectedAgeGroupIds: ['ag-peq'],
    });

    expect(refreshSessionMock).toHaveBeenCalled();
  });
});

describe('publishChildrenActivities — liturgy existence guard', () => {
  it('fails every group fast, without invoking the EF, when the liturgy row does not exist', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await publishChildrenActivities(buildPublishParams());

    // No generation work and no writes were attempted.
    expect(invokeMock).not.toHaveBeenCalled();
    expect(vi.mocked(createLesson)).not.toHaveBeenCalled();
    expect(vi.mocked(createSession)).not.toHaveBeenCalled();
    expect(vi.mocked(createPublication)).not.toHaveBeenCalled();

    expect(result.success).toBe(false);
    expect(result.publicationCount).toBe(0);
    expect(result.totalActivitiesGenerated).toBe(0);
    expect(result.results).toHaveLength(3);
    expect(result.results.every((r) => !r.success)).toBe(true);
    expect(result.results[0].error).toMatch(/no está guardada/);
    // Labels still resolve so the dialog's per-group detail stays readable.
    expect(result.results.map((r) => r.ageGroupLabel)).toEqual(['Pequenos', 'Medianos', 'Grandes']);
    // One warning per group, carrying the same actionable message.
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toMatch(/Pequenos.*no está guardada/);
  });

  it('fails fast with a lookup message when the verification query itself errors', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

    const result = await publishChildrenActivities(buildPublishParams());

    expect(invokeMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.results.every((r) => !r.success)).toBe(true);
    expect(result.results[0].error).toMatch(/No se pudo verificar la liturgia: permission denied/);
  });

  it('verifies the liturgy exactly once, by id, and proceeds when the row exists', async () => {
    const result = await publishChildrenActivities(buildPublishParams());

    expect(maybeSingleMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('liturgias');
    expect(selectMock).toHaveBeenCalledWith('id');
    // The guard must filter on the id column with the caller-supplied liturgy id.
    expect(eqMock).toHaveBeenCalledWith('id', 'lit-1');
    expect(result.success).toBe(true);
  });
});
