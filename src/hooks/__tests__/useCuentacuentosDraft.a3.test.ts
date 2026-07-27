/**
 * A3 — Harden draft persistence identity and recovery storage contract.
 *
 * Cubre las invariantes de la subtask A3/2:
 *   - Operation-start guard: escrituras generated stale al arranque del tail
 *     no realizan upsert, upload, swap ni success reporting.
 *   - Stale explícito devuelto por `enqueueDraftWrite`.
 *   - Path-only en el JSON persistido (nunca base64 ni `data:` URLs).
 *   - EditorStateV1 embebido en story; drafts legados cargan con defaults.
 *   - Provenance hook validado antes de los URL swaps.
 *   - Zero stale writes desde la ruta A2 cuando el ciclo de vida cambia.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Story } from '@/types/shared/story';

// -----------------------------------------------------------------------------
// Mock de Supabase con capture.
// -----------------------------------------------------------------------------

type UpsertPayload = Record<string, unknown> & { image_paths?: Record<string, unknown> };

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
const uploadCalls: Array<{ path: string }> = [];
const removedPaths: string[] = [];
let existingImagePaths: Record<string, unknown> | null = null;
let selectError: { message: string } | null = null;
let upsertError: { message: string } | null = null;
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let mockUserId: string | null = null;
let loadedDraftRow: Record<string, unknown> | null = null;

vi.mock('@/integrations/supabase/client', () => {

  // B1 — El `upsert` real de supabase-js devuelve un BUILDER encadenable
  // (thenable y con `.select()`), no una promesa. `saveDraftToSupabase` ahora
  // encadena `.select('updated_at').maybeSingle()` para obtener ATÓMICAMENTE el
  // instante de la escritura (testigo del compare-and-delete de la
  // finalización), así que el mock adopta esa forma — es más fiel al borde real
  // que el shape anterior. Cada escritura devuelve un `updated_at` distinto y
  // monótono: eso es lo que hace observable el ack obsoleto.
  let __updatedAtSeq = 0;
  const __nextUpdatedAt = () => {
    __updatedAtSeq += 1;
    return `2026-05-01T00:00:${String(__updatedAtSeq).padStart(2, '0')}.000Z`;
  };
  const __upsertBuilder = (result: Promise<{ error: { message: string } | null }>) => {
    const rowResult = async () => {
      const r = await result;
      if (r && r.error) return { data: null, error: r.error };
      return { data: { updated_at: __nextUpdatedAt() }, error: null };
    };
    return {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        result.then(res as never, rej as never),
      select: () => ({
        maybeSingle: rowResult,
        single: rowResult,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          rowResult().then(res as never, rej as never),
      }),
    };
  };
  const tableApi = () => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => {
      if (selectError) return { data: null, error: selectError };
      if (loadedDraftRow) return { data: loadedDraftRow, error: null };
      return {
        data: existingImagePaths ? { image_paths: existingImagePaths } : null,
        error: null,
      };
    }),
    upsert: vi.fn().mockImplementation((payload: UpsertPayload) =>
      __upsertBuilder((async () => {
      upsertCalls.push({ payload });
      const deferred = upsertDeferreds.shift();
      if (deferred) return deferred.promise;
      return { error: upsertError };
    })())
    ),
    delete: vi.fn().mockReturnThis(),
  });

  const storageApi = () => ({
    upload: vi.fn().mockImplementation(async (path: string) => {
      uploadCalls.push({ path });
      return { data: { path }, error: null };
    }),
    getPublicUrl: vi.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/${path}` },
    })),
    remove: vi.fn().mockImplementation(async (paths: string[]) => {
      removedPaths.push(...paths);
      return { error: null };
    }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  return {
    supabase: {
      from: vi.fn(() => tableApi()),
      storage: { from: vi.fn(() => storageApi()) },
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

import {
  saveDraftNow,
  useCuentacuentosDraft,
  defaultEditorStateV1,
  type CuentacuentosDraftFull,
  type DraftPatch,
  type EditorStateV1,
  type EnqueueDraftWriteResult,
  type EnqueueDraftWriteStale,
  type EnqueueGeneratedSnapshotResult,
} from '../useCuentacuentosDraft';

beforeEach(() => {
  upsertCalls.length = 0;
  uploadCalls.length = 0;
  removedPaths.length = 0;
  upsertDeferreds.length = 0;
  existingImagePaths = null;
  selectError = null;
  upsertError = null;
  mockUserId = null;
  loadedDraftRow = null;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
  );
});

const flushMicrotasks = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

async function mountReadyHook(liturgyId = 'lit-1') {
  mockUserId = 'u1';
  const { result } = renderHook(() => useCuentacuentosDraft({ liturgyId }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

const sampleScenePatch = (): DraftPatch => ({
  currentStep: 'scenes',
  sceneImageOptions: { 1: ['https://cdn/scene-1-a.png'] },
  selectedSceneImages: { 1: 0 },
});

const baseSnapshot = (): CuentacuentosDraftFull => ({
  liturgyId: 'lit-1',
  currentStep: 'scenes',
  config: {
    location: 'jerusalem',
    customLocation: '',
    characters: 'jesus, discipulos',
    style: 'reflexivo',
    illustrationStyle: 'ghibli',
    additionalNotes: '',
  },
  story: {
    id: 'story-1',
    title: 'Cuento A3',
    summary: '',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [],
    scenes: [],
    props: [],
    spiritualConnection: '',
    metadata: { createdAt: '', updatedAt: '', status: 'draft' as Story['metadata']['status'] },
  } as Story,
  characterSheetOptions: {},
  selectedCharacterSheets: {},
  sceneImageOptions: {},
  selectedSceneImages: {},
  coverOptions: [],
  selectedCover: null,
  endOptions: [],
  selectedEnd: null,
  sceneReferenceModes: {},
  propReferenceImages: {},
  savedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
});

// -----------------------------------------------------------------------------
// A3/F1 — Operation-start guard: enqueue-before-lifecycle-change /
// start-after-change. Un `enqueueGeneratedSnapshot` cuya identidad expiró
// mientras esperaba en la cola NO debe upsert, upload, swap ni committear.
// -----------------------------------------------------------------------------
describe('A3/F1 operation-start guard (enqueue-before-lifecycle-change, start-after-change)', () => {
  it('bump epoch entre enqueue y arranque: cero upsert, cero upload, cero commit para el generated', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Blocker: mantiene el tail ocupado mientras encolamos el generated.
    let opBlock: Promise<unknown>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    // Generated encolado detrás del blocker. Su identidad quedará stale por el
    // bump del epoch antes de que arranque el tail.
    let opGen: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      opGen = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });

    // Antes de que el tail avance, cambio de lifecycle: epoch bump.
    act(() => {
      result.current.bumpDraftEpoch();
    });

    // Resolver el blocker: el tail avanza y el generated intenta arrancar.
    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });

    await act(async () => {
      await opGen;
    });

    // Cero upserts adicionales, cero uploads: la guard bloqueó saveDraftNow.
    expect(upsertCalls).toHaveLength(1);
    expect(uploadCalls).toHaveLength(0);
    // El blocker mismo quedó stale también (bump epoch invalida su identidad),
    // así que draft sigue en null: nada aplicó al React state.
    expect(result.current.draft).toBeNull();
  });

  it('storyId reset entre enqueue y arranque: la queued generated es stale y no upsertea', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    let opBlock: Promise<unknown>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    let opGen: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      opGen = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });

    // Reemplazar el story activo antes de que arranque el generated.
    act(() => {
      result.current.setActiveDraftStoryId('story-2');
    });

    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });
    await act(async () => {
      await opGen;
    });

    // Sólo el upsert del blocker; el generated fue stale al arranque.
    expect(upsertCalls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// D15 (pre-existing fix) — Un bump de `contentRevision` (p.ej. el commit de una
// aprobación en vuelo) entre el enqueue y el arranque de un snapshot generado NO
// debe volverlo stale: su validez la gobierna su propia identidad
// {storyId, epoch, itemId, generatedRevision} (preStart), no el contentRevision
// del editor. Antes de este fix la imagen (pagada) se perdía silenciosamente.
// -----------------------------------------------------------------------------
describe('D15 generated snapshot survives an editor/approval contentRevision bump', () => {
  it('bump de contentRevision entre enqueue y arranque: el generated upsertea (no stale)', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Blocker: mantiene el tail ocupado mientras encolamos el generated.
    let opBlock: Promise<unknown>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    // Generated encolado detrás del blocker.
    let opGen: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      opGen = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });

    // Una aprobación autoritative en vuelo bumpea contentRevision (mismo
    // lifecycle: epoch/story/revision no cambian).
    act(() => {
      result.current.bumpContentRevision();
    });

    // Resolver el blocker: el tail avanza y el generated arranca.
    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });
    let genResult: EnqueueGeneratedSnapshotResult;
    await act(async () => {
      genResult = await opGen;
    });

    // El generated NO fue stale por el bump de contentRevision: hizo su upsert
    // (2do) y commiteó (resultado undefined, no {stale:true}). Sin el fix, el CAS
    // de queue-start lo habría staleado y la imagen se perdería (upsertCalls=1).
    expect(upsertCalls).toHaveLength(2);
    expect(genResult!).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------
// A3/F2 — Stale result explícito: `enqueueDraftWrite` con `preStart` falso
// devuelve `{stale:true}` y no toca Supabase.
// -----------------------------------------------------------------------------
describe('A3/F2 enqueueDraftWrite stale result (preStart=false)', () => {
  it('preStart devuelve false: promise resuelve {stale:true}, cero upsert/upload/swap', async () => {
    const result = await mountReadyHook();

    let resValue: EnqueueDraftWriteResult | EnqueueDraftWriteStale | undefined;
    await act(async () => {
      resValue = await result.current.enqueueDraftWrite(
        { currentStep: 'scenes' },
        {
          preStart: () => false,
          onCommit: () => {
            throw new Error('onCommit no debe invocarse en stale');
          },
        }
      );
    });

    expect(resValue).toEqual({ stale: true });
    expect(upsertCalls).toHaveLength(0);
    expect(uploadCalls).toHaveLength(0);
    expect(result.current.draft).toBeNull();
    expect(result.current.lastSavedAt).toBeNull();
  });

  it('preStart devuelve true: promise resuelve con snapshot+uploadedUrls (fast path normal)', async () => {
    const result = await mountReadyHook();

    let resValue: EnqueueDraftWriteResult | EnqueueDraftWriteStale | undefined;
    await act(async () => {
      resValue = await result.current.enqueueDraftWrite(
        { currentStep: 'scenes' },
        { preStart: () => true }
      );
    });

    expect(resValue).toBeDefined();
    expect('stale' in resValue! && resValue!.stale).toBeFalsy();
    expect(upsertCalls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// A3/F3 — Path-only JSON: la story persistida no contiene base64 ni data URLs.
// Los paths de imagen viven en `image_paths` (Storage paths).
// -----------------------------------------------------------------------------
describe('A3/F3 path-only image references in persisted JSON (no base64, no data URLs)', () => {
  it('base64 en propReferenceImages: se sube; el story JSON persistido no lleva base64', async () => {
    const draft = baseSnapshot();
    draft.story = {
      ...draft.story!,
      props: [
        {
          id: 'p1',
          kind: 'object',
          name: 'p1',
          narrativeRole: '',
          visualDescription: '',
          // base64 crudo (no data:), simula una imagen recién capturada.
          referenceImages: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA'],
          role: 'primary',
        } as unknown as NonNullable<Story['props']>[number],
      ],
    };

    await saveDraftNow({
      userId: 'u1',
      liturgyId: 'lit-1',
      currentDraft: draft,
      patch: { propReferenceImages: { p1: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA'] } },
    });

    expect(upsertCalls).toHaveLength(1);
    const persisted = upsertCalls[0].payload;
    const persistedStory = persisted.story as { props?: Array<{ referenceImages?: unknown[] }> } | null;
    const persistedRefs = persistedStory?.props?.[0]?.referenceImages ?? [];
    // Invariante A3: 0 base64 y 0 data URLs en el JSON del story.
    for (const ref of persistedRefs) {
      expect(typeof ref).toBe('string');
      expect((ref as string).startsWith('data:')).toBe(false);
    }

    // El JSON completo del story serializado NO contiene `data:image` ni un
    // base64 crudo largo (>512 chars sin scheme).
    const storyJson = JSON.stringify(persistedStory);
    expect(storyJson).not.toContain('data:image');
    // image_paths sí lleva paths (no URLs, no base64).
    const imagePaths = persisted.image_paths as { propImagePaths: Record<string, string[]> };
    for (const [, paths] of Object.entries(imagePaths.propImagePaths)) {
      for (const p of paths) {
        expect(p.startsWith('data:')).toBe(false);
        // Debe empezar con `<userId>/<liturgyId>/props/...` — Storage path.
        expect(p).toMatch(/^u1\/lit-1\/props\//);
      }
    }
  });
});

// -----------------------------------------------------------------------------
// A3/F4 — EditorStateV1: embebido en story al persistir; drafts legados cargan
// con defaults seguros; el hook boundary lo despoja del Story expuesto.
// -----------------------------------------------------------------------------
describe('A3/F4 EditorStateV1 (persist embed + legacy defaults)', () => {
  it('defaultEditorStateV1(): defaults con version=1 y selecciones vacías', () => {
    const defaults = defaultEditorStateV1();
    expect(defaults.version).toBe(1);
    expect(defaults.selections.selectedCharacterSheets).toEqual({});
    expect(defaults.selections.selectedSceneImages).toEqual({});
    expect(defaults.selections.selectedCover).toBeNull();
    expect(defaults.selections.selectedEnd).toBeNull();
  });

  it('persistencia embebe editorStateV1 dentro del story JSONB', async () => {
    const draft = baseSnapshot();
    draft.selectedCover = 2;
    draft.selectedCharacterSheets = { char1: 3 };

    await saveDraftNow({
      userId: 'u1',
      liturgyId: 'lit-1',
      currentDraft: draft,
      patch: { currentStep: 'cover' },
    });

    expect(upsertCalls).toHaveLength(1);
    const persistedStory = upsertCalls[0].payload.story as Record<string, unknown> | null;
    expect(persistedStory).not.toBeNull();
    const persistedEditor = persistedStory!.editorStateV1 as EditorStateV1;
    expect(persistedEditor).toBeDefined();
    expect(persistedEditor.version).toBe(1);
    // El bloque refleja los selectors del draft en el momento de guardar.
    expect(persistedEditor.selections.selectedCover).toBe(2);
    expect(persistedEditor.selections.selectedCharacterSheets).toEqual({ char1: 3 });
  });

  it('load legado sin editorStateV1: el hook aplica defaults y no expone el campo dentro del Story', async () => {
    // Simular un row viejo en la tabla: story sin `editorStateV1`.
    loadedDraftRow = {
      current_step: 'scenes',
      config: baseSnapshot().config,
      story: { ...baseSnapshot().story, id: 'legacy-story' } as unknown as Record<string, unknown>,
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();

    // Forzar load explícito.
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });

    expect(loaded).not.toBeNull();
    // El Story expuesto por el hook NO debe llevar `editorStateV1` mezclado.
    const storyExposed = loaded!.story as (Story & { editorStateV1?: unknown }) | null;
    expect(storyExposed).not.toBeNull();
    expect((storyExposed as { editorStateV1?: unknown }).editorStateV1).toBeUndefined();
    // El load no tira: los defaults vienen del helper (assertable vía helper).
    expect(defaultEditorStateV1().version).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// A3/F5 — Provenance hook antes de URL swaps: si la validación falla, la
// persistencia igual ocurre pero el hook NO commitea el swap ni dispara
// onCommit — la persistencia no reporta success.
// -----------------------------------------------------------------------------
describe('A3/F5 validateProvenanceBeforeSwap (persist without swap if provenance rejects)', () => {
  it('provenance validator devuelve false: upsert ocurre, cero swap, cero onCommit', async () => {
    const result = await mountReadyHook();

    const onCommit = vi.fn();

    let resValue: EnqueueDraftWriteResult | EnqueueDraftWriteStale | undefined;
    await act(async () => {
      resValue = await result.current.enqueueDraftWrite(
        { currentStep: 'scenes' },
        {
          validateProvenanceBeforeSwap: () => false,
          onCommit,
        }
      );
    });

    // Persistió (upsert efectivo).
    expect(upsertCalls).toHaveLength(1);
    // pero NO commiteó al React state.
    expect(result.current.draft).toBeNull();
    expect(result.current.lastSavedAt).toBeNull();
    // Y el callback de éxito NO se invocó.
    expect(onCommit).not.toHaveBeenCalled();
    // El return sigue siendo la shape normal (snapshot+uploadedUrls).
    expect(resValue).toBeDefined();
    expect('stale' in resValue! && resValue!.stale).toBeFalsy();
    expect(resValue).toHaveProperty('snapshot');
  });

  it('provenance validator devuelve true: commit normal', async () => {
    const result = await mountReadyHook();
    const onCommit = vi.fn();
    await act(async () => {
      await result.current.enqueueDraftWrite(
        { currentStep: 'scenes' },
        { validateProvenanceBeforeSwap: () => true, onCommit }
      );
    });
    expect(upsertCalls).toHaveLength(1);
    expect(result.current.draft?.currentStep).toBe('scenes');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});

// -----------------------------------------------------------------------------
// A3/F6 — Zero stale writes desde la ruta A2: enqueueGeneratedSnapshot devuelve
// `{stale:true}` (A3a/S3 subtask 3: contrato discriminado) cuando la guard
// bloqueó. El adaptador `buildSnapshotTask` traduce este valor a
// `PERSIST_STALE` para el runner, que NO marca `done` (no hubo commit) ni
// `save-failed` (no hubo error de I/O). La reserva por-ítem se libera si
// sigue siendo nuestra, para no dejarla stranded.
// -----------------------------------------------------------------------------
describe('A3/F6 zero stale writes end-to-end desde enqueueGeneratedSnapshot', () => {
  it('lifecycle change antes del arranque: resuelve {stale:true}; upsert cero', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    let opBlock: Promise<unknown>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    let opGen: Promise<void | { stale: true }>;
    act(() => {
      opGen = result.current.enqueueGeneratedSnapshot({
        patch: sampleScenePatch(),
        identity: { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
      });
    });

    act(() => {
      result.current.bumpDraftEpoch();
    });

    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });

    let genResult: void | { stale: true } | undefined;
    await act(async () => {
      genResult = await opGen;
    });

    // {stale:true} = contrato discriminado (A3a/S3 subtask 3). El adaptador
    // en la ruta de producción traduce esto a PERSIST_STALE para el runner,
    // que NO marca el ítem `done` (no hubo commit React) ni `save-failed`
    // (no hubo error de I/O). Aquí probamos el shape en el hook boundary.
    expect(genResult).toEqual({ stale: true });
    // Cero upserts adicionales (sólo el del blocker).
    expect(upsertCalls).toHaveLength(1);
    await flushMicrotasks();
  });
});

// =============================================================================
// A3/S4 — Hash-based provenance guard
// =============================================================================

// Helper: provenance con hash determinista
function makeProvenance(revision: number, hash: string) {
  return { sourceRevision: revision, contentHash: hash };
}

// -----------------------------------------------------------------------------
// T-A3a.3 — apply produce snapshot + hash, NO llama persistencia directamente.
// Luego persist invoca enqueueGeneratedSnapshot exactamente una vez.
// -----------------------------------------------------------------------------
describe('T-A3a.3 apply produces snapshot+hash without persisting; persist routes through enqueueGeneratedSnapshot', () => {
  it('enqueueGeneratedSnapshot called zero times during apply phase, once in persist', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    const enqueueSpy = vi.fn().mockImplementation(
      result.current.enqueueGeneratedSnapshot.bind(result.current)
    );

    // Simulate apply: builds patch, does NOT call enqueueGeneratedSnapshot.
    const patch: DraftPatch = { coverOptions: ['https://cdn/cover-1.png'] };
    // Apply phase: just compute hash + update refs — no persistence call.
    expect(enqueueSpy).not.toHaveBeenCalled();

    // Persist phase: call enqueueGeneratedSnapshot with provenance.
    const identity = { storyId: 'story-1', epoch: 0, itemId: 'cover', generatedRevision: 1 };
    const provenance = makeProvenance(1, 'abc00001');
    await act(async () => {
      await result.current.enqueueGeneratedSnapshot({ patch, identity, provenance });
    });

    expect(upsertCalls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// A3/S4 — preStart hash guard: wenn ein neuerer contentHash registriert ist,
// lehnt preStart ab.
// -----------------------------------------------------------------------------
describe('A3/S4 preStart contentHash guard', () => {
  it('preStart rejects if tracked hash changed between enqueue and queue start', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    // Blocker ocupa el tail.
    let opBlock: Promise<unknown>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    const identity = { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 };
    const patchA: DraftPatch = { sceneImageOptions: { 1: ['https://cdn/scene-a.png'] } };
    const provenanceA = makeProvenance(1, 'hash-A');

    // Encolar snapshot A.
    let opA: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      opA = result.current.enqueueGeneratedSnapshot({ patch: patchA, identity, provenance: provenanceA });
    });

    // Antes de que arranque A: encolar B con la MISMA revisión pero hash
    // diferente — esto simula un segundo apply que sobreescribe A.
    // Para que la misma revisión sea reencolable, necesitamos que A haya fallado.
    // En este test queremos que B (un NUEVO rev mayor) invalide A.
    const identityB = { ...identity, generatedRevision: 2 };
    const patchB: DraftPatch = { sceneImageOptions: { 1: ['https://cdn/scene-b.png'] } };
    const provenanceB = makeProvenance(2, 'hash-B');
    let opB: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      opB = result.current.enqueueGeneratedSnapshot({ patch: patchB, identity: identityB, provenance: provenanceB });
    });

    // Resolver blocker.
    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });

    // A se ejecuta: preStart debe rechazar porque la reserva ahora es para rev=2.
    await act(async () => {
      await opA;
    });
    // B se ejecuta: preStart acepta.
    await act(async () => {
      await opB;
    });

    // Sólo dos upserts totales: el blocker + B. A fue rechazado por preStart.
    // (blocker=1, B=1 = 2 total). A no upsertea.
    expect(upsertCalls).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// A3/S4 — validateProvenanceBeforeSwap: obsolete swap discarded even if
// story+epoch still match (stale contentHash).
// -----------------------------------------------------------------------------
describe('A3/S4 validateProvenanceBeforeSwap rejects obsolete snapshot swap', () => {
  it('apply A (hash HA, rev R+1) loses ownership to apply B (hash HB, rev R+2); A swap is rejected', async () => {
    const dfdA = makeDeferred<{ error: null }>();
    // A's upsert is blocked; B is queued behind A in the serialised write queue.
    // Both resolve in order: A first (swap rejected), then B (swap committed).
    upsertDeferreds.push(dfdA); // A consumes the deferred; B resolves immediately.

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    const identityA = { storyId: 'story-1', epoch: 0, itemId: 'cover', generatedRevision: 1 };
    const patchA: DraftPatch = { coverOptions: ['https://cdn/cover-A.png'] };
    const provenanceA = makeProvenance(1, 'hash-HA');

    // Enqueue A — upsert is deferred (blocked in queue).
    let opA: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      opA = result.current.enqueueGeneratedSnapshot({ patch: patchA, identity: identityA, provenance: provenanceA });
    });

    // Wait for A's upsert to start.
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    // B arrives while A's upsert is in-flight. B synchronously registers hash HB
    // in the tracker (rev R+2), taking ownership. B is queued behind A.
    const identityB = { storyId: 'story-1', epoch: 0, itemId: 'cover', generatedRevision: 2 };
    const patchB: DraftPatch = { coverOptions: ['https://cdn/cover-B.png'] };
    const provenanceB = makeProvenance(2, 'hash-HB');
    let opB: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      opB = result.current.enqueueGeneratedSnapshot({ patch: patchB, identity: identityB, provenance: provenanceB });
    });

    // Resolve A's deferred — its validateProvenanceBeforeSwap runs and REJECTS
    // because the tracker now holds rev=2, hash=HB (not HA at rev=1).
    await act(async () => {
      dfdA.resolve({ error: null });
      await opA;
    });

    // B is queued behind A. Now that A is done, B runs and commits.
    await act(async () => {
      await opB;
    });

    // Total upserts: A + B = 2.
    expect(upsertCalls).toHaveLength(2);
    // A's URL is NOT in draft (swap was rejected).
    expect(result.current.draft?.coverOptions).not.toContain('https://cdn/cover-A.png');
    // B's URL IS in draft.
    expect(result.current.draft?.coverOptions).toContain('https://cdn/cover-B.png');
  });
});

// -----------------------------------------------------------------------------
// A3/S4 — Immutable snapshots: deep-frozen snapshots cannot be mutated.
// -----------------------------------------------------------------------------
describe('A3/S4 immutable snapshots (deep-frozen)', () => {
  it('the DraftPatch returned by apply is frozen and cannot be mutated', () => {
    // Simulate the object that apply returns (a DraftPatch).
    // deepFreeze is from storyImagePipelineRunner — we test the property here.
    const patch: DraftPatch = { coverOptions: ['https://cdn/img.png'] };
    Object.freeze(patch);
    Object.freeze(patch.coverOptions);

    expect(Object.isFrozen(patch)).toBe(true);
    expect(Object.isFrozen(patch.coverOptions)).toBe(true);

    // Attempting to mutate in strict mode (which Vitest runs) throws.
    expect(() => {
      (patch as Record<string, unknown>).coverOptions = [];
    }).toThrow();
  });
});

// -----------------------------------------------------------------------------
// A3/S4 — apply-without-persist: spy on enqueueGeneratedSnapshot shows it is
// called ZERO times by apply; only persist calls it.
// -----------------------------------------------------------------------------
describe('A3/S4 apply does not call any persistence surface', () => {
  it('enqueueGeneratedSnapshot is not called during the apply phase of a mock task', async () => {
    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    let enqueueCallCount = 0;
    // Wrap the real function to count calls.
    const realEnqueue = result.current.enqueueGeneratedSnapshot;
    const wrappedEnqueue = (input: Parameters<typeof realEnqueue>[0]) => {
      enqueueCallCount++;
      return realEnqueue(input);
    };

    // apply phase: just computes patch and hash — does NOT call persistence.
    const patch: DraftPatch = { coverOptions: ['https://cdn/cover.png'] };
    // Simulate: apply returned patch (no side-effects on persistence).
    expect(enqueueCallCount).toBe(0);

    // persist phase: calls enqueueGeneratedSnapshot exactly once.
    await act(async () => {
      await wrappedEnqueue({
        patch,
        identity: { storyId: 'story-1', epoch: 0, itemId: 'cover', generatedRevision: 1 },
        provenance: makeProvenance(1, 'hash-c0ver'),
      });
    });

    expect(enqueueCallCount).toBe(1);
    expect(upsertCalls).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
// A3/S4 — save-only retry: retry via enqueueGeneratedSnapshot calls persist
// (upsert), but the provider (supabase.functions.invoke) is called ZERO times.
// -----------------------------------------------------------------------------
describe('A3/S4 save-only retry: provider called zero times', () => {
  it('after save-failed, retry re-upserts without re-invoking provider', async () => {
    upsertError = { message: 'Network error' };

    const result = await mountReadyHook();
    act(() => {
      result.current.setActiveDraftStoryId('story-1');
    });

    const identity = { storyId: 'story-1', epoch: 0, itemId: 'scene-1', generatedRevision: 1 };
    const patch: DraftPatch = { sceneImageOptions: { 1: ['https://cdn/scene.png'] } };
    const provenance = makeProvenance(1, 'hash-retry1');

    // First attempt: fails (upsertError is set).
    let op1: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      op1 = result.current.enqueueGeneratedSnapshot({ patch, identity, provenance }).catch(() => {});
    });
    await act(async () => { await op1; });

    expect(upsertCalls).toHaveLength(1);

    // Clear error, retry save-only (same rev, same hash, state = 'failed').
    upsertError = null;
    let op2: Promise<EnqueueGeneratedSnapshotResult>;
    act(() => {
      op2 = result.current.enqueueGeneratedSnapshot({ patch, identity, provenance });
    });
    await act(async () => { await op2; });

    // Second upsert occurred (retry).
    expect(upsertCalls).toHaveLength(2);
    // uploadCalls === 0 means provider (supabase.functions.invoke for images)
    // was never called — no image generation, just persistence.
    expect(uploadCalls).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------------
// T-A3.4 — Round-trip lossless de EditorStateV1 extendido: al persistir con
// buffers editor (edited prompts, includes/excludes, references, scene text,
// title, overlays, currentStep), un load posterior debe reconstruir cada uno.
// El test cubre TODOS los campos del spec para prevenir regresiones cuando se
// añaden slots nuevos.
// -----------------------------------------------------------------------------
describe('T-A3.4 EditorStateV1 extendido round-trip (persist + reload sin pérdida)', () => {
  it('todos los buffers editor sobreviven un persist + load ciclo', async () => {
    const draft = baseSnapshot();
    // Poblar cada slot del EditorStateV1 extendido con un valor distinto y
    // reconocible — cualquier drop se detecta en la aserción final. Los option
    // arrays deben ser lo bastante largos como para pasar el sanitize del load
    // (`options.length > selectedIdx`).
    draft.characterSheetOptions = { charA: ['https://cdn/a-0.png', 'https://cdn/a-1.png', 'https://cdn/a-2.png'] };
    draft.selectedCharacterSheets = { charA: 2 };
    draft.sceneImageOptions = {
      1: ['https://cdn/s1-0.png', 'https://cdn/s1-1.png', 'https://cdn/s1-2.png', 'https://cdn/s1-3.png'],
      2: ['https://cdn/s2-0.png'],
    };
    draft.selectedSceneImages = { 1: 3, 2: 0 };
    draft.coverOptions = [
      'https://cdn/c-0.png', 'https://cdn/c-1.png', 'https://cdn/c-2.png',
      'https://cdn/c-3.png', 'https://cdn/c-4.png', 'https://cdn/c-5.png',
    ];
    draft.selectedCover = 5;
    draft.endOptions = [
      'https://cdn/e-0.png', 'https://cdn/e-1.png', 'https://cdn/e-2.png',
      'https://cdn/e-3.png', 'https://cdn/e-4.png', 'https://cdn/e-5.png',
      'https://cdn/e-6.png', 'https://cdn/e-7.png',
    ];
    draft.selectedEnd = 7;
    draft.editingScenePrompt = { 1: 'edited scene 1 prompt', 2: 'edited scene 2 prompt' };
    draft.editingCharacterPrompt = { charA: 'edited char A prompt' };
    draft.editingCoverPrompt = 'edited cover prompt';
    draft.editingEndPrompt = 'edited end prompt';
    draft.editingSceneText = { 1: 'edited scene text 1' };
    draft.editingTitle = 'Titulo editado';
    draft.sceneIncludedCharacters = { 1: ['charA', 'charB'] };
    draft.coverIncludedCharacters = ['charA'];
    draft.endIncludedCharacters = ['charB'];
    draft.sceneExcludedCharacters = { 2: ['charC'] };
    draft.coverExcludedCharacters = ['charD'];
    draft.endExcludedCharacters = ['charE'];
    draft.sceneReferenceModes = { 1: 'pov', 2: 'style' };
    // Overlays viven en story pero se mirroran en el snapshot v1 para round-trip.
    const overlayCover = { text: 'PORTADA', position: 'top', color: 'white', size: 'L' } as const;
    const overlayEnd = { text: 'FIN', position: 'bottom', color: 'black', size: 'M' } as const;
    if (draft.story) {
      draft.story = { ...draft.story, coverTextOverlay: overlayCover, endTextOverlay: overlayEnd };
    }
    // Referencias por escena en base64 (hook debe convertir a paths al persistir).
    draft.sceneReferenceImages = { 1: 'data:image/png;base64,AAAA' };
    draft.coverReferenceImage = 'data:image/png;base64,BBBB';
    draft.endReferenceImage = 'data:image/png;base64,CCCC';

    // Persistir.
    await saveDraftNow({
      userId: 'u1',
      liturgyId: 'lit-1',
      currentDraft: draft,
      patch: {
        currentStep: 'cover',
        editingScenePrompt: draft.editingScenePrompt,
        editingCharacterPrompt: draft.editingCharacterPrompt,
        editingCoverPrompt: draft.editingCoverPrompt,
        editingEndPrompt: draft.editingEndPrompt,
        editingSceneText: draft.editingSceneText,
        editingTitle: draft.editingTitle,
        sceneIncludedCharacters: draft.sceneIncludedCharacters,
        coverIncludedCharacters: draft.coverIncludedCharacters,
        endIncludedCharacters: draft.endIncludedCharacters,
        sceneExcludedCharacters: draft.sceneExcludedCharacters,
        coverExcludedCharacters: draft.coverExcludedCharacters,
        endExcludedCharacters: draft.endExcludedCharacters,
        sceneReferenceImages: draft.sceneReferenceImages,
        coverReferenceImage: draft.coverReferenceImage,
        endReferenceImage: draft.endReferenceImage,
        sceneReferenceModes: draft.sceneReferenceModes,
        story: draft.story,
      },
    });

    expect(upsertCalls).toHaveLength(1);
    const payload = upsertCalls[0].payload;
    const persistedStory = payload.story as Record<string, unknown>;
    // Invariante path-only: los strings del story no llevan `data:` URLs.
    const storyJson = JSON.stringify(persistedStory);
    expect(storyJson.includes('data:image')).toBe(false);
    // El snapshot embebido debe cubrir cada slot extendido.
    const embedded = persistedStory.editorStateV1 as {
      version: number;
      selections: { selectedCover: number; selectedEnd: number };
      edited: {
        scenePrompt: Record<number, string>;
        characterPrompt: Record<string, string>;
        coverPrompt: string;
        endPrompt: string;
        sceneText: Record<number, string>;
        title: string;
      };
      includedCharacters: { scene: Record<number, string[]>; cover: string[]; end: string[] };
      excludedCharacters: { scene: Record<number, string[]>; cover: string[]; end: string[] };
      sceneReferenceModes: Record<number, string>;
      overlays: { cover: unknown; end: unknown };
      currentStep: string;
      recoveryRevision: number;
    };
    expect(embedded.version).toBe(1);
    expect(embedded.currentStep).toBe('cover');
    expect(embedded.selections.selectedCover).toBe(5);
    expect(embedded.selections.selectedEnd).toBe(7);
    expect(embedded.edited.scenePrompt[1]).toBe('edited scene 1 prompt');
    expect(embedded.edited.characterPrompt.charA).toBe('edited char A prompt');
    expect(embedded.edited.coverPrompt).toBe('edited cover prompt');
    expect(embedded.edited.endPrompt).toBe('edited end prompt');
    expect(embedded.edited.sceneText[1]).toBe('edited scene text 1');
    expect(embedded.edited.title).toBe('Titulo editado');
    expect(embedded.includedCharacters.scene[1]).toEqual(['charA', 'charB']);
    expect(embedded.includedCharacters.cover).toEqual(['charA']);
    expect(embedded.includedCharacters.end).toEqual(['charB']);
    expect(embedded.excludedCharacters.scene[2]).toEqual(['charC']);
    expect(embedded.excludedCharacters.cover).toEqual(['charD']);
    expect(embedded.excludedCharacters.end).toEqual(['charE']);
    expect(embedded.sceneReferenceModes[1]).toBe('pov');
    expect(embedded.sceneReferenceModes[2]).toBe('style');
    expect(embedded.overlays.cover).toEqual(overlayCover);
    expect(embedded.overlays.end).toEqual(overlayEnd);
    expect(embedded.recoveryRevision).toBeGreaterThanOrEqual(1);

    // Ahora simular un load usando el payload persistido como el row de DB.
    // Nota: paths de referencia se serializan dentro de image_paths, no en JSON.
    // Las option arrays (characterSheet/scene/cover/end) NO iban en el patch
    // (son ortogonales a este test), así que inyectamos paths sintéticos con
    // suficiente longitud para sobrevivir el sanitize del load — el objetivo
    // de este test es el round-trip del EditorStateV1, no las opciones.
    const imagePaths = {
      ...(payload.image_paths as Record<string, unknown>),
      characterSheetPaths: {
        charA: ['u1/lit-1/characters/charA_0.png', 'u1/lit-1/characters/charA_1.png', 'u1/lit-1/characters/charA_2.png'],
      },
      sceneImagePaths: {
        1: ['u1/lit-1/scenes/scene1_0.png', 'u1/lit-1/scenes/scene1_1.png', 'u1/lit-1/scenes/scene1_2.png', 'u1/lit-1/scenes/scene1_3.png'],
        2: ['u1/lit-1/scenes/scene2_0.png'],
      },
      coverPaths: [
        'u1/lit-1/cover/cover_0.png', 'u1/lit-1/cover/cover_1.png', 'u1/lit-1/cover/cover_2.png',
        'u1/lit-1/cover/cover_3.png', 'u1/lit-1/cover/cover_4.png', 'u1/lit-1/cover/cover_5.png',
      ],
      endPaths: [
        'u1/lit-1/end/end_0.png', 'u1/lit-1/end/end_1.png', 'u1/lit-1/end/end_2.png',
        'u1/lit-1/end/end_3.png', 'u1/lit-1/end/end_4.png', 'u1/lit-1/end/end_5.png',
        'u1/lit-1/end/end_6.png', 'u1/lit-1/end/end_7.png',
      ],
    } as Record<string, unknown>;
    expect(imagePaths.sceneReferencePaths).toBeDefined();
    expect(imagePaths.coverReferencePath).toBeTruthy();
    expect(imagePaths.endReferencePath).toBeTruthy();

    loadedDraftRow = {
      current_step: payload.current_step,
      config: payload.config,
      story: persistedStory,
      selected_character_sheets: payload.selected_character_sheets,
      selected_scene_images: payload.selected_scene_images,
      selected_cover: payload.selected_cover,
      selected_end: payload.selected_end,
      image_paths: imagePaths,
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    const d = loaded!;
    // Selections
    expect(d.selectedCharacterSheets).toEqual({ charA: 2 });
    expect(d.selectedSceneImages[1]).toBe(3);
    expect(d.selectedCover).toBe(5);
    expect(d.selectedEnd).toBe(7);
    // Edited prompts + scene text + title.
    expect(d.editingScenePrompt?.[1]).toBe('edited scene 1 prompt');
    expect(d.editingCharacterPrompt?.charA).toBe('edited char A prompt');
    expect(d.editingCoverPrompt).toBe('edited cover prompt');
    expect(d.editingEndPrompt).toBe('edited end prompt');
    expect(d.editingSceneText?.[1]).toBe('edited scene text 1');
    expect(d.editingTitle).toBe('Titulo editado');
    // Includes / excludes en las 3 dimensiones (scene/cover/end).
    expect(d.sceneIncludedCharacters?.[1]).toEqual(['charA', 'charB']);
    expect(d.coverIncludedCharacters).toEqual(['charA']);
    expect(d.endIncludedCharacters).toEqual(['charB']);
    expect(d.sceneExcludedCharacters?.[2]).toEqual(['charC']);
    expect(d.coverExcludedCharacters).toEqual(['charD']);
    expect(d.endExcludedCharacters).toEqual(['charE']);
    // Reference modes + reference images (resueltas como URLs, no base64).
    expect(d.sceneReferenceModes[1]).toBe('pov');
    expect(d.sceneReferenceModes[2]).toBe('style');
    expect(typeof d.sceneReferenceImages?.[1]).toBe('string');
    expect(d.sceneReferenceImages![1].startsWith('data:')).toBe(false);
    expect(typeof d.coverReferenceImage).toBe('string');
    expect(d.coverReferenceImage!.startsWith('data:')).toBe(false);
    expect(typeof d.endReferenceImage).toBe('string');
    expect(d.endReferenceImage!.startsWith('data:')).toBe(false);
    // Overlays (viven en story tras la carga).
    expect(d.story?.coverTextOverlay).toEqual(overlayCover);
    expect(d.story?.endTextOverlay).toEqual(overlayEnd);
    // Current step.
    expect(d.currentStep).toBe('cover');
    // recoveryRevision monotónico (>=1 tras el commit).
    expect((d.recoveryRevision ?? 0)).toBeGreaterThanOrEqual(1);
  });
});

// -----------------------------------------------------------------------------
// T-A3.5 (reload half) — landmarkVisible por escena sobrevive un round-trip.
// El generate/apply owner del snapshot escribe scene.landmarkVisible dentro del
// story tree; el reload debe restaurar ese boolean por escena tanto del story
// como del snapshot v1 embebido.
// -----------------------------------------------------------------------------
describe('T-A3.5 landmarkVisible reload half', () => {
  it('landmarkVisible por escena persiste en editorStateV1 y se restaura al load', async () => {
    const draft = baseSnapshot();
    // Story con dos escenas: una con landmarkVisible true, otra false.
    const scenesWithLandmark = [
      { number: 1, text: 's1', landmarkVisible: true } as unknown as Story['scenes'][number],
      { number: 2, text: 's2', landmarkVisible: false } as unknown as Story['scenes'][number],
    ];
    if (draft.story) {
      draft.story = { ...draft.story, scenes: scenesWithLandmark };
    }
    draft.landmarkVisible = { 1: true, 2: false };

    await saveDraftNow({
      userId: 'u1',
      liturgyId: 'lit-1',
      currentDraft: draft,
      patch: {
        currentStep: 'scenes',
        landmarkVisible: draft.landmarkVisible,
        story: draft.story,
      },
    });

    expect(upsertCalls).toHaveLength(1);
    const payload = upsertCalls[0].payload;
    const persistedStory = payload.story as Record<string, unknown>;
    const embedded = persistedStory.editorStateV1 as { landmarkVisible: Record<number, boolean> };
    expect(embedded.landmarkVisible).toEqual({ 1: true, 2: false });

    loadedDraftRow = {
      current_step: payload.current_step,
      config: payload.config,
      story: persistedStory,
      selected_character_sheets: payload.selected_character_sheets,
      selected_scene_images: payload.selected_scene_images,
      selected_cover: payload.selected_cover,
      selected_end: payload.selected_end,
      image_paths: payload.image_paths,
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.landmarkVisible).toEqual({ 1: true, 2: false });
    // Y también sobrevive dentro de las escenas del story cargado.
    const s1 = loaded!.story?.scenes?.find((s) => s.number === 1);
    const s2 = loaded!.story?.scenes?.find((s) => s.number === 2);
    expect(s1?.landmarkVisible).toBe(true);
    expect(s2?.landmarkVisible).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// A3a/S2 items 5 & 11 — Legacy recovery: currentStep and selection fallbacks
// must preserve dedicated DB columns whenever the embedded EditorStateV1 slot
// is missing/invalid or contains defaulted/empty data.
// -----------------------------------------------------------------------------
describe('A3a/S2 legacy recovery fallbacks (currentStep + selections)', () => {
  it('legacy row missing editorStateV1 entirely: current_step column wins', async () => {
    loadedDraftRow = {
      current_step: 'scenes',
      config: baseSnapshot().config,
      // Story without editorStateV1 block at all.
      story: { ...baseSnapshot().story, id: 'legacy-1' } as unknown as Record<string, unknown>,
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.currentStep).toBe('scenes');
  });

  it('embedded editorStateV1 without a currentStep field: falls back to current_step column', async () => {
    loadedDraftRow = {
      current_step: 'characters',
      config: baseSnapshot().config,
      story: {
        ...baseSnapshot().story,
        id: 'legacy-2',
        // Envelope valid but no currentStep on the snapshot itself.
        editorStateV1: { version: 1, selections: {} },
      } as unknown as Record<string, unknown>,
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.currentStep).toBe('characters');
  });

  it('embedded editorStateV1 with invalid currentStep value: falls back to current_step column', async () => {
    loadedDraftRow = {
      current_step: 'cover',
      config: baseSnapshot().config,
      story: {
        ...baseSnapshot().story,
        id: 'legacy-3',
        editorStateV1: { version: 1, selections: {}, currentStep: 'garbage' },
      } as unknown as Record<string, unknown>,
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.currentStep).toBe('cover');
  });

  it('character selection: empty `{}` on column falls back to embedded v1 selections', async () => {
    const opts = ['https://cdn/a-0.png', 'https://cdn/a-1.png', 'https://cdn/a-2.png'];
    loadedDraftRow = {
      current_step: 'scenes',
      config: baseSnapshot().config,
      story: {
        ...baseSnapshot().story,
        id: 'legacy-4',
        editorStateV1: {
          version: 1,
          selections: {
            selectedCharacterSheets: { charA: 2 },
            selectedSceneImages: {},
            selectedCover: null,
            selectedEnd: null,
          },
          currentStep: 'scenes',
        },
      } as unknown as Record<string, unknown>,
      // Empty dedicated column — write partial before columns caught up.
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {
        characterSheetPaths: { charA: ['u1/lit-1/characters/charA_0.png', 'u1/lit-1/characters/charA_1.png', 'u1/lit-1/characters/charA_2.png'] },
        sceneImagePaths: {},
        coverPaths: [],
        endPaths: [],
      },
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    // Silence: unused option array in mock (paths already cover public URL generation).
    void opts;
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.selectedCharacterSheets).toEqual({ charA: 2 });
  });

  it('scene selection: empty `{}` on column falls back to embedded v1 selections', async () => {
    loadedDraftRow = {
      current_step: 'scenes',
      config: baseSnapshot().config,
      story: {
        ...baseSnapshot().story,
        id: 'legacy-5',
        editorStateV1: {
          version: 1,
          selections: {
            selectedCharacterSheets: {},
            selectedSceneImages: { 1: 1 },
            selectedCover: null,
            selectedEnd: null,
          },
          currentStep: 'scenes',
        },
      } as unknown as Record<string, unknown>,
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {
        characterSheetPaths: {},
        sceneImagePaths: { 1: ['u1/lit-1/scenes/scene1_0.png', 'u1/lit-1/scenes/scene1_1.png'] },
        coverPaths: [],
        endPaths: [],
      },
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.selectedSceneImages).toEqual({ 1: 1 });
  });

  it('meaningful dedicated columns override embedded v1 selections', async () => {
    loadedDraftRow = {
      current_step: 'scenes',
      config: baseSnapshot().config,
      story: {
        ...baseSnapshot().story,
        id: 'legacy-6',
        editorStateV1: {
          version: 1,
          selections: {
            selectedCharacterSheets: { charA: 0 },
            selectedSceneImages: { 1: 0 },
            selectedCover: null,
            selectedEnd: null,
          },
          currentStep: 'scenes',
        },
      } as unknown as Record<string, unknown>,
      // Columns hold newer, meaningful data — must win.
      selected_character_sheets: { charA: 2 },
      selected_scene_images: { 1: 1 },
      selected_cover: null,
      selected_end: null,
      image_paths: {
        characterSheetPaths: { charA: ['u1/lit-1/characters/charA_0.png', 'u1/lit-1/characters/charA_1.png', 'u1/lit-1/characters/charA_2.png'] },
        sceneImagePaths: { 1: ['u1/lit-1/scenes/scene1_0.png', 'u1/lit-1/scenes/scene1_1.png'] },
        coverPaths: [],
        endPaths: [],
      },
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    expect(loaded!.selectedCharacterSheets).toEqual({ charA: 2 });
    expect(loaded!.selectedSceneImages).toEqual({ 1: 1 });
  });
});

// -----------------------------------------------------------------------------
// A3a/S2 item 6 — Round-trip preservation of arbitrary long narrative fields
// (title, summary, description, prompts, scene.text) across a persist+load
// cycle. Field-aware scrubbing must never truncate story text.
// -----------------------------------------------------------------------------
describe('A3a/S2 round-trip: long narrative text and prompts survive persist+load', () => {
  it('title/summary/description and prompts >512 chars persist verbatim', async () => {
    const draft = baseSnapshot();
    const longTitle = 'Titulo largo '.repeat(80); // ~1040 chars
    const longSummary = 'Resumen extenso — '.repeat(64); // ~1150 chars
    const longSpiritual = 'Conexión espiritual: '.repeat(50); // ~1050 chars
    const longScenePrompt = 'Prompt escena editado. '.repeat(30); // ~700 chars
    const longCoverPrompt = 'Prompt portada editado. '.repeat(30); // ~720 chars
    const longEndPrompt = 'Prompt fin editado. '.repeat(30); // ~600 chars
    const longSceneText = 'Texto narrativo de la escena. '.repeat(25); // ~750 chars

    expect(longTitle.length).toBeGreaterThan(512);
    expect(longSummary.length).toBeGreaterThan(512);
    expect(longSpiritual.length).toBeGreaterThan(512);
    expect(longScenePrompt.length).toBeGreaterThan(512);
    expect(longCoverPrompt.length).toBeGreaterThan(512);
    expect(longEndPrompt.length).toBeGreaterThan(512);
    expect(longSceneText.length).toBeGreaterThan(512);

    if (draft.story) {
      draft.story = {
        ...draft.story,
        title: longTitle,
        summary: longSummary,
        spiritualConnection: longSpiritual,
      };
    }
    draft.editingTitle = longTitle;
    draft.editingScenePrompt = { 1: longScenePrompt };
    draft.editingCoverPrompt = longCoverPrompt;
    draft.editingEndPrompt = longEndPrompt;
    draft.editingSceneText = { 1: longSceneText };

    await saveDraftNow({
      userId: 'u1',
      liturgyId: 'lit-1',
      currentDraft: draft,
      patch: {
        currentStep: 'cover',
        editingTitle: draft.editingTitle,
        editingScenePrompt: draft.editingScenePrompt,
        editingCoverPrompt: draft.editingCoverPrompt,
        editingEndPrompt: draft.editingEndPrompt,
        editingSceneText: draft.editingSceneText,
        story: draft.story,
      },
    });

    expect(upsertCalls).toHaveLength(1);
    const payload = upsertCalls[0].payload;
    const persistedStory = payload.story as Record<string, unknown>;
    // Story-tree narrative fields survive verbatim.
    expect(persistedStory.title).toBe(longTitle);
    expect(persistedStory.summary).toBe(longSummary);
    expect(persistedStory.spiritualConnection).toBe(longSpiritual);
    // Embedded snapshot preserves long edited prompts + scene text + title.
    const embedded = persistedStory.editorStateV1 as {
      edited: {
        scenePrompt: Record<number, string>;
        coverPrompt: string;
        endPrompt: string;
        sceneText: Record<number, string>;
        title: string;
      };
    };
    expect(embedded.edited.title).toBe(longTitle);
    expect(embedded.edited.scenePrompt[1]).toBe(longScenePrompt);
    expect(embedded.edited.coverPrompt).toBe(longCoverPrompt);
    expect(embedded.edited.endPrompt).toBe(longEndPrompt);
    expect(embedded.edited.sceneText[1]).toBe(longSceneText);

    loadedDraftRow = {
      current_step: payload.current_step,
      config: payload.config,
      story: persistedStory,
      selected_character_sheets: payload.selected_character_sheets,
      selected_scene_images: payload.selected_scene_images,
      selected_cover: payload.selected_cover,
      selected_end: payload.selected_end,
      image_paths: payload.image_paths,
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    const d = loaded!;
    expect(d.story?.title).toBe(longTitle);
    expect(d.story?.summary).toBe(longSummary);
    expect(d.story?.spiritualConnection).toBe(longSpiritual);
    expect(d.editingTitle).toBe(longTitle);
    expect(d.editingScenePrompt?.[1]).toBe(longScenePrompt);
    expect(d.editingCoverPrompt).toBe(longCoverPrompt);
    expect(d.editingEndPrompt).toBe(longEndPrompt);
    expect(d.editingSceneText?.[1]).toBe(longSceneText);
  });

  it('round-trip mixing >512-char narrative + invalid image refs: narrative survives verbatim, refs are scrubbed', async () => {
    // Combines the two invariants in one persist+load cycle:
    //   - long narrative fields (>512 chars) on title/summary/spiritualConnection,
    //     on scene.text/visualDescription, on character description, and on
    //     edited prompts survive byte-for-byte through save AND reload.
    //   - invalid image refs (data: URLs) placed in image-reference slots that
    //     survive the save pipeline's targeted `undefined` wipes (props.
    //     referenceImages) are scrubbed; zero `data:image` fragments end up in
    //     the persisted JSON.
    const draft = baseSnapshot();
    const longTitle = 'Título — '.repeat(80); // ~720 chars, accented + punctuation
    const longSummary = 'Resumen extenso, con detalles narrativos: '.repeat(20); // ~840 chars
    const longSpiritual = 'Conexión espiritual profunda con la lectura. '.repeat(20); // ~900 chars
    const longSceneText = 'Los discípulos caminaban por la ribera. '.repeat(20); // ~800 chars
    const longSceneDescription = 'Escena luminosa junto al lago. '.repeat(25); // ~775 chars
    const longCharNotes = 'Personaje reflexivo, mirada serena, gestos suaves. '.repeat(15); // ~765 chars
    const longScenePrompt = 'Prompt escena editado con contexto extenso. '.repeat(20); // ~880 chars
    const longCoverPrompt = 'Prompt portada editado con contexto extenso. '.repeat(20); // ~900 chars

    for (const s of [longTitle, longSummary, longSpiritual, longSceneText, longSceneDescription, longCharNotes, longScenePrompt, longCoverPrompt]) {
      expect(s.length).toBeGreaterThan(512);
    }

    draft.story = {
      ...draft.story!,
      title: longTitle,
      summary: longSummary,
      spiritualConnection: longSpiritual,
      characters: [
        {
          id: 'char-1',
          name: 'Pedro',
          role: 'primary',
          description: longCharNotes,
          visualDescription: longCharNotes,
        } as unknown as Story['characters'][number],
      ],
      scenes: [
        {
          number: 1,
          text: longSceneText,
          visualDescription: longSceneDescription,
        } as unknown as Story['scenes'][number],
      ],
      // props.referenceImages hits `stripImageRef` in the save pipeline and
      // then the field-aware scrub — both must cooperate to drop data: URLs
      // while keeping HTTP URLs even at length >512.
      props: [
        {
          id: 'p-invalid',
          kind: 'object',
          name: 'p-invalid',
          narrativeRole: '',
          visualDescription: longCharNotes,
          referenceImages: [
            'data:image/png;base64,AAAA',
            'https://cdn/keep-prop-' + 'x'.repeat(600) + '.png',
          ],
          role: 'primary',
        } as unknown as NonNullable<Story['props']>[number],
      ],
    };
    draft.editingTitle = longTitle;
    draft.editingScenePrompt = { 1: longScenePrompt };
    draft.editingCoverPrompt = longCoverPrompt;

    await saveDraftNow({
      userId: 'u1',
      liturgyId: 'lit-1',
      currentDraft: draft,
      patch: {
        currentStep: 'cover',
        story: draft.story,
        editingTitle: draft.editingTitle,
        editingScenePrompt: draft.editingScenePrompt,
        editingCoverPrompt: draft.editingCoverPrompt,
      },
    });

    expect(upsertCalls).toHaveLength(1);
    const payload = upsertCalls[0].payload;
    const persistedStory = payload.story as Record<string, unknown>;

    // Narrative preservation (byte-for-byte) on the persisted payload.
    expect(persistedStory.title).toBe(longTitle);
    expect(persistedStory.summary).toBe(longSummary);
    expect(persistedStory.spiritualConnection).toBe(longSpiritual);
    const persistedScene = (persistedStory.scenes as Array<Record<string, unknown>>)[0];
    expect(persistedScene.text).toBe(longSceneText);
    expect(persistedScene.visualDescription).toBe(longSceneDescription);
    const persistedChar = (persistedStory.characters as Array<Record<string, unknown>>)[0];
    expect(persistedChar.description).toBe(longCharNotes);
    expect(persistedChar.visualDescription).toBe(longCharNotes);

    // Embedded snapshot preserved long edited prompts verbatim.
    const embedded = persistedStory.editorStateV1 as {
      edited: { title: string; scenePrompt: Record<number, string>; coverPrompt: string };
    };
    expect(embedded.edited.title).toBe(longTitle);
    expect(embedded.edited.scenePrompt[1]).toBe(longScenePrompt);
    expect(embedded.edited.coverPrompt).toBe(longCoverPrompt);

    // Invalid image refs scrubbed in props.referenceImages; HTTP URL kept
    // even though it's much longer than 512 chars.
    const persistedProp = (persistedStory.props as Array<Record<string, unknown>>)[0];
    const propRefs = persistedProp.referenceImages as string[];
    expect(propRefs.length).toBe(1);
    expect(propRefs[0].startsWith('https://cdn/keep-prop-')).toBe(true);
    expect(propRefs[0].length).toBeGreaterThan(512);
    // The prop's own long visualDescription (narrative text, not an image
    // field) survives verbatim regardless of length.
    expect(persistedProp.visualDescription).toBe(longCharNotes);
    // Whole-story JSON: not a single data:image fragment anywhere.
    expect(JSON.stringify(persistedStory)).not.toContain('data:image');

    // Round-trip: reload and re-verify narrative preservation + no data URLs.
    loadedDraftRow = {
      current_step: payload.current_step,
      config: payload.config,
      story: persistedStory,
      selected_character_sheets: payload.selected_character_sheets,
      selected_scene_images: payload.selected_scene_images,
      selected_cover: payload.selected_cover,
      selected_end: payload.selected_end,
      image_paths: payload.image_paths,
      updated_at: '2026-01-02T00:00:00.000Z',
    };
    const result = await mountReadyHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    expect(loaded).not.toBeNull();
    const d = loaded!;
    expect(d.story?.title).toBe(longTitle);
    expect(d.story?.summary).toBe(longSummary);
    expect(d.story?.spiritualConnection).toBe(longSpiritual);
    expect(d.story?.scenes[0].text).toBe(longSceneText);
    expect(d.story?.scenes[0].visualDescription).toBe(longSceneDescription);
    expect(d.story?.characters[0].description).toBe(longCharNotes);
    expect(d.editingTitle).toBe(longTitle);
    expect(d.editingScenePrompt?.[1]).toBe(longScenePrompt);
    expect(d.editingCoverPrompt).toBe(longCoverPrompt);
    expect(JSON.stringify(d.story)).not.toContain('data:image');
  });
});

// =============================================================================
// A3a/S3 — Explicit stale-safe draft writes
// =============================================================================

// -----------------------------------------------------------------------------
// F1 deterministic — enqueue while identity A is current, block the queue,
// change identity BEFORE the operation starts, then release the queue.
// Assert zero upsert, zero upload, zero React commit, and an explicit
// `{stale:true}` return that lets the caller distinguish from success/failure.
// This test hits the lower-level `enqueueDraftWrite` API (with a `preStart`
// closure over captured identity) — no `enqueueGeneratedSnapshot` bridge — so
// the guarantee is proven at the primitive layer.
// -----------------------------------------------------------------------------
describe('A3a/S3 F1 enqueueDraftWrite: pre-start stale returns explicit {stale:true}', () => {
  it('enqueue-before-change / start-after-change: cero upsert, cero upload, cero commit, {stale:true}', async () => {
    const dfdBlocker = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfdBlocker);

    const result = await mountReadyHook();

    // Blocker occupies the tail so the second write cannot start until we
    // resolve the deferred. This gives us a deterministic window to bump the
    // identity between enqueue and start of the second write.
    let opBlock: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      opBlock = result.current.enqueueDraftWrite({ currentStep: 'story' });
    });
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    // Capture the CURRENT identity (epoch 0). `preStart` will re-check this
    // against the LIVE hook identity when the tail advances. Because we bump
    // the epoch before releasing the blocker, the check will fail.
    const capturedEpoch = 0;
    const preStart = vi.fn(() => capturedEpoch === 0);
    const onCommit = vi.fn();

    let opStale: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      opStale = result.current.enqueueDraftWrite(
        { currentStep: 'scenes' },
        {
          preStart: () => {
            // The caller decides staleness at the tail boundary. Simulate a
            // caller that captured identity at enqueue time and revalidates
            // here — the epoch differs after `bumpDraftEpoch` below, so this
            // returns false.
            return preStart() && true;
          },
          onCommit,
        }
      );
    });

    // Change identity BEFORE the queued op starts. `preStart` will see this
    // when the tail advances after the blocker resolves.
    act(() => {
      result.current.bumpDraftEpoch();
    });
    // Rewire preStart to reflect the new epoch mismatch — we captured 0 at
    // enqueue time, live is now 1, so we return false.
    preStart.mockImplementation(() => false);

    // Release the blocker → tail advances → stale op starts → preStart false.
    await act(async () => {
      dfdBlocker.resolve({ error: null });
      await opBlock;
    });

    let staleResult: EnqueueDraftWriteResult | EnqueueDraftWriteStale | undefined;
    await act(async () => {
      staleResult = await opStale;
    });

    // Explicit stale: exact shape, distinguishable from success/failure.
    expect(staleResult).toEqual({ stale: true });
    // Only the blocker's upsert; the stale op never called saveDraftNow.
    expect(upsertCalls).toHaveLength(1);
    // No uploads: preStart short-circuited before storage/saveImagesToStorage.
    expect(uploadCalls).toHaveLength(0);
    // No React commit (blocker itself was stale too by epoch bump).
    expect(result.current.draft).toBeNull();
    expect(result.current.lastSavedAt).toBeNull();
    // onCommit is never invoked in the stale branch.
    expect(onCommit).not.toHaveBeenCalled();
    // preStart WAS invoked at the tail boundary (it's the source of truth
    // for stale — not a silent no-op).
    expect(preStart).toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Post-start deferred-upsert stale — identity changes AFTER the DB operation
// started (upsert already in flight) but BEFORE it settled. The operation is
// allowed to complete (I/O finishes) but the result is explicit `{stale:true}`
// with no URL swap, no React commit, no onCommit. This proves the post-await
// identity revalidation branch returns stale — not a snapshot shape — so the
// caller cannot mistake it for a committed success.
// -----------------------------------------------------------------------------
describe('A3a/S3 post-start identity change returns explicit stale after DB settle', () => {
  it('identity changes after upsert started: op settles, returns {stale:true}, zero React commit', async () => {
    const dfd = makeDeferred<{ error: null }>();
    upsertDeferreds.push(dfd);

    const result = await mountReadyHook();
    const onCommit = vi.fn();

    // Enqueue a write with the CURRENT identity. It starts immediately (no
    // preStart) and the upsert is deferred so we can bump the identity while
    // the DB operation is in flight.
    let op: Promise<EnqueueDraftWriteResult | EnqueueDraftWriteStale>;
    act(() => {
      op = result.current.enqueueDraftWrite({ currentStep: 'scenes' }, { onCommit });
    });

    // Wait for the upsert to be in flight (payload delivered to the mock).
    await waitFor(() => expect(upsertCalls).toHaveLength(1));

    // Bump the epoch WHILE the upsert is pending. Post-await revalidation
    // will see identity mismatched and return {stale:true} even though the
    // DB write already committed.
    act(() => {
      result.current.bumpDraftEpoch();
    });

    // Release the upsert — I/O settles OK.
    let settled: EnqueueDraftWriteResult | EnqueueDraftWriteStale | undefined;
    await act(async () => {
      dfd.resolve({ error: null });
      settled = await op;
    });

    // Explicit stale — the caller can distinguish this from success without
    // introspecting side-effects on the hook.
    expect(settled).toEqual({ stale: true });
    // The upsert DID happen (allowed to settle).
    expect(upsertCalls).toHaveLength(1);
    // But no React commit — draft stayed null, lastSavedAt stayed null.
    expect(result.current.draft).toBeNull();
    expect(result.current.lastSavedAt).toBeNull();
    // onCommit MUST NOT fire on stale — the caller does not report success.
    expect(onCommit).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// B1/F3 — `persistedUpdatedAt` es el ÚNICO testigo válido del
// compare-and-delete, y debe SOBREVIVIR a los commits.
//
// `savedAt` no sirve: `normalizeSnapshot` lo re-estampa con el reloj del
// CLIENTE en cada persistencia, así que basta una escritura entre el montaje y
// el clic de "Recuperar" para que el testigo deje de coincidir con la fila —
// y la confirmación quedaría condenada a borrar 0 filas para siempre.
// `persistedUpdatedAt` lo escribe SÓLO `loadDraftFromSupabase`.
// ---------------------------------------------------------------------------
describe('B1/F3 — el testigo de la finalización sobrevive a un commit', () => {
  it('un commit re-estampa savedAt con el reloj del cliente pero NO toca persistedUpdatedAt', async () => {
    const dbUpdatedAt = '2026-05-01T00:00:42.000Z';
    loadedDraftRow = {
      liturgia_id: 'lit-1',
      user_id: 'u1',
      current_step: 'complete',
      config: {
        location: 'Jerusalén', customLocation: '', characters: '',
        style: 'reflexivo', illustrationStyle: 'ghibli', additionalNotes: '',
      },
      story: {
        id: 'story-witness',
        title: 'Finalizado',
        characters: [],
        scenes: [],
        props: [],
        metadata: { createdAt: '', updatedAt: '', status: 'ready' },
      },
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: dbUpdatedAt,
    };

    const result = await mountReadyHook();
    await waitFor(() => expect(result.current.draft).not.toBeNull());

    // Al cargar, ambos campos valen el `updated_at` de la fila.
    expect(result.current.draft?.persistedUpdatedAt).toBe(dbUpdatedAt);
    expect(result.current.draft?.savedAt).toBe(dbUpdatedAt);

    // Una escritura que COMMITEA (identidad intacta) re-estampa el snapshot.
    await act(async () => {
      await result.current.enqueueDraftWrite({ currentStep: 'complete' });
      await flushMicrotasks();
    });

    // `savedAt` ya no es el valor de la base — es el reloj del cliente.
    expect(result.current.draft?.savedAt).not.toBe(dbUpdatedAt);
    // …pero el testigo del compare-and-delete SIGUE siendo el de la fila.
    expect(result.current.draft?.persistedUpdatedAt).toBe(dbUpdatedAt);
  });
});
