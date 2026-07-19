/**
 * Pure recovery-mapping helpers for CuentacuentoEditor (A3/S5).
 *
 * Owns the shape of the extended EditorStateV1 snapshot and the pure v1 → editor
 * restore mapping. Dependency-free: no React, no Supabase, no side effects — so
 * both the hook (persist path) and component (restore path) can drive round-trip
 * behavior deterministically and tests can pin invariants without mounting.
 *
 * Invariants:
 *  - v1 shape is closed: every listed editor field maps to exactly one slot.
 *  - Legacy drafts without an editorStateV1 block hydrate with safe defaults.
 *  - Recursively scrubs base64/data URLs from any object we intend to persist
 *    (image references live in image_paths, not JSON).
 *  - Reference-image slots always hold Storage paths, never data URLs or raw
 *    base64. Display URL resolution is the caller's responsibility on load.
 */

import type { TextOverlay } from '@/types/shared/story';

/** Steps of the CuentacuentoEditor flow, mirrored from the component. */
export type EditorCreationStep =
  | 'config'
  | 'story'
  | 'characters'
  | 'scenes'
  | 'cover'
  | 'complete';

/**
 * Extended editor-state snapshot embedded inside the persisted story JSONB.
 *
 * The snapshot is authoritative for local editor buffers that don't live
 * inside the Story tree (edited prompts, include/exclude character lists,
 * current step, recovery revision). Story-tree fields (title, overlays,
 * scenes[].text, scenes[].landmarkVisible) stay on Story and are hydrated
 * from there — this snapshot records them under `mirror` so a v1 round-trip
 * is lossless even if the Story tree is missing them (e.g. after a legacy
 * partial write).
 */
export interface EditorStateV1Extended {
  version: 1;
  selections: {
    selectedCharacterSheets: Record<string, number>;
    selectedSceneImages: Record<number, number>;
    selectedCover: number | null;
    selectedEnd: number | null;
  };
  edited: {
    scenePrompt: Record<number, string>;
    characterPrompt: Record<string, string>;
    coverPrompt: string;
    endPrompt: string;
    sceneText: Record<number, string>;
    title: string | null;
  };
  includedCharacters: {
    scene: Record<number, string[]>;
    cover: string[];
    end: string[];
  };
  excludedCharacters: {
    scene: Record<number, string[]>;
    cover: string[];
    end: string[];
  };
  sceneReferenceModes: Record<number, 'style' | 'pov'>;
  overlays: {
    cover: TextOverlay | null;
    end: TextOverlay | null;
  };
  landmarkVisible: Record<number, boolean>;
  currentStep: EditorCreationStep;
  recoveryRevision: number;
  /** Optional provenance carry-over (used by A2/A3 adapters). */
  provenance?: { sourceRevision?: number; contentHash?: string | null };
}

/**
 * Input shape accepted by `buildEditorStateV1` — a duck-typed picker over the
 * editor's state slots. Kept structural (no import from the component) so the
 * hook can build snapshots without pulling in React state APIs.
 */
export interface EditorStateBuildInput {
  selectedCharacterSheets?: Record<string, number>;
  selectedSceneImages?: Record<number, number>;
  selectedCover?: number | null;
  selectedEnd?: number | null;
  editingScenePrompt?: Record<number, string>;
  editingCharacterPrompt?: Record<string, string>;
  editingCoverPrompt?: string;
  editingEndPrompt?: string;
  editingSceneText?: Record<number, string>;
  editingTitle?: string | null;
  sceneIncludedCharacters?: Record<number, string[]>;
  coverIncludedCharacters?: string[];
  endIncludedCharacters?: string[];
  sceneExcludedCharacters?: Record<number, string[]>;
  coverExcludedCharacters?: string[];
  endExcludedCharacters?: string[];
  sceneReferenceModes?: Record<number, 'style' | 'pov'>;
  coverTextOverlay?: TextOverlay | null;
  endTextOverlay?: TextOverlay | null;
  landmarkVisible?: Record<number, boolean>;
  currentStep?: EditorCreationStep;
  recoveryRevision?: number;
  provenance?: { sourceRevision?: number; contentHash?: string | null };
}

/**
 * Pure builder. Fills missing slots with safe defaults so the resulting
 * snapshot is always well-formed and structurally comparable.
 */
export function buildEditorStateV1(
  input: EditorStateBuildInput = {}
): EditorStateV1Extended {
  return {
    version: 1,
    selections: {
      selectedCharacterSheets: input.selectedCharacterSheets ?? {},
      selectedSceneImages: input.selectedSceneImages ?? {},
      selectedCover: input.selectedCover ?? null,
      selectedEnd: input.selectedEnd ?? null,
    },
    edited: {
      scenePrompt: input.editingScenePrompt ?? {},
      characterPrompt: input.editingCharacterPrompt ?? {},
      coverPrompt: input.editingCoverPrompt ?? '',
      endPrompt: input.editingEndPrompt ?? '',
      sceneText: input.editingSceneText ?? {},
      title: input.editingTitle ?? null,
    },
    includedCharacters: {
      scene: input.sceneIncludedCharacters ?? {},
      cover: input.coverIncludedCharacters ?? [],
      end: input.endIncludedCharacters ?? [],
    },
    excludedCharacters: {
      scene: input.sceneExcludedCharacters ?? {},
      cover: input.coverExcludedCharacters ?? [],
      end: input.endExcludedCharacters ?? [],
    },
    sceneReferenceModes: input.sceneReferenceModes ?? {},
    overlays: {
      cover: input.coverTextOverlay ?? null,
      end: input.endTextOverlay ?? null,
    },
    landmarkVisible: input.landmarkVisible ?? {},
    currentStep: input.currentStep ?? 'config',
    recoveryRevision: input.recoveryRevision ?? 0,
    ...(input.provenance ? { provenance: input.provenance } : {}),
  };
}

/**
 * Type guard for the extended v1 shape. Returns `false` for any value that
 * doesn't declare `version: 1` — callers must fall through to defaults.
 * Sub-fields default lazily via `restoreEditorStateV1`; here we only check the
 * envelope.
 */
export function isEditorStateV1Extended(
  candidate: unknown
): candidate is EditorStateV1Extended {
  if (!candidate || typeof candidate !== 'object') return false;
  const c = candidate as Partial<EditorStateV1Extended>;
  if (c.version !== 1) return false;
  if (!c.selections || typeof c.selections !== 'object') return false;
  return true;
}

/**
 * Output shape produced by `restoreEditorStateV1`. Names mirror editor state
 * setters 1:1 so the caller can drop values directly into React state without
 * translation.
 */
export interface EditorStateRestoreOutput {
  selectedCharacterSheets: Record<string, number>;
  selectedSceneImages: Record<number, number>;
  selectedCover: number | null;
  selectedEnd: number | null;
  editingScenePrompt: Record<number, string>;
  editingCharacterPrompt: Record<string, string>;
  editingCoverPrompt: string;
  editingEndPrompt: string;
  editingSceneText: Record<number, string>;
  editingTitle: string | null;
  sceneIncludedCharacters: Record<number, string[]>;
  coverIncludedCharacters: string[];
  endIncludedCharacters: string[];
  sceneExcludedCharacters: Record<number, string[]>;
  coverExcludedCharacters: string[];
  endExcludedCharacters: string[];
  sceneReferenceModes: Record<number, 'style' | 'pov'>;
  coverTextOverlay: TextOverlay | null;
  endTextOverlay: TextOverlay | null;
  landmarkVisible: Record<number, boolean>;
  currentStep: EditorCreationStep;
  recoveryRevision: number;
}

const VALID_STEPS: readonly EditorCreationStep[] = [
  'config',
  'story',
  'characters',
  'scenes',
  'cover',
  'complete',
];

/**
 * Normalizes a possibly-loose record whose keys came from JSON (always strings)
 * into a `Record<number, T>` while dropping non-numeric keys. Values pass
 * through a validator to keep callers safe from unexpected shapes.
 */
function normalizeNumericKeys<T>(
  raw: unknown,
  validate: (v: unknown) => v is T
): Record<number, T> {
  const out: Record<number, T> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const num = Number(key);
    if (!Number.isFinite(num)) continue;
    if (validate(value)) out[num] = value;
  }
  return out;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';
const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const isReferenceMode = (v: unknown): v is 'style' | 'pov' =>
  v === 'style' || v === 'pov';

/**
 * Pure v1 → editor mapping. Every field is defensively normalized so a
 * partially-populated legacy snapshot cannot break restore. Missing state
 * defaults to empty (never silently reset from prior in-memory values —
 * the caller is responsible for treating "empty" as "not present").
 */
export function restoreEditorStateV1(
  raw: unknown
): EditorStateRestoreOutput {
  const empty: EditorStateRestoreOutput = {
    selectedCharacterSheets: {},
    selectedSceneImages: {},
    selectedCover: null,
    selectedEnd: null,
    editingScenePrompt: {},
    editingCharacterPrompt: {},
    editingCoverPrompt: '',
    editingEndPrompt: '',
    editingSceneText: {},
    editingTitle: null,
    sceneIncludedCharacters: {},
    coverIncludedCharacters: [],
    endIncludedCharacters: [],
    sceneExcludedCharacters: {},
    coverExcludedCharacters: [],
    endExcludedCharacters: [],
    sceneReferenceModes: {},
    coverTextOverlay: null,
    endTextOverlay: null,
    landmarkVisible: {},
    currentStep: 'config',
    recoveryRevision: 0,
  };

  if (!isEditorStateV1Extended(raw)) return empty;

  const v1 = raw;
  const sel = v1.selections;
  const edited = (v1 as Partial<EditorStateV1Extended>).edited ?? {};
  const inc = (v1 as Partial<EditorStateV1Extended>).includedCharacters ?? {
    scene: {},
    cover: [],
    end: [],
  };
  const exc = (v1 as Partial<EditorStateV1Extended>).excludedCharacters ?? {
    scene: {},
    cover: [],
    end: [],
  };
  const overlays = (v1 as Partial<EditorStateV1Extended>).overlays ?? {
    cover: null,
    end: null,
  };
  const step = (v1 as Partial<EditorStateV1Extended>).currentStep;
  const rev = (v1 as Partial<EditorStateV1Extended>).recoveryRevision;

  const selectedCharacterSheets: Record<string, number> = {};
  if (sel.selectedCharacterSheets && typeof sel.selectedCharacterSheets === 'object') {
    for (const [k, v] of Object.entries(sel.selectedCharacterSheets)) {
      if (isNumber(v)) selectedCharacterSheets[k] = v;
    }
  }

  return {
    selectedCharacterSheets,
    selectedSceneImages: normalizeNumericKeys(sel.selectedSceneImages, isNumber),
    selectedCover:
      typeof sel.selectedCover === 'number' ? sel.selectedCover : null,
    selectedEnd: typeof sel.selectedEnd === 'number' ? sel.selectedEnd : null,
    editingScenePrompt: normalizeNumericKeys(
      (edited as { scenePrompt?: unknown }).scenePrompt,
      isString
    ),
    editingCharacterPrompt: sanitizeStringMap(
      (edited as { characterPrompt?: unknown }).characterPrompt
    ),
    editingCoverPrompt: isString((edited as { coverPrompt?: unknown }).coverPrompt)
      ? ((edited as { coverPrompt: string }).coverPrompt)
      : '',
    editingEndPrompt: isString((edited as { endPrompt?: unknown }).endPrompt)
      ? ((edited as { endPrompt: string }).endPrompt)
      : '',
    editingSceneText: normalizeNumericKeys(
      (edited as { sceneText?: unknown }).sceneText,
      isString
    ),
    editingTitle: isString((edited as { title?: unknown }).title)
      ? ((edited as { title: string }).title)
      : null,
    sceneIncludedCharacters: normalizeNumericKeys(
      (inc as { scene?: unknown }).scene,
      isStringArray
    ),
    coverIncludedCharacters: isStringArray((inc as { cover?: unknown }).cover)
      ? ((inc as { cover: string[] }).cover)
      : [],
    endIncludedCharacters: isStringArray((inc as { end?: unknown }).end)
      ? ((inc as { end: string[] }).end)
      : [],
    sceneExcludedCharacters: normalizeNumericKeys(
      (exc as { scene?: unknown }).scene,
      isStringArray
    ),
    coverExcludedCharacters: isStringArray((exc as { cover?: unknown }).cover)
      ? ((exc as { cover: string[] }).cover)
      : [],
    endExcludedCharacters: isStringArray((exc as { end?: unknown }).end)
      ? ((exc as { end: string[] }).end)
      : [],
    sceneReferenceModes: normalizeNumericKeys(
      v1.sceneReferenceModes,
      isReferenceMode
    ),
    coverTextOverlay: sanitizeOverlay((overlays as { cover?: unknown }).cover),
    endTextOverlay: sanitizeOverlay((overlays as { end?: unknown }).end),
    landmarkVisible: normalizeNumericKeys(
      (v1 as { landmarkVisible?: unknown }).landmarkVisible,
      isBoolean
    ),
    currentStep: VALID_STEPS.includes(step as EditorCreationStep)
      ? (step as EditorCreationStep)
      : 'config',
    recoveryRevision: isNumber(rev) ? rev : 0,
  };
}

function sanitizeStringMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function sanitizeOverlay(raw: unknown): TextOverlay | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<TextOverlay>;
  if (typeof r.text !== 'string') return null;
  if (r.position !== 'top' && r.position !== 'center' && r.position !== 'bottom')
    return null;
  if (r.color !== 'white' && r.color !== 'black' && r.color !== 'amber')
    return null;
  if (r.size !== 'S' && r.size !== 'M' && r.size !== 'L') return null;
  return { text: r.text, position: r.position, color: r.color, size: r.size };
}

/**
 * Recursively strips any base64 or data-URL image reference from a value tree.
 * Storage paths (short strings, or URLs starting with http) are kept as-is.
 *
 * Used before persisting Story JSON so the invariant "no data URLs in
 * persisted JSON" holds regardless of which nested field carried the string.
 */
export function scrubImageRefsDeep<T>(value: T): T {
  return _scrub(value) as T;
}

function _scrub(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === 'string') {
    return isNonPathImageString(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    return value
      .map(_scrub)
      .filter((v) => v !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const scrubbed = _scrub(v);
      if (scrubbed !== undefined) out[k] = scrubbed;
    }
    return out;
  }
  return value;
}

/** Mirrors the private isNonPathImageRef in useCuentacuentosDraft. */
export function isNonPathImageString(value: string): boolean {
  if (value.startsWith('data:')) return true;
  if (!value.startsWith('http') && value.length > 512) return true;
  return false;
}
