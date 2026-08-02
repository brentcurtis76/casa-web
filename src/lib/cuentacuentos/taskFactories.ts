/**
 * A3a/S3 subtask 4 (F5) — Production factories for the nine PipelineItemTask
 * closures the CuentacuentoEditor runs (five generates: character sheet, prop,
 * scene, cover, end; four refines: character, scene, cover, end).
 *
 * The editor previously inlined nine `buildSnapshotTask({...})` calls with
 * duplicated provider-body + apply-patch bodies. Those bodies are extracted
 * here so:
 *   - The editor imports and delegates instead of restating the same task
 *     shape nine times.
 *   - Tests import these exact factories and exercise every path against real
 *     production construction — no reproducing closure semantics in tests.
 *
 * Contract per factory:
 *   - Provider posts to the `generate-scene-images` edge function via an
 *     injected `invokeGenerateSceneImages` service (tests mock it).
 *   - `apply` runs through `buildSnapshotTask`, which enforces the live
 *     `{storyId, epoch}` identity guard, captures the deterministic snapshot
 *     hash, and never persists — persistence flows only through `persist`.
 *   - `persist` calls the injected `enqueueGeneratedSnapshot` with
 *     `{patch, identity, provenance:{sourceRevision,contentHash}}` and honors
 *     the `PERSIST_STALE` sentinel returned by the draft hook (A3a/S3 F3).
 *   - Save-only retries flow through the runner and reuse the captured hash;
 *     they never touch `provider`, `apply`, or `computePatch` again.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type {
  AppliedIdentity,
  PipelineItemKind,
  PipelineItemTask,
  RunIdentity,
} from '@/hooks/storyImagePipelineRunner';
import { APPLY_EPHEMERAL, APPLY_STALE } from '@/hooks/storyImagePipelineRunner';
import type {
  DraftPatch,
  EnqueueGeneratedSnapshotInput,
  EnqueueGeneratedSnapshotResult,
} from '@/hooks/useCuentacuentosDraft';
import type { SkippedImage } from '@/lib/cuentacuentos/imageFeedback';
import { buildSnapshotTask } from '@/lib/cuentacuentos/pipelineTaskAdapter';
import type { EditorCreationStep } from '@/lib/cuentacuentos/recoverySnapshot';
import type {
  GenerateSceneImagesCharacterRequest,
  GenerateSceneImagesCoverRequest,
  GenerateSceneImagesEndRequest,
  GenerateSceneImagesSceneRequest,
  LocationInfo,
  StoryCharacter,
  StoryProp,
  StoryScene,
} from '@/types/shared/story';

// -----------------------------------------------------------------------------
// Shared provider surface
// -----------------------------------------------------------------------------

/** Raw response from `generate-scene-images` (shared by every task kind). */
export interface ProviderResult {
  success: boolean;
  images: string[];
  referenceImagesCount?: number;
  error?: string;
  /**
   * Referencias que el handler descartó (contrato FASE F). Viene también en las
   * respuestas 200: la generación sigue sin ellas, así que sin esto un character
   * sheet o un style ref que se cayó es indistinguible de uno que se usó.
   */
  skippedImages?: SkippedImage[];
}

/**
 * Injected provider surface. The editor supplies a wrapper around
 * `supabase.functions.invoke('generate-scene-images', {body, signal})` that also
 * unwraps FunctionsHttpError and validates `success/images`.
 *
 * PG/G4 — `signal` is the runner's own run signal, threaded verbatim from
 * `ProviderContext.signal`. Cancelling settles the client request and prevents
 * any future dispatch; it does NOT recall an edge request already dispatched
 * and does not refund its spend (the handler never observes `req.signal`).
 */
export type InvokeGenerateSceneImages = (
  body:
    | GenerateSceneImagesCharacterRequest
    | GenerateSceneImagesSceneRequest
    | GenerateSceneImagesCoverRequest
    | GenerateSceneImagesEndRequest
    | Record<string, unknown>,
  emptyImagesFallback: string,
  signal: AbortSignal,
) => Promise<ProviderResult>;

/**
 * Common dependencies used by every factory: the injected provider surface,
 * the live-identity getter (for the apply-time guard), and the persistence
 * surface `enqueueGeneratedSnapshot`.
 */
export interface CommonFactoryDeps {
  invokeGenerateSceneImages: InvokeGenerateSceneImages;
  getLiveIdentity: () => RunIdentity;
  enqueueGeneratedSnapshot: (
    input: EnqueueGeneratedSnapshotInput,
  ) => Promise<EnqueueGeneratedSnapshotResult>;
}

// -----------------------------------------------------------------------------
// Shared editor-state surface referenced by multiple factories
// -----------------------------------------------------------------------------

/** Refs + setters for character-sheet options and selection. */
export interface CharacterSheetRefs {
  characterSheetOptionsRef: MutableRefObject<Record<string, string[]>>;
  selectedCharacterSheetsRef: MutableRefObject<Record<string, number>>;
  setCharacterSheetOptions: Dispatch<SetStateAction<Record<string, string[]>>>;
  setSelectedCharacterSheets: Dispatch<SetStateAction<Record<string, number>>>;
}

/** Refs + setters for scene-image options and selection. */
export interface SceneImageRefs {
  sceneImageOptionsRef: MutableRefObject<Record<number, string[]>>;
  selectedSceneImagesRef: MutableRefObject<Record<number, number>>;
  sceneReferenceModeRef: MutableRefObject<Record<number, 'style' | 'pov'>>;
  setSceneImageOptions: Dispatch<SetStateAction<Record<number, string[]>>>;
  setSelectedSceneImages: Dispatch<SetStateAction<Record<number, number>>>;
}

/** Refs + setters for prop-sheet ephemeral candidates. */
export interface PropSheetRefs {
  propSheetOptionsRef: MutableRefObject<Record<string, string[]>>;
  setPropSheetOptions: Dispatch<SetStateAction<Record<string, string[]>>>;
  setSelectedPropSheets: Dispatch<SetStateAction<Record<string, number>>>;
}

export interface CoverRefs {
  coverOptionsRef: MutableRefObject<string[]>;
  selectedCoverRef: MutableRefObject<number | null>;
  setCoverOptions: Dispatch<SetStateAction<string[]>>;
}

export interface EndRefs {
  endOptionsRef: MutableRefObject<string[]>;
  selectedEndRef: MutableRefObject<number | null>;
  setEndOptions: Dispatch<SetStateAction<string[]>>;
}

/** Ref carrying the current CreationStep (embedded in every DraftPatch). */
export interface CurrentStepRef {
  currentStepRef: MutableRefObject<EditorCreationStep>;
}

// -----------------------------------------------------------------------------
// Precomputed shapes accepted by the scene/cover/end factories. These are
// assembled by the editor from getCharactersWithReferences / getPropsForScene
// / getPrimaryProps and passed in verbatim so factories stay pure.
// -----------------------------------------------------------------------------

export interface ReferenceCharacter {
  name: string;
  visualDescription: string;
  referenceImage?: string;
}

export interface ReferenceProp {
  name: string;
  visualDescription: string;
  referenceImages: string[];
}

export interface SceneRequestData {
  text: string;
  visualDescription: string;
  landmarkVisible?: boolean;
}

/**
 * Location used by scene/cover generation. Alias of the shared `LocationInfo`
 * (the `Story.location` shape carried by the editor). Kept as `StoryLocation`
 * so factory-input names remain self-describing at the call site.
 */
export type StoryLocation = LocationInfo;

// =============================================================================
// 1) CHARACTER SHEET — GENERATE
// =============================================================================

export interface CharacterSheetTaskInput
  extends CommonFactoryDeps,
    CharacterSheetRefs,
    CurrentStepRef {
  character: StoryCharacter;
  /** Prompt actually sent to the model: custom override or visualDescription. */
  effectivePrompt: string;
  /** `true` = append to existing candidates; `false` = replace selection. */
  append: boolean;
  illustrationStyle: string;
}

export function makeCharacterSheetTask(
  input: CharacterSheetTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    character,
    effectivePrompt,
    append,
    illustrationStyle,
    characterSheetOptionsRef,
    selectedCharacterSheetsRef,
    currentStepRef,
    setCharacterSheetOptions,
    setSelectedCharacterSheets,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: `sheet-${character.id}`,
    kind: 'sheet',
    label: character.name,
    provider: (ctx) =>
      invokeGenerateSceneImages(
        {
          type: 'character',
          styleId: illustrationStyle,
          character: {
            name: character.name,
            description: character.description,
            visualDescription: effectivePrompt,
          },
          count: 2,
          modelTier: 'flash',
        },
        'No se pudieron generar imágenes',
        ctx.signal,
      ),
    computePatch: (result) => {
      const base = characterSheetOptionsRef.current;
      const existingOptions = append ? (base[character.id] || []) : [];
      const nextOptions = {
        ...base,
        [character.id]: [...existingOptions, ...result.images],
      };
      characterSheetOptionsRef.current = nextOptions;
      setCharacterSheetOptions(nextOptions);

      let nextSelection = selectedCharacterSheetsRef.current;
      if (!append && nextSelection[character.id] !== undefined) {
        nextSelection = { ...nextSelection };
        delete nextSelection[character.id];
        selectedCharacterSheetsRef.current = nextSelection;
        setSelectedCharacterSheets(nextSelection);
      }

      return {
        currentStep: currentStepRef.current,
        characterSheetOptions: nextOptions,
        selectedCharacterSheets: nextSelection,
      };
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// =============================================================================
// 2) PROP SHEET — GENERATE (EPHEMERAL: apply returns APPLY_EPHEMERAL)
// =============================================================================

export interface PropSheetTaskInput
  extends CommonFactoryDeps,
    PropSheetRefs {
  prop: StoryProp;
  illustrationStyle: string;
  /** Photo refs the editor has already deduped against session candidates. */
  photoRefs: string[];
}

export function makePropSheetTask(
  input: PropSheetTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    prop,
    illustrationStyle,
    photoRefs,
    propSheetOptionsRef,
    setPropSheetOptions,
    setSelectedPropSheets,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: `prop-${prop.id}`,
    kind: 'prop',
    label: prop.name,
    provider: (ctx) =>
      invokeGenerateSceneImages(
        {
          type: 'prop',
          styleId: illustrationStyle,
          prop: {
            name: prop.name,
            kind: prop.kind,
            visualDescription: prop.visualDescription,
            referenceImages: photoRefs.length > 0 ? photoRefs : undefined,
          },
          count: 2,
          modelTier: 'flash',
        },
        'No se pudieron generar imágenes',
        ctx.signal,
      ),
    computePatch: (result) => {
      const base = propSheetOptionsRef.current;
      const merged = { ...base, [prop.id]: result.images };
      propSheetOptionsRef.current = merged;
      setPropSheetOptions(merged);

      // Regenerating a prop sheet invalidates any previously chosen candidate.
      setSelectedPropSheets((prev) => {
        if (prev[prop.id] === undefined) return prev;
        const next = { ...prev };
        delete next[prop.id];
        return next;
      });

      // Prop sheets are ephemeral by design: runner marks `done` without
      // invoking persist or the enqueueGeneratedSnapshot surface.
      return APPLY_EPHEMERAL;
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// =============================================================================
// 3) SCENE IMAGE — GENERATE
// =============================================================================

export interface SceneTaskInput
  extends CommonFactoryDeps,
    SceneImageRefs,
    CurrentStepRef {
  scene: StoryScene;
  /** Already-composed scene payload (visualDescription may be custom prompt). */
  sceneData: SceneRequestData;
  /** Characters filtered/mapped by getCharactersWithReferences. */
  charactersWithReferences: ReferenceCharacter[];
  location: StoryLocation | undefined;
  sceneReferenceImage: string | undefined;
  propsForScene: ReferenceProp[];
  illustrationStyle: string;
  /** `true` = append to existing options; `false` = replace + clear selection. */
  append: boolean;
}

export function makeSceneTask(
  input: SceneTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    scene,
    sceneData,
    charactersWithReferences,
    location,
    sceneReferenceImage,
    propsForScene,
    illustrationStyle,
    append,
    sceneImageOptionsRef,
    selectedSceneImagesRef,
    sceneReferenceModeRef,
    currentStepRef,
    setSceneImageOptions,
    setSelectedSceneImages,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: `scene-${scene.number}`,
    kind: 'scene',
    label: `Escena ${scene.number}`,
    provider: (ctx) =>
      invokeGenerateSceneImages(
        {
          type: 'scene',
          styleId: illustrationStyle,
          scene: sceneData,
          characters: charactersWithReferences,
          location,
          sceneReferenceImage,
          sceneReferenceMode: sceneReferenceModeRef.current[scene.number] ?? 'style',
          props: propsForScene.length > 0 ? propsForScene : undefined,
          count: 2,
          modelTier: 'flash',
        },
        'No se pudieron generar imágenes',
        ctx.signal,
      ),
    computePatch: (result) => {
      const base = sceneImageOptionsRef.current;
      const existingSceneOptions = append ? (base[scene.number] || []) : [];
      const nextOptions = {
        ...base,
        [scene.number]: [...existingSceneOptions, ...result.images],
      };
      sceneImageOptionsRef.current = nextOptions;
      setSceneImageOptions(nextOptions);

      let nextSelection = selectedSceneImagesRef.current;
      if (!append && nextSelection[scene.number] !== undefined) {
        nextSelection = { ...nextSelection };
        delete nextSelection[scene.number];
        selectedSceneImagesRef.current = nextSelection;
        setSelectedSceneImages(nextSelection);
      }

      return {
        currentStep: currentStepRef.current,
        sceneImageOptions: nextOptions,
        selectedSceneImages: nextSelection,
        sceneReferenceModes: sceneReferenceModeRef.current,
      };
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// =============================================================================
// 4) COVER — GENERATE
// =============================================================================

export interface CoverTaskInput extends CommonFactoryDeps, CoverRefs {
  illustrationStyle: string;
  title: string;
  protagonistVisualDescription: string;
  location: StoryLocation | undefined;
  charactersWithReferences: ReferenceCharacter[];
  coverReferenceImage: string | null;
  primaryProps: ReferenceProp[];
  customPrompt: string | undefined;
  /** `true` = append to existing options; `false` = replace + clear selection. */
  append: boolean;
  /**
   * PH/G2 — Setter de selección, exclusivo del GENERATE. Vive acá y no en
   * `CoverRefs` porque sólo la rama `!append` limpia la selección: el refine
   * reemplaza un slot por valor y preserva el índice a propósito.
   */
  setSelectedCover: Dispatch<SetStateAction<number | null>>;
}

export function makeCoverTask(
  input: CoverTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    illustrationStyle,
    title,
    protagonistVisualDescription,
    location,
    charactersWithReferences,
    coverReferenceImage,
    primaryProps,
    customPrompt,
    append,
    coverOptionsRef,
    selectedCoverRef,
    setCoverOptions,
    setSelectedCover,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: 'cover',
    kind: 'cover',
    label: 'Portada',
    provider: (ctx) =>
      invokeGenerateSceneImages(
        {
          type: 'cover',
          styleId: illustrationStyle,
          title,
          protagonist: { visualDescription: protagonistVisualDescription },
          location,
          characters: charactersWithReferences,
          sceneReferenceImage: coverReferenceImage ?? undefined,
          props: primaryProps.length > 0 ? primaryProps : undefined,
          customPrompt,
          count: 2,
          modelTier: 'pro',
        },
        'No se pudieron generar imágenes de portada',
        ctx.signal,
      ),
    computePatch: (result) => {
      // PH/G2 — Mismo patrón que sheets/scenes: la ref VIVA es la base del
      // append (el estado de React puede ir un render atrás), y se escribe
      // ANTES del setter para que cualquier lectura síncrona posterior
      // — `deriveNextStory` en el tail de la cola, el refine, un segundo
      // batch — vea ya el array completo.
      const existingOptions = append ? coverOptionsRef.current : [];
      const nextOptions = [...existingOptions, ...result.images];
      coverOptionsRef.current = nextOptions;
      setCoverOptions(nextOptions);

      // El append preserva la selección: extender por la derecha no invalida
      // ningún índice. El reemplazo sí, y dejar el índice viejo lo rebindea
      // en silencio a una imagen distinta.
      if (!append && selectedCoverRef.current !== null) {
        selectedCoverRef.current = null;
        setSelectedCover(null);
      }

      return { coverOptions: nextOptions };
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// =============================================================================
// 5) END — GENERATE
// =============================================================================

export interface EndTaskInput extends CommonFactoryDeps, EndRefs {
  illustrationStyle: string;
  endReferenceImage: string | undefined;
  charactersWithReferences: ReferenceCharacter[];
  customPrompt: string | undefined;
  /** `true` = append to existing options; `false` = replace + clear selection. */
  append: boolean;
  /** PH/G2 — Setter de selección, exclusivo del GENERATE (ver `CoverTaskInput`). */
  setSelectedEnd: Dispatch<SetStateAction<number | null>>;
}

export function makeEndTask(
  input: EndTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    illustrationStyle,
    endReferenceImage,
    charactersWithReferences,
    customPrompt,
    append,
    endOptionsRef,
    selectedEndRef,
    setEndOptions,
    setSelectedEnd,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: 'end',
    kind: 'end',
    label: 'Imagen final',
    provider: (ctx) =>
      invokeGenerateSceneImages(
        {
          type: 'end',
          styleId: illustrationStyle,
          referenceImage: endReferenceImage,
          characters:
            charactersWithReferences.length > 0 ? charactersWithReferences : undefined,
          customPrompt,
          count: 2,
          modelTier: 'pro',
        },
        'No se pudieron generar imágenes de fin',
        ctx.signal,
      ),
    computePatch: (result) => {
      // PH/G2 — Simétrico a `makeCoverTask`; ver el comentario de allá.
      const existingOptions = append ? endOptionsRef.current : [];
      const nextOptions = [...existingOptions, ...result.images];
      endOptionsRef.current = nextOptions;
      setEndOptions(nextOptions);

      if (!append && selectedEndRef.current !== null) {
        selectedEndRef.current = null;
        setSelectedEnd(null);
      }

      return { endOptions: nextOptions };
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// =============================================================================
// 6) CHARACTER SHEET — REFINE
// =============================================================================

export interface RefineCharacterSheetTaskInput
  extends CommonFactoryDeps,
    CharacterSheetRefs,
    CurrentStepRef {
  character: StoryCharacter;
  illustrationStyle: string;
  visualDescription: string;
  sourceImage: string;
  feedback: string;
}

export function makeRefineCharacterSheetTask(
  input: RefineCharacterSheetTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    character,
    illustrationStyle,
    visualDescription,
    sourceImage,
    feedback,
    characterSheetOptionsRef,
    selectedCharacterSheetsRef,
    currentStepRef,
    setCharacterSheetOptions,
    setSelectedCharacterSheets,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: `sheet-${character.id}`,
    kind: 'sheet',
    label: character.name,
    provider: (ctx) => {
      const body: GenerateSceneImagesCharacterRequest = {
        type: 'character',
        styleId: illustrationStyle,
        character: {
          name: character.name,
          description: character.description,
          visualDescription,
        },
        modelTier: 'pro',
        refine: { sourceImage, feedback },
      };
      return invokeGenerateSceneImages(body, 'No se pudo refinar el personaje', ctx.signal);
    },
    computePatch: (result) => {
      const refined = result.images[0];
      const existing = characterSheetOptionsRef.current[character.id] || [];
      const currentSelected = selectedCharacterSheetsRef.current[character.id];
      const slotIdx =
        typeof currentSelected === 'number' && existing[currentSelected] === sourceImage
          ? currentSelected
          : existing.findIndex((opt) => opt === sourceImage);
      // Slot not found: the source was already replaced by a newer write;
      // discard as stale so the runner leaves the item at `pending`.
      if (slotIdx < 0) return APPLY_STALE;

      const updated = existing.slice();
      updated[slotIdx] = refined;
      const newOptions = {
        ...characterSheetOptionsRef.current,
        [character.id]: updated,
      };
      const newSelection = {
        ...selectedCharacterSheetsRef.current,
        [character.id]: slotIdx,
      };
      characterSheetOptionsRef.current = newOptions;
      selectedCharacterSheetsRef.current = newSelection;
      setCharacterSheetOptions(newOptions);
      setSelectedCharacterSheets(newSelection);

      return {
        currentStep: currentStepRef.current,
        characterSheetOptions: newOptions,
        selectedCharacterSheets: newSelection,
      };
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// =============================================================================
// 7) SCENE — REFINE
// =============================================================================

export interface RefineSceneTaskInput
  extends CommonFactoryDeps,
    SceneImageRefs,
    CurrentStepRef {
  scene: StoryScene;
  sceneData: SceneRequestData;
  charactersWithReferences: ReferenceCharacter[];
  location: StoryLocation | undefined;
  sceneReferenceImage: string | undefined;
  propsForScene: ReferenceProp[];
  illustrationStyle: string;
  sourceImage: string;
  feedback: string;
}

export function makeRefineSceneTask(
  input: RefineSceneTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    scene,
    sceneData,
    charactersWithReferences,
    location,
    sceneReferenceImage,
    propsForScene,
    illustrationStyle,
    sourceImage,
    feedback,
    sceneImageOptionsRef,
    selectedSceneImagesRef,
    sceneReferenceModeRef,
    currentStepRef,
    setSceneImageOptions,
    setSelectedSceneImages,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  const capturedRefMode = sceneReferenceModeRef.current[scene.number] ?? 'style';

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: `scene-${scene.number}`,
    kind: 'scene',
    label: `Escena ${scene.number}`,
    provider: (ctx) => {
      const body: GenerateSceneImagesSceneRequest = {
        type: 'scene',
        styleId: illustrationStyle,
        scene: sceneData,
        characters: charactersWithReferences,
        location,
        sceneReferenceImage,
        sceneReferenceMode: capturedRefMode,
        props: propsForScene.length > 0 ? propsForScene : undefined,
        modelTier: 'pro',
        refine: { sourceImage, feedback },
      };
      return invokeGenerateSceneImages(body, 'No se pudo refinar la escena', ctx.signal);
    },
    computePatch: (result) => {
      const refined = result.images[0];
      const existing = sceneImageOptionsRef.current[scene.number] || [];
      const currentSelected = selectedSceneImagesRef.current[scene.number];
      const slotIdx =
        typeof currentSelected === 'number' && existing[currentSelected] === sourceImage
          ? currentSelected
          : existing.findIndex((opt) => opt === sourceImage);
      if (slotIdx < 0) return APPLY_STALE;

      const updated = existing.slice();
      updated[slotIdx] = refined;
      const newSceneOptions = {
        ...sceneImageOptionsRef.current,
        [scene.number]: updated,
      };
      const newSelection = {
        ...selectedSceneImagesRef.current,
        [scene.number]: slotIdx,
      };
      sceneImageOptionsRef.current = newSceneOptions;
      selectedSceneImagesRef.current = newSelection;
      setSceneImageOptions(newSceneOptions);
      setSelectedSceneImages(newSelection);

      return {
        currentStep: currentStepRef.current,
        sceneImageOptions: newSceneOptions,
        selectedSceneImages: newSelection,
        sceneReferenceModes: sceneReferenceModeRef.current,
      };
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// =============================================================================
// 8) COVER — REFINE
// =============================================================================

export interface RefineCoverTaskInput extends CommonFactoryDeps, CoverRefs {
  illustrationStyle: string;
  title: string;
  protagonistVisualDescription: string;
  location: StoryLocation | undefined;
  charactersWithReferences: ReferenceCharacter[];
  coverReferenceImage: string | undefined;
  primaryProps: ReferenceProp[];
  customPrompt: string | undefined;
  sourceImage: string;
  feedback: string;
}

export function makeRefineCoverTask(
  input: RefineCoverTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    illustrationStyle,
    title,
    protagonistVisualDescription,
    location,
    charactersWithReferences,
    coverReferenceImage,
    primaryProps,
    customPrompt,
    sourceImage,
    feedback,
    coverOptionsRef,
    selectedCoverRef,
    setCoverOptions,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: 'cover',
    kind: 'cover',
    label: 'Portada',
    provider: (ctx) => {
      const body: GenerateSceneImagesCoverRequest = {
        type: 'cover',
        styleId: illustrationStyle,
        title,
        protagonist: { visualDescription: protagonistVisualDescription },
        location,
        characters: charactersWithReferences,
        sceneReferenceImage: coverReferenceImage,
        props: primaryProps.length > 0 ? primaryProps : undefined,
        customPrompt,
        modelTier: 'pro',
        refine: { sourceImage, feedback },
      };
      return invokeGenerateSceneImages(body, 'No se pudo refinar la portada', ctx.signal);
    },
    computePatch: (result) => {
      const refined = result.images[0];
      const prev = coverOptionsRef.current;
      const selected = selectedCoverRef.current;
      const slotIdx =
        typeof selected === 'number' && prev[selected] === sourceImage
          ? selected
          : prev.findIndex((opt) => opt === sourceImage);
      if (slotIdx < 0) return APPLY_STALE;
      const nextOptions = prev.slice();
      nextOptions[slotIdx] = refined;
      coverOptionsRef.current = nextOptions;
      setCoverOptions(nextOptions);
      // Selection index intentionally preserved; no sibling derivation.
      return { coverOptions: nextOptions };
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// =============================================================================
// 9) END — REFINE
// =============================================================================

export interface RefineEndTaskInput extends CommonFactoryDeps, EndRefs {
  illustrationStyle: string;
  endReferenceImage: string | undefined;
  charactersWithReferences: ReferenceCharacter[];
  customPrompt: string | undefined;
  sourceImage: string;
  feedback: string;
}

export function makeRefineEndTask(
  input: RefineEndTaskInput,
): PipelineItemTask<ProviderResult, DraftPatch> {
  const {
    illustrationStyle,
    endReferenceImage,
    charactersWithReferences,
    customPrompt,
    sourceImage,
    feedback,
    endOptionsRef,
    selectedEndRef,
    setEndOptions,
    invokeGenerateSceneImages,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = input;

  return buildSnapshotTask<ProviderResult, DraftPatch>({
    id: 'end',
    kind: 'end',
    label: 'Imagen final',
    provider: (ctx) => {
      const body: GenerateSceneImagesEndRequest = {
        type: 'end',
        styleId: illustrationStyle,
        referenceImage: endReferenceImage,
        characters:
          charactersWithReferences.length > 0 ? charactersWithReferences : undefined,
        customPrompt,
        modelTier: 'pro',
        refine: { sourceImage, feedback },
      };
      return invokeGenerateSceneImages(body, 'No se pudo refinar la imagen final', ctx.signal);
    },
    computePatch: (result) => {
      const refined = result.images[0];
      const prev = endOptionsRef.current;
      const selected = selectedEndRef.current;
      const slotIdx =
        typeof selected === 'number' && prev[selected] === sourceImage
          ? selected
          : prev.findIndex((opt) => opt === sourceImage);
      if (slotIdx < 0) return APPLY_STALE;
      const nextOptions = prev.slice();
      nextOptions[slotIdx] = refined;
      endOptionsRef.current = nextOptions;
      setEndOptions(nextOptions);
      // Selection index intentionally preserved; no sibling derivation.
      return { endOptions: nextOptions };
    },
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  });
}

// -----------------------------------------------------------------------------
// Typed registry — lets callers (and tests) iterate the nine factories by kind.
// The map key uniquely identifies each of the nine production paths (five
// generates + four refines). The runner's `PipelineItemKind` is not unique
// here because `sheet`/`scene`/`cover`/`end` each appear in both generate and
// refine variants.
// -----------------------------------------------------------------------------

export type TaskFactoryKey =
  | 'characterSheet'
  | 'propSheet'
  | 'scene'
  | 'cover'
  | 'end'
  | 'refineCharacterSheet'
  | 'refineScene'
  | 'refineCover'
  | 'refineEnd';

export interface TaskFactoryMap {
  characterSheet: typeof makeCharacterSheetTask;
  propSheet: typeof makePropSheetTask;
  scene: typeof makeSceneTask;
  cover: typeof makeCoverTask;
  end: typeof makeEndTask;
  refineCharacterSheet: typeof makeRefineCharacterSheetTask;
  refineScene: typeof makeRefineSceneTask;
  refineCover: typeof makeRefineCoverTask;
  refineEnd: typeof makeRefineEndTask;
}

/** Registry of the nine production factories, keyed by unique path name. */
export const TASK_FACTORIES: TaskFactoryMap = {
  characterSheet: makeCharacterSheetTask,
  propSheet: makePropSheetTask,
  scene: makeSceneTask,
  cover: makeCoverTask,
  end: makeEndTask,
  refineCharacterSheet: makeRefineCharacterSheetTask,
  refineScene: makeRefineSceneTask,
  refineCover: makeRefineCoverTask,
  refineEnd: makeRefineEndTask,
};

/** Ordered list of the nine factory keys — for exhaustive iteration in tests. */
export const TASK_FACTORY_KEYS: readonly TaskFactoryKey[] = [
  'characterSheet',
  'propSheet',
  'scene',
  'cover',
  'end',
  'refineCharacterSheet',
  'refineScene',
  'refineCover',
  'refineEnd',
] as const;

/** Runner-level kind that each factory produces (some kinds appear twice). */
export const TASK_FACTORY_KIND: Readonly<Record<TaskFactoryKey, PipelineItemKind>> = {
  characterSheet: 'sheet',
  propSheet: 'prop',
  scene: 'scene',
  cover: 'cover',
  end: 'end',
  refineCharacterSheet: 'sheet',
  refineScene: 'scene',
  refineCover: 'cover',
  refineEnd: 'end',
};

// Re-export runtime sentinels so callers/tests import from a single module.
export { APPLY_EPHEMERAL, APPLY_STALE };
export type { AppliedIdentity };
