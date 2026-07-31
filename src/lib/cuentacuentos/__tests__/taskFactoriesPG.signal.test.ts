/**
 * PG / T-G.5 (mitad de factories) — Las NUEVE factories de producción pasan la
 * señal EXACTA del runner a la superficie de invocación inyectada.
 *
 * Se importan las mismas nueve factories que importa el editor. Cada caso:
 *   - construye la tarea con la factory de producción;
 *   - la corre por el RUNNER de producción (que es quien mintea el
 *     `AbortController` y arma el `ProviderContext`);
 *   - comprueba que el tercer argumento que recibió la invocación es la MISMA
 *     INSTANCIA (identidad referencial, no una copia ni un booleano) que el
 *     `ctx.signal` que el runner entregó;
 *   - comprueba que el cuerpo y el fallback de la petición no cambiaron.
 *
 * Cortar UNA factory hace fallar exactamente SU caso (evidencia D7 registrada
 * en el informe). La mitad de frontera —que el envoltorio del editor reenvía la
 * misma instancia a `supabase.functions.invoke`— vive en la suite de editor
 * `CuentacuentoEditor.pg.cancel.test.tsx`, bajo G7.
 *
 * Honestidad (G4): que la señal llegue al transporte corta la espera del
 * cliente y prohíbe despachos futuros. No revoca una petición ya despachada al
 * edge ni recupera su gasto.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { describe, expect, it, vi } from 'vitest';

import {
  createStoryImagePipelineRunner,
  type PipelineItemTask,
  type ProviderContext,
  type RunIdentity,
} from '@/hooks/storyImagePipelineRunner';
import type { EnqueueGeneratedSnapshotInput } from '@/hooks/useCuentacuentosDraft';
import type { EditorCreationStep } from '@/lib/cuentacuentos/recoverySnapshot';
import {
  makeCharacterSheetTask,
  makeCoverTask,
  makeEndTask,
  makePropSheetTask,
  makeRefineCharacterSheetTask,
  makeRefineCoverTask,
  makeRefineEndTask,
  makeRefineSceneTask,
  makeSceneTask,
  TASK_FACTORY_KEYS,
  type InvokeGenerateSceneImages,
  type ProviderResult,
  type TaskFactoryKey,
} from '@/lib/cuentacuentos/taskFactories';
import type { LocationInfo, StoryCharacter, StoryProp, StoryScene } from '@/types/shared/story';

const LIVE_IDENTITY: RunIdentity = { storyId: 'story-PG', epoch: 0 };

const CHARACTER: StoryCharacter = {
  id: 'char-1',
  name: 'Ana',
  description: 'niña curiosa',
  visualDescription: 'niña 6 años, pelo negro',
  role: 'protagonist',
};

const PROP: StoryProp = {
  id: 'prop-1',
  kind: 'prop',
  name: 'linterna',
  narrativeRole: 'guía a Ana',
  visualDescription: 'linterna metálica plateada',
  referenceImages: [],
  role: 'primary',
};

const SCENE: StoryScene = {
  number: 1,
  text: 'Ana entra a la cueva.',
  visualDescription: 'Ana con linterna en cueva oscura',
};

const LOCATION: LocationInfo = {
  name: 'Chiloé',
  type: 'costa',
  description: 'Isla de mitos',
  visualElements: [],
  colors: [],
  lighting: 'natural',
};

interface Harness {
  characterSheetOptionsRef: MutableRefObject<Record<string, string[]>>;
  selectedCharacterSheetsRef: MutableRefObject<Record<string, number>>;
  currentStepRef: MutableRefObject<EditorCreationStep>;
  propSheetOptionsRef: MutableRefObject<Record<string, string[]>>;
  sceneImageOptionsRef: MutableRefObject<Record<number, string[]>>;
  selectedSceneImagesRef: MutableRefObject<Record<number, number>>;
  sceneReferenceModeRef: MutableRefObject<Record<number, 'style' | 'pov'>>;
  coverOptionsRef: MutableRefObject<string[]>;
  selectedCoverRef: MutableRefObject<number | null>;
  endOptionsRef: MutableRefObject<string[]>;
  selectedEndRef: MutableRefObject<number | null>;
  setCharacterSheetOptions: Dispatch<SetStateAction<Record<string, string[]>>>;
  setSelectedCharacterSheets: Dispatch<SetStateAction<Record<string, number>>>;
  setPropSheetOptions: Dispatch<SetStateAction<Record<string, string[]>>>;
  setSelectedPropSheets: Dispatch<SetStateAction<Record<string, number>>>;
  setSceneImageOptions: Dispatch<SetStateAction<Record<number, string[]>>>;
  setSelectedSceneImages: Dispatch<SetStateAction<Record<number, number>>>;
  setCoverOptions: Dispatch<SetStateAction<string[]>>;
  setEndOptions: Dispatch<SetStateAction<string[]>>;
}

function makeHarness(): Harness {
  return {
    characterSheetOptionsRef: { current: { 'char-1': ['src.png'] } },
    selectedCharacterSheetsRef: { current: { 'char-1': 0 } },
    currentStepRef: { current: 'characters' as EditorCreationStep },
    propSheetOptionsRef: { current: {} },
    sceneImageOptionsRef: { current: { 1: ['src.png'] } },
    selectedSceneImagesRef: { current: { 1: 0 } },
    sceneReferenceModeRef: { current: {} },
    coverOptionsRef: { current: ['src.png'] },
    selectedCoverRef: { current: 0 },
    endOptionsRef: { current: ['src.png'] },
    selectedEndRef: { current: 0 },
    setCharacterSheetOptions: vi.fn(),
    setSelectedCharacterSheets: vi.fn(),
    setPropSheetOptions: vi.fn(),
    setSelectedPropSheets: vi.fn(),
    setSceneImageOptions: vi.fn(),
    setSelectedSceneImages: vi.fn(),
    setCoverOptions: vi.fn(),
    setEndOptions: vi.fn(),
  };
}

interface Injected {
  invoke: InvokeGenerateSceneImages;
  getLiveIdentity: () => RunIdentity;
  enqueueGeneratedSnapshot: (input: EnqueueGeneratedSnapshotInput) => Promise<undefined>;
}

interface FactoryCase {
  key: TaskFactoryKey;
  itemId: string;
  /** Cuerpo esperado (subconjunto) — prueba que la petición no cambió. */
  expectedBody: Record<string, unknown>;
  expectedFallback: string;
  build: (h: Harness, i: Injected) => PipelineItemTask<ProviderResult, never>;
}

const CASES: FactoryCase[] = [
  {
    key: 'characterSheet',
    itemId: 'sheet-char-1',
    expectedBody: { type: 'character', styleId: 'ghibli', count: 2, modelTier: 'flash' },
    expectedFallback: 'No se pudieron generar imágenes',
    build: (h, i) =>
      makeCharacterSheetTask({
        character: CHARACTER,
        effectivePrompt: 'niña 6 años, pelo negro',
        append: false,
        illustrationStyle: 'ghibli',
        characterSheetOptionsRef: h.characterSheetOptionsRef,
        selectedCharacterSheetsRef: h.selectedCharacterSheetsRef,
        currentStepRef: h.currentStepRef,
        setCharacterSheetOptions: h.setCharacterSheetOptions,
        setSelectedCharacterSheets: h.setSelectedCharacterSheets,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
  {
    key: 'propSheet',
    itemId: 'prop-prop-1',
    expectedBody: { type: 'prop', styleId: 'ghibli', count: 2, modelTier: 'flash' },
    expectedFallback: 'No se pudieron generar imágenes',
    build: (h, i) =>
      makePropSheetTask({
        prop: PROP,
        illustrationStyle: 'ghibli',
        photoRefs: [],
        propSheetOptionsRef: h.propSheetOptionsRef,
        setPropSheetOptions: h.setPropSheetOptions,
        setSelectedPropSheets: h.setSelectedPropSheets,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
  {
    key: 'scene',
    itemId: 'scene-1',
    expectedBody: { type: 'scene', styleId: 'ghibli', count: 2, modelTier: 'flash' },
    expectedFallback: 'No se pudieron generar imágenes',
    build: (h, i) =>
      makeSceneTask({
        scene: SCENE,
        sceneData: { text: SCENE.text, visualDescription: SCENE.visualDescription },
        charactersWithReferences: [],
        location: LOCATION,
        sceneReferenceImage: undefined,
        propsForScene: [],
        illustrationStyle: 'ghibli',
        append: false,
        sceneImageOptionsRef: h.sceneImageOptionsRef,
        selectedSceneImagesRef: h.selectedSceneImagesRef,
        sceneReferenceModeRef: h.sceneReferenceModeRef,
        currentStepRef: h.currentStepRef,
        setSceneImageOptions: h.setSceneImageOptions,
        setSelectedSceneImages: h.setSelectedSceneImages,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
  {
    key: 'cover',
    itemId: 'cover',
    expectedBody: { type: 'cover', styleId: 'ghibli', count: 4, modelTier: 'pro' },
    expectedFallback: 'No se pudieron generar imágenes de portada',
    build: (h, i) =>
      makeCoverTask({
        illustrationStyle: 'ghibli',
        title: 'La cueva de Ana',
        protagonistVisualDescription: 'niña 6 años',
        location: LOCATION,
        charactersWithReferences: [],
        coverReferenceImage: null,
        primaryProps: [],
        customPrompt: undefined,
        coverOptionsRef: h.coverOptionsRef,
        selectedCoverRef: h.selectedCoverRef,
        setCoverOptions: h.setCoverOptions,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
  {
    key: 'end',
    itemId: 'end',
    expectedBody: { type: 'end', styleId: 'ghibli', count: 4, modelTier: 'pro' },
    expectedFallback: 'No se pudieron generar imágenes de fin',
    build: (h, i) =>
      makeEndTask({
        illustrationStyle: 'ghibli',
        endReferenceImage: undefined,
        charactersWithReferences: [],
        customPrompt: undefined,
        endOptionsRef: h.endOptionsRef,
        selectedEndRef: h.selectedEndRef,
        setEndOptions: h.setEndOptions,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
  {
    key: 'refineCharacterSheet',
    itemId: 'sheet-char-1',
    expectedBody: { type: 'character', modelTier: 'pro', refine: { sourceImage: 'src.png', feedback: 'más luz' } },
    expectedFallback: 'No se pudo refinar el personaje',
    build: (h, i) =>
      makeRefineCharacterSheetTask({
        character: CHARACTER,
        illustrationStyle: 'ghibli',
        visualDescription: 'niña 6 años',
        sourceImage: 'src.png',
        feedback: 'más luz',
        characterSheetOptionsRef: h.characterSheetOptionsRef,
        selectedCharacterSheetsRef: h.selectedCharacterSheetsRef,
        currentStepRef: h.currentStepRef,
        setCharacterSheetOptions: h.setCharacterSheetOptions,
        setSelectedCharacterSheets: h.setSelectedCharacterSheets,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
  {
    key: 'refineScene',
    itemId: 'scene-1',
    expectedBody: { type: 'scene', modelTier: 'pro', refine: { sourceImage: 'src.png', feedback: 'más luz' } },
    expectedFallback: 'No se pudo refinar la escena',
    build: (h, i) =>
      makeRefineSceneTask({
        scene: SCENE,
        sceneData: { text: SCENE.text, visualDescription: SCENE.visualDescription },
        charactersWithReferences: [],
        location: LOCATION,
        sceneReferenceImage: undefined,
        propsForScene: [],
        illustrationStyle: 'ghibli',
        sourceImage: 'src.png',
        feedback: 'más luz',
        sceneImageOptionsRef: h.sceneImageOptionsRef,
        selectedSceneImagesRef: h.selectedSceneImagesRef,
        sceneReferenceModeRef: h.sceneReferenceModeRef,
        currentStepRef: h.currentStepRef,
        setSceneImageOptions: h.setSceneImageOptions,
        setSelectedSceneImages: h.setSelectedSceneImages,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
  {
    key: 'refineCover',
    itemId: 'cover',
    expectedBody: { type: 'cover', modelTier: 'pro', refine: { sourceImage: 'src.png', feedback: 'más luz' } },
    expectedFallback: 'No se pudo refinar la portada',
    build: (h, i) =>
      makeRefineCoverTask({
        illustrationStyle: 'ghibli',
        title: 'La cueva de Ana',
        protagonistVisualDescription: 'niña 6 años',
        location: LOCATION,
        charactersWithReferences: [],
        coverReferenceImage: undefined,
        primaryProps: [],
        customPrompt: undefined,
        sourceImage: 'src.png',
        feedback: 'más luz',
        coverOptionsRef: h.coverOptionsRef,
        selectedCoverRef: h.selectedCoverRef,
        setCoverOptions: h.setCoverOptions,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
  {
    key: 'refineEnd',
    itemId: 'end',
    expectedBody: { type: 'end', modelTier: 'pro', refine: { sourceImage: 'src.png', feedback: 'más luz' } },
    expectedFallback: 'No se pudo refinar la imagen final',
    build: (h, i) =>
      makeRefineEndTask({
        illustrationStyle: 'ghibli',
        endReferenceImage: undefined,
        charactersWithReferences: [],
        customPrompt: undefined,
        sourceImage: 'src.png',
        feedback: 'más luz',
        endOptionsRef: h.endOptionsRef,
        selectedEndRef: h.selectedEndRef,
        setEndOptions: h.setEndOptions,
        invokeGenerateSceneImages: i.invoke,
        getLiveIdentity: i.getLiveIdentity,
        enqueueGeneratedSnapshot: i.enqueueGeneratedSnapshot,
      }) as unknown as PipelineItemTask<ProviderResult, never>,
  },
];

describe('T-G.5 (factories) — las nueve pasan la señal EXACTA del runner a la invocación', () => {
  it('el arreglo de casos cubre las nueve factories de producción, sin faltar ni repetir clave', () => {
    expect(CASES).toHaveLength(9);
    expect(CASES.map((c) => c.key).sort()).toEqual([...TASK_FACTORY_KEYS].sort());
  });

  it.each(CASES)(
    '$key: la invocación recibe la MISMA instancia de AbortSignal que el ctx del runner, con cuerpo y fallback intactos',
    async ({ itemId, expectedBody, expectedFallback, build }) => {
      const seen: Array<{ body: unknown; fallback: string; signal: AbortSignal | undefined }> = [];
      const invoke = vi.fn<InvokeGenerateSceneImages>(async (body, fallback, signal) => {
        seen.push({ body, fallback, signal });
        return { success: true, images: ['out-1', 'out-2'] } satisfies ProviderResult;
      });
      const task = build(makeHarness(), {
        invoke,
        getLiveIdentity: () => LIVE_IDENTITY,
        enqueueGeneratedSnapshot: vi.fn(async () => undefined),
      });

      // El runner de producción es quien mintea el controlador y arma el ctx.
      const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
      let ctxSignal: AbortSignal | undefined;
      const spiedTask: PipelineItemTask = {
        ...(task as unknown as PipelineItemTask),
        id: itemId,
        provider: (ctx: ProviderContext) => {
          ctxSignal = ctx.signal;
          return (task as unknown as PipelineItemTask).provider(ctx);
        },
      };

      await runner.runItems({ tasks: [spiedTask], identity: LIVE_IDENTITY });

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(seen).toHaveLength(1);
      expect(ctxSignal).toBeInstanceOf(AbortSignal);
      // Identidad referencial: ni copia, ni clon, ni booleano derivado.
      expect(seen[0].signal).toBe(ctxSignal);
      expect(seen[0].fallback).toBe(expectedFallback);
      expect(seen[0].body).toMatchObject(expectedBody);
    },
  );

  it.each(CASES)(
    '$key: la señal que llega a la invocación se aborta cuando el runner cancela',
    async ({ itemId, build }) => {
      let captured: AbortSignal | undefined;
      let released!: () => void;
      const arrived = new Promise<void>((r) => {
        released = r;
      });
      const invoke = vi.fn<InvokeGenerateSceneImages>((_b, _f, signal) => {
        captured = signal;
        released();
        return new Promise<ProviderResult>(() => {});
      });
      const task = build(makeHarness(), {
        invoke,
        getLiveIdentity: () => LIVE_IDENTITY,
        enqueueGeneratedSnapshot: vi.fn(async () => undefined),
      });
      const runner = createStoryImagePipelineRunner({ staggerMs: 0, providerAttempts: 1 });
      void runner.runItems({
        tasks: [{ ...(task as unknown as PipelineItemTask), id: itemId }],
        identity: LIVE_IDENTITY,
      });
      await arrived;

      expect(captured?.aborted).toBe(false);
      runner.cancel();
      expect(captured?.aborted).toBe(true);
      // Y el ítem no aplicado quedó normalizado, no en `error`.
      expect(runner.statusOf(itemId)).toBe('pending');
    },
  );
});
