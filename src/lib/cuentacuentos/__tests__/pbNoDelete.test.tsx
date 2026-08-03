/**
 * PB / T-B.7 — FRONTERA DE NO-BORRADO.
 *
 * Invariante 7: los bytes de cuentacuentos son INDELEBLES desde el frontend.
 * Una liturgia ya guardada puede estar referenciándolos, y el borrado real es
 * un GC aparte, consciente de referencias (ticket separado). PB agrega CERO
 * `storage.remove`, y esta suite lo prueba EJECUTANDO los flujos de producción
 * bajo un espía del borde de Storage — no leyendo el diff.
 *
 * Los cinco flujos exigidos por T-B.7:
 *   1. eliminar el cuento (`handleDeleteStory` → `deleteDraftRecord`);
 *   2. borrar el registro del borrador (`deleteDraftRecord` del hook);
 *   3. purga de props huérfanos (quitar un lugar/objeto ⇒ el guardado
 *      siguiente descarta su contabilidad y CONSERVA los bytes);
 *   4. regeneración / reset (`handleRegenerate` y "Empezar de nuevo");
 *   5. re-finalización.
 *
 * Cada flujo lleva además una MUTACIÓN DE REMOCIÓN PLANTADA (D7): se inserta
 * un `storage.remove` en ese flujo de producción y su test debe fallar. Sin
 * eso, "cero remociones" sería indistinguible de "el flujo no corrió".
 *
 * FUERA DE ALCANCE, y NO mal clasificado: la remoción PREEXISTENTE del PDF de
 * reflexión (`liturgyService` :555, bucket `liturgy-published`) cuando el
 * usuario elimina el PDF. El helper `cuentacuentosRemovals()` la excluye por
 * BUCKET, no por heurística de nombre, y el último caso de esta suite la
 * ejerce explícitamente para dejar constancia de que existe y de por qué no
 * cuenta.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  renderHook,
  render,
  screen,
  waitFor,
  act,
  fireEvent,
  cleanup,
} from '@testing-library/react';
import type { Story } from '@/types/shared/story';
import type { LiturgyContext } from '@/types/shared/liturgy';

import { PNG_A_B64, PNG_B_B64, EXISTING_DRAFTS_URL } from './pbImageFixtures';

vi.mock('@/integrations/supabase/client', async () => {
  const { makeSupabaseMock } = await import('./pbBoundary');
  return { supabase: makeSupabaseMock() };
});
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

import {
  ctl,
  removals,
  cuentacuentosRemovals,
  upsertsTo,
  resetBoundary,
} from './pbBoundary';

// Producción — importada DESPUÉS de los mocks de borde.
import { useCuentacuentosDraft } from '@/hooks/useCuentacuentosDraft';
import CuentacuentoEditor from '@/components/liturgia-builder/editors/CuentacuentoEditor';

// ---------------------------------------------------------------------------

const USER_ID = 'user-pb';
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

function storyWith(status: string, overrides: Partial<Story> = {}): Story {
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
        description: 'd',
        visualDescription: 'v',
        characterSheetUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['characters'][number],
    ],
    scenes: [
      {
        number: 1,
        text: 'Escena 1',
        visualDescription: 'plaza',
        selectedImageUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['scenes'][number],
    ],
    props: [],
    spiritualConnection: 'Esperanza',
    metadata: { createdAt: '', updatedAt: '', status } as Story['metadata'],
    ...overrides,
  } as Story;
}

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

/** Estado de `image_paths` con objetos de cuentacuentos ya persistidos. */
const EXISTING_PATHS = {
  characterSheetPaths: { char1: ['user-pb/lit-pb/characters/char1_0.png'] },
  sceneImagePaths: { 1: ['user-pb/lit-pb/scenes/scene1_0.png'] },
  coverPaths: ['user-pb/lit-pb/cover/cover_0.png'],
  endPaths: ['user-pb/lit-pb/end/end_0.png'],
  propImagePaths: { prop1: ['user-pb/lit-pb/props/prop1_0.png'] },
};

beforeEach(() => {
  resetBoundary();
  ctl.draftRow = null;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Flujo 1 — eliminar el cuento desde el editor
// ---------------------------------------------------------------------------

describe('PB T-B.7 (1) — eliminar el cuento borra la FILA, jamás bytes', () => {
  it('confirmar "Eliminar" no emite ni una remoción de cuentacuentos', async () => {
    ctl.existingImagePaths = { ...EXISTING_PATHS };
    const onStoryDeleted = vi.fn();

    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={storyWith('characters-pending')}
        onStoryCreated={vi.fn()}
        onStoryDeleted={onStoryDeleted}
      />
    );

    const trigger = await waitFor(
      () => screen.getByRole('button', { name: /^Eliminar$/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(trigger);
      await yields(10);
    });

    const confirm = await waitFor(
      () => screen.getByRole('button', { name: /Sí, eliminar/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(confirm);
      await yields(30);
    });

    // El flujo CORRIÓ: el padre fue notificado.
    await waitFor(() => expect(onStoryDeleted).toHaveBeenCalled(), { timeout: 10000 });
    // Y no se tocó ni un byte.
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 90_000);
});

// ---------------------------------------------------------------------------
// Flujo 2 — borrar el registro del borrador (hook)
// ---------------------------------------------------------------------------

describe('PB T-B.7 (2) — `deleteDraftRecord` borra sólo la fila', () => {
  it('con paths persistidos en la fila, el borrado no emite remociones', async () => {
    ctl.draftRow = {
      liturgia_id: LITURGY_ID,
      user_id: USER_ID,
      current_step: 'scenes',
      config: {},
      story: storyWith('characters-approved'),
      image_paths: { ...EXISTING_PATHS },
      updated_at: '2026-05-01T00:00:00.000Z',
    };

    const { result } = renderHook(() => useCuentacuentosDraft({ liturgyId: LITURGY_ID }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok = false;
    await act(async () => {
      ok = await result.current.deleteDraftRecord();
      await yields(10);
    });

    expect(ok, 'el borrado del registro debió ejecutarse').toBe(true);
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Flujo 3 — purga de props huérfanos
// ---------------------------------------------------------------------------

describe('PB T-B.7 (3) — la purga de props descarta CONTABILIDAD, no bytes', () => {
  it('quitar un lugar/objeto saca su clave de `propImagePaths` y conserva el objeto', async () => {
    ctl.existingImagePaths = { ...EXISTING_PATHS };

    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={storyWith('characters-pending', {
          props: [
            {
              id: 'prop1',
              kind: 'place',
              name: 'Pozo',
              narrativeRole: 'lugar',
              visualDescription: 'pozo de piedra',
              referenceImages: [EXISTING_DRAFTS_URL],
              role: 'secondary',
            },
          ] as unknown as Story['props'],
        })}
        onStoryCreated={vi.fn()}
      />
    );

    const remove = await waitFor(
      () => screen.getByRole('button', { name: /Quitar este lugar\/objeto/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(remove);
      await yields(40);
    });

    // El flujo CORRIÓ: hubo un guardado del borrador que ya no contabiliza el
    // prop retirado.
    await waitFor(
      () => {
        const last = upsertsTo('cuentacuentos_drafts').at(-1);
        expect(last, 'la purga debió disparar un guardado').toBeDefined();
        const paths = (last!.payload as { image_paths: Record<string, unknown> }).image_paths;
        expect(paths.propImagePaths).toEqual({});
      },
      { timeout: 10000 }
    );

    // Y los bytes del prop siguen ahí.
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 90_000);

  it('el bloque A4a de huérfanos, cuando SÍ se alcanza, tampoco borra bytes', async () => {
    // FINDING PB-F8 (PREEXISTENTE) — el flujo real de "quitar prop" NO llega al
    // bloque `orphanedPropStoragePaths` de `saveDraftToSupabase` (:1073): al
    // tocar props, el merge RECONSTRUYE `propImagePaths` desde la categoría, así
    // que la clave del prop retirado ya no existe cuando corre la purga. El
    // resultado de cara al usuario es el correcto (contabilidad descartada,
    // bytes conservados), pero el bloque sólo se alcanza cuando
    // `propReferenceImages` trae una clave que `story.props` ya no tiene.
    //
    // Ese camino se ejerce acá EXPLÍCITAMENTE para que la invariante quede
    // cubierta donde vive el `console.log` de A4a, y no sólo donde el flujo
    // habitual pasa.
    resetBoundary();
    const { result } = renderHook(() => useCuentacuentosDraft({ liturgyId: LITURGY_ID }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.enqueueDraftWrite({
        // `propReferenceImages` con prop1, y NINGÚN `story` que lo respalde:
        // el prop queda huérfano y el bloque A4a corre con paths reales.
        propReferenceImages: { prop1: [EXISTING_DRAFTS_URL] },
      });
      await yields(10);
    });

    const last = upsertsTo('cuentacuentos_drafts').at(-1);
    expect(last, 'la escritura debió persistir').toBeDefined();
    const paths = (last!.payload as { image_paths: Record<string, unknown> }).image_paths;
    // La contabilidad del huérfano se descartó…
    expect(paths.propImagePaths).toEqual({});
    // …y sus bytes NO.
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Flujo 4 — regeneración / reset
// ---------------------------------------------------------------------------

describe('PB T-B.7 (4) — regenerar y "Empezar de nuevo" no borran bytes', () => {
  it('"Regenerar" descarta el lote en curso sin tocar Storage', async () => {
    ctl.existingImagePaths = { ...EXISTING_PATHS };

    render(
      <CuentacuentoEditor
        context={baseContext}
        initialStory={storyWith('story-generated')}
        onStoryCreated={vi.fn()}
      />
    );

    const regenerate = await waitFor(
      () => screen.getByRole('button', { name: /Regenerar/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(regenerate);
      await yields(30);
    });

    // El flujo CORRIÓ: el reset devolvió el editor al paso de configuración.
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Regenerar/i })).toBeNull(),
      { timeout: 10000 }
    );
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 90_000);

  it('"Empezar de nuevo" descarta el borrador recuperable sin tocar Storage', async () => {
    ctl.draftRow = {
      liturgia_id: LITURGY_ID,
      user_id: USER_ID,
      current_step: 'scenes',
      config: {
        location: 'Jerusalén', customLocation: '', characters: 'María',
        style: 'reflexivo', illustrationStyle: 'ghibli', additionalNotes: '',
      },
      story: storyWith('characters-approved'),
      selected_character_sheets: {},
      selected_scene_images: {},
      selected_cover: null,
      selected_end: null,
      image_paths: { ...EXISTING_PATHS },
      updated_at: '2026-05-01T00:00:00.000Z',
    };

    render(<CuentacuentoEditor context={baseContext} onStoryCreated={vi.fn()} />);

    const discard = await waitFor(
      () => screen.getByRole('button', { name: /Empezar de nuevo/i }),
      { timeout: 10000 }
    );
    await act(async () => {
      fireEvent.click(discard);
      await yields(30);
    });

    // El flujo CORRIÓ: el prompt de recuperación desapareció.
    await waitFor(
      () => expect(screen.queryByRole('button', { name: /Empezar de nuevo/i })).toBeNull(),
      { timeout: 10000 }
    );
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 90_000);
});

// ---------------------------------------------------------------------------
// Flujo 5 — re-finalización
// ---------------------------------------------------------------------------

describe('PB T-B.7 (5) — re-finalizar con bytes nuevos deja el objeto viejo en paz', () => {
  it('dos finalizaciones seguidas de la misma historia: cero remociones', async () => {
    async function finalize(coverBytes: string) {
      const onStoryCreated = vi.fn();
      const view = render(
        <CuentacuentoEditor
          context={baseContext}
          initialStory={storyWith('scenes-pending', {
            coverImageUrl: coverBytes,
            endImageUrl: EXISTING_DRAFTS_URL,
          })}
          onStoryCreated={onStoryCreated}
        />
      );
      const approve = await waitFor(
        () => screen.getByRole('button', { name: /Aprobar escenas/i }),
        { timeout: 10000 }
      );
      await act(async () => { fireEvent.click(approve); await yields(25); });
      const finalizeBtn = await waitFor(
        () => screen.getByRole('button', { name: /Finalizar cuento/i }),
        { timeout: 10000 }
      );
      await act(async () => { fireEvent.click(finalizeBtn); await yields(30); });
      await waitFor(() => expect(onStoryCreated).toHaveBeenCalledTimes(1), { timeout: 10000 });
      return view;
    }

    const first = await finalize(PNG_A_B64);
    first.unmount();
    cleanup();
    await act(async () => { await yields(5); });
    await finalize(PNG_B_B64);

    // El flujo CORRIÓ dos veces y escribió dos objetos distintos.
    expect(upsertsTo('cuentacuentos_drafts').length).toBeGreaterThan(1);
    // El objeto de la primera finalización queda como huérfano PERMITIDO.
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 120_000);
});

// ---------------------------------------------------------------------------
// La remoción PREEXISTENTE que NO cuenta
// ---------------------------------------------------------------------------

describe('PB T-B.7 — la remoción del PDF de reflexión está fuera de alcance', () => {
  it('vive en `liturgy-published`, no en un bucket de cuentacuentos', async () => {
    // Se ejerce el camino real (`reflexionPdfUrl === null` ⇒ el usuario borró
    // el PDF) para dejar constancia de que la remoción EXISTE, y de que el
    // criterio la excluye por BUCKET y no por una heurística de nombre que
    // podría clasificarla mal en cualquier sentido.
    vi.doMock('@/lib/publishedResourcesService', () => ({
      unpublishReflexionForLiturgy: vi.fn().mockResolvedValue(undefined),
    }));
    const { saveLiturgy } = await import('@/lib/liturgia/liturgyService');

    await saveLiturgy({
      id: LITURGY_ID,
      context: { ...baseContext, reflexionPdfUrl: null },
      status: 'draft',
      metadata: { createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
      elements: [],
    } as never);

    const pdfRemovals = removals.filter((r) => r.bucket === 'liturgy-published');
    expect(pdfRemovals).toHaveLength(1);
    expect(pdfRemovals[0].paths).toEqual([`liturgias/${LITURGY_ID}/reflexion.pdf`]);
    // Y sigue sin haber remociones de cuentacuentos.
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 60_000);
});
