/**
 * A3a/S5 — Adapter tests for the production task-builder `buildSnapshotTask`.
 *
 * These tests exercise the SAME helper the editor uses in every one of its
 * nine `PipelineItemTask` builders (character sheet, prop, scene, cover, end,
 * plus four refine variants). Nothing here reproduces the apply/persist
 * closure semantics — the assertions run against the real production code
 * path via dependency-injected spies for provider, persist, and identity.
 *
 * Invariants covered:
 *   - apply computes hash + returns an immutable snapshot; it never calls
 *     `enqueueGeneratedSnapshot` (persistence surface is untouched).
 *   - persist calls `enqueueGeneratedSnapshot` exactly once per invocation
 *     with `provenance = {sourceRevision: id.generatedRevision, contentHash}`.
 *   - Identity-mismatch returns APPLY_STALE without calling `computePatch`
 *     or `enqueueGeneratedSnapshot`.
 *   - APPLY_EPHEMERAL (prop path) propagates and skips persistence.
 *   - Save-only retry through the real runner invokes persist again but
 *     never provider / apply / computePatch. Provider spy stays at zero for
 *     the retry, `enqueueGeneratedSnapshot` gets called with the same hash.
 *   - All six generate paths (character/prop/scene/cover/end) plus the four
 *     refine paths exercise the exact same production construction, keyed by
 *     the `PipelineItemKind` the editor supplies.
 *
 * No live provider calls, no network, no PII. All persistence and provider
 * surfaces are pure spies.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createStoryImagePipelineRunner,
  APPLY_EPHEMERAL,
  APPLY_STALE,
  type AppliedIdentity,
  type PipelineItemKind,
  type RunIdentity,
} from '@/hooks/storyImagePipelineRunner';
import { hashSnapshot } from '@/lib/cuentacuentos/snapshotHash';
import { buildSnapshotTask } from '@/lib/cuentacuentos/pipelineTaskAdapter';
import type {
  DraftPatch,
  EnqueueGeneratedSnapshotInput,
} from '@/hooks/useCuentacuentosDraft';

// -----------------------------------------------------------------------------
// Test fixtures: minimal ProviderResult and a canonical DraftPatch per kind.
// Each fixture matches the shape one of the nine production builders returns
// from its `computePatch` (character sheet, prop, scene, cover, end + refine).
// -----------------------------------------------------------------------------

interface ProviderResult {
  images: string[];
}

interface PathFixture {
  label: string;
  kind: PipelineItemKind;
  itemId: string;
  providerResult: ProviderResult;
  /** Patch the caller's computePatch would return. `null` = ephemeral (prop). */
  patch: DraftPatch | null;
}

const FIXTURES: PathFixture[] = [
  {
    label: 'character sheet (generate)',
    kind: 'sheet',
    itemId: 'sheet-char-1',
    providerResult: { images: ['https://cdn/char-1a.png', 'https://cdn/char-1b.png'] },
    patch: {
      characterSheetOptions: { 'char-1': ['https://cdn/char-1a.png', 'https://cdn/char-1b.png'] },
      selectedCharacterSheets: {},
    },
  },
  {
    label: 'prop (ephemeral, no persist)',
    kind: 'prop',
    itemId: 'prop-p-1',
    providerResult: { images: ['https://cdn/prop-a.png', 'https://cdn/prop-b.png'] },
    patch: null,
  },
  {
    label: 'scene (generate)',
    kind: 'scene',
    itemId: 'scene-1',
    providerResult: { images: ['https://cdn/scene-1a.png', 'https://cdn/scene-1b.png'] },
    patch: {
      sceneImageOptions: { 1: ['https://cdn/scene-1a.png', 'https://cdn/scene-1b.png'] },
      selectedSceneImages: {},
    },
  },
  {
    label: 'cover (generate)',
    kind: 'cover',
    itemId: 'cover',
    providerResult: { images: ['https://cdn/cover-a.png', 'https://cdn/cover-b.png'] },
    patch: { coverOptions: ['https://cdn/cover-a.png', 'https://cdn/cover-b.png'] },
  },
  {
    label: 'end (generate)',
    kind: 'end',
    itemId: 'end',
    providerResult: { images: ['https://cdn/end-a.png', 'https://cdn/end-b.png'] },
    patch: { endOptions: ['https://cdn/end-a.png', 'https://cdn/end-b.png'] },
  },
  {
    label: 'refine character sheet',
    kind: 'sheet',
    itemId: 'sheet-char-1',
    providerResult: { images: ['https://cdn/char-1-refined.png'] },
    patch: {
      characterSheetOptions: { 'char-1': ['https://cdn/char-1-refined.png'] },
      selectedCharacterSheets: { 'char-1': 0 },
    },
  },
  {
    label: 'refine scene',
    kind: 'scene',
    itemId: 'scene-2',
    providerResult: { images: ['https://cdn/scene-2-refined.png'] },
    patch: {
      sceneImageOptions: { 2: ['https://cdn/scene-2-refined.png'] },
      selectedSceneImages: { 2: 0 },
    },
  },
  {
    label: 'refine cover',
    kind: 'cover',
    itemId: 'cover',
    providerResult: { images: ['https://cdn/cover-refined.png'] },
    patch: { coverOptions: ['https://cdn/cover-refined.png'] },
  },
  {
    label: 'refine end',
    kind: 'end',
    itemId: 'end',
    providerResult: { images: ['https://cdn/end-refined.png'] },
    patch: { endOptions: ['https://cdn/end-refined.png'] },
  },
];

const LIVE_IDENTITY: RunIdentity = { storyId: 'story-A', epoch: 0 };

function makeEnqueueSpy() {
  return vi.fn(async (_input: EnqueueGeneratedSnapshotInput) => undefined);
}

// -----------------------------------------------------------------------------
// apply-without-persist: apply NEVER calls enqueueGeneratedSnapshot; persist
// carries provenance = {sourceRevision, contentHash: hashSnapshot(patch)}.
// -----------------------------------------------------------------------------

describe.each(FIXTURES)(
  'buildSnapshotTask: apply/persist contract — $label',
  ({ kind, itemId, providerResult, patch }) => {
    it('apply does NOT call enqueueGeneratedSnapshot; persist calls it exactly once with the correct provenance', async () => {
      const enqueueSpy = makeEnqueueSpy();
      const computePatch = vi.fn(() => (patch === null ? APPLY_EPHEMERAL : patch));
      const provider = vi.fn(async () => providerResult);

      const task = buildSnapshotTask<ProviderResult, DraftPatch>({
        id: itemId,
        kind,
        label: itemId,
        provider,
        computePatch,
        getLiveIdentity: () => LIVE_IDENTITY,
        enqueueGeneratedSnapshot: enqueueSpy,
      });

      const appliedIdentity: AppliedIdentity = {
        storyId: LIVE_IDENTITY.storyId,
        epoch: LIVE_IDENTITY.epoch,
        itemId,
        generatedRevision: 3,
      };

      const outcome = task.apply(providerResult, appliedIdentity);
      expect(computePatch).toHaveBeenCalledTimes(1);
      expect(enqueueSpy).not.toHaveBeenCalled();

      if (patch === null) {
        // Ephemeral path (prop): outcome is APPLY_EPHEMERAL, persist not called.
        expect(outcome).toBe(APPLY_EPHEMERAL);
        return;
      }

      expect(outcome).toEqual(patch);
      // The snapshot returned from apply is the same structural patch — the
      // runner deep-freezes it before persisting.
      const frozen = Object.freeze({ ...(outcome as DraftPatch) });
      await task.persist(frozen, appliedIdentity);

      expect(enqueueSpy).toHaveBeenCalledTimes(1);
      const call = enqueueSpy.mock.calls[0][0];
      expect(call.identity).toEqual(appliedIdentity);
      expect(call.provenance?.sourceRevision).toBe(3);
      expect(call.provenance?.contentHash).toBe(hashSnapshot(patch));
      expect(call.patch).toEqual(patch);
    });
  },
);

// -----------------------------------------------------------------------------
// Identity guard: mismatched storyId or epoch returns APPLY_STALE without
// calling computePatch or the persistence surface.
// -----------------------------------------------------------------------------

describe('buildSnapshotTask: identity guard', () => {
  it('storyId mismatch returns APPLY_STALE, computePatch never runs', () => {
    const enqueueSpy = makeEnqueueSpy();
    const computePatch = vi.fn(() => ({ coverOptions: ['x'] }));
    const task = buildSnapshotTask<ProviderResult, DraftPatch>({
      id: 'cover',
      kind: 'cover',
      label: 'Portada',
      provider: async () => ({ images: ['x'] }),
      computePatch,
      getLiveIdentity: () => ({ storyId: 'story-B', epoch: 0 }),
      enqueueGeneratedSnapshot: enqueueSpy,
    });
    const outcome = task.apply(
      { images: ['x'] },
      { storyId: 'story-A', epoch: 0, itemId: 'cover', generatedRevision: 1 },
    );
    expect(outcome).toBe(APPLY_STALE);
    expect(computePatch).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('epoch mismatch returns APPLY_STALE, computePatch never runs', () => {
    const enqueueSpy = makeEnqueueSpy();
    const computePatch = vi.fn(() => ({ endOptions: ['x'] }));
    const task = buildSnapshotTask<ProviderResult, DraftPatch>({
      id: 'end',
      kind: 'end',
      label: 'Fin',
      provider: async () => ({ images: ['x'] }),
      computePatch,
      getLiveIdentity: () => ({ storyId: 'story-A', epoch: 1 }),
      enqueueGeneratedSnapshot: enqueueSpy,
    });
    const outcome = task.apply(
      { images: ['x'] },
      { storyId: 'story-A', epoch: 0, itemId: 'end', generatedRevision: 1 },
    );
    expect(outcome).toBe(APPLY_STALE);
    expect(computePatch).not.toHaveBeenCalled();
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('computePatch returning APPLY_STALE propagates (refine slot-not-found path)', () => {
    const enqueueSpy = makeEnqueueSpy();
    const computePatch = vi.fn(() => APPLY_STALE);
    const task = buildSnapshotTask<ProviderResult, DraftPatch>({
      id: 'scene-1',
      kind: 'scene',
      label: 'Escena 1',
      provider: async () => ({ images: ['x'] }),
      computePatch,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueueSpy,
    });
    const outcome = task.apply(
      { images: ['x'] },
      { storyId: 'story-A', epoch: 0, itemId: 'scene-1', generatedRevision: 1 },
    );
    expect(outcome).toBe(APPLY_STALE);
    expect(computePatch).toHaveBeenCalledTimes(1);
    expect(enqueueSpy).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// End-to-end via the real runner: save-retry after a persist failure invokes
// persist again but NEVER provider / apply / computePatch.
// -----------------------------------------------------------------------------

describe('buildSnapshotTask + real runner: save-only retry invariants', () => {
  it.each(
    FIXTURES.filter((f) => f.patch !== null),
  )(
    '$label: retrySaves calls persist again with the retained hash — provider/apply/computePatch stay at zero after initial run',
    async ({ kind, itemId, providerResult, patch }) => {
      const runner = createStoryImagePipelineRunner({
        staggerMs: 0,
        providerAttempts: 1,
      });

      let persistCall = 0;
      const enqueueSpy = vi.fn(async (_input: EnqueueGeneratedSnapshotInput) => {
        persistCall++;
        if (persistCall < 2) throw new Error('io down'); // first attempt fails
      });
      const computePatch = vi.fn(() => patch as DraftPatch);
      const provider = vi.fn(async () => providerResult);

      const task = buildSnapshotTask<ProviderResult, DraftPatch>({
        id: itemId,
        kind,
        label: itemId,
        provider,
        computePatch,
        getLiveIdentity: () => LIVE_IDENTITY,
        enqueueGeneratedSnapshot: enqueueSpy,
      });

      await runner.runItems({ tasks: [task], identity: LIVE_IDENTITY });
      expect(provider).toHaveBeenCalledTimes(1);
      expect(computePatch).toHaveBeenCalledTimes(1);
      expect(enqueueSpy).toHaveBeenCalledTimes(1);
      expect(runner.statusOf(itemId)).toBe('save-failed');
      expect(runner.saveFailedCount()).toBe(1);

      // Verify the registered entry carries the deterministic hash so a
      // save-only retry can revalidate provenance without recomputing anything.
      const entry = runner
        .getSaveRetryRegistry()
        .getLatestForItem(LIVE_IDENTITY.storyId, LIVE_IDENTITY.epoch, itemId)!;
      expect(entry.provenance.contentHash).toBe(hashSnapshot(patch as DraftPatch));
      expect(entry.provenance.sourceRevision).toBe(entry.identity.generatedRevision);

      await runner.retrySaves(LIVE_IDENTITY);
      // Provider + apply + computePatch untouched by the retry.
      expect(provider).toHaveBeenCalledTimes(1);
      expect(computePatch).toHaveBeenCalledTimes(1);
      // Persist ran a second time (initial fail + retry success).
      expect(enqueueSpy).toHaveBeenCalledTimes(2);
      // Both calls carry the same hash — the retry closure reused the value
      // captured at apply time; the runner never recomputed it.
      const [firstCall, secondCall] = enqueueSpy.mock.calls;
      expect(secondCall[0].provenance?.contentHash).toBe(
        firstCall[0].provenance?.contentHash,
      );
      expect(secondCall[0].provenance?.contentHash).toBe(
        hashSnapshot(patch as DraftPatch),
      );
      expect(runner.statusOf(itemId)).toBe('done');
      expect(runner.saveFailedCount()).toBe(0);
    },
  );

  it('ephemeral prop: computePatch returns APPLY_EPHEMERAL — persist NEVER runs, no registry entry, done immediately', async () => {
    const runner = createStoryImagePipelineRunner({
      staggerMs: 0,
      providerAttempts: 1,
    });
    const enqueueSpy = makeEnqueueSpy();
    const computePatch = vi.fn(() => APPLY_EPHEMERAL);
    const provider = vi.fn(async () => ({ images: ['https://cdn/prop.png'] }));
    const task = buildSnapshotTask<ProviderResult, DraftPatch>({
      id: 'prop-p1',
      kind: 'prop',
      label: 'Prop 1',
      provider,
      computePatch,
      getLiveIdentity: () => LIVE_IDENTITY,
      enqueueGeneratedSnapshot: enqueueSpy,
    });
    await runner.runItems({ tasks: [task], identity: LIVE_IDENTITY });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(computePatch).toHaveBeenCalledTimes(1);
    // Prop sheets are ephemeral by design: persistence surface untouched.
    expect(enqueueSpy).not.toHaveBeenCalled();
    expect(runner.statusOf('prop-p1')).toBe('done');
    expect(runner.saveFailedCount()).toBe(0);
  });
});

// -----------------------------------------------------------------------------
// Deterministic hash sanity — same patch → same hash across independent tasks.
// -----------------------------------------------------------------------------

describe('buildSnapshotTask: hash determinism', () => {
  it('two independently constructed tasks produce identical provenance hashes for identical patches', async () => {
    const patch: DraftPatch = { coverOptions: ['https://cdn/x.png'] };
    const enqueueA = makeEnqueueSpy();
    const enqueueB = makeEnqueueSpy();
    const buildOne = (spy: typeof enqueueA) =>
      buildSnapshotTask<ProviderResult, DraftPatch>({
        id: 'cover',
        kind: 'cover',
        label: 'Portada',
        provider: async () => ({ images: patch.coverOptions! }),
        computePatch: () => patch,
        getLiveIdentity: () => LIVE_IDENTITY,
        enqueueGeneratedSnapshot: spy,
      });
    const idA: AppliedIdentity = { ...LIVE_IDENTITY, itemId: 'cover', generatedRevision: 1 };
    const taskA = buildOne(enqueueA);
    taskA.apply({ images: patch.coverOptions! }, idA);
    await taskA.persist(patch, idA);
    const taskB = buildOne(enqueueB);
    taskB.apply({ images: patch.coverOptions! }, idA);
    await taskB.persist(patch, idA);
    expect(enqueueA.mock.calls[0][0].provenance?.contentHash).toBe(
      enqueueB.mock.calls[0][0].provenance?.contentHash,
    );
  });

  it('different patches produce different hashes', () => {
    const p1: DraftPatch = { coverOptions: ['https://cdn/a.png'] };
    const p2: DraftPatch = { coverOptions: ['https://cdn/b.png'] };
    expect(hashSnapshot(p1)).not.toBe(hashSnapshot(p2));
  });
});
