/**
 * PH / G2 + G4 + G6 — Contrato de las fábricas cover/end: `count:2 pro`, la
 * matriz append/replace y el patch generado COMPLETO —array más selección—
 * tanto al devolverlo como al encolarlo (T-H.1, T-H.2, parte de T-H.6).
 *
 * Estas pruebas ejercen las FÁBRICAS DE PRODUCCIÓN importadas, no una copia de
 * su semántica. El único doble es el provider inyectado (`invokeGenerateSceneImages`),
 * que es el borde externo declarado por G9.
 *
 * BASE-RED en `8ceec7c`: allá las fábricas no tienen input `append` y su
 * `computePatch` hace `const nextOptions = result.images` — reemplaza siempre y
 * nunca toca la ref ni la selección. Un `append: true` de más se ignora en
 * runtime (esbuild borra tipos), así que cada aserción de acumulación observa
 * el reemplazo real, no un error de compilación.
 *
 * BASE-RED en `9d96c41` para las aserciones de patch COMPLETO: allá el patch
 * es `{coverOptions}` / `{endOptions}` a secas, sin la clave de selección.
 */

import { describe, expect, it, vi } from 'vitest';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import {
  makeCoverTask,
  makeEndTask,
  type InvokeGenerateSceneImages,
  type ProviderResult,
} from '@/lib/cuentacuentos/taskFactories';
import type { AppliedIdentity, RunIdentity } from '@/hooks/storyImagePipelineRunner';
import type { DraftPatch, EnqueueGeneratedSnapshotInput } from '@/hooks/useCuentacuentosDraft';

const LIVE_IDENTITY: RunIdentity = { storyId: 'story-ph', epoch: 3 };

const appliedFor = (itemId: string): AppliedIdentity =>
  ({ ...LIVE_IDENTITY, itemId } as unknown as AppliedIdentity);

const enqueueSpy = () => vi.fn(async (_input: EnqueueGeneratedSnapshotInput) => undefined);

const providerReturning = (...images: string[]) =>
  vi.fn<InvokeGenerateSceneImages>(async () => ({ success: true, images } as ProviderResult));

/**
 * Refs + setters de portada/fin. `setX` escribe el "estado" simulado para que
 * una prueba pueda distinguir la ref VIVA del valor de estado, que es
 * justamente la diferencia que el append tiene que respetar.
 */
function coverState(options: string[], selected: number | null) {
  const optionsRef: MutableRefObject<string[]> = { current: options };
  const selectedRef: MutableRefObject<number | null> = { current: selected };
  const setOptions = vi.fn() as unknown as Dispatch<SetStateAction<string[]>>;
  const setSelected = vi.fn() as unknown as Dispatch<SetStateAction<number | null>>;
  return { optionsRef, selectedRef, setOptions, setSelected };
}

/** Argumentos fijos de portada; sólo `append` y el estado varían por caso. */
function buildCover(
  st: ReturnType<typeof coverState>,
  append: boolean,
  invoke: ReturnType<typeof providerReturning>,
  enqueue: ReturnType<typeof enqueueSpy> = enqueueSpy(),
) {
  return makeCoverTask({
    illustrationStyle: 'ghibli',
    title: 'La cueva de Ana',
    protagonistVisualDescription: 'niña 6 años',
    location: undefined,
    charactersWithReferences: [],
    coverReferenceImage: null,
    primaryProps: [],
    customPrompt: undefined,
    append,
    coverOptionsRef: st.optionsRef,
    selectedCoverRef: st.selectedRef,
    setCoverOptions: st.setOptions,
    setSelectedCover: st.setSelected,
    invokeGenerateSceneImages: invoke,
    getLiveIdentity: () => LIVE_IDENTITY,
    enqueueGeneratedSnapshot: enqueue,
  });
}

function buildEnd(
  st: ReturnType<typeof coverState>,
  append: boolean,
  invoke: ReturnType<typeof providerReturning>,
  enqueue: ReturnType<typeof enqueueSpy> = enqueueSpy(),
) {
  return makeEndTask({
    illustrationStyle: 'ghibli',
    endReferenceImage: undefined,
    charactersWithReferences: [],
    customPrompt: undefined,
    append,
    endOptionsRef: st.optionsRef,
    selectedEndRef: st.selectedRef,
    setEndOptions: st.setOptions,
    setSelectedEnd: st.setSelected,
    invokeGenerateSceneImages: invoke,
    getLiveIdentity: () => LIVE_IDENTITY,
    enqueueGeneratedSnapshot: enqueue,
  });
}

/** La matriz cover/end: mismo contrato, dos fábricas. */
const KINDS = [
  {
    kind: 'cover' as const,
    build: buildCover,
    patchKey: 'coverOptions' as const,
    selectedKey: 'selectedCover' as const,
  },
  {
    kind: 'end' as const,
    build: buildEnd,
    patchKey: 'endOptions' as const,
    selectedKey: 'selectedEnd' as const,
  },
];

// =============================================================================
// T-H.1 — Conteo y tier
// =============================================================================

describe('T-H.1 — el generate de portada/fin pide 2 imágenes pro', () => {
  it.each(KINDS)('$kind: el cuerpo lleva count:2 y modelTier:pro', async ({ build }) => {
    const invoke = providerReturning('n1.png', 'n2.png');
    const task = build(coverState([], null), false, invoke);

    await task.provider!({ signal: new AbortController().signal } as never);

    const body = invoke.mock.calls[0][0] as Record<string, unknown>;
    expect(body.count).toBe(2);
    expect(body.modelTier).toBe('pro');
  });

  it.each(KINDS)('$kind: el append NO cambia el conteo pedido', async ({ build }) => {
    const invoke = providerReturning('n1.png', 'n2.png');
    const task = build(coverState(['a.png', 'b.png'], 0), true, invoke);

    await task.provider!({ signal: new AbortController().signal } as never);

    const body = invoke.mock.calls[0][0] as Record<string, unknown>;
    expect(body.count).toBe(2);
    expect(body.modelTier).toBe('pro');
  });
});

// =============================================================================
// T-H.2 — Matriz apply append / replace
// =============================================================================

describe('T-H.2 — append preserva options y selección; replace limpia la selección stale', () => {
  it.each(KINDS)(
    '$kind append: las viejas van primero, las nuevas en orden, y la selección sobrevive',
    async ({ kind, build, patchKey, selectedKey }) => {
      const st = coverState(['a.png', 'b.png'], 1);
      const invoke = providerReturning('n1.png', 'n2.png');
      const task = build(st, true, invoke);

      const result = await task.provider!({ signal: new AbortController().signal } as never);
      const patch = task.apply!(result, appliedFor(kind)) as DraftPatch;

      // Orden y multiplicidad: viejas primero, nuevas después, nada descartado.
      expect(patch[patchKey]).toEqual(['a.png', 'b.png', 'n1.png', 'n2.png']);
      // El patch lleva el ARRAY COMPLETO, no el delta.
      expect(st.optionsRef.current).toEqual(['a.png', 'b.png', 'n1.png', 'n2.png']);
      expect(st.setOptions).toHaveBeenCalledWith(['a.png', 'b.png', 'n1.png', 'n2.png']);

      // La selección no se toca: el índice 1 sigue apuntando a la MISMA imagen.
      expect(st.selectedRef.current).toBe(1);
      expect(st.setSelected).not.toHaveBeenCalled();
      expect((patch[patchKey] as string[])[1]).toBe('b.png');

      // El patch COMPLETO —no sólo la clave del array—: preservar la selección
      // en memoria no sirve de nada si el snapshot que se persiste la omite,
      // porque la cola mergea por presencia de clave y el snapshot anterior
      // todavía dice `null`.
      expect(patch).toEqual({
        [patchKey]: ['a.png', 'b.png', 'n1.png', 'n2.png'],
        [selectedKey]: 1,
      });
    },
  );

  it.each(KINDS)(
    '$kind replace: reemplaza el array y limpia la selección stale (ref y estado)',
    async ({ kind, build, patchKey, selectedKey }) => {
      const st = coverState(['a.png', 'b.png'], 1);
      const invoke = providerReturning('n1.png', 'n2.png');
      const task = build(st, false, invoke);

      const result = await task.provider!({ signal: new AbortController().signal } as never);
      const patch = task.apply!(result, appliedFor(kind)) as DraftPatch;

      expect(patch[patchKey]).toEqual(['n1.png', 'n2.png']);
      expect(st.optionsRef.current).toEqual(['n1.png', 'n2.png']);
      // Sin esto, el índice 1 se rebindearía en silencio a `n2.png`: una imagen
      // que el usuario nunca eligió.
      expect(st.selectedRef.current).toBeNull();
      expect(st.setSelected).toHaveBeenCalledWith(null);

      // El patch COMPLETO lleva la limpieza EXPLÍCITA: `null` presente, no la
      // clave ausente. Ausente dejaría el índice viejo en la fila apuntando a
      // una imagen que el usuario nunca eligió.
      expect(patch).toEqual({ [patchKey]: ['n1.png', 'n2.png'], [selectedKey]: null });
    },
  );

  it.each(KINDS)(
    '$kind append: la base es la ref VIVA, no el array que existía al construir la tarea',
    async ({ kind, build, patchKey }) => {
      const st = coverState(['a.png'], 0);
      const invoke = providerReturning('n1.png');
      const task = build(st, true, invoke);

      // Entre construir y aplicar, la ref cambia — es exactamente lo que pasa
      // cuando un upload o un refine aterriza mientras el lote está en vuelo.
      st.optionsRef.current = ['a.png', 'subida.png'];

      const result = await task.provider!({ signal: new AbortController().signal } as never);
      const patch = task.apply!(result, appliedFor(kind)) as DraftPatch;

      expect(patch[patchKey]).toEqual(['a.png', 'subida.png', 'n1.png']);
    },
  );

  it.each(KINDS)(
    '$kind append: la ref queda escrita ANTES de llamar al setter',
    async ({ kind, build }) => {
      const st = coverState(['a.png'], 0);
      const invoke = providerReturning('n1.png');
      // El setter espía la ref en el momento en que lo llaman: si el orden se
      // invirtiera, vería el array viejo.
      const seenBySetter: string[][] = [];
      st.setOptions = vi.fn(() => {
        seenBySetter.push([...st.optionsRef.current]);
      }) as unknown as Dispatch<SetStateAction<string[]>>;
      const task = build(st, true, invoke);

      const result = await task.provider!({ signal: new AbortController().signal } as never);
      task.apply!(result, appliedFor(kind));

      expect(seenBySetter).toEqual([['a.png', 'n1.png']]);
    },
  );

  it.each(KINDS)(
    '$kind replace sin selección previa: no se inventa una limpieza de selección',
    async ({ kind, build, patchKey, selectedKey }) => {
      const st = coverState([], null);
      const invoke = providerReturning('n1.png', 'n2.png');
      const task = build(st, false, invoke);

      const result = await task.provider!({ signal: new AbortController().signal } as never);
      const patch = task.apply!(result, appliedFor(kind)) as DraftPatch;

      expect(patch[patchKey]).toEqual(['n1.png', 'n2.png']);
      expect(st.selectedRef.current).toBeNull();
      expect(st.setSelected).not.toHaveBeenCalled();
      // No hubo setter, pero el patch igual afirma `null`: el valor persistido
      // no depende de si hacía falta limpiar.
      expect(patch).toEqual({ [patchKey]: ['n1.png', 'n2.png'], [selectedKey]: null });
    },
  );

  it.each(KINDS)('$kind append: multiplicidad conservada, no se deduplica', async ({ kind, build, patchKey }) => {
    const st = coverState(['a.png'], 0);
    const invoke = providerReturning('a.png', 'n2.png');
    const task = build(st, true, invoke);

    const result = await task.provider!({ signal: new AbortController().signal } as never);
    const patch = task.apply!(result, appliedFor(kind)) as DraftPatch;

    // Dos entradas idénticas siguen siendo dos opciones distintas para el
    // usuario; deduplicar movería los índices bajo la selección.
    expect(patch[patchKey]).toEqual(['a.png', 'a.png', 'n2.png']);
  });
});

// =============================================================================
// T-H.2 + G6 — lo que realmente llega a la cola de persistencia
// =============================================================================

/**
 * `apply` devuelve el patch, pero quien lo persiste es `persist`, y es ahí
 * donde el contrato de G6 se juega: el snapshot que la cola mergea tiene que
 * traer la selección, porque la cola no puede inferirla del snapshot anterior.
 * Se ejercita el `persist` de producción (`buildSnapshotTask`), no una copia.
 */
describe('G6 — el snapshot encolado lleva el array completo Y la selección', () => {
  it.each(KINDS)(
    '$kind append: la cola recibe la selección preservada',
    async ({ kind, build, patchKey, selectedKey }) => {
      const enqueue = enqueueSpy();
      const st = coverState(['a.png', 'b.png'], 1);
      const task = build(st, true, providerReturning('n1.png', 'n2.png'), enqueue);

      const result = await task.provider!({ signal: new AbortController().signal } as never);
      const patch = task.apply!(result, appliedFor(kind)) as DraftPatch;
      await task.persist!(patch, appliedFor(kind));

      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(enqueue.mock.calls[0][0].patch).toEqual({
        [patchKey]: ['a.png', 'b.png', 'n1.png', 'n2.png'],
        [selectedKey]: 1,
      });
    },
  );

  it.each(KINDS)(
    '$kind replace: la cola recibe la selección en null',
    async ({ kind, build, patchKey, selectedKey }) => {
      const enqueue = enqueueSpy();
      const st = coverState(['a.png', 'b.png'], 1);
      const task = build(st, false, providerReturning('n1.png', 'n2.png'), enqueue);

      const result = await task.provider!({ signal: new AbortController().signal } as never);
      const patch = task.apply!(result, appliedFor(kind)) as DraftPatch;
      await task.persist!(patch, appliedFor(kind));

      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(enqueue.mock.calls[0][0].patch).toEqual({
        [patchKey]: ['n1.png', 'n2.png'],
        [selectedKey]: null,
      });
    },
  );
});

// =============================================================================
// T-H.6 (fábrica) — lote parcial
// =============================================================================

describe('T-H.6 (fábrica) — un lote parcial agrega lo que llegó', () => {
  it.each(KINDS)(
    '$kind: una sola imagen se agrega tal cual — no se rellena ni se rechaza por no llegar a dos',
    async ({ kind, build, patchKey }) => {
      const st = coverState(['a.png', 'b.png'], 1);
      const invoke = providerReturning('unica.png');
      const task = build(st, true, invoke);

      const result = await task.provider!({ signal: new AbortController().signal } as never);
      const patch = task.apply!(result, appliedFor(kind)) as DraftPatch;

      expect(patch[patchKey]).toEqual(['a.png', 'b.png', 'unica.png']);
      expect((patch[patchKey] as string[]).length).toBe(3);
      expect(st.selectedRef.current).toBe(1);
    },
  );
});
