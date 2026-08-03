/**
 * A3a/S3 subtask 4 (F5) — Coverage for the nine production task factories used
 * by `CuentacuentoEditor` (5 generates + 4 refines).
 *
 * These tests import the EXACT same factories the editor imports from
 * `@/lib/cuentacuentos/taskFactories` — no closure copies live inside the test
 * file. Every one of the nine paths is enumerated (see `TASK_FACTORY_KEYS`).
 *
 * Per factory we verify:
 *   - Provider payload construction: the injected `invokeGenerateSceneImages`
 *     spy is called exactly once with the correctly-typed body.
 *   - apply behavior: the returned patch (or `APPLY_EPHEMERAL`) matches the
 *     production shape, editor refs are mutated, and setState spies fire.
 *   - Persistence behavior: apply NEVER calls `enqueueGeneratedSnapshot`;
 *     persist calls it exactly once with `provenance = {sourceRevision,
 *     contentHash: hashSnapshot(patch)}`.
 *   - Retry behavior via the real runner: `retrySaves` re-invokes persist and
 *     never re-invokes provider / apply / computePatch. The retained hash is
 *     preserved across retries.
 *   - Revision/hash provenance: the hash captured at apply is the deterministic
 *     `hashSnapshot(patch)` of the patch, and the sourceRevision propagates
 *     from `AppliedIdentity.generatedRevision` — verified per factory.
 *   - Identity guards: post-start `{storyId, epoch}` mismatch returns
 *     `APPLY_STALE`; computePatch never runs and the persistence surface is
 *     untouched.
 *   - PERSIST_STALE (A3a/S3 F3) propagation is preserved end-to-end when the
 *     draft hook signals `{stale: true}` — verified once via a representative
 *     factory since the wiring lives in `buildSnapshotTask` (shared by all
 *     nine).
 *   - No provider call escapes the injected spy — every factory receives its
 *     provider surface via dependency injection; there is no network, no
 *     Supabase, and no PII.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { describe, expect, it, vi } from 'vitest';

import {
  APPLY_EPHEMERAL,
  APPLY_STALE,
  createStoryImagePipelineRunner,
  type AppliedIdentity,
  type PipelineItemKind,
  type RunIdentity,
} from '@/hooks/storyImagePipelineRunner';
import type {
  DraftPatch,
  EnqueueGeneratedSnapshotInput,
} from '@/hooks/useCuentacuentosDraft';
import { hashSnapshot } from '@/lib/cuentacuentos/snapshotHash';
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
  TASK_FACTORIES,
  TASK_FACTORY_KEYS,
  TASK_FACTORY_KIND,
  type InvokeGenerateSceneImages,
  type ProviderResult,
  type TaskFactoryKey,
} from '@/lib/cuentacuentos/taskFactories';
import type { LocationInfo, StoryCharacter, StoryProp, StoryScene } from '@/types/shared/story';

// -----------------------------------------------------------------------------
// Registry-level invariants: the exported list must enumerate all nine
// production factories, each keyed to the pipeline kind the runner tracks.
// -----------------------------------------------------------------------------

describe('TASK_FACTORIES registry', () => {
  it('enumerates exactly the nine production factories', () => {
    expect(TASK_FACTORY_KEYS).toHaveLength(9);
    expect(new Set(TASK_FACTORY_KEYS).size).toBe(9);
    expect(TASK_FACTORY_KEYS).toEqual(
      expect.arrayContaining<TaskFactoryKey>([
        'characterSheet',
        'propSheet',
        'scene',
        'cover',
        'end',
        'refineCharacterSheet',
        'refineScene',
        'refineCover',
        'refineEnd',
      ]),
    );
  });

  it.each(TASK_FACTORY_KEYS)(
    'registry entry `%s` is a function and matches its expected runner kind',
    (key) => {
      expect(typeof TASK_FACTORIES[key]).toBe('function');
      expect(TASK_FACTORY_KIND[key]).toMatch(/^(sheet|scene|cover|end|prop)$/);
    },
  );
});

// -----------------------------------------------------------------------------
// Shared fixtures + helpers. `LIVE_IDENTITY` is what all factories treat as
// "same run"; mismatching it verifies the apply-time identity guard.
// -----------------------------------------------------------------------------

const LIVE_IDENTITY: RunIdentity = { storyId: 'story-A', epoch: 0 };

/** Applied identity handed to `apply` — carries the item id and revision. */
function makeAppliedIdentity(
  itemId: string,
  overrides: Partial<AppliedIdentity> = {},
): AppliedIdentity {
  return {
    storyId: LIVE_IDENTITY.storyId,
    epoch: LIVE_IDENTITY.epoch,
    itemId,
    generatedRevision: 3,
    ...overrides,
  };
}

/**
 * Minimal editor-state harness reused across factories. Each field is either
 * a MutableRefObject or a state setter spy — mirrors the shape the editor
 * passes to the factories.
 */
interface EditorHarness {
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
  setSelectedCover: Dispatch<SetStateAction<number | null>>;
  setSelectedEnd: Dispatch<SetStateAction<number | null>>;
}

function makeHarness(): EditorHarness {
  return {
    characterSheetOptionsRef: { current: {} },
    selectedCharacterSheetsRef: { current: {} },
    currentStepRef: { current: 'characters' as EditorCreationStep },
    propSheetOptionsRef: { current: {} },
    sceneImageOptionsRef: { current: {} },
    selectedSceneImagesRef: { current: {} },
    sceneReferenceModeRef: { current: {} },
    coverOptionsRef: { current: [] },
    selectedCoverRef: { current: null },
    endOptionsRef: { current: [] },
    selectedEndRef: { current: null },
    setCharacterSheetOptions: vi.fn(),
    setSelectedCharacterSheets: vi.fn(),
    setPropSheetOptions: vi.fn(),
    setSelectedPropSheets: vi.fn(),
    setSceneImageOptions: vi.fn(),
    setSelectedSceneImages: vi.fn(),
    setCoverOptions: vi.fn(),
    setEndOptions: vi.fn(),
    setSelectedCover: vi.fn(),
    setSelectedEnd: vi.fn(),
  };
}

function makeEnqueueSpy() {
  return vi.fn(async (_input: EnqueueGeneratedSnapshotInput) => undefined);
}

// Sample domain fixtures used by multiple factories.
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
  narrativeRole: 'guía a Ana en la cueva',
  visualDescription: 'linterna metálica plateada',
  referenceImages: [],
  role: 'primary',
};

const SCENE: StoryScene = {
  number: 1,
  text: 'Ana entra a la cueva.',
  visualDescription: 'Ana con linterna en cueva oscura',
  landmarkVisible: true,
};

const LOCATION: LocationInfo = {
  name: 'Chiloé',
  type: 'costa',
  description: 'Isla de mitos',
  visualElements: [],
  colors: [],
  lighting: 'natural',
};

// -----------------------------------------------------------------------------
// Per-factory verification. Each `describe.each` case exercises one of the
// nine factories via its production `make…Task` export.
// -----------------------------------------------------------------------------

describe('makeCharacterSheetTask (generate)', () => {
  it('provider posts a character body with count=2 modelTier=flash; apply mutates refs, returns patch with characterSheetOptions', async () => {
    const harness = makeHarness();
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['a.png', 'b.png'],
    } as ProviderResult));

    const task = makeCharacterSheetTask({
      character: CHARACTER,
      effectivePrompt: 'niña 6 años, pelo negro',
      append: false,
      illustrationStyle: 'ghibli',
      characterSheetOptionsRef: harness.characterSheetOptionsRef,
      selectedCharacterSheetsRef: harness.selectedCharacterSheetsRef,
      currentStepRef: harness.currentStepRef,
      setCharacterSheetOptions: harness.setCharacterSheetOptions,
      setSelectedCharacterSheets: harness.setSelectedCharacterSheets,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });

    expect(task.id).toBe('sheet-char-1');
    expect(task.kind).toBe<PipelineItemKind>('sheet');

    const result = await task.provider!({} as never);
    expect(invoke).toHaveBeenCalledTimes(1);
    const [body, fallback] = invoke.mock.calls[0];
    expect(body).toMatchObject({
      type: 'character',
      styleId: 'ghibli',
      character: {
        name: 'Ana',
        description: 'niña curiosa',
        visualDescription: 'niña 6 años, pelo negro',
      },
      count: 2,
      modelTier: 'flash',
    });
    expect(fallback).toBe('No se pudieron generar imágenes');

    const applied = makeAppliedIdentity('sheet-char-1');
    const patch = task.apply!(result, applied);
    expect(patch).toEqual({
      currentStep: 'characters',
      characterSheetOptions: { 'char-1': ['a.png', 'b.png'] },
      selectedCharacterSheets: {},
    });
    expect(harness.characterSheetOptionsRef.current).toEqual({
      'char-1': ['a.png', 'b.png'],
    });
    expect(harness.setCharacterSheetOptions).toHaveBeenCalledWith({
      'char-1': ['a.png', 'b.png'],
    });
    expect(enqueue).not.toHaveBeenCalled();

    await task.persist!(patch as DraftPatch, applied);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0].provenance?.sourceRevision).toBe(3);
    expect(enqueue.mock.calls[0][0].provenance?.contentHash).toBe(
      hashSnapshot(patch as DraftPatch),
    );
  });
});

describe('makePropSheetTask (generate — ephemeral)', () => {
  it('provider posts a prop body with dedup photoRefs; apply returns APPLY_EPHEMERAL and never persists', async () => {
    const harness = makeHarness();
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['p1.png', 'p2.png'],
    } as ProviderResult));

    const task = makePropSheetTask({
      prop: PROP,
      illustrationStyle: 'storybook',
      photoRefs: ['user-photo.jpg'],
      propSheetOptionsRef: harness.propSheetOptionsRef,
      setPropSheetOptions: harness.setPropSheetOptions,
      setSelectedPropSheets: harness.setSelectedPropSheets,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    expect(task.id).toBe('prop-prop-1');
    expect(task.kind).toBe<PipelineItemKind>('prop');

    const result = await task.provider!({} as never);
    expect(invoke.mock.calls[0][0]).toMatchObject({
      type: 'prop',
      styleId: 'storybook',
      prop: {
        name: 'linterna',
        kind: 'prop',
        visualDescription: 'linterna metálica plateada',
        referenceImages: ['user-photo.jpg'],
      },
      count: 2,
      modelTier: 'flash',
    });

    const outcome = task.apply!(result, makeAppliedIdentity('prop-prop-1'));
    expect(outcome).toBe(APPLY_EPHEMERAL);
    expect(harness.propSheetOptionsRef.current).toEqual({
      'prop-1': ['p1.png', 'p2.png'],
    });
    expect(harness.setPropSheetOptions).toHaveBeenCalledWith({
      'prop-1': ['p1.png', 'p2.png'],
    });
    // Runner never invokes persist when apply returns APPLY_EPHEMERAL, and the
    // persistence spy is proof — see the runner-level assertion below.
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('omits referenceImages when no photoRefs are supplied', async () => {
    const harness = makeHarness();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['p1.png', 'p2.png'],
    } as ProviderResult));
    const task = makePropSheetTask({
      prop: PROP,
      illustrationStyle: 'ghibli',
      photoRefs: [],
      propSheetOptionsRef: harness.propSheetOptionsRef,
      setPropSheetOptions: harness.setPropSheetOptions,
      setSelectedPropSheets: harness.setSelectedPropSheets,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: makeEnqueueSpy(),
    });
    await task.provider!({} as never);
    const body = invoke.mock.calls[0][0] as Record<string, unknown>;
    expect((body.prop as Record<string, unknown>).referenceImages).toBeUndefined();
  });
});

describe('makeSceneTask (generate)', () => {
  it('provider posts scene body with sceneReferenceMode and props; apply mutates ref + setState', async () => {
    const harness = makeHarness();
    harness.sceneReferenceModeRef.current = { 1: 'pov' };
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['s1.png', 's2.png'],
    } as ProviderResult));

    const task = makeSceneTask({
      scene: SCENE,
      sceneData: {
        text: SCENE.text,
        visualDescription: SCENE.visualDescription,
        landmarkVisible: true,
      },
      charactersWithReferences: [
        { name: 'Ana', visualDescription: 'niña 6 años', referenceImage: 'ref.png' },
      ],
      location: LOCATION,
      sceneReferenceImage: 'scene-ref.png',
      propsForScene: [
        { name: 'linterna', visualDescription: 'linterna metálica', referenceImages: [] },
      ],
      illustrationStyle: 'watercolor',
      append: false,
      sceneImageOptionsRef: harness.sceneImageOptionsRef,
      selectedSceneImagesRef: harness.selectedSceneImagesRef,
      sceneReferenceModeRef: harness.sceneReferenceModeRef,
      currentStepRef: harness.currentStepRef,
      setSceneImageOptions: harness.setSceneImageOptions,
      setSelectedSceneImages: harness.setSelectedSceneImages,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    expect(task.id).toBe('scene-1');
    expect(task.kind).toBe<PipelineItemKind>('scene');

    const result = await task.provider!({} as never);
    const body = invoke.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({
      type: 'scene',
      styleId: 'watercolor',
      scene: { text: SCENE.text, visualDescription: SCENE.visualDescription, landmarkVisible: true },
      location: LOCATION,
      sceneReferenceImage: 'scene-ref.png',
      sceneReferenceMode: 'pov',
      count: 2,
      modelTier: 'flash',
    });
    expect(Array.isArray(body.props)).toBe(true);
    expect((body.props as unknown[]).length).toBe(1);

    const applied = makeAppliedIdentity('scene-1');
    const patch = task.apply!(result, applied) as DraftPatch;
    expect(patch).toEqual({
      currentStep: 'characters',
      sceneImageOptions: { 1: ['s1.png', 's2.png'] },
      selectedSceneImages: {},
      sceneReferenceModes: { 1: 'pov' },
    });
    expect(harness.sceneImageOptionsRef.current).toEqual({ 1: ['s1.png', 's2.png'] });
    expect(enqueue).not.toHaveBeenCalled();

    await task.persist!(patch, applied);
    expect(enqueue.mock.calls[0][0].provenance?.contentHash).toBe(hashSnapshot(patch));
    expect(enqueue.mock.calls[0][0].provenance?.sourceRevision).toBe(3);
  });

  it('append=true appends to existing options and does NOT clear selection', () => {
    const harness = makeHarness();
    harness.sceneImageOptionsRef.current = { 1: ['pre.png'] };
    harness.selectedSceneImagesRef.current = { 1: 0 };
    const task = makeSceneTask({
      scene: SCENE,
      sceneData: {
        text: SCENE.text,
        visualDescription: SCENE.visualDescription,
        landmarkVisible: true,
      },
      charactersWithReferences: [],
      location: LOCATION,
      sceneReferenceImage: undefined,
      propsForScene: [],
      illustrationStyle: 'ghibli',
      append: true,
      sceneImageOptionsRef: harness.sceneImageOptionsRef,
      selectedSceneImagesRef: harness.selectedSceneImagesRef,
      sceneReferenceModeRef: harness.sceneReferenceModeRef,
      currentStepRef: harness.currentStepRef,
      setSceneImageOptions: harness.setSceneImageOptions,
      setSelectedSceneImages: harness.setSelectedSceneImages,
      invokeGenerateSceneImages: vi.fn(),
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: makeEnqueueSpy(),
    });
    const patch = task.apply!(
      { success: true, images: ['new.png'] },
      makeAppliedIdentity('scene-1'),
    ) as DraftPatch;
    expect(patch.sceneImageOptions).toEqual({ 1: ['pre.png', 'new.png'] });
    expect(patch.selectedSceneImages).toEqual({ 1: 0 });
    expect(harness.setSelectedSceneImages).not.toHaveBeenCalled();
  });
});

describe('makeCoverTask (generate)', () => {
  it('provider posts cover body with count=2 modelTier=pro; apply sets coverOptions', async () => {
    const harness = makeHarness();
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['c1.png', 'c2.png', 'c3.png', 'c4.png'],
    } as ProviderResult));

    const task = makeCoverTask({
      illustrationStyle: 'pixar',
      title: 'La Cueva de Chiloé',
      protagonistVisualDescription: 'niña 6 años, pelo negro',
      location: LOCATION,
      charactersWithReferences: [
        { name: 'Ana', visualDescription: 'niña 6 años', referenceImage: 'ref.png' },
      ],
      coverReferenceImage: 'cover-ref.png',
      primaryProps: [
        { name: 'linterna', visualDescription: 'linterna metálica', referenceImages: [] },
      ],
      customPrompt: 'portada de aventura',
      append: false,
      coverOptionsRef: harness.coverOptionsRef,
      selectedCoverRef: harness.selectedCoverRef,
      setCoverOptions: harness.setCoverOptions,
      setSelectedCover: harness.setSelectedCover,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    expect(task.id).toBe('cover');
    expect(task.kind).toBe<PipelineItemKind>('cover');

    const result = await task.provider!({} as never);
    expect(invoke.mock.calls[0][0]).toMatchObject({
      type: 'cover',
      styleId: 'pixar',
      title: 'La Cueva de Chiloé',
      protagonist: { visualDescription: 'niña 6 años, pelo negro' },
      location: LOCATION,
      sceneReferenceImage: 'cover-ref.png',
      customPrompt: 'portada de aventura',
      count: 2,
      modelTier: 'pro',
    });

    const applied = makeAppliedIdentity('cover');
    const patch = task.apply!(result, applied) as DraftPatch;
    // PH/G6 — el generate lleva también la clave de selección: `append:false` con
    // la ref en `null` ⇒ `null` explícito. (El refine NO la lleva; ver abajo.)
    expect(patch).toEqual({
      coverOptions: ['c1.png', 'c2.png', 'c3.png', 'c4.png'],
      selectedCover: null,
    });
    expect(harness.setCoverOptions).toHaveBeenCalledWith([
      'c1.png',
      'c2.png',
      'c3.png',
      'c4.png',
    ]);

    await task.persist!(patch, applied);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0].provenance?.contentHash).toBe(hashSnapshot(patch));
  });
});

describe('makeEndTask (generate)', () => {
  it('provider posts end body with count=2 modelTier=pro; omits characters when empty', async () => {
    const harness = makeHarness();
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['e1.png', 'e2.png', 'e3.png', 'e4.png'],
    } as ProviderResult));

    const task = makeEndTask({
      illustrationStyle: 'folk-art',
      endReferenceImage: 'end-ref.png',
      charactersWithReferences: [],
      customPrompt: 'atmósfera nocturna',
      append: false,
      endOptionsRef: harness.endOptionsRef,
      selectedEndRef: harness.selectedEndRef,
      setEndOptions: harness.setEndOptions,
      setSelectedEnd: harness.setSelectedEnd,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    expect(task.id).toBe('end');
    expect(task.kind).toBe<PipelineItemKind>('end');

    const result = await task.provider!({} as never);
    const body = invoke.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({
      type: 'end',
      styleId: 'folk-art',
      referenceImage: 'end-ref.png',
      customPrompt: 'atmósfera nocturna',
      count: 2,
      modelTier: 'pro',
    });
    expect(body.characters).toBeUndefined();

    const applied = makeAppliedIdentity('end');
    const patch = task.apply!(result, applied) as DraftPatch;
    // PH/G6 — simétrico a la portada.
    expect(patch).toEqual({
      endOptions: ['e1.png', 'e2.png', 'e3.png', 'e4.png'],
      selectedEnd: null,
    });
    expect(harness.setEndOptions).toHaveBeenCalled();
    await task.persist!(patch, applied);
    expect(enqueue.mock.calls[0][0].provenance?.contentHash).toBe(hashSnapshot(patch));
  });
});

describe('makeRefineCharacterSheetTask', () => {
  it('provider posts modelTier=pro with refine payload; apply replaces selected slot in place', async () => {
    const harness = makeHarness();
    harness.characterSheetOptionsRef.current = { 'char-1': ['old-a.png', 'old-b.png'] };
    harness.selectedCharacterSheetsRef.current = { 'char-1': 1 };
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['refined.png'],
    } as ProviderResult));

    const task = makeRefineCharacterSheetTask({
      character: CHARACTER,
      illustrationStyle: 'ghibli',
      visualDescription: 'niña 6 años, pelo negro',
      sourceImage: 'old-b.png',
      feedback: 'más luz',
      characterSheetOptionsRef: harness.characterSheetOptionsRef,
      selectedCharacterSheetsRef: harness.selectedCharacterSheetsRef,
      currentStepRef: harness.currentStepRef,
      setCharacterSheetOptions: harness.setCharacterSheetOptions,
      setSelectedCharacterSheets: harness.setSelectedCharacterSheets,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    expect(task.id).toBe('sheet-char-1');
    expect(task.kind).toBe<PipelineItemKind>('sheet');

    const result = await task.provider!({} as never);
    expect(invoke.mock.calls[0][0]).toMatchObject({
      type: 'character',
      modelTier: 'pro',
      refine: { sourceImage: 'old-b.png', feedback: 'más luz' },
    });

    const applied = makeAppliedIdentity('sheet-char-1');
    const patch = task.apply!(result, applied) as DraftPatch;
    expect(patch).toEqual({
      currentStep: 'characters',
      characterSheetOptions: { 'char-1': ['old-a.png', 'refined.png'] },
      selectedCharacterSheets: { 'char-1': 1 },
    });
    expect(harness.characterSheetOptionsRef.current).toEqual({
      'char-1': ['old-a.png', 'refined.png'],
    });
    await task.persist!(patch, applied);
    expect(enqueue.mock.calls[0][0].provenance?.contentHash).toBe(hashSnapshot(patch));
  });

  it('returns APPLY_STALE when the source slot is gone (post-refine race)', () => {
    const harness = makeHarness();
    harness.characterSheetOptionsRef.current = { 'char-1': ['other.png'] };
    const invoke = vi.fn<InvokeGenerateSceneImages>();
    const task = makeRefineCharacterSheetTask({
      character: CHARACTER,
      illustrationStyle: 'ghibli',
      visualDescription: 'niña 6 años',
      sourceImage: 'missing.png',
      feedback: 'más luz',
      characterSheetOptionsRef: harness.characterSheetOptionsRef,
      selectedCharacterSheetsRef: harness.selectedCharacterSheetsRef,
      currentStepRef: harness.currentStepRef,
      setCharacterSheetOptions: harness.setCharacterSheetOptions,
      setSelectedCharacterSheets: harness.setSelectedCharacterSheets,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: makeEnqueueSpy(),
    });
    const outcome = task.apply!(
      { success: true, images: ['refined.png'] },
      makeAppliedIdentity('sheet-char-1'),
    );
    expect(outcome).toBe(APPLY_STALE);
    expect(harness.setCharacterSheetOptions).not.toHaveBeenCalled();
  });
});

describe('makeRefineSceneTask', () => {
  it('provider posts scene body with refine payload; apply replaces the selected slot and preserves selection index', async () => {
    const harness = makeHarness();
    harness.sceneImageOptionsRef.current = { 1: ['s-a.png', 's-b.png'] };
    harness.selectedSceneImagesRef.current = { 1: 0 };
    harness.sceneReferenceModeRef.current = { 1: 'style' };
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['s-refined.png'],
    } as ProviderResult));

    const task = makeRefineSceneTask({
      scene: SCENE,
      sceneData: {
        text: SCENE.text,
        visualDescription: SCENE.visualDescription,
        landmarkVisible: true,
      },
      charactersWithReferences: [],
      location: LOCATION,
      sceneReferenceImage: undefined,
      propsForScene: [],
      illustrationStyle: 'anime-soft',
      sourceImage: 's-a.png',
      feedback: 'menos oscuro',
      sceneImageOptionsRef: harness.sceneImageOptionsRef,
      selectedSceneImagesRef: harness.selectedSceneImagesRef,
      sceneReferenceModeRef: harness.sceneReferenceModeRef,
      currentStepRef: harness.currentStepRef,
      setSceneImageOptions: harness.setSceneImageOptions,
      setSelectedSceneImages: harness.setSelectedSceneImages,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });

    const result = await task.provider!({} as never);
    expect(invoke.mock.calls[0][0]).toMatchObject({
      type: 'scene',
      modelTier: 'pro',
      refine: { sourceImage: 's-a.png', feedback: 'menos oscuro' },
      sceneReferenceMode: 'style',
    });

    const applied = makeAppliedIdentity('scene-1');
    const patch = task.apply!(result, applied) as DraftPatch;
    expect(patch).toMatchObject({
      currentStep: 'characters',
      sceneImageOptions: { 1: ['s-refined.png', 's-b.png'] },
      selectedSceneImages: { 1: 0 },
    });
    await task.persist!(patch, applied);
    expect(enqueue.mock.calls[0][0].provenance?.contentHash).toBe(hashSnapshot(patch));
  });

  it('returns APPLY_STALE when the source is gone', () => {
    const harness = makeHarness();
    harness.sceneImageOptionsRef.current = { 1: ['other.png'] };
    const task = makeRefineSceneTask({
      scene: SCENE,
      sceneData: {
        text: SCENE.text,
        visualDescription: SCENE.visualDescription,
      },
      charactersWithReferences: [],
      location: undefined,
      sceneReferenceImage: undefined,
      propsForScene: [],
      illustrationStyle: 'ghibli',
      sourceImage: 'missing.png',
      feedback: 'x',
      sceneImageOptionsRef: harness.sceneImageOptionsRef,
      selectedSceneImagesRef: harness.selectedSceneImagesRef,
      sceneReferenceModeRef: harness.sceneReferenceModeRef,
      currentStepRef: harness.currentStepRef,
      setSceneImageOptions: harness.setSceneImageOptions,
      setSelectedSceneImages: harness.setSelectedSceneImages,
      invokeGenerateSceneImages: vi.fn(),
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: makeEnqueueSpy(),
    });
    expect(
      task.apply!(
        { success: true, images: ['refined.png'] },
        makeAppliedIdentity('scene-1'),
      ),
    ).toBe(APPLY_STALE);
  });
});

describe('makeRefineCoverTask', () => {
  it('provider posts cover body with refine payload; apply replaces the selected slot; preserves selection', async () => {
    const harness = makeHarness();
    harness.coverOptionsRef.current = ['cov-a.png', 'cov-b.png'];
    harness.selectedCoverRef.current = 1;
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['cov-refined.png'],
    } as ProviderResult));

    const task = makeRefineCoverTask({
      illustrationStyle: 'disney-classic',
      title: 'Cuento',
      protagonistVisualDescription: 'niña 6 años',
      location: LOCATION,
      charactersWithReferences: [],
      coverReferenceImage: undefined,
      primaryProps: [],
      customPrompt: undefined,
      sourceImage: 'cov-b.png',
      feedback: 'brillante',
      coverOptionsRef: harness.coverOptionsRef,
      selectedCoverRef: harness.selectedCoverRef,
      setCoverOptions: harness.setCoverOptions,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    const result = await task.provider!({} as never);
    expect(invoke.mock.calls[0][0]).toMatchObject({
      type: 'cover',
      modelTier: 'pro',
      refine: { sourceImage: 'cov-b.png', feedback: 'brillante' },
    });

    const applied = makeAppliedIdentity('cover');
    const patch = task.apply!(result, applied) as DraftPatch;
    expect(patch).toEqual({ coverOptions: ['cov-a.png', 'cov-refined.png'] });
    // Selection index preserved.
    expect(harness.selectedCoverRef.current).toBe(1);
    await task.persist!(patch, applied);
    expect(enqueue.mock.calls[0][0].provenance?.contentHash).toBe(hashSnapshot(patch));
  });

  it('returns APPLY_STALE when the source is gone', () => {
    const harness = makeHarness();
    harness.coverOptionsRef.current = ['other.png'];
    const task = makeRefineCoverTask({
      illustrationStyle: 'ghibli',
      title: 'x',
      protagonistVisualDescription: 'y',
      location: undefined,
      charactersWithReferences: [],
      coverReferenceImage: undefined,
      primaryProps: [],
      customPrompt: undefined,
      sourceImage: 'missing.png',
      feedback: 'x',
      coverOptionsRef: harness.coverOptionsRef,
      selectedCoverRef: harness.selectedCoverRef,
      setCoverOptions: harness.setCoverOptions,
      invokeGenerateSceneImages: vi.fn(),
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: makeEnqueueSpy(),
    });
    expect(
      task.apply!(
        { success: true, images: ['refined.png'] },
        makeAppliedIdentity('cover'),
      ),
    ).toBe(APPLY_STALE);
  });
});

describe('makeRefineEndTask', () => {
  it('provider posts end body with refine payload; apply replaces the selected slot; preserves selection', async () => {
    const harness = makeHarness();
    harness.endOptionsRef.current = ['end-a.png', 'end-b.png'];
    harness.selectedEndRef.current = 0;
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['end-refined.png'],
    } as ProviderResult));

    const task = makeRefineEndTask({
      illustrationStyle: 'eric-carle',
      endReferenceImage: undefined,
      charactersWithReferences: [
        { name: 'Ana', visualDescription: 'niña 6 años', referenceImage: 'ref.png' },
      ],
      customPrompt: undefined,
      sourceImage: 'end-a.png',
      feedback: 'suave',
      endOptionsRef: harness.endOptionsRef,
      selectedEndRef: harness.selectedEndRef,
      setEndOptions: harness.setEndOptions,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    const result = await task.provider!({} as never);
    expect(invoke.mock.calls[0][0]).toMatchObject({
      type: 'end',
      modelTier: 'pro',
      refine: { sourceImage: 'end-a.png', feedback: 'suave' },
    });

    const applied = makeAppliedIdentity('end');
    const patch = task.apply!(result, applied) as DraftPatch;
    expect(patch).toEqual({ endOptions: ['end-refined.png', 'end-b.png'] });
    expect(harness.selectedEndRef.current).toBe(0);
    await task.persist!(patch, applied);
    expect(enqueue.mock.calls[0][0].provenance?.contentHash).toBe(hashSnapshot(patch));
  });

  it('returns APPLY_STALE when the source is gone', () => {
    const harness = makeHarness();
    harness.endOptionsRef.current = ['other.png'];
    const task = makeRefineEndTask({
      illustrationStyle: 'ghibli',
      endReferenceImage: undefined,
      charactersWithReferences: [],
      customPrompt: undefined,
      sourceImage: 'missing.png',
      feedback: 'x',
      endOptionsRef: harness.endOptionsRef,
      selectedEndRef: harness.selectedEndRef,
      setEndOptions: harness.setEndOptions,
      invokeGenerateSceneImages: vi.fn(),
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: makeEnqueueSpy(),
    });
    expect(
      task.apply!(
        { success: true, images: ['refined.png'] },
        makeAppliedIdentity('end'),
      ),
    ).toBe(APPLY_STALE);
  });
});

// -----------------------------------------------------------------------------
// Cross-factory: identity guard. Every generate factory must return
// APPLY_STALE when the live identity has drifted since the run started, and
// must NOT touch the persistence surface.
// -----------------------------------------------------------------------------

interface GuardCase {
  key: TaskFactoryKey;
  itemId: string;
  build: (
    harness: EditorHarness,
    services: {
      invoke: ReturnType<typeof vi.fn<InvokeGenerateSceneImages>>;
      getLiveIdentity: () => RunIdentity;
      enqueueGeneratedSnapshot: ReturnType<typeof makeEnqueueSpy>;
    },
  ) => ReturnType<typeof makeCharacterSheetTask>;
}

const GUARD_CASES: GuardCase[] = [
  {
    key: 'characterSheet',
    itemId: 'sheet-char-1',
    build: (h, s) =>
      makeCharacterSheetTask({
        character: CHARACTER,
        effectivePrompt: 'x',
        append: false,
        illustrationStyle: 'ghibli',
        characterSheetOptionsRef: h.characterSheetOptionsRef,
        selectedCharacterSheetsRef: h.selectedCharacterSheetsRef,
        currentStepRef: h.currentStepRef,
        setCharacterSheetOptions: h.setCharacterSheetOptions,
        setSelectedCharacterSheets: h.setSelectedCharacterSheets,
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
  {
    key: 'propSheet',
    itemId: 'prop-prop-1',
    build: (h, s) =>
      makePropSheetTask({
        prop: PROP,
        illustrationStyle: 'ghibli',
        photoRefs: [],
        propSheetOptionsRef: h.propSheetOptionsRef,
        setPropSheetOptions: h.setPropSheetOptions,
        setSelectedPropSheets: h.setSelectedPropSheets,
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
  {
    key: 'scene',
    itemId: 'scene-1',
    build: (h, s) =>
      makeSceneTask({
        scene: SCENE,
        sceneData: { text: 'x', visualDescription: 'y' },
        charactersWithReferences: [],
        location: undefined,
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
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
  {
    key: 'cover',
    itemId: 'cover',
    build: (h, s) =>
      makeCoverTask({
        illustrationStyle: 'ghibli',
        title: 'x',
        protagonistVisualDescription: 'y',
        location: undefined,
        charactersWithReferences: [],
        coverReferenceImage: null,
        primaryProps: [],
        customPrompt: undefined,
        append: false,
        coverOptionsRef: h.coverOptionsRef,
        selectedCoverRef: h.selectedCoverRef,
        setCoverOptions: h.setCoverOptions,
        setSelectedCover: h.setSelectedCover,
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
  {
    key: 'end',
    itemId: 'end',
    build: (h, s) =>
      makeEndTask({
        illustrationStyle: 'ghibli',
        endReferenceImage: undefined,
        charactersWithReferences: [],
        customPrompt: undefined,
        append: false,
        endOptionsRef: h.endOptionsRef,
        selectedEndRef: h.selectedEndRef,
        setEndOptions: h.setEndOptions,
        setSelectedEnd: h.setSelectedEnd,
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
  {
    key: 'refineCharacterSheet',
    itemId: 'sheet-char-1',
    build: (h, s) =>
      makeRefineCharacterSheetTask({
        character: CHARACTER,
        illustrationStyle: 'ghibli',
        visualDescription: 'x',
        sourceImage: 'src.png',
        feedback: 'x',
        characterSheetOptionsRef: h.characterSheetOptionsRef,
        selectedCharacterSheetsRef: h.selectedCharacterSheetsRef,
        currentStepRef: h.currentStepRef,
        setCharacterSheetOptions: h.setCharacterSheetOptions,
        setSelectedCharacterSheets: h.setSelectedCharacterSheets,
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
  {
    key: 'refineScene',
    itemId: 'scene-1',
    build: (h, s) =>
      makeRefineSceneTask({
        scene: SCENE,
        sceneData: { text: 'x', visualDescription: 'y' },
        charactersWithReferences: [],
        location: undefined,
        sceneReferenceImage: undefined,
        propsForScene: [],
        illustrationStyle: 'ghibli',
        sourceImage: 'src.png',
        feedback: 'x',
        sceneImageOptionsRef: h.sceneImageOptionsRef,
        selectedSceneImagesRef: h.selectedSceneImagesRef,
        sceneReferenceModeRef: h.sceneReferenceModeRef,
        currentStepRef: h.currentStepRef,
        setSceneImageOptions: h.setSceneImageOptions,
        setSelectedSceneImages: h.setSelectedSceneImages,
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
  {
    key: 'refineCover',
    itemId: 'cover',
    build: (h, s) =>
      makeRefineCoverTask({
        illustrationStyle: 'ghibli',
        title: 'x',
        protagonistVisualDescription: 'y',
        location: undefined,
        charactersWithReferences: [],
        coverReferenceImage: undefined,
        primaryProps: [],
        customPrompt: undefined,
        sourceImage: 'src.png',
        feedback: 'x',
        coverOptionsRef: h.coverOptionsRef,
        selectedCoverRef: h.selectedCoverRef,
        setCoverOptions: h.setCoverOptions,
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
  {
    key: 'refineEnd',
    itemId: 'end',
    build: (h, s) =>
      makeRefineEndTask({
        illustrationStyle: 'ghibli',
        endReferenceImage: undefined,
        charactersWithReferences: [],
        customPrompt: undefined,
        sourceImage: 'src.png',
        feedback: 'x',
        endOptionsRef: h.endOptionsRef,
        selectedEndRef: h.selectedEndRef,
        setEndOptions: h.setEndOptions,
        invokeGenerateSceneImages: s.invoke,
        getLiveIdentity: s.getLiveIdentity,
        enqueueGeneratedSnapshot: s.enqueueGeneratedSnapshot,
      }),
  },
];

describe('identity-guard: every factory returns APPLY_STALE when the live identity drifted', () => {
  it.each(GUARD_CASES)('$key returns APPLY_STALE on storyId mismatch — persistence untouched', ({ itemId, build }) => {
    const harness = makeHarness();
    const invoke = vi.fn<InvokeGenerateSceneImages>();
    const enqueue = makeEnqueueSpy();
    const task = build(harness, {
      invoke,
      // Live identity has moved to a different story.
      getLiveIdentity: () => ({ storyId: 'story-B', epoch: 0 }),
      enqueueGeneratedSnapshot: enqueue,
    });
    const outcome = task.apply!(
      { success: true, images: ['x.png', 'y.png'] },
      makeAppliedIdentity(itemId),
    );
    expect(outcome).toBe(APPLY_STALE);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it.each(GUARD_CASES)('$key returns APPLY_STALE on epoch mismatch — persistence untouched', ({ itemId, build }) => {
    const harness = makeHarness();
    const invoke = vi.fn<InvokeGenerateSceneImages>();
    const enqueue = makeEnqueueSpy();
    const task = build(harness, {
      invoke,
      // Live identity is same story but a new epoch (fresh draft cycle).
      getLiveIdentity: () => ({ storyId: LIVE_IDENTITY.storyId, epoch: 1 }),
      enqueueGeneratedSnapshot: enqueue,
    });
    const outcome = task.apply!(
      { success: true, images: ['x.png', 'y.png'] },
      makeAppliedIdentity(itemId),
    );
    expect(outcome).toBe(APPLY_STALE);
    expect(enqueue).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Save-only retry via the real runner: for each persist-bearing factory, first
// persist fails; retrySaves re-invokes persist with the same hash but does NOT
// re-invoke provider / apply / computePatch.
// -----------------------------------------------------------------------------

const RETRY_CASES = GUARD_CASES.filter((c) => c.key !== 'propSheet');

describe('save-only retry: every persist-bearing factory reuses the captured hash and never regenerates', () => {
  it.each(RETRY_CASES)('$key: retrySaves re-invokes persist with the same contentHash — provider stays at zero after initial run', async ({ itemId, build }) => {
    const harness = makeHarness();
    // Seed refs so refine factories can locate the source slot.
    harness.characterSheetOptionsRef.current = { 'char-1': ['src.png'] };
    harness.selectedCharacterSheetsRef.current = { 'char-1': 0 };
    harness.sceneImageOptionsRef.current = { 1: ['src.png'] };
    harness.selectedSceneImagesRef.current = { 1: 0 };
    harness.coverOptionsRef.current = ['src.png'];
    harness.selectedCoverRef.current = 0;
    harness.endOptionsRef.current = ['src.png'];
    harness.selectedEndRef.current = 0;

    let persistCall = 0;
    const enqueue = vi.fn(async (_input: EnqueueGeneratedSnapshotInput) => {
      persistCall++;
      if (persistCall < 2) throw new Error('io down'); // initial failure
    });
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['g1.png', 'g2.png'],
    } as ProviderResult));

    const runner = createStoryImagePipelineRunner({
      staggerMs: 0,
      providerAttempts: 1,
    });
    const task = build(harness, {
      invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });

    await runner.runItems({ tasks: [task], identity: LIVE_IDENTITY });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(runner.statusOf(itemId)).toBe('save-failed');

    const entry = runner
      .getSaveRetryRegistry()
      .getLatestForItem(LIVE_IDENTITY.storyId, LIVE_IDENTITY.epoch, itemId)!;
    const capturedHash = entry.provenance.contentHash;
    expect(entry.provenance.sourceRevision).toBe(entry.identity.generatedRevision);

    await runner.retrySaves(LIVE_IDENTITY);
    // Provider never re-runs on save-only retry.
    expect(invoke).toHaveBeenCalledTimes(1);
    // Persist ran a second time and carried the SAME captured hash.
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[1][0].provenance?.contentHash).toBe(capturedHash);
    expect(runner.statusOf(itemId)).toBe('done');
    expect(runner.saveFailedCount()).toBe(0);
  });

  it('propSheet: apply=APPLY_EPHEMERAL — runner marks done without calling persist, no retry entry', async () => {
    const runner = createStoryImagePipelineRunner({
      staggerMs: 0,
      providerAttempts: 1,
    });
    const harness = makeHarness();
    const enqueue = makeEnqueueSpy();
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['p1.png', 'p2.png'],
    } as ProviderResult));

    const task = makePropSheetTask({
      prop: PROP,
      illustrationStyle: 'ghibli',
      photoRefs: [],
      propSheetOptionsRef: harness.propSheetOptionsRef,
      setPropSheetOptions: harness.setPropSheetOptions,
      setSelectedPropSheets: harness.setSelectedPropSheets,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    await runner.runItems({ tasks: [task], identity: LIVE_IDENTITY });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(enqueue).not.toHaveBeenCalled();
    expect(runner.statusOf('prop-prop-1')).toBe('done');
    expect(runner.saveFailedCount()).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// PERSIST_STALE (A3a/S3 F3): when the draft-hook layer signals stale (via
// `{stale: true}` on the enqueue result), the runner must leave the item at
// `pending` without marking done or save-failed. The wiring lives in
// `buildSnapshotTask` (shared by all nine factories) — verified once here via
// a representative factory to keep the invariant explicit in this test file.
// -----------------------------------------------------------------------------

describe('PERSIST_STALE propagation (A3a/S3 F3) via a representative factory', () => {
  it('cover factory: enqueue returning {stale:true} leaves the item at pending — not done, not save-failed', async () => {
    const runner = createStoryImagePipelineRunner({
      staggerMs: 0,
      providerAttempts: 1,
    });
    const harness = makeHarness();
    const enqueue = vi.fn(async (_input: EnqueueGeneratedSnapshotInput) => ({
      stale: true as const,
    }));
    const invoke = vi.fn<InvokeGenerateSceneImages>(async () => ({
      success: true,
      images: ['c1.png', 'c2.png', 'c3.png', 'c4.png'],
    } as ProviderResult));

    const task = makeCoverTask({
      illustrationStyle: 'ghibli',
      title: 'x',
      protagonistVisualDescription: 'y',
      location: undefined,
      charactersWithReferences: [],
      coverReferenceImage: null,
      primaryProps: [],
      customPrompt: undefined,
      append: false,
      coverOptionsRef: harness.coverOptionsRef,
      selectedCoverRef: harness.selectedCoverRef,
      setCoverOptions: harness.setCoverOptions,
      setSelectedCover: harness.setSelectedCover,
      invokeGenerateSceneImages: invoke,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueue,
    });
    await runner.runItems({ tasks: [task], identity: LIVE_IDENTITY });
    // Runner interprets PERSIST_STALE explicitly: pending, not done/save-failed.
    expect(runner.statusOf('cover')).toBe('pending');
    expect(runner.saveFailedCount()).toBe(0);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
