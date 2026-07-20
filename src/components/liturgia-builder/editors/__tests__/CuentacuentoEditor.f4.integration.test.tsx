/**
 * F4 — Honest approval/finalization envelope integration suite.
 *
 * Renders the REAL CuentacuentoEditor with REAL hooks (useCuentacuentosDraft,
 * useStoryImagePipeline, approvalGate, storyImagePipelineRunner, taskFactories).
 * Only external boundaries are mocked:
 *   - @/integrations/supabase/client (from/storage/functions/auth)
 *   - @/hooks/use-toast
 *   - global fetch
 *   - timers (vi fake timers, only to arm/fire the 2s debounce deterministically)
 *
 * NO vi.mock on useCuentacuentosDraft, useStoryImagePipeline, approvalGate,
 * buildAuthoritativeDraftPatch, storyImagePipelineRunner, or taskFactories.
 *
 * Upsert payload shape (supabase.from('cuentacuentos_drafts').upsert(row)):
 *   row.current_step                          — step persisted with the write
 *   row.story                                 — Story JSONB (metadata.status, id)
 *   row.story.editorStateV1.edited.scenePrompt — editor buffer round-trip
 *   row.story.editorStateV1.edited.sceneText   — editor buffer round-trip
 *   row.story.editorStateV1.edited.title       — editor buffer round-trip
 *
 * Spec cases (Direct Execution charter, 1–12). BASE-RED on 02f7909 for the
 * intended reason: cases 2, 3, 11 and 12 (the envelope races). Cases 1 and
 * 4–10 codify contracts that must hold before AND after the fix.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

// ---------------------------------------------------------------------------
// Deferred utility
// ---------------------------------------------------------------------------

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

/** Deferred pre-resolved with a successful upsert result. */
function makeResolvedOk(): Deferred<{ error: { message: string } | null }> {
  const d = makeDeferred<{ error: { message: string } | null }>();
  d.resolve({ error: null });
  return d;
}

/** Deferred pre-resolved with a failing upsert result. */
function makeResolvedFail(message: string): Deferred<{ error: { message: string } | null }> {
  const d = makeDeferred<{ error: { message: string } | null }>();
  d.resolve({ error: { message } });
  return d;
}

// ---------------------------------------------------------------------------
// External-boundary trackers
// ---------------------------------------------------------------------------

type UpsertPayload = Record<string, unknown>;
const upsertCalls: Array<{ payload: UpsertPayload }> = [];
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let upsertDefaultError: { message: string } | null = null;
let mockUserId: string | null = 'user-f4-integration';

// functions.invoke tracker (provider boundary — kicks/generation)
const invokeCalls: Array<{ fn: string }> = [];

// delete tracker (draft row deletion — finalization acknowledgement)
const deletedDraftRows: Array<{ liturgiaId: string }> = [];

// recovery-row served to the mount-time checkForDraft (case 4)
let mockDraftRow: Record<string, unknown> | null = null;

// ---------------------------------------------------------------------------
// Supabase mock — external boundary only
// ---------------------------------------------------------------------------

vi.mock('@/integrations/supabase/client', () => {
  const makeDeleteChain = (tableName: string) => {
    const chain = {
      eq: (col: string, val: unknown) => {
        if (tableName === 'cuentacuentos_drafts' && col === 'liturgia_id') {
          deletedDraftRows.push({ liturgiaId: String(val) });
        }
        return chain;
      },
    };
    return chain;
  };

  const tableApi = (tableName: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => ({
      data: tableName === 'cuentacuentos_drafts' ? mockDraftRow : null,
      error: null,
    })),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockImplementation(async (payload: UpsertPayload) => {
      upsertCalls.push({ payload });
      const deferred = upsertDeferreds.shift();
      if (deferred) return deferred.promise;
      return { error: upsertDefaultError };
    }),
    delete: vi.fn().mockImplementation(() => makeDeleteChain(tableName)),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  });

  const storageApi = () => ({
    upload: vi.fn().mockImplementation(async (path: string) => ({
      data: { path },
      error: null,
    })),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/cuentacuentos-drafts/${path}` },
    })),
    remove: vi.fn().mockResolvedValue({ error: null }),
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn((table: string) => tableApi(table)),
      storage: { from: vi.fn(() => storageApi()) },
      functions: {
        invoke: vi.fn().mockImplementation(async (fn: string) => {
          invokeCalls.push({ fn });
          // Valid provider shape so the REAL taskFactories generate path
          // succeeds (`success` + non-empty `images`).
          return {
            data: { success: true, images: ['data:image/png;base64,iVBORw0KGgo='] },
            error: null,
          };
        }),
      },
      auth: {
        getUser: vi.fn().mockImplementation(async () => ({
          data: { user: mockUserId ? { id: mockUserId } : null },
        })),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      },
    },
  };
});

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocks are defined
// ---------------------------------------------------------------------------

import CuentacuentoEditor from '../CuentacuentoEditor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseContext: LiturgyContext = {
  id: 'lit-f4-integration',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy F4',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

function makeStoryGeneratedStory(id = 'story-sg-1'): Story {
  return {
    id,
    title: 'Cuento de integración',
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

/** characters-approved → scenes step */
function makeCharactersApprovedStory(id = 'story-ca-1'): Story {
  return {
    ...makeStoryGeneratedStory(id),
    title: 'Cuento aprobado chars',
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
    metadata: {
      createdAt: '',
      updatedAt: '',
      status: 'characters-approved' as Story['metadata']['status'],
    },
  } as Story;
}

/** scenes-pending → cover step (finalization flows) */
function makeScenesPendingStory(id = 'story-fin'): Story {
  return {
    ...makeCharactersApprovedStory(id),
    title: 'Cuento a finalizar',
    coverImageUrl: 'https://mock/cover.png',
    endImageUrl: 'https://mock/end.png',
    metadata: {
      createdAt: '',
      updatedAt: '',
      status: 'scenes-pending' as Story['metadata']['status'],
    },
  } as Story;
}

// ---------------------------------------------------------------------------
// Upsert payload helpers
// ---------------------------------------------------------------------------

function parseUpsertRow(payload: UpsertPayload) {
  const currentStep = (payload['current_step'] as string | null) ?? null;
  const story = (payload['story'] as Record<string, unknown> | null) ?? null;
  const metadata = (story?.['metadata'] as Record<string, unknown> | null) ?? null;
  const status = (metadata?.['status'] as string | null) ?? null;
  const storyId = (story?.['id'] as string | null) ?? null;
  const editorStateV1 = (story?.['editorStateV1'] as Record<string, unknown> | null) ?? null;
  const edited = (editorStateV1?.['edited'] as Record<string, unknown> | null) ?? null;
  const editingScenePrompt = edited?.['scenePrompt'] as Record<number, string> | undefined;
  const editingSceneText = edited?.['sceneText'] as Record<number, string> | undefined;
  const editedTitle = edited?.['title'] as string | null | undefined;
  return { currentStep, status, storyId, editingScenePrompt, editingSceneText, editedTitle };
}

function isAuthoritativeStoryToCharacters(payload: UpsertPayload): boolean {
  const { currentStep, status } = parseUpsertRow(payload);
  return currentStep === 'characters' && status === 'characters-pending';
}

function isAuthoritativeCharactersToScenes(payload: UpsertPayload): boolean {
  const { currentStep, status } = parseUpsertRow(payload);
  return currentStep === 'scenes' && status === 'characters-approved';
}

function isAuthoritativeScenesToCover(payload: UpsertPayload): boolean {
  const { currentStep, status } = parseUpsertRow(payload);
  return currentStep === 'cover' && status === 'scenes-pending';
}

function isAuthoritativeFinalize(payload: UpsertPayload): boolean {
  const { currentStep, status } = parseUpsertRow(payload);
  return currentStep === 'complete' && status === 'ready';
}

/** Step recorded by an upsert row. */
function stepOf(c: { payload: UpsertPayload }): string | null {
  return parseUpsertRow(c.payload).currentStep;
}

/** All writes that persisted a given step. */
function writesAtStep(step: string) {
  return upsertCalls.filter((c) => stepOf(c) === step);
}

/**
 * Number of TRANSITIONS into `step` across the upsert sequence: an index i
 * counts when step(i) === step and step(i-1) !== step. Robust against
 * follow-up pipeline persists that keep writing the same step, while still
 * catching a stale write that regresses the step and re-enters it.
 */
function countStepTransitions(step: string): number {
  let n = 0;
  let prev: string | null = null;
  for (const c of upsertCalls) {
    const s = stepOf(c);
    if (s === step && prev !== step) n++;
    prev = s;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  upsertCalls.length = 0;
  upsertDeferreds.length = 0;
  upsertDefaultError = null;
  invokeCalls.length = 0;
  deletedDraftRows.length = 0;
  mockUserId = 'user-f4-integration';
  mockDraftRow = null;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: null }),
    } as unknown as Response)
  );
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Drive helpers
// ---------------------------------------------------------------------------

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

async function renderAtStoryStep(storyId = 'story-sg') {
  const onStoryCreated = vi.fn();
  const rendered = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeStoryGeneratedStory(storyId)}
      onStoryCreated={onStoryCreated}
    />
  );
  await waitFor(
    () => expect(screen.getByRole('button', { name: /Aprobar cuento y generar imágenes/i })).toBeTruthy(),
    { timeout: 3000 }
  );
  return { ...rendered, onStoryCreated };
}

async function renderAtScenesStep(storyId = 'story-ca') {
  const onStoryCreated = vi.fn();
  const rendered = render(
    <CuentacuentoEditor
      context={baseContext}
      initialStory={makeCharactersApprovedStory(storyId)}
      onStoryCreated={onStoryCreated}
    />
  );
  await waitFor(
    () => expect(screen.getByRole('button', { name: /Aprobar escenas/i })).toBeTruthy(),
    { timeout: 3000 }
  );
  return { ...rendered, onStoryCreated };
}

/**
 * At the scenes step, expand scene 1's prompt panel and type into the PROMPT
 * textarea (textareas[1] after expansion; [0] is scene text). Triggers
 * setEditingScenePrompt → auto-persist effect → bumpContentRevision + saveDraft
 * → arms the 2s debounce with current_step='scenes'.
 */
async function armScenePromptDebounce(promptValue = 'EDITED PROMPT'): Promise<HTMLElement> {
  const verPromptBtns = screen.queryAllByRole('button', { name: /Ver prompt/i });
  if (verPromptBtns.length === 0) {
    throw new Error('No "Ver prompt" button found at scenes step');
  }
  await act(async () => {
    fireEvent.click(verPromptBtns[0]);
  });
  const textareas = screen.queryAllByRole('textbox');
  expect(textareas.length).toBeGreaterThanOrEqual(2);
  const promptTextarea = textareas[1];
  await act(async () => {
    fireEvent.change(promptTextarea, { target: { value: promptValue } });
  });
  return promptTextarea;
}

/** Same as above but for the scene TEXT textarea (textareas[0]). */
function armSceneTextDebounceSync(textValue: string): void {
  act(() => {
    const verPromptBtns = screen.queryAllByRole('button', { name: /Ver prompt/i });
    if (verPromptBtns.length > 0) fireEvent.click(verPromptBtns[0]);
  });
  act(() => {
    const textareas = screen.queryAllByRole('textbox');
    expect(textareas.length).toBeGreaterThanOrEqual(1);
    fireEvent.change(textareas[0], { target: { value: textValue } });
  });
}

// ---------------------------------------------------------------------------
// Case 1 — Normal approval: pending debounce drains, exactly ONE authoritative
// commit, then transition and exactly ONE auto-kick, strictly after persistence.
// ---------------------------------------------------------------------------
describe('Case 1: debounce drains, one authoritative commit, one kick after persistence', () => {
  it('story→characters: kick fires only AFTER the authoritative upsert resolves, exactly once', { timeout: 15000 }, async () => {
    await renderAtStoryStep('story-c1');

    // Block the authoritative upsert to observe ordering.
    const authBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(authBlocker);

    const approveBtn = screen.getByRole('button', { name: /Aprobar cuento y generar imágenes/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(10);
    });

    // While persistence is in flight: no transition, no kick.
    expect(screen.queryByRole('button', { name: /Aprobar cuento y generar imágenes/i })).not.toBeNull();
    expect(invokeCalls).toHaveLength(0);

    await act(async () => {
      authBlocker.resolve({ error: null });
      await yields(15);
    });

    // Transition happened.
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar cuento y generar imágenes/i })).toBeNull(),
      { timeout: 5000 }
    );
    // Exactly ONE transition into 'characters' (follow-up pipeline persists
    // stay at the same step and must not re-enter it).
    expect(countStepTransitions('characters')).toBe(1);
    // And the transition write itself is the authoritative one.
    const firstCharactersWrite = upsertCalls.find((c) => stepOf(c) === 'characters');
    expect(firstCharactersWrite && isAuthoritativeStoryToCharacters(firstCharactersWrite.payload)).toBe(true);
    // Exactly one kick (1 character → 1 sheet generation invoke), post-commit.
    await waitFor(() => expect(invokeCalls.length).toBeGreaterThanOrEqual(1), { timeout: 4000 });
    await act(async () => { await yields(10); });
    expect(invokeCalls).toHaveLength(1);
  });

  it('scenes→cover: a pending debounced edit is drained (persisted) before the single authoritative commit', { timeout: 15000 }, async () => {
    await renderAtScenesStep('story-c1b');

    // Arm a debounce with a real UI edit; the envelope must flush it, not drop it.
    await armScenePromptDebounce('PENDING EDIT');

    const approveBtn = screen.getByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(20);
    });

    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
      { timeout: 5000 }
    );

    const authIdx = upsertCalls.findIndex((c) => isAuthoritativeScenesToCover(c.payload));
    expect(authIdx).toBeGreaterThanOrEqual(0);
    // Exactly ONE transition into 'cover' (post-transition pipeline persists
    // keep the step; they must not re-enter it).
    expect(countStepTransitions('cover')).toBe(1);
    // The drained debounce write ran BEFORE the authoritative one (a
    // 'scenes'-step write precedes the first 'cover' write).
    const drainIdx = upsertCalls.findIndex((c) => stepOf(c) === 'scenes');
    expect(drainIdx).toBeGreaterThanOrEqual(0);
    expect(drainIdx).toBeLessThan(authIdx);
    // And the authoritative snapshot itself carries the drained edit — the
    // envelope read LIVE refs, not a pre-drain closure.
    expect(parseUpsertRow(upsertCalls[authIdx].payload).editingScenePrompt?.[1]).toBe('PENDING EDIT');
  });
});

// ---------------------------------------------------------------------------
// Case 2 (BASE-RED) — Same-story edit while the initial DRAIN is blocked ⇒
// stale: zero authoritative enqueue/transition/kick effects; newest edit kept.
//
// BASE DEFECT: the envelope captures no pre-drain identity — after the drain it
// re-baselines on the (already mutated) live identity and proceeds to commit.
// ---------------------------------------------------------------------------
describe('Case 2 (BASE-RED): edit during blocked drain ⇒ stale with zero authoritative effects', () => {
  it('returns stale, enqueues no authoritative write, keeps the newest edit', { timeout: 15000 }, async () => {
    await renderAtScenesStep('story-c2');

    // 1. Arm the pending debounce the envelope will have to drain.
    const promptTextarea = await armScenePromptDebounce('ORIGINAL EDIT');

    // 2. Block the DRAIN: the flushed pending write consumes this deferred.
    const drainBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(drainBlocker);

    // 3. Click approve — envelope captures identity, flush starts, drain blocks.
    const approveBtn = screen.getByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(8);
    });
    expect(screen.queryByRole('button', { name: /Finalizar cuento/i })).toBeNull();

    // 4. While the drain is blocked, edit through the UI (arms a NEW debounce
    //    under fake timers so we can fire it deterministically later).
    vi.useFakeTimers({ shouldAdvanceTime: false });
    act(() => {
      fireEvent.change(promptTextarea, { target: { value: 'NEW EDIT' } });
    });
    // Fire the new debounce: its write queues BEHIND the blocked drain write.
    await act(async () => {
      vi.advanceTimersByTime(2100);
      await yields(4);
    });
    vi.useRealTimers();

    // 5. Release the drain → envelope's post-drain comparison must see the
    //    mid-drain edit (contentRevision) and go stale BEFORE the gate/enqueue.
    await act(async () => {
      drainBlocker.resolve({ error: null });
      await yields(20);
    });

    // ZERO authoritative effects: the envelope aborted BEFORE enqueue, so no
    // write at the target step exists at all.
    expect(writesAtStep('cover')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Finalizar cuento/i })).toBeNull();
    expect(invokeCalls).toHaveLength(0);
    // Stale is surfaced to the user.
    expect(screen.queryAllByText(/El borrador cambió durante la aprobación/i).length).toBeGreaterThan(0);
    // The UI still shows the newest edit (retained, not clobbered).
    expect((promptTextarea as HTMLTextAreaElement).value).toBe('NEW EDIT');

    // Retention end-to-end: approving again (everything default-succeeds now)
    // commits a transition whose authoritative snapshot carries the newest
    // edit — the mid-drain edit was preserved and is able to persist.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aprobar escenas/i }));
      await yields(25);
    });
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
      { timeout: 5000 }
    );
    expect(countStepTransitions('cover')).toBe(1);
    const commitWrite = upsertCalls.find((c) => isAuthoritativeScenesToCover(c.payload));
    expect(commitWrite && parseUpsertRow(commitWrite.payload).editingScenePrompt?.[1]).toBe('NEW EDIT');
  });
});

// ---------------------------------------------------------------------------
// Case 3 (BASE-RED) — Same-story edit while the AUTHORITATIVE upsert is in
// flight ⇒ persistence resolves stale: no transition; newest edit retained
// and able to persist.
//
// BASE DEFECT: the post-persistence CAS ignores contentRevision for
// authoritative writes — the stale approval commits, transitions, and its
// authoritative bump invalidates the edit's queued debounce.
// ---------------------------------------------------------------------------
describe('Case 3 (BASE-RED): edit during blocked authoritative upsert ⇒ stale, edit persists', () => {
  it('does not transition, surfaces stale, and the mid-flight edit persists afterwards', { timeout: 15000 }, async () => {
    await renderAtScenesStep('story-c3');

    // 1. Block the authoritative upsert (no pending debounce at this point).
    const authBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(authBlocker);

    const approveBtn = screen.getByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(8);
    });
    expect(screen.queryByRole('button', { name: /Finalizar cuento/i })).toBeNull();

    // 2. While the authoritative write is in flight, edit through the UI.
    vi.useFakeTimers({ shouldAdvanceTime: false });
    armSceneTextDebounceSync('MID-FLIGHT EDIT');
    await act(async () => {
      vi.advanceTimersByTime(2100); // edit's own write queues behind the auth
      await yields(4);
    });
    vi.useRealTimers();

    // 3. Release the authoritative upsert.
    await act(async () => {
      authBlocker.resolve({ error: null });
      await yields(20);
    });

    // The authoritative I/O ran (allowed) but resolved STALE: no transition,
    // no kick, stale surfaced.
    const authWrites = writesAtStep('cover');
    expect(authWrites).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Finalizar cuento/i })).toBeNull();
    expect(invokeCalls).toHaveLength(0);
    expect(screen.queryAllByText(/El borrador cambió durante la aprobación/i).length).toBeGreaterThan(0);

    // The mid-flight edit's own queued write RAN after the stale authoritative
    // one (its debounce identity stayed valid — no authoritative bump killed
    // it): a 'scenes'-step write exists after the stale 'cover' write.
    await waitFor(
      () => {
        const authIdx = upsertCalls.findIndex((c) => stepOf(c) === 'cover');
        const lateIdx = upsertCalls.findIndex((c, i) => i > authIdx && stepOf(c) === 'scenes');
        expect(lateIdx).toBeGreaterThan(authIdx);
      },
      { timeout: 3000 }
    );

    // Retention end-to-end: approving again commits and the authoritative
    // snapshot carries the mid-flight edit.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aprobar escenas/i }));
      await yields(25);
    });
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
      { timeout: 5000 }
    );
    const commitWrite = upsertCalls.filter((c) => isAuthoritativeScenesToCover(c.payload)).pop();
    expect(commitWrite && parseUpsertRow(commitWrite.payload).editingSceneText?.[1]).toBe('MID-FLIGHT EDIT');
  });
});

// ---------------------------------------------------------------------------
// Case 4 — Lifecycle identity change while the DRAIN is blocked ⇒ ZERO old
// authoritative effects (strict zero — no enqueue at all).
//
// Lifecycle trigger is real UI: declining the recovery prompt ("Empezar de
// nuevo") bumps the draft epoch.
// ---------------------------------------------------------------------------
describe('Case 4: lifecycle identity change while drain is blocked ⇒ zero authoritative effects', () => {
  it('declining recovery (epoch bump) during the blocked drain aborts the envelope before enqueue', async () => {
    // Serve a recovery row so the recovery modal is present at mount.
    mockDraftRow = {
      current_step: 'scenes',
      story: {
        id: 'story-rec',
        title: 'Recuperado',
        characters: [],
        scenes: [],
        props: [],
        metadata: { createdAt: '', updatedAt: '', status: 'characters-approved' },
      },
      config: {},
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: '2026-05-01T00:00:00Z',
    };

    await renderAtScenesStep('story-c4');
    // Recovery modal is up (real UI lifecycle control available).
    await waitFor(
      () => expect(screen.getByRole('button', { name: /Empezar de nuevo/i })).toBeTruthy(),
      { timeout: 3000 }
    );

    // Arm a pending debounce so the envelope has a real drain to block.
    await armScenePromptDebounce('EDIT BEFORE LIFECYCLE');
    const drainBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(drainBlocker);

    const approveBtn = screen.getByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(8);
    });

    // While the drain is blocked, the user declines recovery → epoch bump.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Empezar de nuevo/i }));
      await yields(4);
    });

    // Release the drain.
    await act(async () => {
      drainBlocker.resolve({ error: null });
      await yields(20);
    });

    // STRICT ZERO authoritative effects for the old lifecycle: no write at
    // the target step exists at all (the envelope aborted before enqueue).
    expect(writesAtStep('cover')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Finalizar cuento/i })).toBeNull();
    expect(invokeCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Case 5 — Lifecycle identity change during PERSISTENCE ⇒ no success-only
// effect (no transition, no kick, no parent callback).
//
// Lifecycle trigger is real UI: the story step's "Regenerar" button
// (handleRegenerate → epoch bump + story replacement).
// ---------------------------------------------------------------------------
describe('Case 5: lifecycle identity change during persistence ⇒ no success transition', () => {
  it('clicking Regenerar while the authoritative upsert is in flight yields zero success effects', async () => {
    const { onStoryCreated } = await renderAtStoryStep('story-c5');

    const authBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(authBlocker);

    const approveBtn = screen.getByRole('button', { name: /Aprobar cuento y generar imágenes/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(6);
    });

    // Real UI lifecycle change while persistence is in flight.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Regenerar$/i }));
      await yields(6);
    });

    await act(async () => {
      authBlocker.resolve({ error: null });
      await yields(20);
    });

    // The I/O ran, but success-only effects are all absent: the editor is back
    // at the config form (regenerate), never at the characters step.
    expect(screen.queryByRole('button', { name: /Aprobar cuento y generar imágenes/i })).toBeNull();
    expect(invokeCalls).toHaveLength(0); // no auto-kick for the dead approval
    expect(onStoryCreated).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Case 6 — A REAL save-failed pipeline entry (driven through the UI + mocked
// external persistence failure) blocks approval with zero authoritative effects.
// ---------------------------------------------------------------------------
describe('Case 6: real save-failed pipeline entry disables approval (gate wired to the button)', () => {
  it('a failed pipeline persist creates a save-failed entry; the approve button is disabled and a click yields zero effects', { timeout: 15000 }, async () => {
    await renderAtStoryStep('story-c6');

    // FIFO deferred plan: [auth ok] then [pipeline persist FAILS].
    upsertDeferreds.push(makeResolvedOk(), makeResolvedFail('persist boom'));

    // Approve story → transition → auto-kick generates the character sheet →
    // apply → pipeline persist consumes the failing deferred → save-failed.
    const approveBtn = screen.getByRole('button', { name: /Aprobar cuento y generar imágenes/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(25);
    });
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar cuento y generar imágenes/i })).toBeNull(),
      { timeout: 5000 }
    );
    // The kick really ran (provider invoked) and its persist really failed:
    // the save-retry banner appears with the retry button.
    await waitFor(() => expect(invokeCalls.length).toBeGreaterThanOrEqual(1), { timeout: 4000 });
    await waitFor(
      () => expect(screen.queryAllByText(/Reintentar guardado/i).length).toBeGreaterThan(0),
      { timeout: 5000 }
    );

    // HONEST gate assertion. The gate is ENFORCED via the disabled attribute:
    // the approve button's `disabled` shares the `canApprove` predicate with the
    // runtime gate, so a real save-failed entry disables it. A disabled button
    // suppresses onClick (React does not dispatch to disabled form controls), so
    // the integration truth is: button disabled + warning shown + a click yields
    // zero authoritative effects. The runtime gate predicate and the
    // `runApprovalTransaction` onBlocked path are unit-covered deterministically
    // in src/lib/cuentacuentos/__tests__/approvalGate.a3.test.ts.
    const approveChars = screen.getByRole('button', { name: /Aprobar personajes/i });
    expect((approveChars as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryAllByText(/Hay imágenes sin guardar; reintenta antes de aprobar/i).length).toBeGreaterThan(0);
    const beforeCount = upsertCalls.length;
    await act(async () => {
      fireEvent.click(approveChars);
      await yields(20);
    });
    expect(upsertCalls.slice(beforeCount).filter((c) => stepOf(c) === 'scenes')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Aprobar personajes/i })).not.toBeNull(); // no transition
  });
});

// ---------------------------------------------------------------------------
// Case 7 — REAL in-flight pipeline persistence blocks approval until it
// settles; afterwards the same approval path succeeds.
// ---------------------------------------------------------------------------
describe('Case 7: real in-flight pipeline persistence disables approval; re-enables after it settles', () => {
  it('the approve button is disabled (zero effects) while a pipeline persist is held; approval succeeds after it settles', { timeout: 20000 }, async () => {
    await renderAtStoryStep('story-c7');

    // FIFO plan: [auth ok] then [pipeline persist HELD in-flight].
    const persistHold = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(makeResolvedOk(), persistHold);

    const approveBtn = screen.getByRole('button', { name: /Aprobar cuento y generar imágenes/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(25);
    });
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar cuento y generar imágenes/i })).toBeNull(),
      { timeout: 5000 }
    );
    await waitFor(() => expect(invokeCalls.length).toBeGreaterThanOrEqual(1), { timeout: 4000 });

    // HONEST gate assertion: while the pipeline persist is in flight, canApprove
    // is false ⇒ the button is disabled ⇒ a click is suppressed, yielding zero
    // authoritative effects. (Runtime gate logic unit-covered in
    // approvalGate.a3.test.ts.)
    const approveChars = screen.getByRole('button', { name: /Aprobar personajes/i });
    expect((approveChars as HTMLButtonElement).disabled).toBe(true);
    const beforeCount = upsertCalls.length;
    await act(async () => {
      fireEvent.click(approveChars);
      await yields(25);
    });
    expect(upsertCalls.slice(beforeCount).filter((c) => stepOf(c) === 'scenes')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Aprobar personajes/i })).not.toBeNull();

    // Release the pipeline persist → item settles.
    await act(async () => {
      persistHold.resolve({ error: null });
      await yields(25);
    });

    // Complete the REAL user flow: select the generated sheet (the approve
    // button also requires a selection), then approve. The button's disabled
    // gate includes canApprove/isRunning — wait (bounded) until the settled
    // pipeline re-enables it.
    const sheetOptionBtn = await waitFor(
      () => {
        const btns = screen.getAllByRole('button', { name: /Opción 1/i });
        expect(btns.length).toBeGreaterThan(0);
        return btns[0];
      },
      { timeout: 5000 }
    );
    await act(async () => {
      fireEvent.click(sheetOptionBtn);
      await yields(5);
    });
    const approveAfter = screen.getByRole('button', { name: /Aprobar personajes/i });
    await waitFor(() => expect((approveAfter as HTMLButtonElement).disabled).toBe(false), {
      timeout: 5000,
    });
    await act(async () => {
      fireEvent.click(approveAfter);
      await yields(25);
    });
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar personajes/i })).toBeNull(),
      { timeout: 8000 }
    );
    // Exactly ONE transition into 'scenes', and its write is the
    // authoritative one (follow-up scene-batch persists keep the step).
    expect(countStepTransitions('scenes')).toBe(1);
    const firstScenesWrite = upsertCalls.find((c) => stepOf(c) === 'scenes');
    expect(firstScenesWrite && isAuthoritativeCharactersToScenes(firstScenesWrite.payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Case 8 — Authoritative persistence REJECTION leaves story and step unchanged
// (no transition, no kick), and surfaces the error.
// ---------------------------------------------------------------------------
describe('Case 8: authoritative persistence rejection preserves story/step', () => {
  it('on upsert error the editor stays on the story step, with no kick and a visible error', async () => {
    await renderAtStoryStep('story-c8');

    upsertDefaultError = { message: 'boom — persistence rejected' };

    const approveBtn = screen.getByRole('button', { name: /Aprobar cuento y generar imágenes/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(15);
    });

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Aprobar cuento y generar imágenes/i })).not.toBeNull()
    );
    expect(invokeCalls).toHaveLength(0);
    expect(screen.queryAllByText(/No se pudo guardar antes de aprobar/i).length).toBeGreaterThan(0);

    upsertDefaultError = null;
  });
});

// ---------------------------------------------------------------------------
// Case 9 — Finalization success calls the parent and deletes the draft
// EXACTLY once, and only AFTER the authoritative commit.
// ---------------------------------------------------------------------------
describe('Case 9: finalization success → parent + deleteDraft exactly once, after commit', () => {
  it('onStoryCreated and the draft deletion happen only after the finalize upsert resolves', async () => {
    const onStoryCreated = vi.fn();
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeScenesPendingStory('story-c9')}
        onStoryCreated={onStoryCreated}
      />
    );

    const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveScenes);
      await yields(15);
    });

    const finalizeBtn = await screen.findByRole('button', { name: /Finalizar cuento/i });

    // The cover auto-persist debounce is pending; the envelope drains it first.
    // FIFO plan: [drain ok] then [finalize auth HELD].
    const finalizeBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(makeResolvedOk(), finalizeBlocker);

    await act(async () => {
      fireEvent.click(finalizeBtn);
      await yields(20);
    });

    // While the finalize upsert is blocked: no parent callback, no deletion.
    expect(onStoryCreated).not.toHaveBeenCalled();
    expect(deletedDraftRows).toHaveLength(0);

    await act(async () => {
      finalizeBlocker.resolve({ error: null });
      await yields(20);
    });

    await waitFor(() => expect(onStoryCreated).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(onStoryCreated.mock.calls).toHaveLength(1);
    const [finalStory] = onStoryCreated.mock.calls[0] as [Story, unknown];
    expect(finalStory.metadata.status).toBe('ready');
    // Draft deleted exactly once, strictly after the commit (it was 0 above).
    expect(deletedDraftRows).toHaveLength(1);
    // Exactly one transition into 'complete', and it is the finalize write.
    expect(countStepTransitions('complete')).toBe(1);
    const completeWrite = upsertCalls.find((c) => stepOf(c) === 'complete');
    expect(completeWrite && isAuthoritativeFinalize(completeWrite.payload)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Case 10 — Finalization REJECTION calls neither the parent nor deleteDraft.
// ---------------------------------------------------------------------------
describe('Case 10: finalization rejection → neither parent nor deleteDraft', () => {
  it('a failing finalize upsert leaves the draft, the parent uncalled, and the button visible', async () => {
    const onStoryCreated = vi.fn();
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeScenesPendingStory('story-c10')}
        onStoryCreated={onStoryCreated}
      />
    );

    const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveScenes);
      await yields(15);
    });

    const finalizeBtn = await screen.findByRole('button', { name: /Finalizar cuento/i });

    // Every upsert fails from here (drain fails gracefully; finalize auth fails).
    upsertDefaultError = { message: 'io error' };
    await act(async () => {
      fireEvent.click(finalizeBtn);
      await yields(20);
    });

    expect(onStoryCreated).not.toHaveBeenCalled();
    expect(deletedDraftRows).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Finalizar cuento/i })).not.toBeNull();
    expect(screen.queryAllByText(/No se pudo guardar antes de finalizar/i).length).toBeGreaterThan(0);

    upsertDefaultError = null;
  });
});

// ---------------------------------------------------------------------------
// Case 11 (BASE-RED) — Finalization STALE (edit while the finalize upsert is
// in flight) calls neither the parent nor deleteDraft; the edit is retained;
// a subsequent finalize succeeds and carries the edit.
// ---------------------------------------------------------------------------
describe('Case 11 (BASE-RED): finalization stale → neither parent nor deleteDraft; edit retained', () => {
  it('an edit during the blocked finalize upsert makes it stale: no parent, no deletion, edit kept', { timeout: 20000 }, async () => {
    const onStoryCreated = vi.fn();
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeScenesPendingStory('story-c11')}
        onStoryCreated={onStoryCreated}
      />
    );

    const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveScenes);
      await yields(15);
    });

    const finalizeBtn = await screen.findByRole('button', { name: /Finalizar cuento/i });

    // FIFO plan: [drain ok] then [finalize auth HELD].
    const finalizeBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(makeResolvedOk(), finalizeBlocker);

    await act(async () => {
      fireEvent.click(finalizeBtn);
      await yields(20);
    });
    expect(onStoryCreated).not.toHaveBeenCalled();

    // While the finalize upsert is in flight, edit the title through the UI
    // (click-to-edit heading at the cover step → input → change).
    const titleHeading = screen.getByTitle(/Haz clic para editar el título/i);
    await act(async () => {
      fireEvent.click(titleHeading);
    });
    // Two inputs can carry this display value (another field uses it as its
    // placeholder-backed value); the click-to-edit title input is the
    // autofocused text input rendered in place of the heading.
    const titleInput = screen
      .getAllByDisplayValue('Cuento a finalizar')
      .find((el) => el.className.includes('font-semibold'));
    expect(titleInput).toBeTruthy();
    await act(async () => {
      fireEvent.change(titleInput!, { target: { value: 'TITULO EDITADO EN VUELO' } });
    });

    // Release the finalize upsert → must resolve STALE.
    await act(async () => {
      finalizeBlocker.resolve({ error: null });
      await yields(20);
    });

    // Neither parent nor deleteDraft; no complete transition; stale surfaced.
    expect(onStoryCreated).not.toHaveBeenCalled();
    expect(deletedDraftRows).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Finalizar cuento/i })).not.toBeNull();
    expect(screen.queryAllByText(/El borrador cambió durante la finalización/i).length).toBeGreaterThan(0);

    // Retention end-to-end: finalizing again (all upserts default-succeed now)
    // drains the pending title edit and completes; the committed final story
    // carries the newest title.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Finalizar cuento/i }));
      await yields(25);
    });
    await waitFor(() => expect(onStoryCreated).toHaveBeenCalledTimes(1), { timeout: 4000 });
    const [finalStory] = onStoryCreated.mock.calls[0] as [Story, unknown];
    expect(finalStory.metadata.status).toBe('ready');
    // The second finalize's authoritative snapshot carries the edited title.
    const finalizeUpserts = upsertCalls.filter((c) => isAuthoritativeFinalize(c.payload));
    expect(finalizeUpserts.length).toBeGreaterThanOrEqual(1);
    const lastFinalize = finalizeUpserts[finalizeUpserts.length - 1];
    expect(parseUpsertRow(lastFinalize.payload).editedTitle).toBe('TITULO EDITADO EN VUELO');
    expect(deletedDraftRows).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Case 12 (BASE-RED) — A debounce armed during the approval envelope can never
// overwrite a committed transition.
//
// Under the fixed protocol the mid-envelope edit makes the authoritative write
// STALE (no committed transition exists to overwrite) and the edit persists;
// a later approval commits and nothing pending can regress the step.
//
// BASE DEFECT: the stale approval COMMITS the transition and the late debounce
// then overwrites the committed step with the old one.
// ---------------------------------------------------------------------------
describe('Case 12 (BASE-RED): envelope-armed debounce cannot overwrite a committed transition', () => {
  it('mid-envelope edit ⇒ stale (no commit); after the later committed approval no stale step write appears', { timeout: 20000 }, async () => {
    await renderAtScenesStep('story-c12');

    // 1. Block the authoritative upsert.
    const authBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(authBlocker);

    const approveBtn = screen.getByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(8);
    });

    // 2. Arm a debounce DURING the envelope (fake timers for determinism).
    vi.useFakeTimers({ shouldAdvanceTime: false });
    armSceneTextDebounceSync('LATE EDIT');
    await act(async () => {
      vi.advanceTimersByTime(2100); // late write queues behind the blocked auth
      await yields(4);
    });
    vi.useRealTimers();

    // 3. Release the authoritative upsert.
    await act(async () => {
      authBlocker.resolve({ error: null });
      await yields(20);
    });

    // FIXED CONTRACT: the mid-envelope edit made the approval STALE — there is
    // NO committed transition (still at scenes) and the late debounce write
    // ran (a 'scenes'-step write after the stale 'cover' I/O; its identity
    // stayed valid because no authoritative bump occurred).
    expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).not.toBeNull();
    // Hard guard (mirror of Case 3): the blocked authoritative 'cover' I/O MUST
    // have run, otherwise staleAuthIdx=-1 makes the ordering assertion below
    // pass vacuously for any 'scenes' write. This proves the interleaving under
    // test actually happened.
    expect(writesAtStep('cover')).toHaveLength(1);
    await waitFor(
      () => {
        const staleAuthIdx = upsertCalls.findIndex((c) => stepOf(c) === 'cover');
        expect(staleAuthIdx).toBeGreaterThanOrEqual(0);
        const lateIdx = upsertCalls.findIndex((c, i) => i > staleAuthIdx && stepOf(c) === 'scenes');
        expect(lateIdx).toBeGreaterThan(staleAuthIdx);
      },
      { timeout: 3000 }
    );

    // 4. Approve again (everything default-succeeds; nothing pending anymore).
    const beforeSecond = upsertCalls.length;
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aprobar escenas/i }));
      await yields(25);
    });
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
      { timeout: 5000 }
    );

    // The committed transition exists…
    const commitIdx = upsertCalls.findIndex(
      (c, i) => i >= beforeSecond && isAuthoritativeScenesToCover(c.payload)
    );
    expect(commitIdx).toBeGreaterThanOrEqual(0);
    // …its snapshot carries the (previously persisted) newest edit…
    expect(parseUpsertRow(upsertCalls[commitIdx].payload).editingSceneText?.[1]).toBe('LATE EDIT');
    // …and NOTHING after the committed transition writes the stale step back.
    const postCommitStaleWrites = upsertCalls
      .slice(commitIdx + 1)
      .filter((c) => parseUpsertRow(c.payload).currentStep === 'scenes');
    expect(postCommitStaleWrites).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Case 13 (INTRODUCED FIX) — Phantom-finalize corrective. A stale finalize
// wrote current_step='complete' to the draft row before going stale; the
// corrective non-authoritative write restores the live step ('cover')
// IMMEDIATELY, so the row is never left orphaned as 'complete' (a state the
// recovery mount-check ignores → a stranded finished story on tab-close).
// ---------------------------------------------------------------------------
describe('Case 13 (INTRODUCED FIX): stale finalize corrects the phantom complete row back to cover', () => {
  it('after a stale finalize the persisted current_step is restored to cover, not left at complete', { timeout: 20000 }, async () => {
    const onStoryCreated = vi.fn();
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeScenesPendingStory('story-c13')}
        onStoryCreated={onStoryCreated}
      />
    );
    const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveScenes);
      await yields(15);
    });
    const finalizeBtn = await screen.findByRole('button', { name: /Finalizar cuento/i });

    // FIFO: [cover drain ok] then [finalize auth HELD].
    const finalizeBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(makeResolvedOk(), finalizeBlocker);

    await act(async () => {
      fireEvent.click(finalizeBtn);
      await yields(20);
    });

    // FREEZE the 2s debounce with fake timers so the ONLY thing that can restore
    // the step is an IMMEDIATE corrective write — isolating the introduced fix
    // from the pre-existing ≤2s debounce self-heal (which is what made this test
    // pass against base with real timers).
    vi.useFakeTimers({ shouldAdvanceTime: false });
    // Edit the title while the finalize upsert is in flight → makes it stale.
    act(() => {
      fireEvent.click(screen.getByTitle(/Haz clic para editar el título/i));
    });
    const titleInput = screen
      .getAllByDisplayValue('Cuento a finalizar')
      .find((el) => el.className.includes('font-semibold'));
    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'EDIT MID FINALIZE' } });
    });

    // Release → finalize resolves STALE (microtasks only; the debounce timer is
    // frozen and never advanced, so no self-heal can fire).
    await act(async () => {
      finalizeBlocker.resolve({ error: null });
      await yields(25);
    });
    vi.useRealTimers();

    // Stale: no finalize side-effects.
    expect(onStoryCreated).not.toHaveBeenCalled();
    expect(deletedDraftRows).toHaveLength(0);

    // The finalize upsert wrote 'complete' to the row…
    const completeIdx = upsertCalls.findIndex((c) => isAuthoritativeFinalize(c.payload));
    expect(completeIdx).toBeGreaterThanOrEqual(0);
    // …and the IMMEDIATE corrective restored 'cover' right after it, WITHOUT the
    // debounce ever firing. (Against base — no corrective, debounce frozen — no
    // such 'cover' write exists, so this assertion fails there.)
    const coverAfter = upsertCalls.findIndex((c, i) => i > completeIdx && stepOf(c) === 'cover');
    expect(coverAfter).toBeGreaterThan(completeIdx);
    // Net: the last persisted step is NOT 'complete' — no orphaned row.
    expect(stepOf(upsertCalls[upsertCalls.length - 1])).not.toBe('complete');
  });
});

// ---------------------------------------------------------------------------
// Case 14 (INTRODUCED FIX) — Double-click re-entrancy. A synchronous
// double-click runs a SINGLE envelope (isApprovingRef latches the 2nd) and
// therefore shows no false "vuelve a intentar" banner after the transition.
// ---------------------------------------------------------------------------
describe('Case 14 (INTRODUCED FIX): double-click approve runs a single envelope, no false stale banner', () => {
  it('a synchronous double-click transitions exactly once and surfaces no stale error', { timeout: 15000 }, async () => {
    await renderAtStoryStep('story-c14');
    const authBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(authBlocker);

    const approveBtn = screen.getByRole('button', {
      name: /Aprobar cuento y generar imágenes/i,
    });
    await act(async () => {
      fireEvent.click(approveBtn);
      // Second click in the SAME tick (before any re-render disables the button):
      // only the synchronous isApprovingRef latch can prevent a 2nd envelope.
      fireEvent.click(approveBtn);
      await yields(10);
    });
    await act(async () => {
      authBlocker.resolve({ error: null });
      await yields(25);
    });

    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar cuento y generar imágenes/i })).toBeNull(),
      { timeout: 5000 }
    );
    // Exactly one transition — the second click did not start a second envelope.
    expect(countStepTransitions('characters')).toBe(1);
    // No false "the draft changed, try again" after a visibly successful approval.
    expect(screen.queryAllByText(/El borrador cambió durante la aprobación/i)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Case 15 (INTRODUCED FIX) — A successful retry clears the stale error banner
// (setError(null) at envelope entry). Stale-then-retry is the designed
// mainline, so the red banner must not survive a successful retry.
// ---------------------------------------------------------------------------
describe('Case 15 (INTRODUCED FIX): a successful retry clears the stale banner', () => {
  it('the stale banner shown after a stale approval is cleared once a re-approval succeeds', { timeout: 20000 }, async () => {
    await renderAtScenesStep('story-c15');

    // Force stale via an edit during the blocked drain (drainStable early-out).
    const promptTextarea = await armScenePromptDebounce('ORIGINAL');
    const drainBlocker = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(drainBlocker);
    const approveBtn = screen.getByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveBtn);
      await yields(8);
    });
    vi.useFakeTimers({ shouldAdvanceTime: false });
    act(() => {
      fireEvent.change(promptTextarea, { target: { value: 'NEW' } });
    });
    await act(async () => {
      vi.advanceTimersByTime(2100);
      await yields(4);
    });
    vi.useRealTimers();
    await act(async () => {
      drainBlocker.resolve({ error: null });
      await yields(20);
    });

    // Stale banner is present.
    expect(screen.queryAllByText(/El borrador cambió durante la aprobación/i).length).toBeGreaterThan(0);

    // Retry (all upserts default-succeed now) → transitions to cover.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aprobar escenas/i }));
      await yields(25);
    });
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
      { timeout: 5000 }
    );
    // The banner was cleared at envelope entry — it does not follow the user to
    // the cover step after the successful retry.
    expect(screen.queryAllByText(/El borrador cambió durante la aprobación/i)).toHaveLength(0);
  });
});
