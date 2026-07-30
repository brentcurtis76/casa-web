/**
 * CASA Story Generator — request handler.
 *
 * Genera cuentos para niños usando Claude Opus 4.5, basado en el contexto
 * litúrgico y parámetros del usuario.
 *
 * Extracted from `index.ts` (FASE F) so it can be imported by tests without
 * starting a server, reading the environment, or hitting the network.
 * `index.ts` is the only place that constructs production dependencies and
 * calls `serve()`.
 *
 * Auth: OPTIONS is handled before the guard for CORS preflight. Every other
 * method must pass `requireLiturgyWriter` BEFORE the handler reads the body,
 * downloads any image, or calls Gemini/Anthropic. Fail-closed by design.
 */

import {
  requireLiturgyWriter,
  type RequirePermissionDeps,
} from '../_shared/liturgyAuth.ts';
import {
  bodyShape,
  charCount,
  collectStoryImageRefs,
  DEFAULT_IMAGE_LIMITS,
  describeError,
  imageErrorResponse,
  imageFieldOf,
  ImageRefError,
  type ImageLimits,
  type MaterializedImage,
  materializeImageRefs,
  prevalidateImageRefs,
  readBoundedJson,
  type SkippedImage,
  storyImageReadSet,
} from '../_shared/imageFetch.ts';

export interface HandlerDeps {
  /** ANTHROPIC_API_KEY. Empty/absent => the handler reports a config error. */
  anthropicApiKey: string;
  /** GOOGLE_AI_API_KEY. Empty/absent => research and image analysis fail soft. */
  googleAiApiKey: string;
  /**
   * Gemini model for BOTH research calls (location research and reference-photo
   * analysis). Required, with no fallback here on purpose: `index.ts` owns the
   * `GEMINI_RESEARCH_MODEL` read and its default (D2), so a deployment that
   * forgets to wire it fails to type-check rather than silently pinning a model
   * this file used to hardcode.
   */
  researchModel: string;
  /** Injectable authz backend for the shared fail-closed guard. */
  authzDeps: RequirePermissionDeps;
  /** SUPABASE_URL — pins the one bucket origin image URLs may come from. */
  supabaseUrl: string;
  /** Overridable in tests; production uses `DEFAULT_IMAGE_LIMITS`. */
  imageLimits?: ImageLimits;
}

/** Provider credentials + model config threaded to the module-level helpers. */
interface ProviderConfig {
  anthropicApiKey: string;
  googleAiApiKey: string;
  researchModel: string;
}

const MODEL = 'claude-opus-4-5-20251101';

/**
 * Research knobs, pinned by PLAN Phase PC. Both research calls send the same
 * pair: an output cap, and the cheapest thinking tier the model offers.
 *
 * The cap is NOT "enough for a ~300-word Spanish answer" — that was the
 * rationale for the original 1024, and the [PC7] canary disproved it on the
 * live surface: at `thinkingLevel: LOW` a production-shaped research ask spent
 * 768 tokens on thinking plus 252 on the answer (1059 total), so 1024 truncated
 * EVERY call and PC's own contract then discarded the text as degraded. 2048 is
 * the measured thinking cost plus a ~450-token answer plus headroom. Moving it
 * again needs another canary measurement, not an estimate.
 */
const RESEARCH_THINKING_LEVEL = 'LOW';
const RESEARCH_MAX_OUTPUT_TOKENS = 2048;

/**
 * Why research failed. Closed set: these codes reach the client inside
 * `warnings`, so a new one is a contract change, not an implementation detail.
 */
export type ResearchFailureCode =
  | 'NO_API_KEY'
  | 'MODEL_NOT_FOUND'
  | 'PROVIDER_HTTP_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'EMPTY_RESPONSE'
  | 'OUTPUT_TRUNCATED'
  | 'OUTPUT_BLOCKED';

/**
 * The outcome of one research call.
 *
 * Replaces the old `Promise<string>` where `''` meant "no key", "no photos",
 * "provider 500", "blocked" and "the model genuinely said nothing" all at once
 * — indistinguishable to the caller and invisible to the user.
 *
 * `text` exists ONLY on `ok`: a truncated or blocked answer contributes
 * nothing, rather than half a description that reads like a whole one.
 */
export type ResearchResult =
  | { status: 'ok'; text: string; finishReason: 'STOP' }
  | { status: 'skipped'; code: 'NO_IMAGES' }
  | {
    status: 'failed';
    code: ResearchFailureCode;
    httpStatus?: number;
    finishReason?: string;
  };

/** Which research call degraded. One value per call site, not per entity kind. */
export type WarningSource = 'location' | 'landmark' | 'prop';

/** Additive, user-facing degradation report (D8: Spanish). */
export interface ResponseWarning {
  source: WarningSource;
  code: ResearchFailureCode;
  message: string;
  httpStatus?: number;
  finishReason?: string;
}

/**
 * Why story normalization dropped something. Closed set: these reach the client
 * inside `warnings`, so a new one is a contract change.
 *
 * `source` is `'story'` and NOT `'prop'` on purpose: PC already uses `'prop'`
 * for "the photo analysis of a recurring element degraded", which is a different
 * event with a different remedy. Overloading it would make the two
 * indistinguishable to the consumer that renders them (PLAN G3).
 */
export type StoryWarningCode = 'PROP_NOT_RECURRING';

export interface StoryWarning {
  source: 'story';
  code: StoryWarningCode;
  message: string;
}

/**
 * Fixed copy, built from the code alone — never from the provider's prop name or
 * description. The client is told what was lost, not what the provider called it.
 */
const STORY_WARNING_MESSAGES: Record<StoryWarningCode, string> = {
  PROP_NOT_RECURRING:
    'Se omitió un elemento recurrente porque aparece en menos de dos escenas válidas.',
};

function storyWarning(code: StoryWarningCode): StoryWarning {
  return { source: 'story', code, message: STORY_WARNING_MESSAGES[code] };
}

/** Everything the `warnings` envelope key can carry. Additive union. */
export type EnvelopeWarning = ResponseWarning | StoryWarning;

// ---------------------------------------------------------------------------
// Typed errors (PLAN G3)
// ---------------------------------------------------------------------------

/**
 * Why the provider's output was unusable. INTERNAL: the reason selects one of
 * three fixed Spanish messages and never reaches the client itself, so the
 * client cannot distinguish "the model refused" from a raw `stop_reason`.
 */
export type ProviderOutputReason = 'REFUSAL' | 'MAX_TOKENS' | 'INVALID_STORY';

const PROVIDER_OUTPUT_MESSAGES: Record<ProviderOutputReason, string> = {
  REFUSAL: 'El proveedor rechazó generar el cuento. Ajusta las notas y vuelve a intentarlo.',
  MAX_TOKENS:
    'El proveedor cortó el cuento antes de completarlo. Usa notas más breves y vuelve a intentarlo.',
  INVALID_STORY:
    'El proveedor devolvió un cuento con una estructura inválida. Vuelve a intentarlo.',
};

/**
 * The provider answered, and its answer is not a story. Mapped to 502 INSIDE
 * the handler — a provider that returns garbage is not a server fault, and it is
 * not the client's fault either, so neither 500 nor 4xx describes it.
 */
export class ProviderOutputError extends Error {
  readonly reason: ProviderOutputReason;
  /**
   * Log-only. Safe validation codes, field paths and counts — this module's own
   * literals, never provider values or serialized output.
   */
  readonly detail: string;

  constructor(reason: ProviderOutputReason, detail = '') {
    super(PROVIDER_OUTPUT_MESSAGES[reason]);
    this.name = 'ProviderOutputError';
    this.reason = reason;
    this.detail = detail;
  }
}

/**
 * The request itself is unusable. 400 for a body that is not JSON, 422 for JSON
 * that is missing a field this function requires.
 */
export class ClientInputError extends Error {
  readonly httpStatus: 400 | 422;

  constructor(httpStatus: 400 | 422, message: string) {
    super(message);
    this.name = 'ClientInputError';
    this.httpStatus = httpStatus;
  }
}

// ---------------------------------------------------------------------------
// The validated story
// ---------------------------------------------------------------------------

const CHARACTER_ROLES = ['protagonist', 'secondary', 'minor'] as const;
const PROP_KINDS = ['location', 'prop'] as const;

export type CharacterRole = typeof CHARACTER_ROLES[number];
export type PropKind = typeof PROP_KINDS[number];

/** The scene window this function requests and accepts (PLAN G1). */
const SCENE_COUNT_MIN = 12;
const SCENE_COUNT_MAX = 16;

export interface StoryCharacter {
  name: string;
  role: CharacterRole;
  description: string;
  visualDescription: string;
  appearsInScenes?: number[];
}

export interface StoryScene {
  number: number;
  text: string;
  visualDescription: string;
  charactersInScene?: string[];
  landmarkVisible?: boolean;
}

export interface StoryProp {
  name: string;
  kind: PropKind;
  narrativeRole: string;
  visualDescription: string;
  sceneNumbers: number[];
}

export interface StoryOutput {
  title: string;
  summary: string;
  characters: StoryCharacter[];
  scenes: StoryScene[];
  props: StoryProp[];
  spiritualConnection: string;
}

/** A rejection reason. `path` is a field position, never a field value. */
export interface StoryValidationError {
  code: string;
  path: string;
}

/**
 * Discriminated on purpose: a caller cannot reach `story` without having
 * checked `ok`, so there is no shape in which a story with fatal errors is
 * usable (PLAN STRIKE/TIGHTEN).
 */
export type StoryValidationResult =
  | { ok: true; story: StoryOutput; warnings: StoryWarning[] }
  | { ok: false; errors: StoryValidationError[] };

/** `undefined` unless the value is a string with content after trimming. */
function trimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * The uniqueness key for a character name: NFKC → trim → collapse internal
 * whitespace → `toLocaleLowerCase('es-CL')`.
 *
 * Locale-aware lowercasing because the names are Spanish and the invariant is
 * "the same person". `" Ana "` and `"ana"` collide; so do a precomposed `ñ` and
 * an `n` followed by a combining tilde.
 */
function characterNameKey(raw: string): string {
  return raw
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-CL');
}

/**
 * Canonicalizes an enum that differs from the schema ONLY in capitalization.
 *
 * SOURCE: Anthropic's structured-outputs documentation warns that enum values
 * can come back differing in case even under strict output, so strict mode is
 * defence one and this is defence two. Deliberately `toLowerCase()` and not
 * trim-then-lowercase: anything differing by more than case — `' protagonist'`,
 * `'protagonista'` — is a different value and stays invalid. ASCII enum tokens,
 * so the locale-aware variant is not wanted here.
 */
function canonicalEnum<T extends string>(
  raw: unknown,
  allowed: readonly T[],
): T | undefined {
  if (typeof raw !== 'string') return undefined;
  const lowered = raw.toLowerCase();
  return allowed.find((value) => value === lowered);
}

/** An integer scene reference inside `1..max`. */
function isSceneNumber(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 &&
    value <= max;
}

/**
 * A reference array that must be intact: unique in-range integers, returned
 * sorted. `undefined` means fatal — this is the STRICT rule, and it is not the
 * lossy prop rule below. Nothing is dropped or coerced here, because a
 * character that claims to appear in a scene that does not exist is a broken
 * story, not a story with a stray number.
 */
function validateSceneRefs(value: unknown, max: number): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<number>();
  for (const entry of value) {
    if (!isSceneNumber(entry, max)) return undefined;
    if (seen.has(entry)) return undefined;
    seen.add(entry);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Second line of defence, behind the strict tool.
 *
 * Strict mode guarantees the SHAPE: types, required keys, no extra keys, enum
 * membership. It cannot express any of the rules below — the documented JSON
 * Schema subset has no `minLength`, no `minimum`/`maximum`, and no array-length
 * constraint beyond `minItems: 0|1` — and it does not apply at all on the two
 * documented exceptions (`stop_reason` of `refusal` or `max_tokens`). So the
 * semantic rules live here: non-empty trimmed text, the 12–16 scene window with
 * set-exact `1..N` numbering, normalized-unique names, exactly one protagonist,
 * and reference integrity.
 *
 * Everything is fatal EXCEPT one authorized lossy rule: duplicate and
 * out-of-range `sceneNumbers` on a prop are dropped, and a prop left with fewer
 * than two references is dropped with a warning. That is the only place a story
 * is repaired rather than rejected.
 */
export function validateAndNormalizeStory(data: unknown): StoryValidationResult {
  const errors: StoryValidationError[] = [];
  const warnings: StoryWarning[] = [];
  const fail = (code: string, path: string) => errors.push({ code, path });

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: [{ code: 'NOT_OBJECT', path: '' }] };
  }
  const raw = data as Record<string, unknown>;

  // --- required prose -----------------------------------------------------
  const prose: Partial<Record<'title' | 'summary' | 'spiritualConnection', string>> = {};
  for (const field of ['title', 'summary', 'spiritualConnection'] as const) {
    const value = trimmedString(raw[field]);
    if (value === undefined) fail('EMPTY_STRING', field);
    else prose[field] = value;
  }

  // --- scenes: the window, then set-exact 1..N numbering -------------------
  let sceneCount = 0;
  const sceneRecords: Array<{
    scene: StoryScene;
    raw: Record<string, unknown>;
    index: number;
  }> = [];

  if (!Array.isArray(raw.scenes)) {
    fail('NOT_ARRAY', 'scenes');
  } else if (
    raw.scenes.length < SCENE_COUNT_MIN || raw.scenes.length > SCENE_COUNT_MAX
  ) {
    // Not padded, not truncated, not merged: the count is the provider's
    // answer and a wrong one is a rejection.
    fail('SCENE_COUNT_OUT_OF_RANGE', 'scenes');
  } else {
    sceneCount = raw.scenes.length;
    const numbers = new Set<number>();

    raw.scenes.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        fail('NOT_OBJECT', `scenes[${index}]`);
        return;
      }
      const scene = entry as Record<string, unknown>;

      let number: number | undefined;
      if (!isSceneNumber(scene.number, sceneCount)) {
        fail('SCENE_NUMBER_INVALID', `scenes[${index}].number`);
      } else if (numbers.has(scene.number)) {
        fail('SCENE_NUMBER_DUPLICATE', `scenes[${index}].number`);
      } else {
        numbers.add(scene.number);
        number = scene.number;
      }

      const text = trimmedString(scene.text);
      if (text === undefined) fail('EMPTY_STRING', `scenes[${index}].text`);
      const visualDescription = trimmedString(scene.visualDescription);
      if (visualDescription === undefined) {
        fail('EMPTY_STRING', `scenes[${index}].visualDescription`);
      }

      // Optional, but not "optional means anything goes".
      const landmarkVisible = scene.landmarkVisible;
      const hasLandmarkVisible = landmarkVisible !== undefined;
      if (hasLandmarkVisible && typeof landmarkVisible !== 'boolean') {
        fail('NOT_BOOLEAN', `scenes[${index}].landmarkVisible`);
      }

      if (number !== undefined && text !== undefined && visualDescription !== undefined) {
        sceneRecords.push({
          scene: {
            number,
            text,
            visualDescription,
            ...(typeof landmarkVisible === 'boolean' ? { landmarkVisible } : {}),
          },
          raw: scene,
          index,
        });
      }
    });

    // The SET must be exactly `1..N`.
    //
    // HONEST NOTE: with the per-entry checks above this cannot fire on its own
    // today — a number is only missing from the set because it was already
    // reported as invalid, duplicate, or attached to a non-object entry, so
    // mutation M16 (deleting this check) failed no test. It stays as the
    // invariant stated in one place, and as the net if a per-entry rule is ever
    // relaxed; it is documented as redundant rather than presented as a proof.
    if (numbers.size !== sceneCount) {
      fail('SCENE_NUMBERS_NOT_EXACT', 'scenes');
    }
  }

  // --- characters ---------------------------------------------------------
  const characters: StoryCharacter[] = [];
  /** Normalized key -> the trimmed name to display and to rewrite refs to. */
  const displayNameByKey = new Map<string, string>();

  if (!Array.isArray(raw.characters)) {
    fail('NOT_ARRAY', 'characters');
  } else if (raw.characters.length === 0) {
    fail('EMPTY_ARRAY', 'characters');
  } else {
    let protagonists = 0;

    raw.characters.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        fail('NOT_OBJECT', `characters[${index}]`);
        return;
      }
      const character = entry as Record<string, unknown>;

      const name = trimmedString(character.name);
      if (name === undefined) fail('EMPTY_STRING', `characters[${index}].name`);
      const description = trimmedString(character.description);
      if (description === undefined) {
        fail('EMPTY_STRING', `characters[${index}].description`);
      }
      const visualDescription = trimmedString(character.visualDescription);
      if (visualDescription === undefined) {
        fail('EMPTY_STRING', `characters[${index}].visualDescription`);
      }

      const role = canonicalEnum(character.role, CHARACTER_ROLES);
      if (role === undefined) fail('ENUM_INVALID', `characters[${index}].role`);
      else if (role === 'protagonist') protagonists++;

      let key: string | undefined;
      if (name !== undefined) {
        const candidate = characterNameKey(name);
        if (displayNameByKey.has(candidate)) {
          fail('NAME_NOT_UNIQUE', `characters[${index}].name`);
        } else {
          displayNameByKey.set(candidate, name);
          key = candidate;
        }
      }

      let appearsInScenes: number[] | undefined;
      if (character.appearsInScenes !== undefined) {
        appearsInScenes = validateSceneRefs(character.appearsInScenes, sceneCount);
        if (appearsInScenes === undefined) {
          fail('SCENE_REFS_INVALID', `characters[${index}].appearsInScenes`);
        }
      }

      if (
        name !== undefined && description !== undefined &&
        visualDescription !== undefined && role !== undefined && key !== undefined
      ) {
        characters.push({
          name,
          role,
          description,
          visualDescription,
          ...(appearsInScenes !== undefined ? { appearsInScenes } : {}),
        });
      }
    });

    // "UN personaje principal claramente definido" is a product rule the system
    // prompt states, so a story with none or two is not the story we asked for.
    if (protagonists !== 1) fail('PROTAGONIST_COUNT', 'characters');
  }

  // --- scene -> character references (needs the character table) ----------
  for (const record of sceneRecords) {
    const value = record.raw.charactersInScene;
    if (value === undefined) continue;

    if (!Array.isArray(value)) {
      fail('NOT_ARRAY', `scenes[${record.index}].charactersInScene`);
      continue;
    }

    const seenKeys = new Set<string>();
    const resolved: string[] = [];
    let broken = false;

    for (const entry of value) {
      const name = trimmedString(entry);
      if (name === undefined) {
        broken = true;
        break;
      }
      const key = characterNameKey(name);
      const display = displayNameByKey.get(key);
      // Unknown reference, or the same character twice under two spellings.
      if (display === undefined || seenKeys.has(key)) {
        broken = true;
        break;
      }
      seenKeys.add(key);
      resolved.push(display);
    }

    if (broken) {
      fail('CHARACTER_REF_INVALID', `scenes[${record.index}].charactersInScene`);
      continue;
    }
    record.scene.charactersInScene = resolved;
  }

  // --- props: required, and the ONE lossy rule ----------------------------
  const props: StoryProp[] = [];

  if (raw.props === undefined) {
    // Required, because an omitted `props` is indistinguishable from "this
    // story has no recurring elements" — and the second is `[]`.
    fail('REQUIRED', 'props');
  } else if (!Array.isArray(raw.props)) {
    fail('NOT_ARRAY', 'props');
  } else {
    raw.props.forEach((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        fail('NOT_OBJECT', `props[${index}]`);
        return;
      }
      const prop = entry as Record<string, unknown>;

      const name = trimmedString(prop.name);
      if (name === undefined) fail('EMPTY_STRING', `props[${index}].name`);
      const narrativeRole = trimmedString(prop.narrativeRole);
      if (narrativeRole === undefined) {
        fail('EMPTY_STRING', `props[${index}].narrativeRole`);
      }
      const visualDescription = trimmedString(prop.visualDescription);
      if (visualDescription === undefined) {
        fail('EMPTY_STRING', `props[${index}].visualDescription`);
      }
      const kind = canonicalEnum(prop.kind, PROP_KINDS);
      if (kind === undefined) fail('ENUM_INVALID', `props[${index}].kind`);

      let sceneNumbers: number[] | undefined;
      if (!Array.isArray(prop.sceneNumbers)) {
        fail('NOT_ARRAY', `props[${index}].sceneNumbers`);
      } else if (
        prop.sceneNumbers.some((n) => typeof n !== 'number' || !Number.isInteger(n))
      ) {
        // A fractional or non-number reference is corruption, not noise:
        // silently coercing 2.5 to 2 invents a scene the provider never chose.
        fail('SCENE_REF_NOT_INTEGER', `props[${index}].sceneNumbers`);
      } else {
        // THE LOSSY RULE, and its only scope: duplicates collapse and
        // out-of-range numbers drop. Both are noise in a list whose whole
        // purpose is "draw this the same way in these scenes".
        const kept = new Set<number>();
        for (const n of prop.sceneNumbers as number[]) {
          if (n >= 1 && n <= sceneCount) kept.add(n);
        }
        sceneNumbers = [...kept].sort((a, b) => a - b);
      }

      if (
        name === undefined || narrativeRole === undefined ||
        visualDescription === undefined || kind === undefined ||
        sceneNumbers === undefined
      ) {
        return;
      }

      // "Recurring" means two or more scenes. One is not a consistency
      // constraint, it is just a detail of that scene — so the prop is dropped
      // and the client is told, rather than the whole story being rejected.
      if (sceneNumbers.length < 2) {
        warnings.push(storyWarning('PROP_NOT_RECURRING'));
        return;
      }
      props.push({ name, kind, narrativeRole, visualDescription, sceneNumbers });
    });
  }

  if (errors.length > 0) {
    // Warnings collected from a story that is being thrown away describe
    // nothing the client can act on (PLAN [PD7]).
    return { ok: false, errors };
  }

  return {
    ok: true,
    story: {
      title: prose.title!,
      summary: prose.summary!,
      characters,
      scenes: sceneRecords
        .map((record) => record.scene)
        .sort((a, b) => a.number - b.number),
      props,
      spiritualConnection: prose.spiritualConnection!,
    },
    warnings,
  };
}

/**
 * A log-safe summary of why a story was rejected: this module's own codes and
 * field paths, plus a count. No provider values, no serialized output — the
 * channel PF [B3] closed stays closed.
 */
function describeValidationErrors(errors: StoryValidationError[]): string {
  const shown = errors
    .slice(0, 5)
    .map((error) => (error.path ? `${error.code}@${error.path}` : error.code));
  return `n=${errors.length} ${shown.join(', ')}${
    errors.length > shown.length ? ', …' : ''
  }`;
}

const WARNING_REASONS: Record<ResearchFailureCode, string> = {
  NO_API_KEY: 'Falta la configuración del servicio de investigación visual',
  MODEL_NOT_FOUND: 'El modelo de investigación visual no está disponible',
  PROVIDER_HTTP_ERROR: 'El servicio de investigación visual respondió con un error',
  PROVIDER_UNAVAILABLE: 'El servicio de investigación visual no respondió',
  EMPTY_RESPONSE: 'El servicio de investigación visual no devolvió texto',
  OUTPUT_TRUNCATED: 'La investigación visual quedó cortada por el límite de tokens',
  OUTPUT_BLOCKED: 'El servicio de investigación visual no completó la respuesta',
};

const WARNING_SOURCES: Record<WarningSource, string> = {
  location: 'la investigación del lugar',
  landmark: 'el análisis de las fotos del lugar destacado',
  prop: 'el análisis de las fotos de un elemento recurrente',
};

/**
 * Builds the user-facing message from the code and the call site ONLY.
 *
 * Never from provider output and never from request text: the message is
 * returned to the client and summarised in logs, so interpolating either would
 * reopen the channels PF [B3] closed.
 *
 * The consequence clause is ENVELOPE-NEUTRAL (PC r1 [S1]). The frozen contract
 * puts the same warnings on three envelopes — prompt preview, story success and
 * the downstream error — and `El cuento se generó sin esa información.` was
 * false on two of them: the preview generates no story, and the error envelope
 * reports that story generation failed. One message serves all three, so it
 * states what was lost rather than what became of the story.
 */
function warningMessage(source: WarningSource, code: ResearchFailureCode): string {
  return `${WARNING_REASONS[code]} en ${WARNING_SOURCES[source]}. ` +
    'No se pudo incorporar esa información.';
}

function toWarning(source: WarningSource, result: ResearchResult): ResponseWarning | undefined {
  if (result.status !== 'failed') return undefined;
  return {
    source,
    code: result.code,
    message: warningMessage(source, result.code),
    ...(result.httpStatus !== undefined ? { httpStatus: result.httpStatus } : {}),
    ...(result.finishReason !== undefined ? { finishReason: result.finishReason } : {}),
  };
}

/**
 * The provider's documented `Candidate.finishReason` domain.
 *
 * SOURCE: Google `generativelanguage` v1beta discovery document, revision
 * `20260728` — `schemas.Candidate.properties.finishReason.enum`, fetched from
 * `https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta`.
 * That is the exact API version this handler calls (`/v1beta/models/{model}:
 * generateContent`). Cross-checked, same names, against the googleapis
 * `google/ai/generativelanguage/v1beta/generative_service.proto`
 * (`Candidate.FinishReason`) and the `@google/genai` JS SDK `FinishReason`.
 *
 * Ordered as the provider documents it, so a future re-check is a diff.
 */
const PROVIDER_FINISH_REASONS: ReadonlySet<string> = new Set([
  'FINISH_REASON_UNSPECIFIED',
  'STOP',
  'MAX_TOKENS',
  'SAFETY',
  'RECITATION',
  'LANGUAGE',
  'OTHER',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'MALFORMED_FUNCTION_CALL',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_OTHER',
  'NO_IMAGE',
  'IMAGE_RECITATION',
  'UNEXPECTED_TOOL_CALL',
  'TOO_MANY_TOOL_CALLS',
  'MISSING_THOUGHT_SIGNATURE',
  'MALFORMED_RESPONSE',
  'ESCALATION',
]);

/**
 * `finishReason` is provider-controlled text that this handler both logs and
 * echoes to the client, so it is classified against the DOMAIN above before
 * either. Anything outside it collapses to `DESCONOCIDO`.
 *
 * A shape test is not enough, and that was PC r1 [B1]: `/^[A-Z_]{1,40}$/`
 * accepts any upper-snake-case token, so a provider-controlled value shaped
 * like an enum was logged and returned verbatim. Same shape-vs-domain hole as
 * PF [B3-R] — an accepted lexical shape is not an accepted meaning.
 *
 * The cost is that a genuinely NEW provider reason reports as `DESCONOCIDO`
 * until this list is re-checked against the docs. That is the safe direction:
 * the taxonomy branch it lands in ([PC3], below) is decided by the value being
 * neither `STOP` nor `MAX_TOKENS`, which an unknown reason still is not, so it
 * still degrades to `OUTPUT_BLOCKED` and is still reported — just not named.
 */
function safeFinishReason(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return PROVIDER_FINISH_REASONS.has(raw) ? raw : 'DESCONOCIDO';
}

/**
 * Un intento de reintento en 429/5xx/timeout con backoff corto (respeta Retry-After).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

      if ((response.status === 429 || response.status >= 500) && attempt === 0) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 15_000)
          : 2_000 + Math.random() * 3_000;
        console.warn(`[generate-story] ${label}: ${response.status}, reintentando en ${Math.round(delayMs)}ms`);
        await response.body?.cancel();
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      return response;
    } catch (err) {
      lastErr = err;
      if (attempt === 0) {
        console.warn(`[generate-story] ${label}: error de red/timeout, reintentando: ${describeError(err)}`);
        await new Promise((r) => setTimeout(r, 2_000 + Math.random() * 3_000));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Extrae el texto de una respuesta de Gemini.
 *
 * Concatena las partes de texto y descarta las partes de "pensamiento" (que el
 * modelo sólo devuelve con `includeThoughts`) y las que no traen texto — leer
 * `parts[0].text` a ciegas convertía una respuesta válida cuya primera parte no
 * es texto en un `EMPTY_RESPONSE`.
 */
function extractResearchText(data: unknown): string {
  const parts = (data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown; thought?: unknown }> } }>;
  } | null)?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => p?.thought !== true)
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

/**
 * Hace UNA llamada de investigación a Gemini y la clasifica.
 *
 * Único punto donde se decide `ok` / `failed`, para que la investigación de
 * ubicación y el análisis de fotos no puedan divergir en su taxonomía.
 *
 * Precedencia (PLAN [PC3]): primero `finishReason`, después el texto. Un
 * `MAX_TOKENS` con texto parcial es `OUTPUT_TRUNCATED` y NO aporta ese texto —
 * media descripción se lee igual que una completa y contamina la ilustración.
 */
async function callGeminiResearch(params: {
  config: ProviderConfig;
  body: Record<string, unknown>;
  timeoutMs: number;
  /** Shape-only label; it reaches the retry warnings. */
  label: string;
}): Promise<ResearchResult> {
  const { config, body, timeoutMs, label } = params;

  let response: Response;
  try {
    response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.researchModel}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.googleAiApiKey },
        body: JSON.stringify(body),
      },
      timeoutMs,
      label,
    );
  } catch (err) {
    // fetchWithRetry only throws once BOTH attempts failed at the transport
    // level (network error or the 30s/45s timeout) — nothing was answered.
    console.error(`[generate-story] ${label}: sin respuesta del proveedor: ${describeError(err)}`);
    return { status: 'failed', code: 'PROVIDER_UNAVAILABLE' };
  }

  if (!response.ok) {
    // Shape only: the status is a number, the body is never quoted.
    const httpStatus = Number(response.status);
    await response.body?.cancel();
    const code: ResearchFailureCode = httpStatus === 404 ? 'MODEL_NOT_FOUND' : 'PROVIDER_HTTP_ERROR';
    console.error(`[generate-story] ${label}: ${code} (HTTP ${httpStatus})`);
    return { status: 'failed', code, httpStatus };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    // A 200 whose body is not JSON yields no text and no finish reason: there
    // is nothing to use and nothing more precise to report.
    console.error(`[generate-story] ${label}: respuesta ilegible: ${describeError(err)}`);
    return { status: 'failed', code: 'EMPTY_RESPONSE' };
  }

  const finishReason = safeFinishReason(
    (data as { candidates?: Array<{ finishReason?: unknown }> } | null)?.candidates?.[0]
      ?.finishReason,
  );
  const text = extractResearchText(data);

  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[generate-story] ${label}: OUTPUT_TRUNCATED (${charCount(text)} descartados)`);
    return { status: 'failed', code: 'OUTPUT_TRUNCATED', finishReason };
  }
  if (finishReason !== 'STOP') {
    console.warn(
      `[generate-story] ${label}: OUTPUT_BLOCKED (finishReason ${finishReason ?? 'ausente'})`,
    );
    return { status: 'failed', code: 'OUTPUT_BLOCKED', ...(finishReason ? { finishReason } : {}) };
  }
  if (!text) {
    console.warn(`[generate-story] ${label}: EMPTY_RESPONSE`);
    return { status: 'failed', code: 'EMPTY_RESPONSE', finishReason };
  }

  console.log(`[generate-story] ${label}: ok ${charCount(text)}`);
  return { status: 'ok', text, finishReason: 'STOP' };
}

/**
 * Investiga información visual sobre una ubicación en Chile usando Gemini
 */
async function researchLocation(
  location: string,
  config: ProviderConfig,
): Promise<ResearchResult> {
  if (!config.googleAiApiKey) {
    console.log('[generate-story] No GOOGLE_AI_API_KEY, skipping location research');
    return { status: 'failed', code: 'NO_API_KEY' };
  }

  const researchPrompt = `Necesito información visual detallada sobre "${location}" en Chile para crear ilustraciones de un cuento infantil.

Por favor proporciona:
1. **Características geográficas**: ¿Es costa, montaña, isla, desierto, bosque, ciudad? Describe el paisaje.
2. **Elementos visuales distintivos**: ¿Qué edificios, monumentos, o elementos naturales son característicos? (faros, iglesias, volcanes, playas, etc.)
3. **Colores predominantes**: ¿Qué colores dominan el paisaje? (azul del mar, verde de bosques, colores de casas, etc.)
4. **Arquitectura local**: ¿Cómo son las casas y edificios típicos? (palafitos, casas de madera, adobe, etc.)
5. **Flora y fauna**: ¿Qué plantas y animales son típicos de la zona?
6. **Clima y luz**: ¿Cómo es la luz típica? ¿Hay niebla, sol fuerte, etc.?

Responde en español, de forma concisa pero detallada (máximo 300 palabras). Solo información visual útil para ilustraciones.`;

  return await callGeminiResearch({
    config,
    body: {
      contents: [{ parts: [{ text: researchPrompt }] }],
      generationConfig: {
        maxOutputTokens: RESEARCH_MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingLevel: RESEARCH_THINKING_LEVEL },
      },
    },
    timeoutMs: 30_000,
    label: 'investigación de ubicación',
  });
}

/**
 * Construye el prompt de análisis visual según el tipo de elemento
 * (landmark/edificio, lugar/escenario, u objeto/prop)
 */
function buildVisualAnalysisPrompt(
  name: string,
  narrativeRole: string,
  kind: 'landmark' | 'location' | 'prop'
): string {
  if (kind === 'prop') {
    return `Analiza las fotos de referencia del objeto "${name}" y proporciona una descripción visual extremadamente detallada para usar en prompts de generación de imágenes de un cuento infantil ilustrado.

Contexto narrativo: ${narrativeRole}

Describe con el máximo detalle posible:
1. Forma y estructura general del objeto
2. Materiales y texturas visibles (madera, metal, tela, cuero, etc.)
3. Colores específicos de cada parte
4. Elementos distintivos, ornamentos o decoraciones
5. Proporciones relativas (tamaño respecto a una mano humana u otro objeto de referencia)
6. Estado, desgaste visible y detalles únicos que lo hacen reconocible

Responde en español, en un solo párrafo denso de máximo 200 palabras. Solo información visual útil para que un modelo de IA pueda recrear fielmente este objeto en ilustraciones infantiles. NO incluyas historia ni datos culturales — solo lo visual.`;
  }

  if (kind === 'location') {
    return `Analiza las fotos de referencia del lugar "${name}" y proporciona una descripción visual extremadamente detallada para usar en prompts de generación de imágenes de un cuento infantil ilustrado.

Contexto narrativo: ${narrativeRole}

Describe con el máximo detalle posible:
1. Características geográficas y topografía (costa, montaña, bosque, interior, etc.)
2. Vegetación y fauna visible
3. Colores predominantes del entorno
4. Elementos construidos o naturales distintivos
5. Iluminación y clima típicos
6. Proporciones, perspectiva y puntos de referencia visuales

Responde en español, en un solo párrafo denso de máximo 200 palabras. Solo información visual útil para que un modelo de IA pueda recrear fielmente este lugar en ilustraciones infantiles. NO incluyas historia ni datos culturales — solo lo visual.`;
  }

  // default: landmark (edificio / monumento)
  return `Analiza las fotos de referencia de "${name}" y proporciona una descripción visual extremadamente detallada para usar en prompts de generación de imágenes de un cuento infantil ilustrado.

Contexto narrativo: ${narrativeRole}

Describe con el máximo detalle posible:
1. Forma y estructura: Forma general del edificio/landmark, número de pisos, torres, techos, cúpulas
2. Materiales y texturas: Tipo de construcción (piedra, madera, adobe, concreto), texturas visibles
3. Colores específicos: Colores exactos de paredes, techos, puertas, ventanas, detalles
4. Elementos arquitectónicos: Puertas, ventanas, columnas, arcos, campanarios, escaleras, balcones
5. Elementos decorativos: Cruces, vitrales, molduras, inscripciones, ornamentos
6. Proporciones: Relación de tamaño con personas, árboles u otros elementos de escala
7. Entorno inmediato: Tipo de suelo, vegetación, elementos que rodean el landmark

Responde en español, en un solo párrafo denso de máximo 200 palabras. Solo información visual útil para que un modelo de IA pueda recrear fielmente este landmark en ilustraciones infantiles. NO incluyas historia ni datos culturales — solo lo visual.`;
}

/**
 * Analiza fotos de referencia de un elemento visual (landmark, lugar u objeto)
 * usando Gemini Vision y devuelve una descripción visual detallada.
 *
 * Helper genérico que reemplaza al antiguo `analyzeLandmarkImages` y se usa
 * tanto para landmarks como para props recurrentes del cuento.
 */
async function analyzeImagesForVisualDescription(params: {
  name: string;
  narrativeRole: string;
  /** Already validated and materialised by FASE F pass 1/pass 2. */
  referenceImages: MaterializedImage[];
  kind?: 'landmark' | 'location' | 'prop';
  config: ProviderConfig;
}): Promise<ResearchResult> {
  const { name, narrativeRole, referenceImages, config } = params;
  const kind = params.kind ?? 'landmark';

  // Order matters. "No photos" is checked FIRST because it is not a
  // degradation: there was never an analysis to run, so it must not raise a
  // warning. A missing key on an entity the user gave no photos for would
  // otherwise manufacture a failure report, and the location research already
  // surfaces NO_API_KEY once for the whole request.
  if (!Array.isArray(referenceImages) || referenceImages.length === 0) {
    console.log(`[generate-story] No ${kind} images (${charCount(name)}), skipping analysis`);
    return { status: 'skipped', code: 'NO_IMAGES' };
  }
  if (!config.googleAiApiKey) {
    console.log(`[generate-story] No API key for ${kind} analysis (${charCount(name)})`);
    return { status: 'failed', code: 'NO_API_KEY' };
  }

  const analysisPrompt = buildVisualAnalysisPrompt(name, narrativeRole, kind);

  // Build multimodal request with images
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  parts.push({ text: analysisPrompt });

  // No parsing here any more: pass 1 stripped any data-URL wrapper and the
  // MIME type comes from the content's magic bytes, not from a client claim.
  for (const img of referenceImages.slice(0, 4)) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.base64,
      },
    });
  }

  console.log(`[generate-story] Analyzing ${referenceImages.length} ${kind} images (${charCount(name)})`);

  return await callGeminiResearch({
    config,
    body: {
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: RESEARCH_MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingLevel: RESEARCH_THINKING_LEVEL },
      },
    },
    timeoutMs: 45_000,
    // Shape only: this label reaches the retry warnings, and `name` is
    // client text — the retry path was the last channel carrying it raw.
    label: `análisis visual (${kind}, ${charCount(name)})`,
  });
}

// Nombres prohibidos - niños de la comunidad CASA
const FORBIDDEN_NAMES = [
  'Matías', 'Emilia', 'Tomás', 'Amanda', 'Matilde',
  'Leonor', 'Timoteo', 'Rocío', 'Renato', 'Rafael',
  'Sofía', 'Martín', 'Isidora', 'Benjamín', 'Florencia',
  'Agustín', 'Catalina', 'Vicente', 'Valentina', 'Joaquín',
  'Antonia', 'Maximiliano', 'Fernanda', 'Sebastián', 'Josefa',
  'Alonso', 'Trinidad', 'Nicolás', 'Maite', 'Lucas',
  'Ignacia', 'Felipe', 'Pascuala', 'Diego', 'Esperanza',
  'Gabriel', 'Paz', 'Daniel', 'Colomba', 'Samuel',
  'Montserrat', 'Facundo', 'Javiera', 'Gaspar', 'Julieta',
  'Simón', 'Agustina', 'Mateo', 'Isabella', 'Santiago',
  'Antonella', 'José', 'María', 'Pedro', 'Juan',
  'Francisca', 'Francisco', 'Camila', 'Pablo', 'Constanza'
];

// System prompt para Claude - Especializado en cuentos infantiles cristocéntricos
const SYSTEM_PROMPT = `Eres un cuentacuentos experto en crear historias para niños pequeños en el contexto de una comunidad cristiana progresiva e inclusiva (CASA - Comunidad Anglicana San Andrés).

## Tu Tarea
Escribir un cuento breve para el momento del "Cuentacuento" durante la liturgia dominical.

## Especificaciones del Cuento

### Audiencia
- Niños y niñas de aproximadamente 7 años
- Lenguaje claro, sencillo y accesible
- Oraciones cortas y vocabulario apropiado para la edad

### Duración
- Máximo 5 minutos de lectura en voz alta
- EXACTAMENTE 15 escenas (mínimo 12, máximo 16)

### Estructura Narrativa
- UN personaje principal claramente definido (no pueden haber dos protagonistas)
- Puede haber personajes secundarios que acompañen o desafíen al protagonista
- Debe tener tensión dramática: un problema, dilema o conflicto
- Debe tener una resolución clara y satisfactoria

### Enfoque Cristocéntrico
- La historia debe tener una referencia a Jesús, ya sea directa o simbólica
- O bien debe conectar con una enseñanza del Evangelio
- Esta referencia debe ser significativa pero NO forzada ni doctrinal
- Evitar ser predicador o moralizante; que la enseñanza emerja naturalmente

### Para las Ilustraciones
- Cada escena debe poder visualizarse como una imagen estática
- Describir escenas con buena iluminación (evitar escenas oscuras porque la proyección no se ve bien)
- Las escenas deben tener elementos visuales interesantes

### Nombres Prohibidos
NO uses estos nombres porque pertenecen a niños de la comunidad:
${FORBIDDEN_NAMES.join(', ')}

## IMPORTANTE: Lugares y Objetos Recurrentes (array "props")

Además de los personajes, debes listar en el array "props" TODO lugar u objeto
que aparezca en 2 o más escenas y que deba verse IGUAL en todas ellas:
- Objetos: un auto, un bote, un sombrero, un tesoro, una carreta, etc.
- Lugares/edificios específicos: una iglesia, una casa, un faro, una plaza, etc.

Para cada uno entrega:
- name: nombre corto y estable (ej: "el auto rojo del abuelo")
- kind: "location" para lugares/edificios, "prop" para objetos
- narrativeRole: su rol en la historia en una frase
- visualDescription: descripción visual CANÓNICA y muy detallada (forma,
  colores exactos, materiales, proporciones, detalles distintivos). Esta
  descripción se copiará textualmente en cada ilustración donde aparezca,
  así que debe ser autocontenida y repetible.
- sceneNumbers: números de las escenas donde aparece

NO incluyas en "props": personas o animales (van en "characters"), ni el
paisaje general del lugar (eso va en la ambientación de cada escena).

## IMPORTANTE: Lista de Personajes

Debes incluir en el array "characters" ABSOLUTAMENTE TODOS los personajes que aparecen en el cuento, incluyendo:
- El protagonista (role: "protagonist")
- Personajes secundarios recurrentes que aparecen en múltiples escenas (role: "secondary")
- Personajes menores que aparecen en una o dos escenas (role: "minor")

Por ejemplo, si hay un alcalde, un pescador, una abuela, etc. que aparecen en alguna escena, TODOS deben estar listados con su visualDescription detallada.

Cada personaje DEBE tener una visualDescription muy detallada y consistente que incluya:
- Edad aproximada
- Contextura física
- Color y estilo de pelo
- Color de piel
- Ropa característica (colores específicos)
- Rasgos distintivos (barba, lentes, sombrero, etc.)

## Formato de Respuesta
CRÍTICO: Tu respuesta debe ser ÚNICAMENTE un objeto JSON válido. No incluyas ningún texto antes o después del JSON. No uses bloques de código markdown. Solo el JSON puro.

El JSON debe tener esta estructura exacta:
{"title":"string","summary":"string","characters":[{"name":"string","role":"protagonist|secondary|minor","description":"string","visualDescription":"string","appearsInScenes":[1,2,3]}],"scenes":[{"number":1,"text":"string","visualDescription":"string","charactersInScene":["name1","name2"],"landmarkVisible":true}],"spiritualConnection":"string","props":[{"name":"string","kind":"location|prop","narrativeRole":"string","visualDescription":"string","sceneNumbers":[2,5]}]}

Donde:
- title: Título del cuento
- summary: Resumen en una oración
- characters: Array con TODOS los personajes (protagonist, secondary, minor)
  - visualDescription debe ser MUY detallada: edad, contextura, pelo, piel, ropa con colores específicos
  - appearsInScenes: números de escenas donde aparece
- scenes: Array de 12-16 escenas
  - text: 2-4 oraciones para leer en voz alta
  - visualDescription: descripción visual detallada, bien iluminada
  - charactersInScene: nombres de personajes en la escena
  - landmarkVisible: boolean, true si el landmark/edificio debe aparecer visible en la ilustración de esta escena
- spiritualConnection: conexión con el Evangelio
- props: Array de lugares u objetos recurrentes (ver la sección de arriba).
  Siempre debe estar presente: usa [] si el cuento no tiene ninguno.
  - sceneNumbers: números de las escenas donde aparece (2 o más)`;

/**
 * Schema del tool `emit_story`, declarado en modo estricto.
 *
 * Con `strict: true` (en la definición del tool, no aquí) la API restringe el
 * muestreo a salidas válidas según este schema, así que cada pin de abajo es una
 * garantía y no una sugerencia:
 *
 *   * `additionalProperties: false` en la raíz y en CADA objeto anidado. Sin
 *     esto el modelo puede añadir campos que ningún consumidor lee.
 *   * `props` es requerido. Un `props` ausente y un `props: []` significan cosas
 *     distintas — "no me acordé" y "no hay elementos recurrentes" — y sólo el
 *     segundo es una respuesta.
 *   * `integer` (no `number`) en todo número de escena: `2.5` no es una escena.
 *
 * Lo que este schema NO puede expresar, y por eso vive en
 * `validateAndNormalizeStory`: el rango de 12–16 escenas, la numeración exacta
 * `1..N`, y "texto no vacío". El subconjunto de JSON Schema documentado no
 * admite `minimum`/`maximum`, ni `minLength`, ni restricciones de largo de array
 * más allá de `minItems: 0|1`.
 */
const STORY_TOOL_SCHEMA = {
  type: 'object',
  required: ['title', 'summary', 'characters', 'scenes', 'spiritualConnection', 'props'],
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'role', 'description', 'visualDescription'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: ['protagonist', 'secondary', 'minor'] },
          description: { type: 'string' },
          visualDescription: { type: 'string' },
          appearsInScenes: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['number', 'text', 'visualDescription'],
        additionalProperties: false,
        properties: {
          number: { type: 'integer' },
          text: { type: 'string' },
          visualDescription: { type: 'string' },
          charactersInScene: { type: 'array', items: { type: 'string' } },
          landmarkVisible: { type: 'boolean' },
        },
      },
    },
    // spiritualConnection va ANTES de props: si el output alcanza max_tokens,
    // el corte cae en props (el último campo) y no en un campo de prosa.
    spiritualConnection: { type: 'string' },
    props: {
      type: 'array',
      description: 'Lugares y objetos que aparecen en 2+ escenas y deben verse idénticos entre ilustraciones. [] si no hay ninguno.',
      items: {
        type: 'object',
        required: ['name', 'kind', 'narrativeRole', 'visualDescription', 'sceneNumbers'],
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['location', 'prop'] },
          narrativeRole: { type: 'string' },
          visualDescription: { type: 'string' },
          sceneNumbers: { type: 'array', items: { type: 'integer' } },
        },
      },
    },
  },
} as const;

/**
 * Construye el prompt del usuario con la información de la liturgia y preferencias
 */
function buildUserPrompt(data: {
  context: {
    title: string;
    summary: string;
    readings: Array<{ reference: string; text: string }>;
    reflexionText?: string;
  };
  location: string;
  locationResearch: string;
  characters: string[];
  landmarks?: Array<{ name: string; narrativeRole: string; visualDescription: string; role: string }>;
  props?: Array<{ name: string; kind: string; narrativeRole: string; visualDescription: string; role: string }>;
  style: string;
  additionalNotes: string;
}): string {
  const { context, location, locationResearch, characters, landmarks, props, style, additionalNotes } = data;

  // Safely handle readings array - ensure it exists and is an array
  const readings = Array.isArray(context?.readings) ? context.readings : [];
  const readingsText = readings.length > 0
    ? readings.map((r, i) => `### Lectura ${i + 1}: ${r?.reference || 'Sin referencia'}\n${r?.text || ''}`).join('\n\n')
    : '### Lecturas\nNo hay lecturas disponibles';

  const styleDescriptions: Record<string, string> = {
    aventura: 'emocionante, con acción y momentos de suspenso positivo',
    reflexivo: 'contemplativo, con momentos de silencio y descubrimiento interior',
    humoristico: 'divertido, con situaciones graciosas y personajes simpáticos',
    misterio: 'intrigante, con un pequeño misterio que resolver',
  };

  // Safely handle characters array
  const safeCharacters = Array.isArray(characters) ? characters : [];

  // Incluir texto de reflexión si está disponible
  const reflexionSection = context?.reflexionText ? `

### Texto de la Reflexión del Predicador
${context.reflexionText}

NOTA IMPORTANTE: Este es el texto completo de la reflexión que el predicador dará después del cuento.
El cuento debe preparar a los niños para recibir este mensaje, usando metáforas y situaciones que
conecten con los temas de la reflexión de manera natural y apropiada para su edad.
` : '';

  return `## Información de la Liturgia

### Título/Tema
${context?.title || 'Sin título'}

### Resumen del Mensaje
${context?.summary || 'No disponible'}

${readingsText}
${reflexionSection}
---

## Parámetros del Cuento

### Lugar
${location || 'Chile'}
(Ambienta la historia en este lugar de Chile, usando detalles locales reconocibles)

${locationResearch ? `### Información Visual del Lugar (investigación real)
${locationResearch}
` : ''}
### Personajes Sugeridos
${safeCharacters.length > 0 ? safeCharacters.join(', ') : 'A tu elección - crea personajes apropiados para la historia'}

### Estilo Narrativo
${styleDescriptions[style] || style}

### Notas Adicionales del Usuario
${additionalNotes || 'Ninguna'}
${landmarks && landmarks.length > 0 ? `
### Landmark / Edificio como "Personaje" Visual
${landmarks.map(lm => `
**${lm.name}**
- Rol narrativo: ${lm.narrativeRole}
- Prominencia: ${lm.role === 'primary' ? 'PRINCIPAL — debe aparecer en muchas escenas (al menos la mitad)' : 'SECUNDARIO — aparece en algunas escenas (3-4)'}
${lm.visualDescription ? `- Descripción visual (analizada de fotos reales): ${lm.visualDescription}` : ''}

IMPORTANTE: Trata "${lm.name}" casi como un personaje más. Cuando aparezca en una escena, incluye detalles visuales específicos del landmark en la visualDescription de esa escena. Marca "landmarkVisible": true en cada escena donde el landmark debe verse en la ilustración.
`).join('\n')}` : ''}
${props && props.length > 0 ? `
### Referencias visuales (elementos recurrentes)
${props.map(p => `
**${p.name}**
- Tipo: ${p.kind === 'location' ? 'Lugar / escenario' : 'Objeto / prop'}
- Rol narrativo: ${p.narrativeRole}
${p.visualDescription ? `- Descripción visual (analizada de fotos reales): ${p.visualDescription}` : ''}
`).join('\n')}
IMPORTANTE: Estos elementos deben aparecer de manera consistente en cualquier escena cuya descripción visual (visualDescription) los mencione. Cuando incluyas uno de estos elementos en una escena, usa los mismos detalles visuales descritos arriba para mantener coherencia entre ilustraciones.
` : ''}
---

Por favor, crea un cuento original basándote en esta información. El cuento debe:
- Durar 3-5 minutos al ser leído en voz alta (aproximadamente 400-600 palabras)
- Estar dividido en párrafos cortos para facilitar la lectura
- Transmitir el mensaje espiritual de forma implícita, no explícita
- Ser apropiado para niños de 5-10 años${context?.reflexionText ? '\n- Conectar con los temas de la reflexión del predicador de manera sutil' : ''}`;
}

/**
 * Builds one of the two typed JSON error envelopes (PLAN G3).
 *
 * Field order is the contract's: `success`, `code`, `error`, then the additive
 * keys — and each additive key appears only when it has something to report, so
 * a failure with no drops and no degradation produces the body it produced
 * before PD plus the new `code`.
 */
function typedErrorResponse(params: {
  status: number;
  code: 'PROVIDER_OUTPUT_INVALID' | 'CLIENT_INPUT_INVALID';
  error: string;
  skippedImages: Array<{ field: string; code: string }>;
  warnings: EnvelopeWarning[];
}): Response {
  const { status, code, error, skippedImages, warnings } = params;
  return new Response(
    JSON.stringify({
      success: false,
      code,
      error,
      // PFE consumes `skippedImages` from non-2xx invoke bodies; PC-UI consumes
      // `warnings` from both. Neither may be renamed or dropped on a 502.
      ...(skippedImages.length > 0 ? { skippedImages } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function createHandler(
  deps: HandlerDeps,
): (req: Request) => Promise<Response> {
  const config: ProviderConfig = {
    anthropicApiKey: deps.anthropicApiKey,
    googleAiApiKey: deps.googleAiApiKey,
    researchModel: deps.researchModel,
  };
  const limits: ImageLimits = deps.imageLimits ?? DEFAULT_IMAGE_LIMITS;
  // Checked once here rather than per-request after the downloads (see the
  // sibling handler): the key is constant per deployment.
  const missingApiKey = !deps.anthropicApiKey;

  return async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // F0 fail-closed authz: runs BEFORE req.json(), any download, Storage, or the
  // provider. Missing/invalid token => 401, denied => 403, backend error => 503.
  const authz = await requireLiturgyWriter(req, deps.authzDeps, corsHeaders);
  if (!authz.ok) {
    return authz.response;
  }

  if (missingApiKey) {
    console.error('[generate-story] ANTHROPIC_API_KEY no está configurada');
    return new Response(
      JSON.stringify({ success: false, error: 'El servicio de cuentos no está configurado.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // FASE F pass 1 + pass 2, before Gemini research/analysis and before
  // Anthropic. One untrusted image entry aborts the whole request with zero
  // fetches and zero provider spend (T-F.9).
  //
  // The whole block sits INSIDE the try that produces the JSON+CORS error
  // response, so nothing can escape into `serve`'s CORS-less plain-text 500.
  //
  // Declared OUTSIDE that try: drops are recorded during the image phase, but
  // the response that reports them is written much later. When a provider
  // failure escalated to the outer catch, the report was simply lost — a photo
  // the user had uploaded had been dropped, and the only response they got
  // said "Error de Claude API: 400". PFE consumes this field, so the catch
  // adds it and changes nothing else.
  let skippedImages: Array<{ field: string; code: string }> = [];

  // Same reason as `skippedImages`, one stage later: research degradation is
  // recorded before Claude is called, and the envelope that reports it may be
  // the outer catch's. Declared here so a provider failure AFTER research
  // cannot silently swallow the fact that the story was written blind.
  // Widened by PD from `ResponseWarning[]`: story normalization appends its own
  // entries to the SAME list, after PC's, so a client parses one array.
  const warnings: EnvelopeWarning[] = [];

  try {
    // deno-lint-ignore no-explicit-any
    let requestData: any;
    let sourceImages: Map<string, MaterializedImage>;
    let skipped: SkippedImage[];
    try {
      requestData = await readBoundedJson(req, limits);

      // See the scene handler: the slot ceiling binds during traversal.
      const prevalidated = prevalidateImageRefs(collectStoryImageRefs(requestData, limits), {
        limits,
        supabaseUrl: deps.supabaseUrl,
      });
      const result = await materializeImageRefs(prevalidated, { limits });
      sourceImages = result.images;
      skipped = result.skipped;
    } catch (err) {
      if (err instanceof ImageRefError) {
        // A failure on the BODY itself — unparseable JSON, or a stream that was
        // cut off — is client input, not an image problem, and PD gives it the
        // typed 400 [PD6] requires. `readBoundedJson` reports both through
        // PF's image error type with `path: 'body'`, which is where the
        // misnomer came from; every other ImageRefError, including
        // `BODY_TOO_LARGE`, keeps PF's exact status, code and envelope.
        if (err.path === 'body' && err.code === 'INVALID_IMAGE_REF') {
          throw new ClientInputError(400, err.message);
        }
        console.warn(`[generate-story] request rejected: ${err.code} at ${err.path}`);
        return imageErrorResponse(err, corsHeaders);
      }
      throw err;
    }

    // An unusable individual photo drops out of the analysis rather than
    // failing the whole story generation.
    if (skipped.length > 0) {
      console.warn(
        `[generate-story] ${skipped.length} image(s) skipped: ` +
          skipped.map((s) => `${s.path}=${s.code}`).join(', '),
      );
    }
    // Reported to the client, not just the log: a photo silently missing from
    // the analysis is indistinguishable from one that was used.
    skippedImages = skipped.map((s) => ({ field: s.path, code: s.code }));

    // The SAME consumption plan pass 1 used, so `takeImages` cannot read a
    // field the collector never marked consumed. One edit moves both.
    const reads = storyImageReadSet(requestData);

    /**
     * Materialised images for a `referenceImages` array, in slot order.
     *
     * Bounded by what pass 1 could possibly have produced, NOT by a length
     * taken from the request: `referenceImages` is client JSON, so
     * `{"length": 1e9}` drove this loop a billion times. The base code was
     * accidentally safe here because it called `.slice()`, which a non-array
     * does not have.
     */
    const takeImages = (prefix: string, raw: unknown): MaterializedImage[] => {
      const field = imageFieldOf(prefix);
      if (!reads.has(field)) {
        // Same fail-closed rule as the scene handler: a field this function
        // does not declare as analysed is not fetched, so it must not be
        // readable here either. Shape only — no values in the log.
        console.warn('[generate-story] field not in the consumption plan; ignored', { field });
        return [];
      }
      const available = Array.isArray(raw) ? raw.length : 0;
      const bound = Math.min(available, limits.maxImagesPerField);
      const out: MaterializedImage[] = [];
      for (let j = 0; j < bound; j++) {
        const img = sourceImages.get(`${prefix}[${j}]`);
        if (img) out.push(img);
      }
      return out;
    };

    const { context, location, characters, landmarks, props, style, additionalNotes, previewPromptOnly } = requestData;

    if (!context || !location) {
      // Typed, so it lands on 422 CLIENT_INPUT_INVALID instead of the generic
      // 500. The PREDICATE is deliberately unchanged: `!location` already
      // rejects the empty string, and tightening it to reject whitespace-only
      // input would be a NEW rejection class for a payload 96cb2cc served —
      // exactly the "rejects too much" regression that failed FASE F twice.
      throw new ClientInputError(422, 'Se requiere contexto de la liturgia y ubicación');
    }

    console.log(`[generate-story] Generando cuento; título ${charCount(context?.title)}`);
    console.log(`[generate-story] Ubicación ${charCount(location)}, Estilo ${charCount(style)}`);
    console.log(`[generate-story] Landmarks: ${landmarks?.length || 0}, Props: ${props?.length || 0}`);
    console.log(`[generate-story] Texto de reflexión: ${context.reflexionText ? `${context.reflexionText.length} caracteres` : 'No disponible'}`);

    // Investigación de ubicación + análisis de fotos de landmarks/props en paralelo:
    // son llamadas independientes a Gemini y ninguna lanza excepciones (devuelven
    // un resultado discriminado, nunca un throw).
    const landmarkList: Array<{ name: string; narrativeRole: string; referenceImages?: string[]; role?: string }> =
      Array.isArray(landmarks) ? landmarks : [];
    const propList: Array<{ id: string; name: string; kind?: string; narrativeRole?: string; referenceImages?: string[]; role?: string }> =
      Array.isArray(props) ? props : [];

    console.log(`[generate-story] Investigando ubicación (${charCount(location)}) y analizando ${landmarkList.length} landmarks + ${propList.length} props en paralelo...`);

    const [locationResult, landmarkResults, propResults] = await Promise.all([
      researchLocation(location, config),
      Promise.all(landmarkList.map(async (lm, i) => ({
        name: lm.name,
        narrativeRole: lm.narrativeRole,
        research: await analyzeImagesForVisualDescription({
          name: lm.name,
          narrativeRole: lm.narrativeRole,
          referenceImages: takeImages(
            `landmarks[${i}].referenceImages`,
            lm.referenceImages,
          ),
          kind: 'landmark',
          config,
        }),
        role: lm.role || 'primary',
      }))),
      // Each incoming prop must include `id` so the visual description can be merged
      // back to the originating prop without relying on array order or duplicate names.
      Promise.all(propList.map(async (p, i) => {
        const propKind: 'location' | 'prop' = p.kind === 'location' ? 'location' : 'prop';
        return {
          id: p.id,
          name: p.name,
          kind: propKind,
          narrativeRole: p.narrativeRole || '',
          research: await analyzeImagesForVisualDescription({
            name: p.name,
            narrativeRole: p.narrativeRole || '',
            referenceImages: takeImages(
              `props[${i}].referenceImages`,
              p.referenceImages,
            ),
            kind: propKind,
            config,
          }),
          role: p.role || 'secondary',
        };
      })),
    ]);

    // Failed research becomes a warning; failed OR skipped research contributes
    // empty text, so the story is still written — just without that detail.
    // Order is call order: location, landmarks, props.
    for (
      const [source, results] of [
        ['location', [locationResult]],
        ['landmark', landmarkResults.map((l) => l.research)],
        ['prop', propResults.map((p) => p.research)],
      ] as Array<[WarningSource, ResearchResult[]]>
    ) {
      for (const result of results) {
        const warning = toWarning(source, result);
        if (warning) warnings.push(warning);
      }
    }

    const locationResearch = locationResult.status === 'ok' ? locationResult.text : '';
    const landmarkAnalyses = landmarkResults.map(({ research, ...rest }) => ({
      ...rest,
      visualDescription: research.status === 'ok' ? research.text : '',
    }));
    const propAnalyses = propResults.map(({ research, ...rest }) => ({
      ...rest,
      visualDescription: research.status === 'ok' ? research.text : '',
    }));

    // Shape and count only: `source` and `code` are this module's own closed
    // enums, never provider or client text.
    console.log(
      `[generate-story] Investigación: ${
        [locationResult, ...landmarkResults.map((l) => l.research), ...propResults.map((p) => p.research)]
          .filter((r) => r.status === 'ok').length
      } ok, ${warnings.length} con advertencia`,
    );
    if (warnings.length > 0) {
      console.warn(
        `[generate-story] investigación degradada: ${
          warnings.map((w) => `${w.source}=${w.code}`).join(', ')
        }`,
      );
    }

    // Si solo quieren ver el prompt, devolverlo sin generar
    if (previewPromptOnly) {
      const userPrompt = buildUserPrompt({
        context,
        location,
        locationResearch,
        characters: characters || [],
        landmarks: landmarkAnalyses.length > 0 ? landmarkAnalyses : undefined,
        props: propAnalyses.length > 0 ? propAnalyses : undefined,
        style: style || 'reflexivo',
        additionalNotes: additionalNotes || ''
      });
      return new Response(
        JSON.stringify({
          success: true,
          skippedImages,
          // Additive, and omitted when empty: a request whose research all
          // succeeded produces the body it produced before.
          ...(warnings.length > 0 ? { warnings } : {}),
          promptPreview: {
            systemPrompt: SYSTEM_PROMPT,
            userPrompt: userPrompt,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Construir prompt con la investigación de ubicación
    const userPrompt = buildUserPrompt({
      context,
      location,
      locationResearch,
      characters: characters || [],
      landmarks: landmarkAnalyses.length > 0 ? landmarkAnalyses : undefined,
      props: propAnalyses.length > 0 ? propAnalyses : undefined,
      style: style || 'reflexivo',
      additionalNotes: additionalNotes || ''
    });

    // Llamar a Claude API con tool forzado para salida estructurada
    const response = await fetchWithRetry(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 16384,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          tools: [
            {
              name: 'emit_story',
              description: 'Emite el cuento infantil completo en formato estructurado',
              // Top-level, beside `name`/`description`/`input_schema` — that is
              // where the API reads it. Inside `input_schema` it is an ignored
              // extra key, which is silent: the request still succeeds and the
              // output is simply unconstrained.
              strict: true,
              input_schema: STORY_TOOL_SCHEMA,
            },
          ],
          tool_choice: { type: 'tool', name: 'emit_story' },
        }),
      },
      120_000,
      'Claude'
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generate-story] Error de API: ${response.status} ${bodyShape(errorText)}`);
      throw new Error(`Error de Claude API: ${response.status}`);
    }

      // ---- the response-body guard (PD review [B1]) -----------------------
      //
      // A provider 200 is not yet a provider answer: the body is raw
      // provider-controlled bytes until the parse succeeds, and V8's
      // SyntaxError quotes those leading bytes back in its own message.
      // Letting that error escape to the generic 500 echoed provider text to
      // the client, so the engine error is never bound at all — the guard
      // reports through the fixed module literal only.
      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        throw new ProviderOutputError(
          "INVALID_STORY",
          "response body not JSON",
        );
      }
      // `null`, scalars and arrays are all valid JSON that still cannot carry
      // the protocol: reading `stop_reason` off `null` was a TypeError whose
      // engine message reached the client the same way.
      if (
        parsed === null || typeof parsed !== "object" || Array.isArray(parsed)
      ) {
        throw new ProviderOutputError(
          "INVALID_STORY",
          "response body not an object",
        );
      }
      // The three fields the success path reads, typed no wider than it reads
      // them. Runtime-identical to the untyped parse this replaces.
      const data = parsed as {
        stop_reason?: unknown;
        content?: unknown;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

    // ---- the stop_reason protocol (PLAN G5) -------------------------------
    //
    // `stop_reason` is read BEFORE any content, because strict mode has two
    // DOCUMENTED exceptions that both return HTTP 200 with output that does not
    // match the schema: `refusal` and `max_tokens`. Reading content first would
    // serve a refusal's leftovers as a story.
    //
    // A normal client tool completion is `stop_reason: 'tool_use'`. Anything
    // else — `end_turn`, `stop_sequence`, `pause_turn`, an absent reason, or a
    // value this code has never heard of — is not the success protocol, and the
    // safe direction is to say so rather than to guess.
    const stopReason: unknown = data.stop_reason;
    if (stopReason === 'refusal') {
      throw new ProviderOutputError('REFUSAL');
    }
    if (stopReason === 'max_tokens') {
      throw new ProviderOutputError('MAX_TOKENS');
    }
    if (stopReason !== 'tool_use') {
      // Shape only: the raw reason is provider-controlled text, so it is neither
      // logged nor returned. PC r1 [B1] is the same lesson one field over.
      throw new ProviderOutputError('INVALID_STORY', 'stop_reason not tool_use');
    }

    const contentBlocks: Array<{ type?: string; name?: string; input?: unknown }> =
      Array.isArray(data.content) ? data.content : [];

    // EXACTLY one matching block. Zero is no story; two is two stories and no
    // way to know which one the model meant.
    const storyBlocks = contentBlocks.filter(
      (b) => b?.type === 'tool_use' && b?.name === 'emit_story',
    );
    if (storyBlocks.length !== 1) {
      throw new ProviderOutputError(
        'INVALID_STORY',
        `emit_story blocks n=${storyBlocks.length}`,
      );
    }

    // NO text/regex/JSON.parse fallback any more. With a forced strict tool,
    // prose is not a second success protocol — it is the model failing to
    // answer, and parsing it was how a story that never passed the schema
    // reached the client.
    const validated = validateAndNormalizeStory(storyBlocks[0].input);
    if (!validated.ok) {
      throw new ProviderOutputError(
        'INVALID_STORY',
        describeValidationErrors(validated.errors),
      );
    }
    const story = validated.story;
    // Appended AFTER PC's research entries, and only now that the story is
    // known good: warnings about a story that was rejected describe nothing the
    // client can act on.
    warnings.push(...validated.warnings);

    console.log(`[generate-story] Cuento generado exitosamente; título ${charCount(story.title)}`);
    console.log(`[generate-story] Escenas: ${story.scenes?.length || 0}, Personajes: ${story.characters?.length || 0}, Props sugeridos: ${story.props?.length || 0}`);

    // Props sugeridos por el modelo (lugares/objetos recurrentes inventados por
    // el cuento). Se excluyen los que el usuario ya definió con fotos propias
    // (match por nombre, sin distinguir mayúsculas ni artículos iniciales).
    const normalizePropName = (n: string) =>
      n.toLowerCase().trim().replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
    const userPropNames = new Set(propList.map((p) => normalizePropName(p.name || '')));
    // `story.props` is now always an array of fully-validated props, so the old
    // per-entry emptiness guards are gone: the only filter left is the one that
    // was ever load-bearing — excluding props the user already defined.
    const suggestedProps = story.props.filter(
      (p) => !userPropNames.has(normalizePropName(p.name))
    );

    // Construir el contenido como texto plano para compatibilidad
    const contentText = Array.isArray(story.scenes)
      ? story.scenes.map((s: { text: string }) => s.text).join('\n\n')
      : '';

    return new Response(
      JSON.stringify({
        success: true,
        skippedImages,
        // Additive, and omitted when empty (see the preview envelope).
        ...(warnings.length > 0 ? { warnings } : {}),
        // Nuevo formato estructurado
        title: story.title,
        summary: story.summary,
        characters: story.characters,
        scenes: story.scenes,
        spiritualConnection: story.spiritualConnection,
        // Landmark analysis results (visual descriptions from Gemini)
        landmarkAnalyses: landmarkAnalyses.length > 0 ? landmarkAnalyses : undefined,
        // Prop analysis results (visual descriptions from Gemini) for recurring elements.
        // Returned as `[{ id, visualDescription }]` so the caller can merge by id.
        propAnalyses: propAnalyses.map(({ id, visualDescription }) => ({ id, visualDescription })),
        // Lugares/objetos recurrentes propuestos por el modelo (sin id: el
        // cliente los crea como StoryProp con id propio y hoja generada).
        suggestedProps: suggestedProps.length > 0 ? suggestedProps : undefined,
        // Compatibilidad con formato anterior
        content: contentText,
        story: contentText,
        moral: story.spiritualConnection,
        suggestedDuration: Math.ceil((story.scenes?.length || 12) / 3), // ~3 escenas por minuto
        model: MODEL,
        usage: {
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    // Typed errors are MAPPED here, not re-thrown: letting a
    // `ProviderOutputError` reach the generic 500 below is exactly the defect PD
    // closes. The dispatch sits at the TOP of the catch, so the 500 is only ever
    // the fallback branch for something genuinely unexpected.
    if (error instanceof ProviderOutputError) {
      console.error(
        `[generate-story] salida del proveedor rechazada: ${error.reason}` +
          (error.detail ? ` (${error.detail})` : ''),
      );
      return typedErrorResponse({
        status: 502,
        code: 'PROVIDER_OUTPUT_INVALID',
        error: error.message,
        skippedImages,
        warnings,
      });
    }
    if (error instanceof ClientInputError) {
      // Status only: the message is this module's own fixed Spanish copy, so the
      // log has no reason to repeat it.
      console.warn(
        `[generate-story] petición inválida del cliente: HTTP ${error.httpStatus}`,
      );
      return typedErrorResponse({
        status: error.httpStatus,
        code: 'CLIENT_INPUT_INVALID',
        error: error.message,
        skippedImages,
        warnings,
      });
    }

    console.error(`[generate-story] Error: ${describeError(error)}`);

    return new Response(
      JSON.stringify({
        success: false,
        // Behaviour-preserving narrowing of the pre-existing `error.message`:
        // same value for Error and for any thrown object carrying `message`,
        // and the fallback (instead of a TypeError) for null/undefined.
        error: (error as { message?: string } | null | undefined)?.message ||
          'Error generando cuento',
        // Additive, and only when there is something to report: a failure that
        // happened before the image phase produces a body byte-identical to
        // the previous one. Existing fields, codes and semantics unchanged.
        ...(skippedImages.length > 0 ? { skippedImages } : {}),
        // Same rule for research degradation: a failure that escalated AFTER
        // research still reports that the story was written without it.
        ...(warnings.length > 0 ? { warnings } : {}),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
  };
}
