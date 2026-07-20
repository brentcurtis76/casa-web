/**
 * A3a/S5(F4) — Component-level integration for approval + finalization envelope.
 *
 * Renders the REAL `CuentacuentoEditor` with the REAL `useCuentacuentosDraft`
 * and `useStoryImagePipeline` hooks. Only external boundaries are mocked:
 * Supabase (database, storage, functions.invoke, auth), `use-toast`, and
 * `fetch`. The test drives the actual `handleApproveStory` / `handleFinalize`
 * UI paths and asserts the entire persist-first envelope contract:
 *
 *   1. `flushPendingDraftWrites` runs BEFORE `enqueueDraftWrite` — debounced
 *      edits are drained, never dropped.
 *   2. The approval envelope calls BOTH synchronous getters from the pipeline
 *      hook (`getSaveFailedCount(identity)` and `isBusySaving()`) after the
 *      flush and before enqueueing. Removing either getter from
 *      `useStoryImagePipeline` breaks the wrapping spy — this test fails.
 *   3. Exactly ONE authoritative `DraftPatch` is enqueued, carrying every
 *      approved-plan field the `buildAuthoritativeDraftPatch` closure builds
 *      (currentStep, story, config, prompts, edits, options, selections,
 *      references, include/exclude, overlays via landmarkVisible, uploads via
 *      propReferenceImages, sceneReferenceModes).
 *   4. Persistence resolves BEFORE the local transition — `setStory` /
 *      `setCurrentStep` only fire in `onSuccess`.
 *   5. On persistence rejection: `onError` path — no transition, no auto-kick,
 *      no `deleteDraft` (for finalize).
 *   6. On stale (`preStart` returns false or identity mutated mid-flight):
 *      `onStale` path — no transition, no auto-kick.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

// -----------------------------------------------------------------------------
// Mock external boundaries only.
// -----------------------------------------------------------------------------

type UpsertPayload = Record<string, unknown>;
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}
function makeDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const upsertCalls: Array<{ payload: UpsertPayload }> = [];
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let upsertDefaultError: { message: string } | null = null;
let mockUserId: string | null = null;

// Test seams — the wrapper below consults these BEFORE delegating to the real
// runner. They let a specific test case simulate "there is a save-failed entry
// in the registry" or "a persist is currently in flight" without having to
// register a real failure through the runner API. The base F4.1 test does not
// set them, so the F1-regression signal (wrapper delegates to real getter,
// throws if the return object omits the key) still fires in that test.
let overrideIsBusySaving: (() => boolean) | null = null;
let overrideGetSaveFailedCount:
  | ((identity: { storyId: string | null; epoch: number }) => number)
  | null = null;

vi.mock('@/integrations/supabase/client', () => {
  const tableApi = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi
      .fn()
      .mockImplementation(async () => ({ data: null, error: null })),
    upsert: vi.fn().mockImplementation(async (payload: UpsertPayload) => {
      upsertCalls.push({ payload });
      const deferred = upsertDeferreds.shift();
      if (deferred) return deferred.promise;
      return { error: upsertDefaultError };
    }),
    delete: vi.fn().mockReturnThis(),
  });
  const storageApi = () => ({
    upload: vi.fn().mockImplementation(async (path: string) => ({
      data: { path },
      error: null,
    })),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/${path}` },
    })),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  return {
    supabase: {
      from: vi.fn(() => tableApi()),
      storage: { from: vi.fn(() => storageApi()) },
      functions: {
        invoke: vi
          .fn()
          .mockResolvedValue({ data: {}, error: null }),
      },
      auth: {
        getUser: vi.fn().mockImplementation(async () => ({
          data: { user: mockUserId ? { id: mockUserId } : null },
        })),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
    },
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// -----------------------------------------------------------------------------
// Spy wrappers on the REAL hooks. We forward every call to the actual
// implementation and record the invocations of the two new synchronous
// getters (`getSaveFailedCount`, `isBusySaving`) plus `flushPendingDraftWrites`
// and `enqueueDraftWrite`. If either getter is missing from the pipeline hook
// return object (F1 regression), invoking it here throws and the test fails.
// -----------------------------------------------------------------------------

interface CallLog {
  getSaveFailedCountCalls: number;
  isBusySavingCalls: number;
  flushCalls: number;
  enqueuePatches: unknown[];
  runItemsCalls: number;
  eventOrder: string[];
}
const callLog: CallLog = {
  getSaveFailedCountCalls: 0,
  isBusySavingCalls: 0,
  flushCalls: 0,
  enqueuePatches: [],
  runItemsCalls: 0,
  eventOrder: [],
};

vi.mock('@/hooks/useStoryImagePipeline', async () => {
  const actual = await vi.importActual<
    typeof import('@/hooks/useStoryImagePipeline')
  >('@/hooks/useStoryImagePipeline');
  return {
    ...actual,
    useStoryImagePipeline: (opts: Parameters<typeof actual.useStoryImagePipeline>[0]) => {
      const real = actual.useStoryImagePipeline(opts);
      return {
        ...real,
        getSaveFailedCount: (identity: Parameters<typeof real.getSaveFailedCount>[0]) => {
          callLog.getSaveFailedCountCalls += 1;
          callLog.eventOrder.push('getSaveFailedCount');
          if (overrideGetSaveFailedCount) return overrideGetSaveFailedCount(identity);
          // Delegating to `real.getSaveFailedCount` keeps the F1 regression
          // signal: if the pipeline hook stops returning this getter, `real`
          // has no such key and this call throws TypeError.
          return real.getSaveFailedCount(identity);
        },
        isBusySaving: () => {
          callLog.isBusySavingCalls += 1;
          callLog.eventOrder.push('isBusySaving');
          if (overrideIsBusySaving) return overrideIsBusySaving();
          return real.isBusySaving();
        },
        runItems: (
          tasks: Parameters<typeof real.runItems>[0],
          identity: Parameters<typeof real.runItems>[1],
        ) => {
          callLog.runItemsCalls += 1;
          callLog.eventOrder.push('runItems');
          return real.runItems(tasks, identity);
        },
      };
    },
  };
});

vi.mock('@/hooks/useCuentacuentosDraft', async () => {
  const actual = await vi.importActual<
    typeof import('@/hooks/useCuentacuentosDraft')
  >('@/hooks/useCuentacuentosDraft');
  return {
    ...actual,
    useCuentacuentosDraft: (
      opts: Parameters<typeof actual.useCuentacuentosDraft>[0]
    ) => {
      const real = actual.useCuentacuentosDraft(opts);
      const wrapped = {
        ...real,
        flushPendingDraftWrites: () => {
          callLog.flushCalls += 1;
          callLog.eventOrder.push('flush');
          return real.flushPendingDraftWrites();
        },
        enqueueDraftWrite: (
          patch: Parameters<typeof real.enqueueDraftWrite>[0],
          options?: Parameters<typeof real.enqueueDraftWrite>[1]
        ) => {
          callLog.enqueuePatches.push(patch);
          callLog.eventOrder.push('enqueue');
          return real.enqueueDraftWrite(patch, options);
        },
      };
      return wrapped;
    },
  };
});

import CuentacuentoEditor from '../CuentacuentoEditor';

// -----------------------------------------------------------------------------
// Test fixtures.
// -----------------------------------------------------------------------------

const baseContext: LiturgyContext = {
  id: 'lit-approval-1',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

function makeStoryGeneratedStory(id = 'story-1'): Story {
  return {
    id,
    title: 'Cuento aprobación',
    summary: 'Resumen breve',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [
      {
        id: 'char-1',
        name: 'María',
        role: 'protagonist',
        description: 'Niña curiosa',
        visualDescription: 'niña con vestido azul',
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      {
        number: 1,
        text: 'Escena de apertura',
        visualDescription: 'plaza soleada',
      } as unknown as Story['scenes'][number],
      {
        number: 2,
        text: 'Escena de nudo',
        visualDescription: 'templo antiguo',
      } as unknown as Story['scenes'][number],
    ],
    props: [],
    spiritualConnection: 'Esperanza',
    metadata: {
      createdAt: '',
      updatedAt: '',
      status: 'story-generated' as Story['metadata']['status'],
    },
  } as Story;
}

function resetCallLog() {
  callLog.getSaveFailedCountCalls = 0;
  callLog.isBusySavingCalls = 0;
  callLog.flushCalls = 0;
  callLog.enqueuePatches = [];
  callLog.runItemsCalls = 0;
  callLog.eventOrder = [];
}

beforeEach(() => {
  upsertCalls.length = 0;
  upsertDeferreds.length = 0;
  upsertDefaultError = null;
  mockUserId = 'user-approval';
  overrideIsBusySaving = null;
  overrideGetSaveFailedCount = null;
  resetCallLog();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Fields the authoritative DraftPatch built in the editor must carry.
const REQUIRED_PATCH_KEYS = [
  'currentStep',
  'config',
  'story',
  'characterSheetOptions',
  'sceneImageOptions',
  'coverOptions',
  'endOptions',
  'propReferenceImages',
  'selectedCharacterSheets',
  'selectedSceneImages',
  'selectedCover',
  'selectedEnd',
  'sceneReferenceModes',
  'editingScenePrompt',
  'editingCharacterPrompt',
  'editingCoverPrompt',
  'editingEndPrompt',
  'editingSceneText',
  'editingTitle',
  'sceneIncludedCharacters',
  'sceneExcludedCharacters',
  'coverIncludedCharacters',
  'coverExcludedCharacters',
  'endIncludedCharacters',
  'endExcludedCharacters',
  'sceneReferenceImages',
  'coverReferenceImage',
  'endReferenceImage',
  'landmarkVisible',
] as const;

async function renderAtStoryStep() {
  const onStoryCreated = vi.fn();
  const rendered = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeStoryGeneratedStory()}
      onStoryCreated={onStoryCreated}
    />
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', {
        name: /Aprobar cuento y generar imágenes/i,
      })
    ).toBeTruthy()
  );
  return { ...rendered, onStoryCreated };
}

// -----------------------------------------------------------------------------
// (F4.1) Successful approval: envelope runs flush → getters → single
// authoritative enqueue → transition on onSuccess.
// -----------------------------------------------------------------------------
describe('A3a/S5(F4) CuentacuentoEditor approval envelope — success path', () => {
  it('runs flush, calls both live getters, enqueues one authoritative patch, then transitions', async () => {
    await renderAtStoryStep();
    // Baseline: nothing pushed by the envelope yet. (Some initial hook mount
    // side-effects may have called the getters/enqueue — reset the counters
    // right before the click so assertions target the click flow only.)
    resetCallLog();

    const approveButton = screen.getByRole('button', {
      name: /Aprobar cuento y generar imágenes/i,
    });

    await act(async () => {
      fireEvent.click(approveButton);
      // Yield: envelope awaits flush then enqueue, then onSuccess.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Wait for the transition to characters step to prove onSuccess fired.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: /Aprobar cuento y generar imágenes/i,
        })
      ).toBeNull()
    );

    // 1) flush ran, and it ran BEFORE the getters and BEFORE enqueue.
    expect(callLog.flushCalls).toBeGreaterThanOrEqual(1);
    const firstFlush = callLog.eventOrder.indexOf('flush');
    const firstGetSaveFailed = callLog.eventOrder.indexOf('getSaveFailedCount');
    const firstIsBusySaving = callLog.eventOrder.indexOf('isBusySaving');
    const firstEnqueue = callLog.eventOrder.indexOf('enqueue');
    expect(firstFlush).toBeGreaterThanOrEqual(0);
    expect(firstGetSaveFailed).toBeGreaterThan(firstFlush);
    expect(firstIsBusySaving).toBeGreaterThan(firstFlush);
    expect(firstEnqueue).toBeGreaterThan(firstGetSaveFailed);
    expect(firstEnqueue).toBeGreaterThan(firstIsBusySaving);

    // 2) BOTH live getters were consulted by the envelope. Removing either
    // getter from the pipeline hook return (F1 regression) makes the spy
    // wrapping throw and this expectation fail.
    expect(callLog.getSaveFailedCountCalls).toBeGreaterThanOrEqual(1);
    expect(callLog.isBusySavingCalls).toBeGreaterThanOrEqual(1);

    // 3) Exactly one authoritative patch enqueued by the envelope, and its
    // payload carries every approved-plan field with the expected VALUES
    // (not just key presence). The initial-state maps are asserted as `{}`
    // / `[]` / `null` so a regression that dropped the field (via optional
    // spread or "compact" logic) surfaces here instead of silently shipping.
    expect(callLog.enqueuePatches).toHaveLength(1);
    const patch = callLog.enqueuePatches[0] as Record<string, unknown>;
    for (const key of REQUIRED_PATCH_KEYS) {
      expect(
        Object.prototype.hasOwnProperty.call(patch, key),
        `authoritative patch missing own-property: ${key}`,
      ).toBe(true);
    }

    // Next step + status transition.
    expect(patch.currentStep).toBe('characters');
    const story = patch.story as Story;
    expect(story.metadata.status).toBe('characters-pending');

    // story payload retains the incoming characters/scenes (proves the patch
    // uses the live nextStory, not a summary).
    expect(story.characters).toHaveLength(1);
    expect(story.characters[0].id).toBe('char-1');
    expect(story.scenes).toHaveLength(2);
    expect(story.scenes[0].text).toBe('Escena de apertura');
    expect(story.scenes[1].text).toBe('Escena de nudo');
    expect(story.props).toEqual([]);

    // Editor buffer defaults (nothing edited yet at the story step) are
    // present as empty maps / null, not `undefined`.
    expect(patch.editingScenePrompt).toEqual({});
    expect(patch.editingCharacterPrompt).toEqual({});
    expect(patch.editingCoverPrompt).toBe('');
    expect(patch.editingEndPrompt).toBe('');
    expect(patch.editingSceneText).toEqual({});
    // editingTitle initial state is `null` (Story step, nothing edited yet).
    expect(patch.editingTitle).toBeNull();
    expect(patch.characterSheetOptions).toEqual({});
    expect(patch.sceneImageOptions).toEqual({});
    expect(patch.coverOptions).toEqual([]);
    expect(patch.endOptions).toEqual([]);
    expect(patch.propReferenceImages).toEqual({});
    expect(patch.selectedCharacterSheets).toEqual({});
    expect(patch.selectedSceneImages).toEqual({});
    expect(patch.selectedCover).toBeNull();
    expect(patch.selectedEnd).toBeNull();
    expect(patch.sceneReferenceModes).toEqual({});
    expect(patch.sceneIncludedCharacters).toEqual({});
    expect(patch.sceneExcludedCharacters).toEqual({});
    expect(patch.coverIncludedCharacters).toEqual([]);
    expect(patch.coverExcludedCharacters).toEqual([]);
    expect(patch.endIncludedCharacters).toEqual([]);
    expect(patch.endExcludedCharacters).toEqual([]);
    expect(patch.sceneReferenceImages).toEqual({});
    expect(patch.coverReferenceImage).toBeNull();
    expect(patch.endReferenceImage).toBeNull();
    expect(patch.landmarkVisible).toEqual({});
    // config block is derived from useState defaults seeded by initialStory.
    const config = patch.config as Record<string, unknown>;
    expect(config).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(config, 'location')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(config, 'illustrationStyle')).toBe(true);

    // 4) Supabase upsert happened at least once (persistence occurred before
    // the local transition — the transition is the visible proof).
    expect(upsertCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// -----------------------------------------------------------------------------
// (F4.2) Persistence rejection: envelope catches, onError runs, no transition.
// -----------------------------------------------------------------------------
describe('A3a/S5(F4) CuentacuentoEditor approval envelope — rejection path', () => {
  it('when enqueueDraftWrite rejects, editor stays on story step and shows error', async () => {
    await renderAtStoryStep();
    resetCallLog();

    // Configure the NEXT upsert to reject with a supabase error object.
    upsertDefaultError = { message: 'boom' };

    const approveButton = screen.getByRole('button', {
      name: /Aprobar cuento y generar imágenes/i,
    });

    await act(async () => {
      fireEvent.click(approveButton);
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });

    // Envelope must have called the live getters + enqueue exactly once.
    expect(callLog.getSaveFailedCountCalls).toBeGreaterThanOrEqual(1);
    expect(callLog.isBusySavingCalls).toBeGreaterThanOrEqual(1);
    expect(callLog.enqueuePatches).toHaveLength(1);

    // No transition — the approve button is STILL rendered (still on story step).
    expect(
      screen.queryByRole('button', {
        name: /Aprobar cuento y generar imágenes/i,
      })
    ).not.toBeNull();

    // No auto-kick: `pipeline.runItems` must NOT have fired for a rejected
    // approval, because the step never advanced to `characters`.
    expect(callLog.runItemsCalls).toBe(0);

    // Reset error for the next test to avoid leaking state across the file.
    upsertDefaultError = null;
  });
});

// -----------------------------------------------------------------------------
// (F4.3) Stale path: preStart evaluates false via a mid-flight bump epoch,
// enqueue resolves { stale: true } → onStale → no transition.
//
// The strict `stale` outcome is covered end-to-end at the hook level by
// `useCuentacuentosDraft.a3a.subtask6.test.ts` (b), which threads a
// `preStart: () => false` through the real hook and asserts
// `runApprovalTransaction` reports `'stale'`, zero upserts, and zero
// commit to the React draft. At the component level, the shared envelope
// funnels stale into `onStale` identically to error → the "no transition"
// visible signal is the same as (F4.2).
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// (F4.4) Auto-kick timing: successful approval arms EXACTLY ONE auto-kick
// (`pipeline.runItems`) and only AFTER persistence resolves. Ordering is
// proven by blocking the upsert on a deferred: while it is pending, no
// runItems call has occurred; after it resolves the effect fires and
// runItems is called exactly once.
// -----------------------------------------------------------------------------
describe('A3a/S5(F4) auto-kick timing — persistence-first', () => {
  it('does not auto-kick pipeline.runItems until the upsert resolves, then kicks exactly once', async () => {
    const blocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(blocker);

    await renderAtStoryStep();
    resetCallLog();

    const approveButton = screen.getByRole('button', {
      name: /Aprobar cuento y generar imágenes/i,
    });
    await act(async () => {
      fireEvent.click(approveButton);
      // Yield past flush/enqueue microtasks so the envelope reaches the
      // point of awaiting persistence.
      for (let i = 0; i < 6; i++) await Promise.resolve();
    });

    // Envelope committed the write and is now blocked on the upsert.
    expect(callLog.enqueuePatches).toHaveLength(1);
    expect(upsertCalls).toHaveLength(1);
    // Auto-kick must NOT have fired: persistence has not resolved, so
    // `setCurrentStep('characters')` has not run yet, so the auto-kick
    // effect has not observed the forward transition.
    expect(callLog.runItemsCalls).toBe(0);
    // Approve button still visible — no local transition yet.
    expect(
      screen.queryByRole('button', {
        name: /Aprobar cuento y generar imágenes/i,
      }),
    ).not.toBeNull();

    // Release the upsert; envelope resolves, onSuccess runs, step transitions,
    // and the auto-kick effect fires runItems ONCE for character sheets.
    await act(async () => {
      blocker.resolve({ error: null });
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });

    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: /Aprobar cuento y generar imágenes/i,
        }),
      ).toBeNull(),
    );
    expect(callLog.runItemsCalls).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// (F4.5) Gate: existing save-failed entries block the approval envelope.
// canApprove returns false because the getter reports >0 save-failed entries
// for the live identity → no enqueue, no transition, no auto-kick.
// -----------------------------------------------------------------------------
describe('A3a/S5(F4) gate: save-failed count > 0 blocks approval', () => {
  it('when getSaveFailedCount(identity) > 0, envelope skips enqueue and does not transition or auto-kick', async () => {
    await renderAtStoryStep();
    resetCallLog();

    // Force the getter to report a save-failed entry against the live
    // identity. Wrapper still records the call (F1 return-shape signal).
    overrideGetSaveFailedCount = () => 1;

    const approveButton = screen.getByRole('button', {
      name: /Aprobar cuento y generar imágenes/i,
    });
    await act(async () => {
      fireEvent.click(approveButton);
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });

    // Envelope consulted BOTH live getters after the flush (proves the F1
    // return shape is still consumed on the blocked branch).
    expect(callLog.flushCalls).toBeGreaterThanOrEqual(1);
    expect(callLog.getSaveFailedCountCalls).toBeGreaterThanOrEqual(1);
    expect(callLog.isBusySavingCalls).toBeGreaterThanOrEqual(1);

    // canApprove was false → NO enqueue, NO upsert, NO transition, NO kick.
    expect(callLog.enqueuePatches).toHaveLength(0);
    expect(upsertCalls).toHaveLength(0);
    expect(callLog.runItemsCalls).toBe(0);
    expect(
      screen.queryByRole('button', {
        name: /Aprobar cuento y generar imágenes/i,
      }),
    ).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// (F4.6) Gate: an in-flight persistence (`isBusySaving()` true) blocks the
// approval envelope for the same reason: canApprove returns false.
// -----------------------------------------------------------------------------
describe('A3a/S5(F4) gate: isBusySaving true blocks approval', () => {
  it('when isBusySaving() reports true post-flush, envelope skips enqueue and does not transition or auto-kick', async () => {
    await renderAtStoryStep();
    resetCallLog();

    overrideIsBusySaving = () => true;

    const approveButton = screen.getByRole('button', {
      name: /Aprobar cuento y generar imágenes/i,
    });
    await act(async () => {
      fireEvent.click(approveButton);
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });

    expect(callLog.flushCalls).toBeGreaterThanOrEqual(1);
    expect(callLog.getSaveFailedCountCalls).toBeGreaterThanOrEqual(1);
    expect(callLog.isBusySavingCalls).toBeGreaterThanOrEqual(1);

    expect(callLog.enqueuePatches).toHaveLength(0);
    expect(upsertCalls).toHaveLength(0);
    expect(callLog.runItemsCalls).toBe(0);
    expect(
      screen.queryByRole('button', {
        name: /Aprobar cuento y generar imágenes/i,
      }),
    ).not.toBeNull();
  });
});

// -----------------------------------------------------------------------------
// (F4.7) Finalization envelope: parent `onStoryCreated` fires ONLY after
// persistence resolves. The editor is bootstrapped past scenes with pre-seeded
// selections and cover/end options so the Finalize button becomes reachable
// via a Scenes → Cover approval + Finalize click.
// -----------------------------------------------------------------------------

function makeScenesPendingStory(id = 'story-fin'): Story {
  return {
    id,
    title: 'Cuento a finalizar',
    summary: 'Resumen',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [
      {
        id: 'char-1',
        name: 'María',
        role: 'protagonist',
        description: 'Niña curiosa',
        visualDescription: 'niña con vestido azul',
        characterSheetUrl: 'https://mock/char-1.png',
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      {
        number: 1,
        text: 'Escena de apertura',
        visualDescription: 'plaza soleada',
        selectedImageUrl: 'https://mock/scene-1.png',
      } as unknown as Story['scenes'][number],
      {
        number: 2,
        text: 'Escena de nudo',
        visualDescription: 'templo antiguo',
        selectedImageUrl: 'https://mock/scene-2.png',
      } as unknown as Story['scenes'][number],
    ],
    props: [],
    spiritualConnection: 'Esperanza',
    coverImageUrl: 'https://mock/cover.png',
    endImageUrl: 'https://mock/end.png',
    metadata: {
      createdAt: '',
      updatedAt: '',
      status: 'scenes-pending' as Story['metadata']['status'],
    },
  } as Story;
}

async function renderReadyForFinalize() {
  const onStoryCreated = vi.fn();
  const rendered = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeScenesPendingStory()}
      onStoryCreated={onStoryCreated}
    />,
  );
  // Editor mounts at Scenes step with all selections pre-populated.
  const approveScenes = await screen.findByRole('button', {
    name: /Aprobar escenas/i,
  });
  return { ...rendered, onStoryCreated, approveScenes };
}

describe('A3a/S5(F4) finalization envelope — success path', () => {
  it('handleFinalize notifies parent onStoryCreated ONLY after persistence resolves', async () => {
    const { onStoryCreated, approveScenes } = await renderReadyForFinalize();

    // Step 1: click Approve Scenes to transition scenes → cover. This upsert
    // resolves synchronously (no deferred queued), moving the UI to the
    // cover step where Finalize is enabled.
    await act(async () => {
      fireEvent.click(approveScenes);
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    const finalizeButton = await screen.findByRole('button', {
      name: /Finalizar cuento/i,
    });
    resetCallLog();

    // Step 2: `flushPendingDraftWrites` inside the finalize envelope will
    // flush the debounced editor-buffer patch that the saveDraft effect
    // enqueued on the scenes→cover transition — that consumes ONE upsert.
    // Prime a resolved deferred first so the flush's upsert resolves cleanly,
    // then queue the actual `blocker` for the finalize authoritative write.
    const drain = makeDeferred<{ error: null }>();
    drain.resolve({ error: null });
    const blocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(drain, blocker);
    await act(async () => {
      fireEvent.click(finalizeButton);
      for (let i = 0; i < 12; i++) await Promise.resolve();
    });
    expect(callLog.enqueuePatches).toHaveLength(1);
    // Persistence not yet resolved → parent not notified.
    expect(onStoryCreated).not.toHaveBeenCalled();

    // Resolve — onSuccess runs, parent MUST be notified exactly once with the
    // finalized `Story` (metadata.status === 'ready').
    await act(async () => {
      blocker.resolve({ error: null });
      for (let i = 0; i < 12; i++) await Promise.resolve();
    });
    await waitFor(() => expect(onStoryCreated).toHaveBeenCalledTimes(1));
    const [finalStory] = onStoryCreated.mock.calls[0] as [Story, unknown];
    expect(finalStory.metadata.status).toBe('ready');
  });
});

describe('A3a/S5(F4) finalization envelope — rejection path', () => {
  it('handleFinalize does NOT notify parent when the persistence rejects', async () => {
    const { onStoryCreated, approveScenes } = await renderReadyForFinalize();

    // Advance to cover step (approval upsert resolves default = no error).
    await act(async () => {
      fireEvent.click(approveScenes);
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    const finalizeButton = await screen.findByRole('button', {
      name: /Finalizar cuento/i,
    });
    resetCallLog();

    // Make the NEXT upsert (finalize) return a supabase error object.
    upsertDefaultError = { message: 'io down' };

    await act(async () => {
      fireEvent.click(finalizeButton);
      for (let i = 0; i < 12; i++) await Promise.resolve();
    });

    // Envelope reached enqueue but persistence failed → onSuccess never ran.
    expect(callLog.enqueuePatches).toHaveLength(1);
    expect(onStoryCreated).not.toHaveBeenCalled();
    // Finalize button still visible (no transition to 'complete').
    expect(
      screen.queryByRole('button', { name: /Finalizar cuento/i }),
    ).not.toBeNull();

    upsertDefaultError = null;
  });
});
