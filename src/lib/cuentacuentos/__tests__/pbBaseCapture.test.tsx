/**
 * PB / G6 — CAPTURA del comportamiento base + COMPARADOR post-cambio.
 *
 * =====================  REGLA DE ORO (D5)  =====================
 * El fixture `pb_fe_base_185c370.json` se capturó con TODOS los archivos de
 * producción byte-idénticos a `cc-downscale-a`@185c370, y es READ-ONLY desde
 * ese commit. NUNCA se regenera para poner en verde una comparación: si el
 * comparador falla en un campo que no está declarado como divergencia en
 * `pbBaseCapture.divergences.ts`, eso es un FINDING, no un fixture a rehacer.
 *
 * Re-captura (sólo válida sobre un árbol byte-idéntico a la base):
 *     PB_CAPTURE=1 npx vitest run src/lib/cuentacuentos/__tests__/pbBaseCapture.test.tsx
 * El modo captura ABORTA si detecta que producción ya no está en la base.
 * ===============================================================
 *
 * Los payloads NO se inventan: sus formas se transcribieron de los call sites
 * reales leídos con `git show 185c370:<path>` (hook `saveImagesToStorage`
 * :690-801 y `saveDraftToSupabase` :957-1236; editor :3086/:3164/:3336/:3401;
 * `liturgyService` :154/:201/:499-580).
 *
 * Sólo se mockean BORDES externos: cliente Supabase (auth/table/storage),
 * invocación de funciones pagas, y `use-toast`. El hook, el editor y
 * `liturgyService` son los de producción.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, render, screen, waitFor, act, fireEvent, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

import {
  PNG_A_B64,
  PNG_B_B64,
  PNG_C_B64,
  PNG_D_B64,
  PNG_E_B64,
  JPEG_B64,
  WEBP_B64,
  GIF_B64,
  INVALID_B64,
  PNG_A_DATA_URL,
  PNG_A_DATA_URL_LYING,
  EXISTING_DRAFTS_URL,
} from './pbImageFixtures';
import {
  normalizeValue,
  treeHasInlineImage,
  getPath,
  deletePath,
  type CaseRecord,
  type CaptureFixture,
  type UploadCall,
  type UpsertCall,
} from './pbBaseCapture.harness';
import { DIVERGENCES, assertNewValueInvariants } from './pbBaseCapture.divergences';

// ---------------------------------------------------------------------------
// Controles del borde externo
// ---------------------------------------------------------------------------

interface BoundaryControls {
  userId: string | null;
  selectError: { message: string } | null;
  upsertError: { message: string } | null;
  elementosUpsertError: { message: string } | null;
  existingImagePaths: Record<string, unknown> | null;
  draftRow: Record<string, unknown> | null;
  /** Falla la subida cuyo blob mide exactamente estos bytes (selector estable
   *  entre base y head: NO depende del nombre del archivo, que es justamente
   *  lo que la fase cambia). */
  failUploadWhenSize: number | null;
  failAllUploads: boolean;
  /** Devuelve un conflicto de duplicado (409) en vez de éxito. */
  duplicateWhenSize: number | null;
}

const ctl: BoundaryControls = {
  userId: 'user-pb',
  selectError: null,
  upsertError: null,
  elementosUpsertError: null,
  existingImagePaths: null,
  draftRow: null,
  failUploadWhenSize: null,
  failAllUploads: false,
  duplicateWhenSize: null,
};

const uploads: UploadCall[] = [];
const upserts: UpsertCall[] = [];
const removedPaths: string[] = [];

function resetBoundary() {
  ctl.userId = 'user-pb';
  ctl.selectError = null;
  ctl.upsertError = null;
  ctl.elementosUpsertError = null;
  ctl.existingImagePaths = null;
  ctl.draftRow = null;
  ctl.failUploadWhenSize = null;
  ctl.failAllUploads = false;
  ctl.duplicateWhenSize = null;
  uploads.length = 0;
  upserts.length = 0;
  removedPaths.length = 0;
}

vi.mock('@/integrations/supabase/client', () => {
  let seq = 0;
  const nextUpdatedAt = () => {
    seq += 1;
    return `2026-05-01T00:00:${String(seq).padStart(2, '0')}.000Z`;
  };

  const upsertBuilder = (table: string, payload: Record<string, unknown>) => {
    const run = async () => {
      const err = table === 'liturgia_elementos' ? ctl.elementosUpsertError : ctl.upsertError;
      const record: UpsertCall = { table };
      if (table === 'cuentacuentos_drafts') {
        record.imagePaths = payload['image_paths'];
        record.persistedJsonHasInlineImage = treeHasInlineImage(payload['story']);
      } else if (table === 'liturgia_elementos') {
        const rows = Array.isArray(payload) ? payload : [payload];
        record.elementStoryImageRefs = rows.map((r) => {
          const cfg = (r as Record<string, unknown>)['config'] as Record<string, unknown> | null;
          const story = cfg?.['storyData'] as Record<string, unknown> | undefined;
          if (!story) return null;
          return {
            characterSheetUrls: (story['characters'] as Array<Record<string, unknown>> | undefined)?.map(
              (c) => c['characterSheetUrl'] ?? null
            ),
            sceneUrls: (story['scenes'] as Array<Record<string, unknown>> | undefined)?.map(
              (s) => s['selectedImageUrl'] ?? null
            ),
            coverImageUrl: story['coverImageUrl'] ?? null,
            endImageUrl: story['endImageUrl'] ?? null,
            hasInlineImage: treeHasInlineImage(story),
          };
        });
      }
      upserts.push(record);
      if (err) return { error: err };
      return { error: null };
    };
    const rowResult = async () => {
      const r = await run();
      if (r.error) return { data: null, error: r.error };
      // `saveLiturgy` lee `liturgiaData.id` del RETURNING del upsert de
      // `liturgias` (:440-455): sin `id` el path de finalización quedaría
      // `liturgias/undefined/...`.
      return {
        data: { updated_at: nextUpdatedAt(), id: (payload as Record<string, unknown>)['id'] ?? 'lit-pb' },
        error: null,
      };
    };
    return {
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        run().then(res as never, rej as never),
      select: () => ({
        maybeSingle: rowResult,
        single: rowResult,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          rowResult().then(res as never, rej as never),
      }),
    };
  };

  const makeDeleteChain = () => {
    const chain = {
      eq: () => chain,
      not: () => chain,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ error: null, data: [{ id: 'row' }] }).then(res as never, rej as never),
      select: () => ({
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ error: null, data: [{ id: 'row' }] }).then(res as never, rej as never),
      }),
    };
    return chain;
  };

  const tableApi = (table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(async () => {
      if (table === 'cuentacuentos_drafts') {
        if (ctl.selectError) return { data: null, error: ctl.selectError };
        if (ctl.draftRow) return { data: ctl.draftRow, error: null };
        return {
          data: ctl.existingImagePaths ? { image_paths: ctl.existingImagePaths } : null,
          error: null,
        };
      }
      if (table === 'liturgias') return { data: { id: 'lit-pb' }, error: null };
      return { data: null, error: null };
    }),
    single: vi.fn().mockImplementation(async () => {
      if (table === 'liturgias') return { data: { id: 'lit-pb' }, error: null };
      return { data: null, error: null };
    }),
    upsert: vi.fn().mockImplementation((payload: Record<string, unknown>) =>
      upsertBuilder(table, payload)
    ),
    delete: vi.fn().mockImplementation(() => makeDeleteChain()),
  });

  const storageApi = (bucket: string) => ({
    upload: vi.fn().mockImplementation(
      async (p: string, blob: Blob, opts?: { contentType?: string; upsert?: boolean }) => {
        uploads.push({
          bucket,
          path: p,
          contentType: opts?.contentType,
          upsert: opts?.upsert,
        });
        if (ctl.failAllUploads) {
          return { data: null, error: storageError('Storage falló', '500') };
        }
        if (ctl.failUploadWhenSize !== null && blob?.size === ctl.failUploadWhenSize) {
          return { data: null, error: storageError('Storage falló', '500') };
        }
        if (ctl.duplicateWhenSize !== null && blob?.size === ctl.duplicateWhenSize) {
          return { data: null, error: storageError('The resource already exists', '409') };
        }
        return { data: { path: p }, error: null };
      }
    ),
    getPublicUrl: vi.fn().mockImplementation((p: string) => ({
      data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucket}/${p}` },
    })),
    remove: vi.fn().mockImplementation(async (paths: string[]) => {
      removedPaths.push(...paths);
      return { error: null };
    }),
    list: vi.fn().mockImplementation(async (dir: string, opts?: { search?: string }) => ({
      data: opts?.search ? [{ name: opts.search }] : [],
      error: null,
    })),
    download: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  /**
   * Error de Storage con la FORMA REAL capturada del runtime local
   * (storage-api v1.66.4 + @supabase/storage-js 2.90.1): `StorageApiError` con
   * `status: 400` y `statusCode` STRING. Ver `pbStorageError.ts`.
   */
  function storageError(message: string, statusCode: string) {
    const err = new Error(message) as Error & {
      __isStorageError: boolean;
      status: number;
      statusCode: string;
    };
    err.name = 'StorageApiError';
    err.__isStorageError = true;
    err.status = 400;
    err.statusCode = statusCode;
    return err;
  }

  return {
    supabase: {
      from: vi.fn((t: string) => tableApi(t)),
      storage: { from: vi.fn((b: string) => storageApi(b)) },
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: { success: true, images: [`data:image/png;base64,${PNG_A_B64}`] },
          error: null,
        }),
      },
      auth: {
        getUser: vi.fn().mockImplementation(async () => ({
          data: { user: ctl.userId ? { id: ctl.userId } : null },
        })),
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    },
  };
});

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

// Producción — importada DESPUÉS de los mocks.
import {
  useCuentacuentosDraft,
  type DraftPatch,
  type CuentacuentosDraftFull,
} from '@/hooks/useCuentacuentosDraft';
import CuentacuentoEditor from '@/components/liturgia-builder/editors/CuentacuentoEditor';
import { saveLiturgy } from '@/lib/liturgia/liturgyService';

// ---------------------------------------------------------------------------
// Fixture I/O
// ---------------------------------------------------------------------------

const FIXTURE_PATH = path.resolve(
  __dirname,
  'pb_fe_base_185c370.json'
);
const CAPTURE_MODE = process.env.PB_CAPTURE === '1';

const captured: Record<string, CaseRecord> = {};

function record(id: string, outcome: string, error: string | null, observed: Record<string, unknown>): CaseRecord {
  const rec: CaseRecord = {
    id,
    outcome,
    error: error === null ? null : normalizeValue(error),
    uploads: normalizeValue([...uploads]),
    upserts: normalizeValue([...upserts]),
    observed: normalizeValue(observed),
  };
  captured[id] = rec;
  return rec;
}

// ---------------------------------------------------------------------------
// Fixtures de dominio, transcritas de los call sites de 185c370
// ---------------------------------------------------------------------------

const LITURGY_ID = 'lit-pb';

const baseContext: LiturgyContext = {
  id: LITURGY_ID,
  date: new Date('2026-05-10'),
  title: 'Liturgia PB',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

function storyWith(overrides: Partial<Story> = {}): Story {
  return {
    id: 'story-pb',
    title: 'Cuento PB',
    summary: 'Resumen',
    location: { name: 'Jerusalén' } as unknown as Story['location'],
    illustrationStyle: 'ghibli',
    characters: [
      {
        id: 'char1',
        name: 'María',
        role: 'protagonist',
        description: 'Niña curiosa',
        visualDescription: 'vestido azul',
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      {
        number: 1,
        text: 'Escena 1',
        visualDescription: 'plaza',
      } as unknown as Story['scenes'][number],
    ],
    props: [],
    spiritualConnection: 'Esperanza',
    metadata: {
      createdAt: '',
      updatedAt: '',
      status: 'story-generated' as Story['metadata']['status'],
    },
    ...overrides,
  } as Story;
}

async function mountHook() {
  const { result } = renderHook(() => useCuentacuentosDraft({ liturgyId: LITURGY_ID }));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

/** Ejerce una escritura del hook de producción y registra el resultado. */
async function runHookCase(
  id: string,
  patch: DraftPatch,
  setup?: () => void
): Promise<void> {
  // Todos los casos corren dentro de UN it(): el auto-cleanup de
  // testing-library (que ocurre entre it()) no aplica. Sin esto, los árboles
  // React se acumulan y un click alcanza el render de un caso anterior.
  cleanup();
  resetBoundary();
  setup?.();
  const result = await mountHook();
  let outcome = 'resolved';
  let error: string | null = null;
  let value: unknown = null;
  await act(async () => {
    try {
      value = await result.current.enqueueDraftWrite(patch);
    } catch (err) {
      outcome = 'rejected';
      error = err instanceof Error ? err.message : String(err);
    }
  });
  const res = value as
    | { stale?: boolean; uploadedUrls?: unknown; committed?: CuentacuentosDraftFull }
    | null;
  const committed = res?.committed ?? null;
  record(id, outcome, error, {
    stale: res?.stale ?? false,
    uploadedUrls: res?.uploadedUrls ?? null,
    // "post-write React swap result": lo que el hook dejó en su estado.
    swap: committed
      ? {
          characterSheetOptions: committed.characterSheetOptions ?? null,
          sceneImageOptions: committed.sceneImageOptions ?? null,
          coverOptions: committed.coverOptions ?? null,
          endOptions: committed.endOptions ?? null,
          sceneReferenceImages: committed.sceneReferenceImages ?? null,
          coverReferenceImage: committed.coverReferenceImage ?? null,
          endReferenceImage: committed.endReferenceImage ?? null,
          propsReferenceImages: committed.story?.props?.map((p) => ({
            id: p.id,
            referenceImages: p.referenceImages ?? null,
          })) ?? null,
        }
      : null,
  });
}

// ---------------------------------------------------------------------------
// Matriz de categorías del hook (las nueve de G6)
// ---------------------------------------------------------------------------

/** Grupo de 3 con tamaños de blob DISTINTOS: PNG(70) / JPEG(160) / PNG(70). */
const TRIO = [PNG_A_B64, JPEG_B64, PNG_B_B64];
/** Grupo mixto: URL existente + base64 crudo + data URL. */
const MIXED = [EXISTING_DRAFTS_URL, PNG_C_B64, PNG_A_DATA_URL];

const JPEG_SIZE = 160; // bytes del fixture JPEG → selector de fallo intermedio

interface CategorySpec {
  name: string;
  /** Patch con el grupo dado. */
  patch: (values: string[]) => DraftPatch;
  /** Patch explícitamente vacío. */
  empty: DraftPatch;
  /** Categorías escalares aceptan un solo valor. */
  scalar?: boolean;
}

const CATEGORIES: CategorySpec[] = [
  {
    name: 'characterSheets',
    patch: (v) => ({ characterSheetOptions: { char1: v } }),
    empty: { characterSheetOptions: {} },
  },
  {
    name: 'sceneImages',
    patch: (v) => ({ sceneImageOptions: { 1: v } }),
    empty: { sceneImageOptions: {} },
  },
  {
    name: 'cover',
    patch: (v) => ({ coverOptions: v }),
    empty: { coverOptions: [] },
  },
  {
    name: 'end',
    patch: (v) => ({ endOptions: v }),
    empty: { endOptions: [] },
  },
  {
    name: 'propsFromStory',
    patch: (v) => ({
      story: storyWith({
        props: [{ id: 'prop1', name: 'Lámpara', referenceImages: v }] as unknown as Story['props'],
      }),
    }),
    empty: { story: storyWith({ props: [] }) },
  },
  {
    name: 'propsFromPropRefs',
    patch: (v) => ({ propReferenceImages: { prop1: v } }),
    empty: { propReferenceImages: {} },
  },
  {
    name: 'sceneReferences',
    patch: (v) => ({ sceneReferenceImages: { 1: v[0] } }),
    empty: { sceneReferenceImages: {} },
    scalar: true,
  },
  {
    name: 'coverReference',
    patch: (v) => ({ coverReferenceImage: v[0] }),
    empty: { coverReferenceImage: null },
    scalar: true,
  },
  {
    name: 'endReference',
    patch: (v) => ({ endReferenceImage: v[0] }),
    empty: { endReferenceImage: null },
    scalar: true,
  },
];

// ---------------------------------------------------------------------------
// Ejecución de la matriz
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetBoundary();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
});

describe('PB G6 — captura/comparación del comportamiento base 185c370', () => {
  it('recorre la matriz completa y compara contra el fixture', async () => {
    // --- 1. Nueve categorías × cinco modos ---------------------------------
    for (const cat of CATEGORIES) {
      const values = cat.scalar ? [PNG_A_B64] : TRIO;

      await runHookCase(`hook.${cat.name}.allSuccess`, cat.patch(values));

      if (!cat.scalar) {
        await runHookCase(`hook.${cat.name}.midFailure`, cat.patch(values), () => {
          ctl.failUploadWhenSize = JPEG_SIZE;
        });
      }

      await runHookCase(`hook.${cat.name}.allFailure`, cat.patch(values), () => {
        ctl.failAllUploads = true;
      });

      await runHookCase(
        `hook.${cat.name}.decodeFailure`,
        cat.patch(cat.scalar ? [INVALID_B64] : [PNG_A_B64, INVALID_B64, PNG_B_B64])
      );

      await runHookCase(`hook.${cat.name}.explicitEmpty`, cat.empty);

      if (!cat.scalar) {
        await runHookCase(`hook.${cat.name}.mixedInputs`, cat.patch(MIXED));
      }
    }

    // --- 2. Fallos de la propia persistencia -------------------------------
    await runHookCase('hook.selectFailure', { coverOptions: TRIO }, () => {
      ctl.selectError = { message: 'select boom' };
    });
    await runHookCase('hook.upsertFailure', { coverOptions: TRIO }, () => {
      ctl.upsertError = { message: 'upsert boom' };
    });

    // --- 3. Conflicto de duplicado en Storage ------------------------------
    await runHookCase('hook.duplicateConflict', { coverOptions: [PNG_A_B64] }, () => {
      ctl.duplicateWhenSize = 70;
    });

    // --- 4. Bytes no soportados (GIF) y WebP admitido ----------------------
    await runHookCase('hook.unsupportedBytes', { coverOptions: [GIF_B64] });
    await runHookCase('hook.webpBytes', { coverOptions: [WEBP_B64] });
    await runHookCase('hook.lyingDataUrl', { coverOptions: [PNG_A_DATA_URL_LYING] });

    // --- 5. Recarga: paths legacy posicionales, hash-shaped y mixtos -------
    for (const [id, paths] of Object.entries({
      'reload.legacyPositional': {
        characterSheetPaths: { char1: ['user-pb/lit-pb/characters/char1_0.png'] },
        sceneImagePaths: { 1: ['user-pb/lit-pb/scenes/scene1_0.png'] },
        coverPaths: ['user-pb/lit-pb/cover/cover_0.png'],
        endPaths: ['user-pb/lit-pb/end/end_0.png'],
      },
      'reload.hashShaped': {
        characterSheetPaths: { char1: [`user-pb/lit-pb/characters/char1_${'a'.repeat(32)}.png`] },
        sceneImagePaths: { 1: [`user-pb/lit-pb/scenes/scene1_${'b'.repeat(32)}.png`] },
        coverPaths: [`user-pb/lit-pb/cover/cover_${'c'.repeat(32)}.png`],
        endPaths: [`user-pb/lit-pb/end/end_${'d'.repeat(32)}.png`],
      },
      'reload.mixed': {
        characterSheetPaths: {
          char1: [
            'user-pb/lit-pb/characters/char1_0.png',
            `user-pb/lit-pb/characters/char1_${'e'.repeat(32)}.png`,
          ],
        },
        sceneImagePaths: { 1: ['user-pb/lit-pb/scenes/scene1_0.png'] },
        coverPaths: [],
        endPaths: [],
      },
    })) {
      cleanup();
      resetBoundary();
      ctl.draftRow = {
        liturgia_id: LITURGY_ID,
        user_id: 'user-pb',
        current_step: 'scenes',
        config: {},
        story: {
          ...storyWith(),
          editorStateV1: {
            version: 1,
            selections: {
              selectedCharacterSheets: { char1: 0 },
              selectedSceneImages: { 1: 0 },
              selectedCover: null,
              selectedEnd: null,
            },
          },
        },
        image_paths: paths,
        updated_at: '2026-05-01T00:00:00.000Z',
      };
      const result = await mountHook();
      let loaded: CuentacuentosDraftFull | null = null;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });
      const d = loaded as CuentacuentosDraftFull | null;
      record(id, 'resolved', null, {
        characterSheetOptions: d?.characterSheetOptions ?? null,
        sceneImageOptions: d?.sceneImageOptions ?? null,
        coverOptions: d?.coverOptions ?? null,
        endOptions: d?.endOptions ?? null,
        selectedCharacterSheets: d?.selectedCharacterSheets ?? null,
        selectedSceneImages: d?.selectedSceneImages ?? null,
      });
    }

    // --- 6. Round trip combinado editorStateV1 + image_paths ---------------
    await runHookCase('roundTrip.combined', {
      currentStep: 'scenes',
      story: storyWith(),
      characterSheetOptions: { char1: [PNG_A_B64] },
      sceneImageOptions: { 1: [PNG_B_B64] },
      selectedCharacterSheets: { char1: 0 },
      selectedSceneImages: { 1: 0 },
      sceneReferenceImages: { 1: PNG_C_B64 },
      coverReferenceImage: PNG_D_B64,
      endReferenceImage: PNG_E_B64,
    });

    // --- 7. Finalización vía saveLiturgy de producción ---------------------
    const finalizationCases: Array<[string, () => void]> = [
      ['liturgy.allSuccess', () => {}],
      ['liturgy.midCategoryFailure', () => { ctl.failUploadWhenSize = JPEG_SIZE; }],
      ['liturgy.allFailure', () => { ctl.failAllUploads = true; }],
      ['liturgy.decodeFailure', () => {}],
    ];
    for (const [id, setup] of finalizationCases) {
      cleanup();
      resetBoundary();
      setup();
      const charBytes = id === 'liturgy.decodeFailure' ? INVALID_B64 : PNG_A_B64;
      const story = storyWith({
        characters: [
          {
            id: 'char1',
            name: 'María',
            role: 'protagonist',
            description: 'd',
            visualDescription: 'v',
            characterSheetUrl: charBytes,
          } as unknown as Story['characters'][number],
        ],
        scenes: [
          {
            number: 1,
            text: 'Escena 1',
            visualDescription: 'plaza',
            selectedImageUrl: JPEG_B64,
          } as unknown as Story['scenes'][number],
        ],
        coverImageUrl: PNG_B_B64,
        endImageUrl: PNG_C_B64,
      });
      let outcome = 'resolved';
      let error: string | null = null;
      let saveResult: unknown = null;
      try {
        saveResult = await saveLiturgy({
          id: LITURGY_ID,
          context: baseContext,
          status: 'draft',
          metadata: { createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
          elements: [
            {
              id: 'el-1',
              type: 'cuentacuentos',
              order: 0,
              title: 'Cuento',
              status: 'pending',
              config: { storyData: story },
            },
          ],
        } as never);
      } catch (err) {
        outcome = 'rejected';
        error = err instanceof Error ? err.message : String(err);
      }
      record(id, outcome, error, { saveResult });
    }

    // --- 8. Callbacks manuales del editor de producción --------------------
    await runEditorCases();

    // --- 9. Captura o comparación -----------------------------------------
    if (CAPTURE_MODE) {
      writeFixtureOrThrow();
      return;
    }
    // Volcado auxiliar del resultado ACTUAL (no toca el fixture base). Se usa
    // sólo para redactar la tabla de divergencias; no participa de ninguna
    // aserción.
    if (process.env.PB_DUMP) {
      fs.writeFileSync(process.env.PB_DUMP, JSON.stringify({ cases: captured }, null, 2), 'utf8');
    }
    compareAgainstFixture();
  }, 600_000);
});

// ---------------------------------------------------------------------------
// Callbacks manuales del editor (los cuatro sitios de guardado)
// ---------------------------------------------------------------------------

/**
 * Los cuatro sitios de guardado manual del editor de PRODUCCIÓN.
 *
 * Cómo se alcanza cada paso (todo por caminos reales del componente):
 *  - `characters` y `scenes` se alcanzan por `getInitialStep()` (:558-569), que
 *    los deriva de `initialStory.metadata.status`.
 *  - `cover` NO tiene mapeo de estado: el editor sólo llega ahí aprobando las
 *    escenas ("Aprobar escenas" → `setCurrentStep('cover')`, :3759). El paso
 *    `cover` renderiza AMBOS selectores, portada (:6212) y fin (:6556).
 *
 * Las opciones se siembran desde `initialStory` (:1011-1057): el efecto copia
 * `characterSheetUrl` / `selectedImageUrl` / `coverImageUrl` / `endImageUrl` a
 * las opciones del editor y selecciona el índice 0. Por eso el valor inline
 * llega al callback sin mockear nada del hook.
 */
type EditorSite = 'character' | 'scene' | 'cover' | 'end';

const EDITOR_MESSAGE_RE =
  /(Imagen guardada exitosamente|Imagen ya guardada|Portada guardada exitosamente|Portada ya guardada|Imagen final guardada exitosamente|Imagen final ya guardada|Error al guardar)/i;

async function renderEditorAtSite(site: EditorSite, optionValue: string) {
  const withStatus = (status: string, extra: Partial<Story>) =>
    storyWith({
      ...extra,
      metadata: { createdAt: '', updatedAt: '', status } as Story['metadata'],
    });

  if (site === 'character') {
    return withStatus('characters-pending', {
      characters: [
        {
          id: 'char1',
          name: 'María',
          role: 'protagonist',
          description: 'd',
          visualDescription: 'v',
          characterSheetUrl: optionValue,
        } as unknown as Story['characters'][number],
      ],
    });
  }
  if (site === 'scene') {
    return withStatus('characters-approved', {
      scenes: [
        {
          number: 1,
          text: 'Escena 1',
          visualDescription: 'plaza',
          selectedImageUrl: optionValue,
        } as unknown as Story['scenes'][number],
      ],
    });
  }
  // cover / end — se parte de `scenes-pending` y se aprueba para llegar a `cover`.
  return withStatus('scenes-pending', {
    scenes: [
      {
        number: 1,
        text: 'Escena 1',
        visualDescription: 'plaza',
        selectedImageUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['scenes'][number],
    ],
    coverImageUrl: site === 'cover' ? optionValue : EXISTING_DRAFTS_URL,
    endImageUrl: site === 'end' ? optionValue : EXISTING_DRAFTS_URL,
  });
}

async function runEditorCases() {
  const sites: EditorSite[] = ['character', 'scene', 'cover', 'end'];
  const bytesFor: Record<EditorSite, string> = {
    character: PNG_A_B64,
    scene: PNG_B_B64,
    cover: PNG_C_B64,
    end: PNG_D_B64,
  };

  for (const site of sites) {
    for (const variant of ['existingUrl', 'success', 'uploadFailure'] as const) {
      cleanup();
      resetBoundary();
      // Sin fila de borrador: el prompt "Borrador encontrado" taparía el paso.
      ctl.draftRow = null;
      if (variant === 'uploadFailure') ctl.failAllUploads = true;

      const optionValue = variant === 'existingUrl' ? EXISTING_DRAFTS_URL : bytesFor[site];
      const initialStory = await renderEditorAtSite(site, optionValue);

      let message: string | null = null;
      let buttonCount = 0;
      try {
        render(
          <CuentacuentoEditor
            context={baseContext}
            initialStory={initialStory}
            onStoryCreated={vi.fn()}
          />
        );

        // cover/end: transición real de escenas → portada.
        if (site === 'cover' || site === 'end') {
          const approve = await waitFor(
            () => screen.getByRole('button', { name: /Aprobar escenas/i }),
            { timeout: 8000 }
          );
          await act(async () => {
            fireEvent.click(approve);
          });
          await waitFor(
            () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
            { timeout: 8000 }
          );
        }

        const saveButtons = await waitFor(
          () => {
            const found = screen.queryAllByRole('button', { name: /Guardar selección/i });
            if (found.length === 0) throw new Error('sin botón de guardado');
            return found;
          },
          { timeout: 8000 }
        );
        buttonCount = saveButtons.length;
        // En el paso `cover` hay DOS botones: portada primero, fin después.
        const index = site === 'end' ? saveButtons.length - 1 : 0;
        uploads.length = 0; // descarta subidas de la transición de aprobación
        await act(async () => {
          fireEvent.click(saveButtons[index]);
        });
        await waitFor(
          () => {
            const el = screen.queryByText(EDITOR_MESSAGE_RE);
            if (!el) throw new Error('sin mensaje visible');
            message = el.textContent;
          },
          { timeout: 8000 }
        );
      } catch (err) {
        message = `__no-ui__:${err instanceof Error ? err.message : String(err)}`;
      }

      record(`editor.${site}.${variant}`, 'resolved', null, {
        userVisibleMessage: message,
        saveButtonCount: buttonCount,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Escritura / comparación del fixture
// ---------------------------------------------------------------------------

function writeFixtureOrThrow() {
  // Guarda D5: el modo captura sólo es legítimo sobre producción intacta.
  if (fs.existsSync(FIXTURE_PATH)) {
    throw new Error(
      `PB_CAPTURE abortado: ${path.basename(FIXTURE_PATH)} ya existe y es READ-ONLY (D5). ` +
        'Una re-captura sólo es válida sobre un árbol byte-idéntico a 185c370 y ' +
        'requiere borrar el fixture DELIBERADAMENTE, nunca para poner en verde una comparación.'
    );
  }
  const fixture: CaptureFixture = {
    base: '185c370f27c018fb8058b34d210a50a63d7651b3',
    runtime: {
      node: process.version,
      note: 'Capturado con src/** byte-idéntico a cc-downscale-a@185c370',
    },
    cases: captured,
  };
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
  console.log(`[PB G6] fixture escrito: ${FIXTURE_PATH} (${Object.keys(captured).length} casos)`);
}

/**
 * PB — las llamadas a Storage se comparan como MULTICONJUNTO ordenado por path.
 *
 * Motivo (finding registrado): la primitiva hashea con `crypto.subtle`, que es
 * asíncrono, así que bajo el pool de concurrencia 6 el ORDEN en que los jobs
 * llegan a `.upload()` varía entre corridas. En 185c370 el decode era síncrono
 * y ese orden salía estable — pero nunca fue un contrato: Storage no impone
 * orden entre objetos distintos.
 *
 * Lo que SÍ es contrato (T-B.1: orden y largo del grupo preservados) se sigue
 * comparando de forma estricta y ordenada, porque vive en `upserts`
 * (`image_paths`) y en `observed` (`uploadedUrls` y el swap de React), que esta
 * función no toca.
 */
function sortUploads<T>(value: T): T {
  if (!Array.isArray(value)) return value;
  return [...(value as unknown[])].sort((a, b) => {
    const pa = String((a as { path?: unknown })?.path ?? '');
    const pb = String((b as { path?: unknown })?.path ?? '');
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  }) as unknown as T;
}

function compareAgainstFixture() {
  expect(
    fs.existsSync(FIXTURE_PATH),
    `Falta el fixture base ${path.basename(FIXTURE_PATH)}`
  ).toBe(true);
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as CaptureFixture;

  // Cobertura: ningún caso capturado puede desaparecer del comparador.
  expect(Object.keys(captured).sort()).toEqual(Object.keys(fixture.cases).sort());

  const findings: string[] = [];

  for (const id of Object.keys(fixture.cases)) {
    const oldRec = JSON.parse(JSON.stringify(fixture.cases[id])) as CaseRecord;
    const newRec = JSON.parse(JSON.stringify(captured[id])) as CaseRecord;
    oldRec.uploads = sortUploads(oldRec.uploads);
    newRec.uploads = sortUploads(newRec.uploads);

    // Aplica las divergencias declaradas para este caso: cada una exige que el
    // VIEJO valor sea exactamente el capturado y el NUEVO exactamente el
    // requerido. Después se retira del objeto para que el resto compare igual.
    for (const div of DIVERGENCES.filter((d) => d.case === id)) {
      const isUploads = div.path === 'uploads';
      const actualOld = getPath(oldRec, div.path);
      const actualNew = getPath(newRec, div.path);
      const expectOld = isUploads ? sortUploads(div.oldValue) : div.oldValue;
      const expectNew = isUploads ? sortUploads(div.newValue) : div.newValue;
      try {
        expect(actualOld, `[${id}] divergencia ${div.path}: el fixture base ya no contiene el valor viejo declarado`).toEqual(expectOld);
        expect(actualNew, `[${id}] divergencia ${div.path} (${div.reason}): el head no produce el valor nuevo requerido`).toEqual(expectNew);
      } catch (err) {
        findings.push(
          `DIVERGENCIA NO SATISFECHA [${id}] ${div.path} — ${div.reason}\n${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
      // Guarda independiente de la tabla: el `newValue` declarado debe
      // satisfacer las invariantes de PB por sí mismo.
      const violations = assertNewValueInvariants(id, div.path, div.newValue);
      if (violations.length > 0) {
        findings.push(`INVARIANTE VIOLADA en el newValue declarado:\n${violations.join('\n')}`);
      }

      deletePath(oldRec, div.path);
      deletePath(newRec, div.path);
    }

    try {
      expect(newRec).toEqual(oldRec);
    } catch (err) {
      findings.push(
        `FINDING — diferencia NO declarada en el caso [${id}]:\n${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  if (findings.length > 0) {
    throw new Error(
      `PB G6 — ${findings.length} diferencia(s) respecto del comportamiento base ` +
        `capturado en 185c370.\n\n${findings.join('\n\n')}`
    );
  }
}
