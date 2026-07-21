/**
 * F4 post-independent-review fix pass — honest integration regressions.
 *
 * Same discipline as CuentacuentoEditor.f4.integration.test.tsx: the REAL
 * CuentacuentoEditor with REAL hooks; only external boundaries mocked
 * (@/integrations/supabase/client, @/hooks/use-toast, global fetch, timers).
 * NO vi.mock on the hook under test.
 *
 * Each case is BASE-RED at 5971d5f (the reviewed baseline this branch forks
 * from) for the intended reason, and PASSES at the fix.
 *
 *   F1 — a sibling content-mutation bump must not strand a pending debounced
 *        editor-buffer patch (data loss on tab close).
 *   F3 — a refine resolving during an in-flight approval must make the approval
 *        stale (refinement kept), not be silently reverted.
 *   F4 — the option selectors must be disabled during the approval/finalize
 *        envelope, so a mid-upsert click can't diverge published vs displayed.
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
function makeResolvedOk(): Deferred<{ error: { message: string } | null }> {
  const d = makeDeferred<{ error: { message: string } | null }>();
  d.resolve({ error: null });
  return d;
}

// ---------------------------------------------------------------------------
// External-boundary trackers
// ---------------------------------------------------------------------------

type UpsertPayload = Record<string, unknown>;
const upsertCalls: Array<{ payload: UpsertPayload }> = [];
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let upsertDefaultError: { message: string } | null = null;
let mockUserId: string | null = 'user-f4fix';

const invokeCalls: Array<{ fn: string }> = [];
const deletedDraftRows: Array<{ liturgiaId: string }> = [];
let mockDraftRow: Record<string, unknown> | null = null;

// refine-story response (F3). When set, the refine-story edge fn returns this.
let mockRefinedStory: Record<string, unknown> | null = null;

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
    upload: vi.fn().mockImplementation(async (path: string) => ({ data: { path }, error: null })),
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
          if (fn === 'refine-story') {
            return { data: { success: true, story: mockRefinedStory }, error: null };
          }
          // Generation path: valid provider shape.
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

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import CuentacuentoEditor from '../CuentacuentoEditor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseContext: LiturgyContext = {
  id: 'lit-f4fix',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy F4fix',
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
      { number: 1, text: 'Escena de apertura', visualDescription: 'plaza soleada' } as unknown as Story['scenes'][number],
      { number: 2, text: 'Escena de nudo', visualDescription: 'templo antiguo' } as unknown as Story['scenes'][number],
    ],
    props: [],
    spiritualConnection: 'Esperanza',
    metadata: { createdAt: '', updatedAt: '', status: 'story-generated' as Story['metadata']['status'] },
  } as Story;
}

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
      { number: 1, text: 'Escena de apertura', visualDescription: 'plaza soleada', selectedImageUrl: 'https://mock/scene-1.png' } as unknown as Story['scenes'][number],
      { number: 2, text: 'Escena de nudo', visualDescription: 'templo antiguo', selectedImageUrl: 'https://mock/scene-2.png' } as unknown as Story['scenes'][number],
    ],
    metadata: { createdAt: '', updatedAt: '', status: 'characters-approved' as Story['metadata']['status'] },
  } as Story;
}

function makeScenesPendingStory(id = 'story-fin'): Story {
  return {
    ...makeCharactersApprovedStory(id),
    title: 'Cuento a finalizar',
    coverImageUrl: 'https://mock/cover.png',
    endImageUrl: 'https://mock/end.png',
    // Two cover / end options so the selectors render clickable options.
    coverImageOptions: ['https://mock/cover-a.png', 'https://mock/cover-b.png'],
    endImageOptions: ['https://mock/end-a.png', 'https://mock/end-b.png'],
    metadata: { createdAt: '', updatedAt: '', status: 'scenes-pending' as Story['metadata']['status'] },
  } as unknown as Story;
}

// ---------------------------------------------------------------------------
// Upsert payload helpers
// ---------------------------------------------------------------------------

function parseUpsertRow(payload: UpsertPayload) {
  const currentStep = (payload['current_step'] as string | null) ?? null;
  const story = (payload['story'] as Record<string, unknown> | null) ?? null;
  const metadata = (story?.['metadata'] as Record<string, unknown> | null) ?? null;
  const status = (metadata?.['status'] as string | null) ?? null;
  const editorStateV1 = (story?.['editorStateV1'] as Record<string, unknown> | null) ?? null;
  const edited = (editorStateV1?.['edited'] as Record<string, unknown> | null) ?? null;
  const editedTitle = edited?.['title'] as string | null | undefined;
  return { currentStep, status, story, editedTitle };
}
function stepOf(c: { payload: UpsertPayload }): string | null {
  return parseUpsertRow(c.payload).currentStep;
}
function writesAtStep(step: string) {
  return upsertCalls.filter((c) => stepOf(c) === step);
}
function isAuthoritativeFinalize(payload: UpsertPayload): boolean {
  const { currentStep, status } = parseUpsertRow(payload);
  return currentStep === 'complete' && status === 'ready';
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
  mockUserId = 'user-f4fix';
  mockDraftRow = null;
  mockRefinedStory = null;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: null }) } as unknown as Response));
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

async function renderAtStoryStep(storyId = 'story-sg') {
  const onStoryCreated = vi.fn();
  const rendered = render(
    <CuentacuentoEditor context={baseContext} initialStory={makeStoryGeneratedStory(storyId)} onStoryCreated={onStoryCreated} />
  );
  await waitFor(() => expect(screen.getByRole('button', { name: /Aprobar cuento y generar imágenes/i })).toBeTruthy(), { timeout: 3000 });
  return { ...rendered, onStoryCreated };
}

/** scenes-pending story → approve scenes → land on the cover step. */
async function renderAtCoverStep(onStoryCreated = vi.fn(), storyId = 'story-cov') {
  render(
    <CuentacuentoEditor context={baseContext} initialStory={makeScenesPendingStory(storyId)} onStoryCreated={onStoryCreated} />
  );
  const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i });
  await act(async () => {
    fireEvent.click(approveScenes);
    await yields(20);
  });
  await screen.findByRole('button', { name: /Finalizar cuento/i });
  return { onStoryCreated };
}

// ---------------------------------------------------------------------------
// F1 (BASE-RED) — a sibling content bump (text-overlay) must not strand a
// pending debounced editor-buffer patch. Base defect: updateTextOverlay bumped
// contentRevision without routing through saveDraft, so the pending title-buffer
// debounce failed the queue-start CAS and was silently dropped (data loss).
// ---------------------------------------------------------------------------
describe('F1 (BASE-RED): sibling content bump does not drop a pending buffer debounce', () => {
  it('a buffered title edit survives an in-window overlay bump and persists', { timeout: 20000 }, async () => {
    await renderAtCoverStep(vi.fn(), 'story-f1');

    // Settle the cover-transition auto-persist under real timers.
    await act(async () => { await yields(6); });

    vi.useFakeTimers({ shouldAdvanceTime: false });

    // 1) Arm a buffer debounce with a REAL edit: click the title heading and
    //    type. The auto-persist effect fires saveDraft({...buffers, editingTitle})
    //    at contentRevision=N and arms the 2s debounce.
    act(() => {
      fireEvent.click(screen.getByTitle(/Haz clic para editar el título/i));
    });
    const titleInput = screen
      .getAllByDisplayValue('Cuento a finalizar')
      .find((el) => el.className.includes('font-semibold'));
    expect(titleInput).toBeTruthy();
    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'TITULO BUFFER' } });
    });

    // 2) Within the debounce window, bump content via the cover text-overlay
    //    position pill (updateTextOverlay). At base this only bumps
    //    contentRevision (N→N+1) and strands the pending buffer patch; at the
    //    fix it also routes through saveDraft so the D14 merge re-stamps it.
    act(() => {
      const centro = screen.getAllByRole('button', { name: /^Centro$/i })[0];
      expect(centro).toBeTruthy();
      fireEvent.click(centro);
    });

    // 3) Fire the debounce.
    await act(async () => {
      vi.advanceTimersByTime(2100);
      await yields(8);
    });
    vi.useRealTimers();

    // The buffered title edit persisted: an upsert carries editedTitle. At base
    // the stranded patch fails the queue-start CAS ⇒ no such upsert exists.
    const titleWrites = upsertCalls.filter((c) => parseUpsertRow(c.payload).editedTitle === 'TITULO BUFFER');
    expect(titleWrites.length).toBeGreaterThan(0);
  });
});
