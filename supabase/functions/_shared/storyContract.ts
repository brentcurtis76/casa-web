/**
 * The strict provider-output contract for the cuentacuentos story shape.
 *
 * EXTRACTED VERBATIM from `generate-story/handler.ts` at phase PD-REFINE so a
 * second function (`refine-story`) can enforce the same contract instead of
 * growing a second, drifting copy of it. Nothing here changed in the move:
 * `generate-story` imports these names and re-exports the ones that were part
 * of its public surface, so its behaviour and its exports are unchanged. The
 * comments are the originals — they record why each rule exists, and rewriting
 * them would lose that.
 *
 * `_shared/` is this repo's established home for cross-function code
 * (`liturgyAuth.ts`, `imageFetch.ts`, `corpus.ts`).
 */

// ---------------------------------------------------------------------------
// Normalization warnings
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Typed errors (PLAN G3)
// ---------------------------------------------------------------------------

/**
 * Why the provider's output was unusable. INTERNAL: the reason selects one of
 * three fixed Spanish messages and never reaches the client itself, so the
 * client cannot distinguish "the model refused" from a raw `stop_reason`.
 */
export type ProviderOutputReason = 'REFUSAL' | 'MAX_TOKENS' | 'INVALID_STORY';

export const PROVIDER_OUTPUT_MESSAGES: Record<ProviderOutputReason, string> = {
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

// ---------------------------------------------------------------------------
// The validated story
// ---------------------------------------------------------------------------

const CHARACTER_ROLES = ['protagonist', 'secondary', 'minor'] as const;
const PROP_KINDS = ['location', 'prop'] as const;

export type CharacterRole = typeof CHARACTER_ROLES[number];
export type PropKind = typeof PROP_KINDS[number];

/**
 * The scene window this contract requests and accepts (PLAN G1).
 *
 * THE single source of truth for the range, exported at PD-REFINE: every prompt
 * that states a scene count and every validator that enforces one reads these
 * two numbers, because the alternative was two functions disagreeing with each
 * other in prose (`refine-story` promised 10–18 in one place and 12–16 in
 * another, and enforced neither).
 */
export const SCENE_COUNT_MIN = 12;
export const SCENE_COUNT_MAX = 16;

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
export function trimmedString(value: unknown): string | undefined {
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
export function describeValidationErrors(errors: StoryValidationError[]): string {
  const shown = errors
    .slice(0, 5)
    .map((error) => (error.path ? `${error.code}@${error.path}` : error.code));
  return `n=${errors.length} ${shown.join(', ')}${
    errors.length > shown.length ? ', …' : ''
  }`;
}

// ---------------------------------------------------------------------------
// The strict tool schema
// ---------------------------------------------------------------------------

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
export const STORY_TOOL_SCHEMA = {
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
