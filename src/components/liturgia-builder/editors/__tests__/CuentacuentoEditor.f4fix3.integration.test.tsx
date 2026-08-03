/**
 * F4 fix-3 — correcciones de la re-revisión independiente de `c4f3b6b`.
 *
 * Misma disciplina que `CuentacuentoEditor.f4fix.integration.test.tsx`: el
 * CuentacuentoEditor REAL con los hooks REALES (`useCuentacuentosDraft`,
 * `useStoryImagePipeline`); sólo se mockean los bordes externos
 * (`@/integrations/supabase/client`, `@/hooks/use-toast`, `fetch`, timers).
 * NINGÚN `vi.mock` sobre el sujeto bajo prueba.
 *
 *   R1 (Finding 1, HIGH) — el re-estampado F1 de `applyPropsUpdate` no debe
 *        resucitar una `story` superseded desde el buffer del debounce.
 *   R3 (Finding 3, MED) — "generar otras opciones" debe estar bloqueado
 *        mientras el envelope de aprobación/finalización está en vuelo.
 *   R4 (Finding 4, MED) — el bump de F3 (refine) debe persistir el cuento
 *        refinado en vez de dejar varado el patch pendiente.
 *   R2 (Finding 2, MED) — la limpieza de filas huérfanas al montar debe ser
 *        condicional: NO puede borrar un borrador vivo.
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

// ---------------------------------------------------------------------------
// External-boundary trackers
// ---------------------------------------------------------------------------

type UpsertPayload = Record<string, unknown>;
const upsertCalls: Array<{ payload: UpsertPayload }> = [];
const upsertDeferreds: Array<Deferred<{ error: { message: string } | null }>> = [];
let upsertDefaultError: { message: string } | null = null;
let mockUserId: string | null = 'user-f4fix3';

const invokeCalls: Array<{ fn: string }> = [];
const invokeDeferreds: Array<Deferred<{ data: unknown; error: unknown }>> = [];
/** Cada DELETE registra TODOS sus filtros `.eq()`, para poder afirmar que la
 *  limpieza de huérfanos es CONDICIONAL (Finding 2), no un borrado ciego. */
const deletedDraftRows: Array<{ filters: Record<string, unknown> }> = [];
let mockDraftRow: Record<string, unknown> | null = null;
let mockRefinedStory: Record<string, unknown> | null = null;

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
  const makeDeleteChain = (tableName: string) => {
    const filters: Record<string, unknown> = {};
    let recorded = false;
    const record = () => {
      if (recorded) return;
      recorded = true;
      if (tableName === 'cuentacuentos_drafts') deletedDraftRows.push({ filters });
    };
    const chain = {
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        // El DELETE se materializa al await-earse; registramos en el then para
        // haber visto TODOS los `.eq()` encadenados.
        return chain;
      },
      then: (res: (v: { error: null; data: unknown[] }) => unknown) => {
        record();
        return Promise.resolve({ error: null, data: [] }).then(res);
      },
      select: () => ({
        then: (res: (v: { error: null; data: unknown[] }) => unknown) => {
          record();
          return Promise.resolve({ error: null, data: [] }).then(res);
        },
      }),
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
    upsert: vi.fn().mockImplementation((payload: UpsertPayload) =>
      __upsertBuilder((async () => {
      upsertCalls.push({ payload });
      const deferred = upsertDeferreds.shift();
      if (deferred) return deferred.promise;
      return { error: upsertDefaultError };
    })())
    ),
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
          const blocker = invokeDeferreds.shift();
          if (blocker) return blocker.promise;
          return {
            data: {
              success: true,
              images: ['data:image/png;base64,iVBORw0KGgoAAA=', 'data:image/png;base64,iVBORw0KGgoBBB='],
            },
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
  id: 'lit-f4fix3',
  date: new Date('2026-05-10'),
  title: 'Test Liturgy F4fix3',
  readings: [],
  summary: '',
  preacher: 'Pastor Test',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

/** Story en el paso `characters` (status `characters-pending`) con DOS props:
 *  uno que editaremos por descripción y otro que borraremos. */
function makeCharactersStepStoryWithProps(id = 'story-r1'): Story {
  return {
    id,
    title: 'Cuento con props',
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
    ],
    props: [
      { id: 'prop-keep', kind: 'object', name: 'El farol', narrativeRole: 'guía', visualDescription: 'farol de bronce', referenceImages: [], role: 'secondary' },
      { id: 'prop-doomed', kind: 'object', name: 'La llave', narrativeRole: 'acceso', visualDescription: 'llave oxidada', referenceImages: [], role: 'secondary' },
    ] as unknown as Story['props'],
    spiritualConnection: 'Esperanza',
    metadata: { createdAt: '', updatedAt: '', status: 'characters-pending' as Story['metadata']['status'] },
  } as Story;
}

function makeStoryGeneratedStory(id = 'story-sg-1'): Story {
  return {
    ...makeCharactersStepStoryWithProps(id),
    props: [] as unknown as Story['props'],
    metadata: { createdAt: '', updatedAt: '', status: 'story-generated' as Story['metadata']['status'] },
  } as Story;
}

function makeScenesPendingStory(id = 'story-fin'): Story {
  return {
    ...makeCharactersStepStoryWithProps(id),
    title: 'Cuento a finalizar',
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
    ],
    coverImageUrl: 'https://mock/cover.png',
    endImageUrl: 'https://mock/end.png',
    coverImageOptions: ['https://mock/cover-a.png', 'https://mock/cover-b.png'],
    endImageOptions: ['https://mock/end-a.png', 'https://mock/end-b.png'],
    metadata: { createdAt: '', updatedAt: '', status: 'scenes-pending' as Story['metadata']['status'] },
  } as unknown as Story;
}

function storyOf(payload: UpsertPayload): Record<string, unknown> | null {
  return (payload['story'] as Record<string, unknown> | null) ?? null;
}
function propIdsOf(payload: UpsertPayload): string[] | null {
  const story = storyOf(payload);
  if (!story) return null;
  const props = story['props'] as Array<{ id?: string }> | undefined;
  if (!Array.isArray(props)) return null;
  return props.map((p) => String(p.id));
}

beforeEach(() => {
  upsertCalls.length = 0;
  upsertDeferreds.length = 0;
  upsertDefaultError = null;
  invokeCalls.length = 0;
  invokeDeferreds.length = 0;
  deletedDraftRows.length = 0;
  mockUserId = 'user-f4fix3';
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

// ---------------------------------------------------------------------------
// R1 (BASE-RED, Finding 1 HIGH) — `applyPropsUpdate` re-estampa el patch
// pendiente del debounce bajo la identidad fresca. Si ese patch pendiente ya
// contenía una `story` de un `saveDraft({story})` anterior (el blur de
// descripción de prop), el merge D14 la CONSERVA y el debounce la persiste
// 2 s DESPUÉS de la escritura directa — resucitando el prop borrado.
// ---------------------------------------------------------------------------
describe('R1 (BASE-RED): el re-estampado de applyPropsUpdate no resucita una story superseded', () => {
  it('borrar un prop tras editar la descripción de otro no lo trae de vuelta al persistir', { timeout: 20000 }, async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeCharactersStepStoryWithProps('story-r1')}
        onStoryCreated={vi.fn()}
      />
    );

    // Los dos props se renderizan en PropSheetSection (paso `characters`).
    const descriptionBoxes = await screen.findAllByPlaceholderText(
      /Descripción visual canónica/i
    );
    expect(descriptionBoxes.length).toBe(2);

    await act(async () => { await yields(6); });
    upsertCalls.length = 0;

    vi.useFakeTimers({ shouldAdvanceTime: false });

    // 1) Blur con cambio real en la descripción del prop que SE CONSERVA.
    //    `handleUpdatePropDescription` ⇒ bump + saveDraft({ story: S1 }).
    //    S1 todavía contiene AMBOS props.
    act(() => {
      fireEvent.change(descriptionBoxes[0], { target: { value: 'farol de bronce pulido' } });
      fireEvent.blur(descriptionBoxes[0]);
    });

    // 2) DENTRO de la ventana de 2 s, borrar el otro prop. `handleRemoveProp`
    //    ⇒ applyPropsUpdate ⇒ bump + saveDraft({currentStep}) (re-estampa el
    //    patch pendiente) + enqueueDraftWrite({story: S2}) que persiste YA.
    const removeButtons = screen.getAllByTitle('Quitar este lugar/objeto');
    expect(removeButtons.length).toBe(2);
    await act(async () => {
      fireEvent.click(removeButtons[1]);
      await yields(20);
    });

    // 3) Vencer el debounce: el patch pendiente re-estampado se persiste.
    await act(async () => {
      vi.advanceTimersByTime(2500);
      await yields(30);
    });
    vi.useRealTimers();
    await act(async () => { await yields(20); });

    // La ÚLTIMA escritura que llevó `story` es la que queda en la fila.
    const storyWrites = upsertCalls.filter((c) => propIdsOf(c.payload) !== null);
    expect(storyWrites.length).toBeGreaterThan(0);
    const finalPropIds = propIdsOf(storyWrites[storyWrites.length - 1].payload)!;

    // El prop borrado NO puede reaparecer en el estado persistido.
    expect(finalPropIds).not.toContain('prop-doomed');
    expect(finalPropIds).toContain('prop-keep');
  });
});

// ---------------------------------------------------------------------------
// R4 (BASE-RED, Finding 4 MED) — el bump de F3 en `handleRefineStory` invalida
// el patch pendiente del debounce sin re-estamparlo, así que una edición de
// buffer hecha durante el refine se pierde. Además el refine nunca persistía.
// ---------------------------------------------------------------------------
describe('R4 (BASE-RED): un refine persiste el cuento refinado', () => {
  it('el cuento refinado llega a la fila del draft sin depender de una aprobación posterior', { timeout: 20000 }, async () => {
    mockRefinedStory = {
      ...(makeStoryGeneratedStory('story-r4') as unknown as Record<string, unknown>),
      title: 'Cuento REFINADO',
      summary: 'Resumen refinado',
    };

    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeStoryGeneratedStory('story-r4')}
        onStoryCreated={vi.fn()}
      />
    );

    await screen.findByRole('button', { name: /Aprobar cuento y generar imágenes/i });
    await act(async () => { await yields(6); });
    upsertCalls.length = 0;

    // Abrir el panel de feedback y pedir un refinamiento real.
    const feedbackToggle = await screen.findByRole('button', {
      name: /¿Quieres mejorar algo del cuento\?/i,
    });
    await act(async () => {
      fireEvent.click(feedbackToggle);
      await yields(4);
    });
    const feedbackBox = await screen.findByPlaceholderText(/Describe qué te gustaría mejorar/i);
    await act(async () => {
      fireEvent.change(feedbackBox, { target: { value: 'Hazlo más breve' } });
      await yields(2);
    });
    const refineButton = await screen.findByRole('button', { name: /Refinar cuento/i });
    await act(async () => {
      fireEvent.click(refineButton);
      await yields(30);
    });

    // Vencer el debounce del guardado del refinamiento.
    await act(async () => { await new Promise((r) => setTimeout(r, 2400)); await yields(20); });

    const refinedWrites = upsertCalls.filter((c) => {
      const story = storyOf(c.payload);
      return story !== null && story['title'] === 'Cuento REFINADO';
    });
    expect(refinedWrites.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// R3 (BASE-RED, Finding 3 MED) — "generar otras opciones" durante el envelope
// de finalización cambia `coverOptionsRef` en vivo, y `deriveNextStory` lee esa
// ref DENTRO del tail ⇒ se publica una portada que el usuario nunca eligió.
// ---------------------------------------------------------------------------
describe('R3 (BASE-RED): regenerar está bloqueado durante el envelope de aprobación', () => {
  it('el botón de regenerar portada se deshabilita mientras la finalización está en vuelo', { timeout: 20000 }, async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeScenesPendingStory('story-r3')}
        onStoryCreated={vi.fn()}
      />
    );

    const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveScenes);
      await yields(20);
    });
    const finalize = await screen.findByRole('button', { name: /Finalizar cuento/i });
    await act(async () => { await yields(10); });

    // El regenerar de portada existe y está habilitado ANTES del envelope —
    // sin esto la aserción de abajo sería vacua (un botón ausente "pasa").
    const regenerateBefore = screen.getAllByRole('button', {
      name: /No me gustan, generar otras opciones|Generar 2 opciones adicionales/i,
    });
    expect(regenerateBefore.length).toBeGreaterThan(0);
    expect((regenerateBefore[0] as HTMLButtonElement).disabled).toBe(false);

    // Retener el upsert autoritativo de la finalización para abrir la ventana.
    const held = makeDeferred<{ error: { message: string } | null }>();
    upsertDeferreds.push(held);

    await act(async () => {
      fireEvent.click(finalize);
      await yields(10);
    });

    // Durante el envelope, regenerar debe estar bloqueado: `deriveNextStory`
    // lee `coverOptionsRef` VIVA dentro del tail, así que una regeneración en
    // esta ventana publica una portada que el usuario nunca eligió.
    const regenerateDuring = screen.getAllByRole('button', {
      name: /No me gustan, generar otras opciones|Generar 2 opciones adicionales/i,
    });
    expect((regenerateDuring[0] as HTMLButtonElement).disabled).toBe(true);

    held.resolve({ error: null });
    await act(async () => { await yields(30); });
  });
});

// ---------------------------------------------------------------------------
// R2 — SUPERSEDED BY B1.
//
// Finding 2 asked for the mount-time cleanup DELETE to be conditional
// (`current_step='complete'`) instead of a blind delete driven by a stale read.
// That fix shipped in the fix-3 pass and this test proved it.
//
// B1 then removed the cleanup entirely: with the eager finalize-delete gone, a
// 'complete' row is a finalization awaiting the parent's confirmation, not an
// orphan — and often the only surviving copy of the story. There is no longer
// any mount-time DELETE to make conditional.
//
// The test now pins the surviving guarantee, which is strictly stronger than
// the conditional delete: mounting over a 'complete' row deletes NOTHING.
// ---------------------------------------------------------------------------
describe('R2 (SUPERSEDED BY B1): mounting over a complete row deletes nothing', () => {
  it('no DELETE is issued at mount for a complete draft row', { timeout: 20000 }, async () => {
    mockDraftRow = {
      liturgia_id: 'lit-f4fix3',
      user_id: 'user-f4fix3',
      current_step: 'complete',
      config: { location: 'Jerusalén', customLocation: '', characters: '', style: 'reflexivo', illustrationStyle: 'ghibli', additionalNotes: '' },
      story: { id: 'story-orphan', title: 'Huérfano', characters: [], scenes: [], props: [], metadata: { status: 'ready' } },
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: {},
      updated_at: '2026-05-01T00:00:00Z',
    };

    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeStoryGeneratedStory('story-r2')}
        onStoryCreated={vi.fn()}
      />
    );

    // Recovery is offered for the 'complete' row (B1), and nothing was deleted.
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Recuperar/i })).not.toBeNull(),
      { timeout: 5000 },
    );
    expect(deletedDraftRows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R5 — La otra rama del arreglo del Finding 3. R1 cubre `pendingHasStory ===
// true` (la que preserva el arreglo HIGH). Ésta cubre `false`: sin nada
// pendiente en el debounce, `applyPropsUpdate` NO debe dejar una `story`
// aparcada en el buffer — hacerlo re-subía los mismos base64 y re-persistía el
// cuento entero 2 s después, en cada mutación de prop.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// R5 — NO EXISTE, deliberadamente.
//
// El re-review pidió un test para la otra rama del Finding 3: "con el buffer
// del debounce vacío, la escritura debounceada ya no lleva `story`". Se intentó
// y se descartó, porque la premisa es falsa: `saveDraftToSupabase` persiste
// SIEMPRE la fila completa —incluida la columna `story`— sea cual sea el patch;
// el patch sólo decide qué se fusiona en el snapshot, no qué columnas se
// escriben. Se verificó ejecutándolo: ambas escrituras del escenario llevan
// `story`, con y sin el arreglo. Un test sobre "el upsert no lleva story" sería
// verde por accidente o rojo por accidente, nunca por la razón correcta.
//
// El efecto REAL del Finding 3 —no re-subir los base64 de props ya subidos— sí
// sería observable contando `storage.upload`, pero sólo en un escenario con
// props que traigan base64. Queda como hueco declarado, no como test falso.
// El arreglo se sostiene por construcción (ver `getPendingDraftPatchKeys` en
// applyPropsUpdate) y R1 cubre la rama que preserva el arreglo HIGH.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// R6 — INVARIANTE, no base-red. Declarado explícitamente.
//
// El efecto de montaje llamaba `deleteDraft()` (sin guardas, keyed sólo por
// liturgia_id+user_id) cuando `initialStory` llegaba en 'ready'. Bajo B1 eso es
// un peligro real: `initialStory` sale del elemento EN MEMORIA, que ya está en
// 'ready' apenas se finaliza y ANTES de guardar la liturgia.
//
// PERO: ese `deleteDraft()` estaba MUERTO en la práctica. El efecto tiene deps
// `[]`, así que corre en el montaje, cuando `userId` todavía es null (lo
// resuelve un `getUser` asíncrono), y `deleteDraft` hace `if (!userId) return`.
// Por eso el peligro nunca se materializó — y por eso este test PASA también
// contra el código previo. No discrimina el cambio: se conserva como invariante
// que debe seguir valiendo, no como prueba del arreglo. Quitar la llamada
// elimina una trampa latente (bastaría que el efecto ganara dependencias, o que
// la sesión resolviera de forma síncrona, para que se volviera alcanzable).
// ---------------------------------------------------------------------------
describe('R6 (INVARIANTE) — montar con una historia ya finalizada no borra el borrador', () => {
  it('cero DELETE al montar con initialStory en `ready`', { timeout: 20000 }, async () => {
    const readyStory = {
      ...(makeScenesPendingStory('story-r6') as unknown as Record<string, unknown>),
      metadata: { createdAt: '', updatedAt: '', status: 'ready' },
    } as unknown as Story;

    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={readyStory}
        onStoryCreated={vi.fn()}
      />
    );
    await act(async () => { await yields(30); });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); await yields(20); });

    expect(deletedDraftRows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// R7 — `updateTextOverlay` PERSISTE el overlay y no pisa el resto de la story.
//
// Esta función ha estado mal TRES veces: (a) en fix-2 pasó de updater funcional
// a pisar el objeto story entero con una foto del render; (b) el arreglo del
// Finding 4 capturaba el resultado desde dentro del updater, lo que sólo
// funciona si React lo evalúa de forma ANSIOSA — con otro setState encolado en
// el mismo batch quedaba inerte y el fallback restauraba en silencio el
// comportamiento viejo; (c) ahora fusiona sobre `storyRef.current`.
//
// Ninguna de las dos primeras fue detectada por la suite, porque no había NADA
// que cubriera esta función. Este test cierra ese agujero.
//
// ALCANCE HONESTO: cubre las dos propiedades observables —el overlay se
// persiste, y el resto de la story sobrevive— que son exactamente los dos modos
// en que falló históricamente. NO discrimina el caso ansioso-vs-diferido de
// React: para forzar el updater diferido haría falta encolar otro setState en
// el mismo batch desde fuera del componente, lo que no es alcanzable
// honestamente sin mockear el sujeto.
// ---------------------------------------------------------------------------
describe('R7 — el overlay de texto se persiste sin pisar el resto de la story', () => {
  it('cambiar la posición del overlay de portada llega a la fila y conserva la story', { timeout: 20000 }, async () => {
    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={makeScenesPendingStory('story-r7')}
        onStoryCreated={vi.fn()}
      />
    );

    const approveScenes = await screen.findByRole('button', { name: /Aprobar escenas/i });
    await act(async () => {
      fireEvent.click(approveScenes);
      await yields(25);
    });
    await screen.findByRole('button', { name: /Finalizar cuento/i });
    await act(async () => { await yields(10); });
    upsertCalls.length = 0;

    // Cambiar la posición del overlay de portada a "Arriba" desde la UI real.
    const topPills = screen.getAllByRole('button', { name: /^Arriba$/i });
    expect(topPills.length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(topPills[0]);
      await yields(10);
    });

    // Vencer el debounce de 2 s.
    await act(async () => { await new Promise((r) => setTimeout(r, 2400)); await yields(30); });

    const withOverlay = upsertCalls.filter((c) => {
      const story = storyOf(c.payload);
      const overlay = story?.['coverTextOverlay'] as { position?: string } | undefined;
      return overlay?.position === 'top';
    });
    // (a) El overlay SE PERSISTE — antes de F1 vivía sólo en estado React.
    expect(withOverlay.length).toBeGreaterThan(0);

    // (b) La story persistida sigue completa: el overlay no la pisó con una
    //     foto parcial del render (el modo de fallo de fix-2).
    const persistedStory = storyOf(withOverlay[withOverlay.length - 1].payload)!;
    expect(persistedStory['id']).toBe('story-r7');
    expect(persistedStory['title']).toBe('Cuento a finalizar');
    expect(Array.isArray(persistedStory['scenes'])).toBe(true);
    expect((persistedStory['scenes'] as unknown[]).length).toBeGreaterThan(0);
  });
});
