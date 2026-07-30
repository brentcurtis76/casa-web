/**
 * PB — suites DEDICADAS de los criterios T-B.1, T-B.5, T-B.6, T-B.12 y T-B.13.
 *
 * El corpus G6 (`pbBaseCapture`) compara el comportamiento COMPLETO contra el
 * fixture base y declara sus divergencias caso a caso. Esto es otra cosa: cada
 * criterio tiene acá sus PROPIAS aserciones nombradas, para que un reviewer
 * pueda leer "T-B.6" y encontrar exactamente qué se afirma y con qué evidencia.
 * Donde la afirmación es NUEVA, es base-red en 185c370; donde fija un
 * comportamiento que la base YA tenía bien, la evidencia es una mutación
 * nombrada (D7). El reporte lista cuál corresponde a cada caso.
 *
 * Sólo se mockean bordes externos (`pbBoundary`): el hook, el editor y
 * `liturgyService` son los de producción.
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
import { createHash } from 'node:crypto';
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
  PNG_A_DATA_URL,
  EXISTING_DRAFTS_URL,
} from './pbImageFixtures';

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
  uploads,
  draftUploads,
  finalUploads,
  upsertsTo,
  cuentacuentosRemovals,
  resetBoundary,
} from './pbBoundary';

// Producción — importada DESPUÉS de los mocks de borde.
import {
  useCuentacuentosDraft,
  type DraftPatch,
  type CuentacuentosDraftFull,
} from '@/hooks/useCuentacuentosDraft';
import CuentacuentoEditor from '@/components/liturgia-builder/editors/CuentacuentoEditor';
import { saveLiturgy } from '@/lib/liturgia/liturgyService';

// ---------------------------------------------------------------------------

const USER_ID = 'user-pb';
const LITURGY_ID = 'lit-pb';
const DRAFTS_BUCKET = 'cuentacuentos-drafts';

/** SHA-256 de los bytes decodificados — independiente de producción. */
function hash32(base64: string): string {
  return createHash('sha256').update(Buffer.from(base64, 'base64')).digest('hex').slice(0, 32);
}

/** Path de borrador esperado para un slot. */
function draftPath(category: string, key: string, bytes: string, ext = 'png'): string {
  return `${USER_ID}/${LITURGY_ID}/${category}/${key}_${hash32(bytes)}.${ext}`;
}

/** El path que la URL existente ya ocupa en Storage. */
const EXISTING_PATH = `${USER_ID}/${LITURGY_ID}/characters/char1_0.png`;

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
      { number: 1, text: 'Escena 1', visualDescription: 'plaza' } as unknown as Story['scenes'][number],
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

interface WriteOutcome {
  rejected: boolean;
  error: string | null;
  committed: CuentacuentosDraftFull | null;
  stale: boolean;
}

/** Ejerce UNA escritura del hook de producción y devuelve su resultado. */
async function write(patch: DraftPatch): Promise<WriteOutcome> {
  const result = await mountHook();
  let rejected = false;
  let error: string | null = null;
  let value: unknown = null;
  await act(async () => {
    try {
      value = await result.current.enqueueDraftWrite(patch);
    } catch (err) {
      rejected = true;
      error = err instanceof Error ? err.message : String(err);
    }
  });
  const res = value as
    | { stale?: boolean; committed?: CuentacuentosDraftFull }
    | null;
  return {
    rejected,
    error,
    committed: res?.committed ?? null,
    stale: res?.stale ?? false,
  };
}

/** `image_paths` del último upsert de borrador emitido. */
function lastImagePaths(): Record<string, unknown> | undefined {
  const last = upsertsTo('cuentacuentos_drafts').at(-1);
  return (last?.payload as { image_paths?: Record<string, unknown> } | undefined)?.image_paths;
}

async function yields(n: number) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

beforeEach(() => {
  resetBoundary();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response));
  vi.useRealTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ===========================================================================
// T-B.1 — preservación de grupos mixtos
// ===========================================================================

describe('PB T-B.1 — un grupo mixto conserva orden, largo y la referencia ya persistida', () => {
  it('[base64A, urlExistente, base64B] ⇒ [hashA, pathExistente, hashB] en ese orden', async () => {
    const group = [PNG_A_B64, EXISTING_DRAFTS_URL, PNG_B_B64];
    const out = await write({ characterSheetOptions: { char1: group } });

    expect(out.rejected).toBe(false);

    // ORDEN y LARGO exactos: la posición 1 sigue siendo la referencia vieja.
    const persisted = (lastImagePaths()?.characterSheetPaths as Record<string, string[]>).char1;
    expect(persisted).toEqual([
      draftPath('characters', 'char1', PNG_A_B64),
      EXISTING_PATH,
      draftPath('characters', 'char1', PNG_B_B64),
    ]);

    // La URL NO se subió: sólo dos objetos nuevos, y ninguna escritura apunta
    // al objeto que la URL ya ocupa.
    expect(draftUploads()).toHaveLength(2);
    expect(draftUploads().map((u) => u.path)).not.toContain(EXISTING_PATH);

    // Todo path de borrador conserva `userId` como segmento 1 (RLS own-folder).
    for (const u of draftUploads()) {
      expect(u.bucket).toBe(DRAFTS_BUCKET);
      expect(u.path.split('/')[0]).toBe(USER_ID);
      expect(u.upsert).toBe(false);
    }
  }, 60_000);

  it('el mismo contrato vale para un grupo de escenas y para uno de props', async () => {
    // `story` va en el patch porque la purga de huérfanos de A4 (preexistente)
    // descarta toda clave de `propImagePaths` que no corresponda a un prop
    // vivo: sin el prop en el story, la contabilidad se limpia y el caso no
    // mediría lo que T-B.1 pide.
    const out = await write({
      sceneImageOptions: { 1: [EXISTING_DRAFTS_URL, PNG_C_B64] },
      propReferenceImages: { prop1: [PNG_D_B64, EXISTING_DRAFTS_URL] },
      story: storyWith({
        props: [{ id: 'prop1', name: 'Lámpara', referenceImages: [] }] as unknown as Story['props'],
      }),
    });
    expect(out.rejected).toBe(false);

    const paths = lastImagePaths()!;
    expect((paths.sceneImagePaths as Record<string, string[]>)['1']).toEqual([
      EXISTING_PATH,
      draftPath('scenes', 'scene1', PNG_C_B64),
    ]);
    expect((paths.propImagePaths as Record<string, string[]>).prop1).toEqual([
      draftPath('props', 'prop1', PNG_D_B64),
      EXISTING_PATH,
    ]);
    expect(draftUploads().map((u) => u.path)).not.toContain(EXISTING_PATH);
  }, 60_000);
});

// ===========================================================================
// T-B.5 — vacío explícito vs ausencia, y recarga
// ===========================================================================

/** Las cinco categorías de colección, con su patch vacío y su clave persistida. */
const COLLECTION_CATEGORIES: Array<{
  name: string;
  filled: DraftPatch;
  empty: DraftPatch;
  key: string;
  emptyValue: unknown;
}> = [
  {
    name: 'characterSheetOptions',
    filled: { characterSheetOptions: { char1: [PNG_A_B64] } },
    empty: { characterSheetOptions: {} },
    key: 'characterSheetPaths',
    emptyValue: {},
  },
  {
    name: 'sceneImageOptions',
    filled: { sceneImageOptions: { 1: [PNG_B_B64] } },
    empty: { sceneImageOptions: {} },
    key: 'sceneImagePaths',
    emptyValue: {},
  },
  {
    name: 'coverOptions',
    filled: { coverOptions: [PNG_C_B64] },
    empty: { coverOptions: [] },
    key: 'coverPaths',
    emptyValue: [],
  },
  {
    name: 'endOptions',
    filled: { endOptions: [PNG_D_B64] },
    empty: { endOptions: [] },
    key: 'endPaths',
    emptyValue: [],
  },
  {
    name: 'propReferenceImages',
    filled: { propReferenceImages: { prop1: [PNG_E_B64] } },
    empty: { propReferenceImages: {} },
    key: 'propImagePaths',
    emptyValue: {},
  },
];

describe('PB T-B.5 — vacío explícito limpia, ausencia preserva, y la recarga no resucita', () => {
  const existing = {
    characterSheetPaths: { char1: ['user-pb/lit-pb/characters/char1_0.png'] },
    sceneImagePaths: { 1: ['user-pb/lit-pb/scenes/scene1_0.png'] },
    coverPaths: ['user-pb/lit-pb/cover/cover_0.png'],
    endPaths: ['user-pb/lit-pb/end/end_0.png'],
    propImagePaths: { prop1: ['user-pb/lit-pb/props/prop1_0.png'] },
  };

  for (const cat of COLLECTION_CATEGORIES) {
    it(`${cat.name}: presente-y-vacío limpia con CERO subidas; ausente preserva`, async () => {
      // (a) Clave PRESENTE con valor vacío ⇒ escribe el vacío que corresponde.
      resetBoundary();
      ctl.existingImagePaths = { ...existing };
      const emptied = await write(cat.empty);
      expect(emptied.rejected).toBe(false);
      expect(lastImagePaths()![cat.key]).toEqual(cat.emptyValue);
      expect(draftUploads()).toHaveLength(0);

      // Las OTRAS categorías, ausentes del patch, conservan lo que había.
      for (const other of COLLECTION_CATEGORIES) {
        if (other.key === cat.key) continue;
        expect(
          lastImagePaths()![other.key],
          `${cat.name} vacío no debe tocar ${other.key}`
        ).toEqual(existing[other.key as keyof typeof existing]);
      }

      // (b) Clave AUSENTE ⇒ preserva incluso la propia categoría.
      resetBoundary();
      ctl.existingImagePaths = { ...existing };
      const untouched = await write({ currentStep: 'scenes' });
      expect(untouched.rejected).toBe(false);
      expect(lastImagePaths()![cat.key]).toEqual(
        existing[cat.key as keyof typeof existing]
      );
      expect(draftUploads()).toHaveLength(0);
    }, 60_000);
  }

  it('tras el clear explícito, la recarga NO resucita las entradas viejas', async () => {
    // El insumo de la recarga NO se escribe a mano: es EXACTAMENTE lo que la
    // escritura de producción persistió al limpiar la portada. Así el caso
    // prueba el round trip clear → recarga, y no la aritmética del test.
    resetBoundary();
    ctl.existingImagePaths = { ...existing };
    const cleared = await write({ coverOptions: [] });
    expect(cleared.rejected).toBe(false);
    const persistedPaths = lastImagePaths()!;

    resetBoundary();
    ctl.draftRow = {
      liturgia_id: LITURGY_ID,
      user_id: USER_ID,
      current_step: 'cover',
      config: {},
      story: storyWith(),
      image_paths: persistedPaths,
      updated_at: '2026-05-01T00:00:00.000Z',
    };
    const result = await mountHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    const d = loaded as CuentacuentosDraftFull | null;
    expect(d?.coverOptions).toEqual([]);
    // Y lo que NO se limpió sigue ahí: el clear es por categoría, no global.
    expect(d?.endOptions?.length).toBe(1);
  }, 60_000);

  it('un valor vacío se distingue de la ausencia por PRESENCIA DE CLAVE, no por truthiness', async () => {
    // `coverOptions: []` es falsy-en-length y `{}` es truthy: si la decisión se
    // tomara por truthiness o por `length`, estos dos casos se confundirían.
    resetBoundary();
    ctl.existingImagePaths = { ...existing };
    await write({ coverOptions: [] });
    const afterExplicitEmpty = lastImagePaths()!.coverPaths;

    resetBoundary();
    ctl.existingImagePaths = { ...existing };
    await write({ endOptions: [] });
    const afterAbsent = lastImagePaths()!.coverPaths;

    expect(afterExplicitEmpty).toEqual([]);
    expect(afterAbsent).toEqual(existing.coverPaths);
  }, 60_000);
});

// ===========================================================================
// T-B.6 — reselección / regeneración
// ===========================================================================

describe('PB T-B.6 — bytes cambiados ⇒ path nuevo; el objeto viejo ni se re-sube ni se borra', () => {
  const SITES: Array<{
    label: string;
    category: string;
    key: string;
    patch: (bytes: string) => DraftPatch;
    read: (paths: Record<string, unknown>) => string[];
  }> = [
    {
      label: 'personaje',
      category: 'characters',
      key: 'char1',
      patch: (b) => ({ characterSheetOptions: { char1: [b] } }),
      read: (p) => (p.characterSheetPaths as Record<string, string[]>).char1,
    },
    {
      label: 'escena',
      category: 'scenes',
      key: 'scene1',
      patch: (b) => ({ sceneImageOptions: { 1: [b] } }),
      read: (p) => (p.sceneImagePaths as Record<string, string[]>)['1'],
    },
    {
      label: 'portada',
      category: 'cover',
      key: 'cover',
      patch: (b) => ({ coverOptions: [b] }),
      read: (p) => p.coverPaths as string[],
    },
    {
      label: 'fin',
      category: 'end',
      key: 'end',
      patch: (b) => ({ endOptions: [b] }),
      read: (p) => p.endPaths as string[],
    },
  ];

  for (const site of SITES) {
    it(`${site.label}: la regeneración apunta SÓLO al path nuevo`, async () => {
      // Primera selección.
      resetBoundary();
      await write(site.patch(PNG_A_B64));
      const oldPath = draftPath(site.category, site.key, PNG_A_B64);
      expect(site.read(lastImagePaths()!)).toEqual([oldPath]);

      // Regeneración: bytes distintos.
      resetBoundary();
      ctl.existingImagePaths = { [pathsKeyOf(site.label)]: undefined } as Record<string, unknown>;
      await write(site.patch(PNG_B_B64));
      const newPath = draftPath(site.category, site.key, PNG_B_B64);

      expect(newPath).not.toBe(oldPath);
      // Se escribió el path NUEVO y sólo ése.
      expect(draftUploads().map((u) => u.path)).toEqual([newPath]);
      // La referencia persistida es la nueva.
      expect(site.read(lastImagePaths()!)).toEqual([newPath]);
      // El objeto viejo no se re-subió ni se borró: PB no compensa.
      expect(draftUploads().map((u) => u.path)).not.toContain(oldPath);
      expect(cuentacuentosRemovals()).toEqual([]);
    }, 60_000);
  }

  it('los mismos bytes bajo prefijos data-URL distintos producen el MISMO path', async () => {
    resetBoundary();
    await write({ coverOptions: [PNG_A_B64] });
    const fromRaw = draftUploads().map((u) => u.path);

    resetBoundary();
    await write({ coverOptions: [PNG_A_DATA_URL] });
    const fromDataUrl = draftUploads().map((u) => u.path);

    // Se afirma el path CONCRETO, no sólo la igualdad entre ambos: en 185c370
    // los dos escribían `cover_0.png`, así que "son iguales" era cierto por la
    // razón equivocada y no probaba nada.
    expect(fromRaw).toEqual([draftPath('cover', 'cover', PNG_A_B64)]);
    expect(fromDataUrl).toEqual(fromRaw);
  }, 60_000);
});

/** Nombre de la clave de `image_paths` que corresponde a un sitio. */
function pathsKeyOf(label: string): string {
  switch (label) {
    case 'personaje': return 'characterSheetPaths';
    case 'escena': return 'sceneImagePaths';
    case 'portada': return 'coverPaths';
    default: return 'endPaths';
  }
}

// ===========================================================================
// T-B.12 — matriz completa de fallos
// ===========================================================================

/** Las nueve categorías del hook, con un grupo de tres cuando aplica. */
const TRIO = [PNG_A_B64, JPEG_B64, PNG_B_B64];
const JPEG_SIZE = 160; // selector estable del fallo intermedio (bytes del JPEG)

const HOOK_CATEGORIES: Array<{
  name: string;
  patch: DraftPatch;
  key: string | null;
  scalar?: boolean;
}> = [
  { name: 'characterSheets', patch: { characterSheetOptions: { char1: TRIO } }, key: 'characterSheetPaths' },
  { name: 'sceneImages', patch: { sceneImageOptions: { 1: TRIO } }, key: 'sceneImagePaths' },
  { name: 'cover', patch: { coverOptions: TRIO }, key: 'coverPaths' },
  { name: 'end', patch: { endOptions: TRIO }, key: 'endPaths' },
  {
    name: 'propsFromStory',
    patch: {
      story: storyWith({
        props: [{ id: 'prop1', name: 'Lámpara', referenceImages: TRIO }] as unknown as Story['props'],
      }),
    },
    key: 'propImagePaths',
  },
  { name: 'propsFromPropRefs', patch: { propReferenceImages: { prop1: TRIO } }, key: 'propImagePaths' },
  { name: 'sceneReferences', patch: { sceneReferenceImages: { 1: PNG_A_B64 } }, key: 'sceneReferencePaths', scalar: true },
  { name: 'coverReference', patch: { coverReferenceImage: PNG_A_B64 }, key: 'coverReferencePath', scalar: true },
  { name: 'endReference', patch: { endReferenceImage: PNG_A_B64 }, key: 'endReferencePath', scalar: true },
];

describe('PB T-B.12 — matriz de fallos: ninguna categoría se persiste acortada ni vacía', () => {
  for (const cat of HOOK_CATEGORIES) {
    it(`${cat.name}: un fallo de Storage ABORTA la escritura lógica antes del upsert`, async () => {
      resetBoundary();
      ctl.failAllUploads = true;
      const out = await write(cat.patch);

      // Fail-closed: la promesa RECHAZA. Nada de "éxito con la foto perdida".
      expect(out.rejected, `${cat.name} debió rechazar`).toBe(true);
      expect(out.committed).toBeNull();
      // Y no hubo upsert del borrador: la base no se tocó.
      expect(upsertsTo('cuentacuentos_drafts')).toEqual([]);
      // Sin swap de React.
      expect(out.stale).toBe(false);
    }, 60_000);

    if (!cat.scalar) {
      it(`${cat.name}: un fallo INTERMEDIO no persiste el grupo acortado`, async () => {
        resetBoundary();
        ctl.failUploadWhenSize = JPEG_SIZE; // falla el 2.º de los tres
        const out = await write(cat.patch);

        expect(out.rejected, `${cat.name} debió rechazar por el fallo intermedio`).toBe(true);
        expect(upsertsTo('cuentacuentos_drafts')).toEqual([]);

        // Los objetos HERMANOS que sí se crearon quedan como huérfanos
        // PERMITIDOS: PB nunca compensa con borrados.
        expect(draftUploads().length).toBeGreaterThan(0);
        expect(cuentacuentosRemovals()).toEqual([]);
      }, 60_000);
    }

    it(`${cat.name}: bytes no soportados (GIF) rechazan, jamás caen a PNG`, async () => {
      resetBoundary();
      const unsupported = JSON.parse(JSON.stringify(cat.patch)) as DraftPatch;
      // Sustituye TODO valor de imagen del patch por el GIF.
      replaceImageValues(unsupported, GIF_B64);
      const out = await write(unsupported);

      expect(out.rejected, `${cat.name} debió rechazar el GIF`).toBe(true);
      expect(upsertsTo('cuentacuentos_drafts')).toEqual([]);
      // Y ninguna subida se etiquetó como PNG "por defecto".
      expect(uploads).toEqual([]);
    }, 60_000);
  }

  it('una categoría posterior NO se persiste en silencio cuando otra falló', async () => {
    resetBoundary();
    // La portada falla; el fin es sano. Sin fail-closed, el fin se habría
    // persistido y la portada habría quedado vacía con éxito reportado.
    ctl.failUploadWhenPathIncludes = '/cover/';
    const out = await write({ coverOptions: [PNG_A_B64], endOptions: [PNG_B_B64] });

    expect(out.rejected).toBe(true);
    expect(upsertsTo('cuentacuentos_drafts')).toEqual([]);
    // El objeto del fin llegó a crearse (hermano) y se deja en paz.
    expect(draftUploads().map((u) => u.path)).toContain(draftPath('end', 'end', PNG_B_B64));
    expect(cuentacuentosRemovals()).toEqual([]);
  }, 60_000);

  it('un conflicto de duplicado (409) es ÉXITO idempotente; un no-409 con el MISMO mensaje no lo es', async () => {
    resetBoundary();
    ctl.duplicateWhenPathIncludes = '/cover/';
    const dup = await write({ coverOptions: [PNG_A_B64] });
    expect(dup.rejected).toBe(false);
    expect((lastImagePaths()!.coverPaths as string[])).toEqual([
      draftPath('cover', 'cover', PNG_A_B64),
    ]);

    resetBoundary();
    // Mismo texto ("The resource already exists"), statusCode 500: un
    // clasificador por MENSAJE lo aceptaría; el estructural debe rechazar.
    ctl.duplicateLikeMessageWhenSize = 70;
    const fake = await write({ coverOptions: [PNG_A_B64] });
    expect(fake.rejected).toBe(true);
    expect(upsertsTo('cuentacuentos_drafts')).toEqual([]);
  }, 60_000);

  describe('los cuatro callbacks manuales del editor', () => {
    const MANUAL_SITES = ['character', 'scene', 'cover', 'end'] as const;

    for (const site of MANUAL_SITES) {
      it(`${site}: un fallo de subida NO colapsa las opciones ni celebra éxito`, async () => {
        resetBoundary();
        ctl.draftRow = null;
        // Para personaje/escena el fallo se inyecta desde el arranque. Para
        // portada/fin, la transición "Aprobar escenas" es una escritura
        // AUTORITATIVA que con fallo global no commitearía (fail-closed), así
        // que el fallo se inyecta DESPUÉS de aprobar, justo antes del click
        // que este caso mide.
        const failFromStart = site === 'character' || site === 'scene';
        if (failFromStart) ctl.failAllUploads = true;

        const bytes = { character: PNG_A_B64, scene: PNG_B_B64, cover: PNG_C_B64, end: PNG_D_B64 }[site];
        render(
          <CuentacuentoEditor
            context={baseContext}
            initialStory={manualSiteStory(site, bytes)}
            onStoryCreated={vi.fn()}
          />
        );

        if (site === 'cover' || site === 'end') {
          const approve = await waitFor(
            () => screen.getByRole('button', { name: /Aprobar escenas/i }),
            { timeout: 10000 }
          );
          await act(async () => { fireEvent.click(approve); });
          await waitFor(
            () => expect(screen.queryByRole('button', { name: /Aprobar escenas/i })).toBeNull(),
            { timeout: 10000 }
          );
          ctl.failAllUploads = true;
        }

        const saveButtons = await waitFor(
          () => {
            const found = screen.queryAllByRole('button', { name: /Guardar selección/i });
            if (found.length === 0) throw new Error('sin control de guardado');
            return found;
          },
          { timeout: 10000 }
        );
        const index = site === 'end' ? saveButtons.length - 1 : 0;
        await act(async () => { fireEvent.click(saveButtons[index]); });

        // Mensaje de error visible: la superficie de fallo del usuario se
        // conserva (G4 no la cambia).
        await waitFor(() => expect(screen.queryByText(/Error al guardar/i)).not.toBeNull(), {
          timeout: 10000,
        });
        // Y NUNCA el mensaje de éxito.
        expect(screen.queryByText(/guardada exitosamente/i)).toBeNull();
        expect(cuentacuentosRemovals()).toEqual([]);
      }, 90_000);
    }
  });

  describe('las cuatro categorías de finalización', () => {
    for (const failing of ['characters', 'scenes', 'cover', 'end'] as const) {
      it(`${failing}: un fallo no-409 aborta el guardado ANTES del upsert de elementos`, async () => {
        resetBoundary();
        ctl.failUploadWhenPathIncludes = `/cuentacuentos/${failing}/`;

        const story = storyWith({
          characters: [
            {
              id: 'char1', name: 'María', role: 'protagonist', description: 'd',
              visualDescription: 'v', characterSheetUrl: PNG_A_B64,
            } as unknown as Story['characters'][number],
          ],
          scenes: [
            {
              number: 1, text: 'Escena 1', visualDescription: 'plaza',
              selectedImageUrl: PNG_B_B64,
            } as unknown as Story['scenes'][number],
          ],
          coverImageUrl: PNG_C_B64,
          endImageUrl: PNG_D_B64,
        });

        const result = await saveLiturgy({
          id: LITURGY_ID,
          context: baseContext,
          status: 'draft',
          metadata: { createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z' },
          elements: [
            {
              id: 'el-1', type: 'cuentacuentos', order: 0, title: 'Cuento',
              status: 'pending', config: { storyData: story },
            },
          ],
        } as never);

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No se pudieron guardar las imágenes del cuento/);
        expect(upsertsTo('liturgia_elementos')).toEqual([]);
        // Los hermanos ya subidos quedan como huérfanos permitidos.
        expect(cuentacuentosRemovals()).toEqual([]);
        expect(finalUploads().every((u) => u.upsert === false)).toBe(true);
      }, 90_000);
    }
  });
});

/** Historia mínima para llegar al control de guardado de cada sitio manual. */
function manualSiteStory(site: 'character' | 'scene' | 'cover' | 'end', bytes: string): Story {
  const withStatus = (status: string, extra: Partial<Story>) =>
    storyWith({ ...extra, metadata: { createdAt: '', updatedAt: '', status } as Story['metadata'] });

  if (site === 'character') {
    return withStatus('characters-pending', {
      characters: [
        {
          id: 'char1', name: 'María', role: 'protagonist', description: 'd',
          visualDescription: 'v', characterSheetUrl: bytes,
        } as unknown as Story['characters'][number],
      ],
    });
  }
  if (site === 'scene') {
    return withStatus('characters-approved', {
      scenes: [
        {
          number: 1, text: 'Escena 1', visualDescription: 'plaza',
          selectedImageUrl: bytes,
        } as unknown as Story['scenes'][number],
      ],
    });
  }
  return withStatus('scenes-pending', {
    scenes: [
      {
        number: 1, text: 'Escena 1', visualDescription: 'plaza',
        selectedImageUrl: EXISTING_DRAFTS_URL,
      } as unknown as Story['scenes'][number],
    ],
    coverImageUrl: site === 'cover' ? bytes : EXISTING_DRAFTS_URL,
    endImageUrl: site === 'end' ? bytes : EXISTING_DRAFTS_URL,
  });
}

/** Sustituye recursivamente todo string base64 del patch por otros bytes. */
function replaceImageValues(node: unknown, replacement: string): void {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (typeof value === 'string') {
      if (value.length > 40 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        (node as Record<string, unknown>)[key] = replacement;
      }
    } else if (Array.isArray(value)) {
      (node as Record<string, unknown>)[key] = value.map((v) =>
        typeof v === 'string' && v.length > 40 && /^[A-Za-z0-9+/]+={0,2}$/.test(v)
          ? replacement
          : (replaceImageValues(v, replacement), v)
      );
    } else {
      replaceImageValues(value, replacement);
    }
  }
}

// ===========================================================================
// T-B.13 — legado + contrato COMBINADO de recuperación
// ===========================================================================

describe('PB T-B.13 — legado, hash y mixto recargan sin migración; el round trip es combinado', () => {
  const RELOAD_CASES: Array<{ id: string; paths: Record<string, unknown>; expectCover: number }> = [
    {
      id: 'posicional legado',
      paths: {
        characterSheetPaths: { char1: ['user-pb/lit-pb/characters/char1_0.png'] },
        sceneImagePaths: { 1: ['user-pb/lit-pb/scenes/scene1_0.png'] },
        coverPaths: ['user-pb/lit-pb/cover/cover_0.png'],
        endPaths: ['user-pb/lit-pb/end/end_0.png'],
      },
      expectCover: 1,
    },
    {
      id: 'nombres por hash',
      paths: {
        characterSheetPaths: { char1: [`user-pb/lit-pb/characters/char1_${'a'.repeat(32)}.png`] },
        sceneImagePaths: { 1: [`user-pb/lit-pb/scenes/scene1_${'b'.repeat(32)}.png`] },
        coverPaths: [`user-pb/lit-pb/cover/cover_${'c'.repeat(32)}.png`],
        endPaths: [`user-pb/lit-pb/end/end_${'d'.repeat(32)}.png`],
      },
      expectCover: 1,
    },
    {
      id: 'mixto posicional + hash',
      paths: {
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
      expectCover: 0,
    },
  ];

  for (const c of RELOAD_CASES) {
    it(`recarga sin migración: ${c.id}`, async () => {
      resetBoundary();
      ctl.draftRow = {
        liturgia_id: LITURGY_ID,
        user_id: USER_ID,
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
        image_paths: c.paths,
        updated_at: '2026-05-01T00:00:00.000Z',
      };

      const result = await mountHook();
      let loaded: CuentacuentosDraftFull | null = null;
      await act(async () => {
        loaded = await result.current.loadDraft();
      });
      const d = loaded as CuentacuentosDraftFull | null;

      // Cada path persistido se resolvió a una URL pública — sin importar si el
      // nombre es posicional o por hash: la lectura NO asume forma de nombre.
      const expected = c.paths.characterSheetPaths as Record<string, string[]>;
      expect(d?.characterSheetOptions?.char1).toHaveLength(expected.char1.length);
      for (const [i, p] of expected.char1.entries()) {
        expect(d?.characterSheetOptions?.char1?.[i]).toContain(p);
      }
      expect(d?.coverOptions).toHaveLength(c.expectCover);

      // Las SELECCIONES vienen de `editorStateV1`, no de `image_paths`: las dos
      // fuentes se unen en la recuperación.
      expect(d?.selectedCharacterSheets).toEqual({ char1: 0 });
      expect(d?.selectedSceneImages).toEqual({ 1: 0 });
    }, 60_000);
  }

  it('round trip combinado: `editorStateV1` lleva buffers/selecciones e `image_paths` los paths, sin base64 en el JSON', async () => {
    resetBoundary();
    const out = await write({
      currentStep: 'scenes',
      story: storyWith(),
      characterSheetOptions: { char1: [PNG_A_B64] },
      sceneImageOptions: { 1: [PNG_B_B64] },
      selectedCharacterSheets: { char1: 0 },
      selectedSceneImages: { 1: 0 },
      sceneReferenceImages: { 1: PNG_C_B64 },
      coverReferenceImage: PNG_D_B64,
      endReferenceImage: PNG_E_B64,
      editingSceneText: { 1: 'texto editado' },
    });
    expect(out.rejected).toBe(false);

    const upsert = upsertsTo('cuentacuentos_drafts').at(-1)!;
    const payload = upsert.payload as Record<string, unknown>;

    // (a) Los PATHS viven en `image_paths`.
    const paths = payload.image_paths as Record<string, unknown>;
    expect((paths.characterSheetPaths as Record<string, string[]>).char1).toEqual([
      draftPath('characters', 'char1', PNG_A_B64),
    ]);
    expect((paths.sceneImagePaths as Record<string, string[]>)['1']).toEqual([
      draftPath('scenes', 'scene1', PNG_B_B64),
    ]);
    expect(paths.sceneReferencePaths).toEqual({
      1: draftPath('sceneRefs', 'scene1', PNG_C_B64),
    });
    expect(paths.coverReferencePath).toBe(draftPath('coverRef', 'cover', PNG_D_B64));
    expect(paths.endReferencePath).toBe(draftPath('endRef', 'end', PNG_E_B64));

    // (b) Los BUFFERS y SELECCIONES viven en `story.editorStateV1`.
    const story = payload.story as Record<string, unknown>;
    const editorState = story.editorStateV1 as Record<string, unknown>;
    expect(editorState).toBeDefined();
    expect(editorState.version).toBe(1);
    expect(JSON.stringify(editorState)).toContain('texto editado');

    // (c) NADA de base64 crudo ni data URLs en el JSON persistido del story.
    expect(treeHasInline(story), 'el story persistido no puede llevar bytes inline').toBe(false);
    // Ni en el bloque de estado del editor.
    expect(treeHasInline(editorState)).toBe(false);
  }, 60_000);

  it('la LECTURA no asume nombres por hash: un path posicional sigue resolviendo', async () => {
    resetBoundary();
    ctl.draftRow = {
      liturgia_id: LITURGY_ID,
      user_id: USER_ID,
      current_step: 'scenes',
      config: {},
      story: storyWith(),
      image_paths: { coverPaths: ['user-pb/lit-pb/cover/cover_0.png'] },
      updated_at: '2026-05-01T00:00:00.000Z',
    };
    const result = await mountHook();
    let loaded: CuentacuentosDraftFull | null = null;
    await act(async () => {
      loaded = await result.current.loadDraft();
    });
    const d = loaded as CuentacuentosDraftFull | null;
    expect(d?.coverOptions?.[0]).toContain('cover_0.png');
    await act(async () => { await yields(3); });
  }, 60_000);
});

/** ¿Hay base64 crudo o data URL en algún lugar del árbol? */
function treeHasInline(node: unknown): boolean {
  if (typeof node === 'string') {
    if (node.startsWith('data:')) return true;
    return node.length > 40 && /^[A-Za-z0-9+/]+={0,2}$/.test(node);
  }
  if (Array.isArray(node)) return node.some(treeHasInline);
  if (node && typeof node === 'object') {
    return Object.values(node as Record<string, unknown>).some(treeHasInline);
  }
  return false;
}

// Fixtures que la matriz usa indirectamente.
void WEBP_B64;
