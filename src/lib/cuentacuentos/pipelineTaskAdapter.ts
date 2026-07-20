/**
 * A3a/S5 — Shared adapter that turns a caller's patch-computation into the
 * standard `{provider, apply, persist}` shape the pipeline runner expects.
 *
 * Every image-generation task in the editor (character sheet, prop, scene,
 * cover, end, plus four refine variants) needs the exact same wrapping around
 * a `computePatch`:
 *   1. `apply` first checks that the LIVE draft identity still matches the
 *      identity captured when the run started. On mismatch it returns
 *      `APPLY_STALE` and the runner leaves the item at `pending` — no merge,
 *      no persist.
 *   2. Otherwise it invokes `computePatch` (caller-supplied), which mutates
 *      editor refs/state and returns either a `DraftPatch`, `APPLY_STALE`, or
 *      `APPLY_EPHEMERAL`. The returned outcome is propagated verbatim.
 *   3. When a real patch is returned, the deterministic snapshot hash is
 *      computed and captured in this adapter's closure. `persist` reads that
 *      same closure variable, so a save-only retry — which the runner services
 *      by calling `entry.persist(entry.snapshot, entry.identity)` again —
 *      re-uses the original hash without re-running `provider`, `apply`, or
 *      `computePatch`.
 *   4. `persist` posts `{patch, identity, provenance:{sourceRevision,
 *      contentHash}}` to `enqueueGeneratedSnapshot`. That is the single
 *      persistence surface used by production; retries flow through it too.
 *
 * The adapter exists so that:
 *   - The editor stops repeating the identity check + hash capture + persist
 *     body nine times.
 *   - Adapter tests can exercise the REAL production construction path with
 *     injected spies for `enqueueGeneratedSnapshot`, `getLiveIdentity`, and
 *     `computePatch`, instead of reproducing the closure semantics inside the
 *     test file.
 */

import type {
  AppliedIdentity,
  ApplyEphemeral,
  ApplyStale,
  PipelineItemKind,
  PipelineItemTask,
  ProviderContext,
} from '@/hooks/storyImagePipelineRunner';
import {
  APPLY_EPHEMERAL,
  APPLY_STALE,
} from '@/hooks/storyImagePipelineRunner';
import type {
  DraftPatch,
  EnqueueGeneratedSnapshotInput,
} from '@/hooks/useCuentacuentosDraft';
import { hashSnapshot } from '@/lib/cuentacuentos/snapshotHash';

/**
 * Return shape of the caller-supplied patch computation. A snapshot is a
 * `DraftPatch`; the two sentinels are re-exported from the runner so callers
 * don't need to import both modules.
 */
export type ComputePatchResult<TPatch extends DraftPatch = DraftPatch> =
  | TPatch
  | ApplyStale
  | ApplyEphemeral;

export interface BuildSnapshotTaskConfig<
  TResult,
  TPatch extends DraftPatch = DraftPatch,
> {
  id: string;
  kind: PipelineItemKind;
  label: string;
  provider: (ctx: ProviderContext) => Promise<TResult>;
  /**
   * Runs synchronously inside `apply` after the live-identity guard passes.
   * Mutates caller refs/state and returns the patch that will be persisted
   * (or `APPLY_STALE` / `APPLY_EPHEMERAL`).
   */
  computePatch: (
    result: TResult,
    identity: AppliedIdentity,
  ) => ComputePatchResult<TPatch>;
  /** Returns the currently-live draft identity ({storyId, epoch}). */
  getLiveIdentity: () => { storyId: string | null; epoch: number };
  /** Single persistence surface used by every generated snapshot. */
  enqueueGeneratedSnapshot: (input: EnqueueGeneratedSnapshotInput) => Promise<void>;
}

/**
 * Build a production `PipelineItemTask` with the standard identity guard +
 * hash capture + provenance-bearing persist body.
 */
export function buildSnapshotTask<
  TResult,
  TPatch extends DraftPatch = DraftPatch,
>(config: BuildSnapshotTaskConfig<TResult, TPatch>): PipelineItemTask<TResult, TPatch> {
  const {
    id,
    kind,
    label,
    provider,
    computePatch,
    getLiveIdentity,
    enqueueGeneratedSnapshot,
  } = config;

  // Hash captured at apply time and reused verbatim by persist — including on
  // save-only retries, which invoke persist without re-running apply.
  let capturedHash: string | null = null;

  return {
    id,
    kind,
    label,
    provider,
    apply: (result, appliedIdentity) => {
      const live = getLiveIdentity();
      if (
        appliedIdentity.storyId !== live.storyId ||
        appliedIdentity.epoch !== live.epoch
      ) {
        return APPLY_STALE;
      }
      const outcome = computePatch(result, appliedIdentity);
      if (outcome === APPLY_STALE || outcome === APPLY_EPHEMERAL) {
        return outcome;
      }
      capturedHash = hashSnapshot(outcome);
      return outcome;
    },
    persist: async (snapshot, appliedIdentity) => {
      await enqueueGeneratedSnapshot({
        patch: snapshot as DraftPatch,
        identity: appliedIdentity,
        provenance: {
          sourceRevision: appliedIdentity.generatedRevision,
          contentHash: capturedHash!,
        },
      });
    },
  };
}
