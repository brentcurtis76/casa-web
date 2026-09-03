/**
 * CASA — generate-scene-images Edge Function · request handler
 *
 * PROJECT BINDING
 *   This function belongs exclusively to the CASA Supabase project
 *   (ref `mulsqxfhxxdsadxsljss`, see supabase/config.toml). At runtime it refuses
 *   to serve unless SUPABASE_URL points at that project (or a local dev stack),
 *   so an accidental deployment to any other project fails closed.
 *   Deploy only through scripts/security/deploy-generate-scene-images.sh.
 *
 * SECURITY MODEL
 *   1. Gateway: `verify_jwt = true` (supabase/config.toml) — requests without a
 *      valid project JWT never reach this code.
 *   2. Authentication (handler level): the caller must present a real user
 *      session token. It is decoded, required to carry `role = authenticated`
 *      and a `sub`, then verified against Supabase Auth (`GET /auth/v1/user`).
 *      The anon key and any service_role credential presented by a caller are
 *      rejected with 401. No service-role key is used anywhere in this function.
 *   3. Authorization: `has_permission(user, 'liturgy_builder', 'write')` — the
 *      existing CASA RBAC RPC — executed with the caller's own JWT. general_admin
 *      passes implicitly inside has_permission() (casa_rbac_schema migration).
 *   4. GOOGLE_AI_API_KEY stays server-side and travels in the `x-goog-api-key`
 *      header, never in a URL.
 *   5. Strict input validation with bounded sizes, reference-image downloads
 *      restricted to the project's own storage host with size/time limits, a
 *      cumulative reference-payload budget enforced before any Gemini request
 *      (downloads resolve one at a time and stop once the allowance is spent),
 *      per-call upstream timeouts, an origin allowlist for CORS, and
 *      metadata-only logging (no headers, tokens, prompts or image data).
 *   6. A 200 from Gemini that carries no image is treated as an upstream
 *      failure (502 when every variation lacks an image; a safe partial error
 *      when only some do).
 *
 * The module has no remote imports so it can be type-checked and tested offline:
 *   deno test --no-remote --no-npm supabase/functions/generate-scene-images/
 */

// ─── Project binding ─────────────────────────────────────────────────────────

/** The only hosted Supabase project this function may run against. */
export const CASA_PROJECT_REF = 'mulsqxfhxxdsadxsljss';

const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'kong',
  'host.docker.internal',
]);

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return LOCAL_HOSTNAMES.has(host) || host.endsWith('.local') || host.endsWith('.internal');
}

export function isCasaProjectUrl(supabaseUrl: string): boolean {
  try {
    const host = new URL(supabaseUrl).hostname.toLowerCase();
    return isLocalHostname(host) || host === `${CASA_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

// ─── Authorization policy ────────────────────────────────────────────────────

/**
 * Derived from committed CASA code: the only production caller (CuentacuentoEditor)
 * lives inside the Constructor de Liturgias module, whose RBAC resource is
 * `liturgy_builder` (src/types/rbac.ts MODULE_RESOURCE_MAP.constructor) and whose
 * content-creating actions use the `write` action (RLS convention in
 * supabase/migrations, usePermissions.ts). general_admin is implicit.
 */
export const REQUIRED_PERMISSION = { resource: 'liturgy_builder', action: 'write' } as const;

// ─── Upstream ────────────────────────────────────────────────────────────────

export const IMAGE_MODEL = 'gemini-3-pro-image-preview';
export const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`;

// ─── Limits ──────────────────────────────────────────────────────────────────

export interface Limits {
  maxBodyBytes: number;
  maxReferenceImages: number;
  maxImageBase64Chars: number;
  maxDownloadBytes: number;
  /**
   * Cumulative budget for ALL reference images of one request, measured in
   * base64 characters — the form that is copied into every Gemini request
   * (up to `maxCount` of them). Covers inline base64, data URLs and downloaded
   * URLs alike and is enforced before any Gemini call.
   */
  maxTotalReferenceBase64Chars: number;
  maxTextChars: number;
  maxDescriptionChars: number;
  maxCustomPromptChars: number;
  maxNameChars: number;
  maxTitleChars: number;
  maxCharacters: number;
  maxLandmarks: number;
  maxLandmarkReferences: number;
  maxCount: number;
  maxStyleIdChars: number;
  authTimeoutMs: number;
  downloadTimeoutMs: number;
  upstreamTimeoutMs: number;
}

export const DEFAULT_LIMITS: Readonly<Limits> = {
  maxBodyBytes: 25 * 1024 * 1024,
  maxReferenceImages: 14,
  maxImageBase64Chars: 8 * 1024 * 1024,
  maxDownloadBytes: 6 * 1024 * 1024,
  // 10 MiB of base64 (~7.5 MB of image bytes) in total: one maximum-size
  // reference still fits, and so do many small ones, but 14 maximum-size
  // downloads (≈ 112 MiB of base64 across four Gemini requests) can no longer
  // be assembled in memory.
  maxTotalReferenceBase64Chars: 10 * 1024 * 1024,
  maxTextChars: 5000,
  maxDescriptionChars: 3000,
  maxCustomPromptChars: 4000,
  maxNameChars: 120,
  maxTitleChars: 200,
  maxCharacters: 20,
  maxLandmarks: 5,
  maxLandmarkReferences: 2,
  maxCount: 4,
  maxStyleIdChars: 50,
  authTimeoutMs: 10_000,
  downloadTimeoutMs: 15_000,
  upstreamTimeoutMs: 60_000,
};

const MIN_UPSTREAM_TIMEOUT_MS = 10;
const MAX_UPSTREAM_TIMEOUT_MS = 300_000;

// ─── CORS ────────────────────────────────────────────────────────────────────

/**
 * CASA deployment origins with unambiguous committed evidence: the Vercel
 * project domain (default origin in admin-user-management), Vercel preview
 * deployments of this project, and the Vite dev server (vite.config.ts).
 *
 * The production custom domain is NOT hardcoded: committed evidence is
 * contradictory (index.html declares anglicanasanandres.cl, robots.txt and
 * VERCEL_DEPLOYMENT.md mention iglesia-casa.cl). It must be supplied through the
 * ALLOWED_ORIGINS secret (comma-separated exact origins) at deployment time;
 * until then browser calls from the custom domain are refused. Wildcards are
 * never used.
 */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  'https://casa-web.vercel.app',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://127.0.0.1:8080',
];

export const VERCEL_PREVIEW_ORIGIN = /^https:\/\/casa-web-[a-z0-9-]+\.vercel\.app$/;

const CORS_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type';

export function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^https?:\/\/[^\s/]+$/.test(item));
}

export function isAllowedOrigin(origin: string, extraOrigins: readonly string[] = []): boolean {
  return DEFAULT_ALLOWED_ORIGINS.includes(origin) ||
    extraOrigins.includes(origin) ||
    VERCEL_PREVIEW_ORIGIN.test(origin);
}

function corsHeadersFor(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ─── Dependencies ────────────────────────────────────────────────────────────

export interface EnvSource {
  get(name: string): string | undefined;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type LogFields = Record<string, string | number | boolean | undefined>;

export type Logger = (event: string, fields?: LogFields) => void;

export interface HandlerDeps {
  env: EnvSource;
  fetch: FetchLike;
  /** Metadata-only logger. Defaults to one JSON line per event on stdout. */
  log?: Logger;
  now?: () => number;
  /** Test hook: override limits (env UPSTREAM_TIMEOUT_MS is applied first). */
  limits?: Partial<Limits>;
}

export class HttpError extends Error {
  readonly status: number;
  readonly extra: Record<string, unknown>;

  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.extra = extra;
  }
}

class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`timeout after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

interface Context {
  fetch: FetchLike;
  log: Logger;
  now: () => number;
  limits: Limits;
  supabaseUrl: string;
  anonKey: string;
  googleKey: string;
  allowedImageHosts: ReadonlySet<string>;
}

const defaultLogger: Logger = (event, fields = {}) => {
  console.log(JSON.stringify({ fn: 'generate-scene-images', event, ...fields }));
};

// ─── Illustration styles (prompt fragments) ──────────────────────────────────

const ILLUSTRATION_STYLES: Record<string, string> = {
  'ghibli': 'Studio Ghibli animation style, soft watercolor backgrounds, detailed natural environments, warm lighting, whimsical atmosphere, hand-drawn aesthetic',
  'pixar': 'Pixar 3D animation style, expressive characters, vibrant colors, cinematic lighting, detailed textures, emotional storytelling',
  'disney-classic': 'Classic Disney 2D animation style, golden age aesthetic, fluid lines, warm colors, fairytale atmosphere, hand-painted backgrounds',
  'dreamworks': 'DreamWorks animation style, dynamic poses, bold colors, expressive faces, cinematic composition, playful energy',
  'storybook': "Children's storybook illustration style, soft pastel colors, gentle brushstrokes, cozy atmosphere, whimsical details, picture book aesthetic",
  'watercolor': "Children's watercolor illustration, soft washes, gentle colors, dreamy atmosphere, delicate lines, artistic and tender",
  'eric-carle': 'Eric Carle collage illustration style, bold colors, textured paper cutouts, simple shapes, vibrant and playful, The Very Hungry Caterpillar aesthetic',
  'quentin-blake': 'Quentin Blake illustration style, loose pen and ink drawings, energetic lines, splashes of watercolor, whimsical and expressive characters, Roald Dahl book aesthetic',
  'papercut': 'Paper cut-out illustration style, layered paper effect, soft shadows, colorful shapes, handcrafted aesthetic, dimensional depth',
  'claymation': 'Claymation stop-motion style, 3D clay figures, textured surfaces, warm lighting, handcrafted charm, Aardman animation aesthetic',
  'folk-art': 'Latin American folk art style, vibrant colors, decorative patterns, naive art aesthetic, cultural motifs, warm and festive',
  'anime-soft': 'Soft anime illustration style, big expressive eyes, pastel colors, gentle lighting, kawaii aesthetic, heartwarming atmosphere',
  'cartoon-network': 'Modern cartoon style, bold outlines, flat colors, geometric shapes, playful proportions, Adventure Time / Steven Universe aesthetic',
  'beatrix-potter': 'Beatrix Potter illustration style, detailed naturalistic animals, soft watercolors, English countryside aesthetic, gentle and refined, Peter Rabbit style',
};

const DEFAULT_STYLE = 'storybook';

function stylePromptFor(styleId: string): string {
  return ILLUSTRATION_STYLES[styleId] ?? ILLUSTRATION_STYLES[DEFAULT_STYLE];
}

// ─── Request model ───────────────────────────────────────────────────────────

type RequestType = 'scene' | 'character' | 'cover' | 'end';

const REQUEST_TYPES: readonly RequestType[] = ['scene', 'character', 'cover', 'end'];

interface CharacterInput {
  name: string;
  visualDescription: string;
  referenceImage?: string;
}

interface SceneInput {
  text: string;
  visualDescription: string;
  landmarkVisible: boolean;
}

interface LocationInput {
  name: string;
  description: string;
}

interface LandmarkInput {
  name: string;
  visualDescription: string;
  referenceImages: string[];
}

type ReferenceKind = 'style' | 'character' | 'landmark';

interface ReferenceInput {
  kind: ReferenceKind;
  source: string;
  label: string;
}

interface ResolvedReference {
  kind: ReferenceKind;
  label: string;
  data: string;
  mimeType: string;
}

interface Job {
  type: RequestType;
  count: number;
  prompt: string;
  references: ReferenceInput[];
  detection?: { scene: SceneInput; characters: CharacterInput[] };
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function detectCharactersInScene(scene: SceneInput, characters: CharacterInput[]): CharacterInput[] {
  const sceneText = `${scene.text} ${scene.visualDescription}`.toLowerCase();
  const articles = ['el ', 'la ', 'los ', 'las ', 'un ', 'una '];
  return characters.filter((character) => {
    const name = character.name.toLowerCase();
    const variations = [
      name,
      ...articles.map((article) => (name.startsWith(article) ? name.slice(article.length) : name)),
    ];
    return variations.some((variation) => variation.length > 2 && sceneText.includes(variation));
  });
}

function buildScenePrompt(
  styleId: string,
  scene: SceneInput,
  characters: CharacterInput[],
  location: LocationInput,
  landmarks: LandmarkInput[],
): string {
  const characterDescriptions = characters.length > 0
    ? characters.map((c) => `- ${c.name}: ${c.visualDescription}`).join('\n')
    : 'No specific characters in this scene';

  const referenceInstruction = characters.some((c) => c.referenceImage)
    ? `\n\nIMPORTANT: Use the reference images provided to maintain EXACT visual consistency for each character. The characters must look IDENTICAL to their reference images in terms of: clothing, hair color/style, facial features, body proportions, and any distinctive features.`
    : '';

  const visibleLandmarks = scene.landmarkVisible ? landmarks.filter((lm) => lm.visualDescription) : [];
  const landmarkSection = visibleLandmarks.length > 0
    ? `\n\nLANDMARK/BUILDING visible in this scene (reference photos provided - render FAITHFULLY):
${visibleLandmarks.map((lm) => `- ${lm.name}: ${lm.visualDescription}`).join('\n')}

CRITICAL: The landmark/building MUST be rendered with EXACT architectural details matching the reference photos. Copy the shape, colors, materials, windows, doors, and all distinctive features precisely. The landmark should be immediately recognizable to someone who knows the real building.`
    : '';

  return `${stylePromptFor(styleId)}

Scene description: ${scene.visualDescription}

Scene narrative: "${scene.text}"

Location: ${location.name}, Chile. ${location.description}

Characters that appear in THIS scene (ONLY these characters should be shown):
${characterDescriptions}
${referenceInstruction}
${landmarkSection}

CRITICAL instructions:
- ONLY show the characters listed above - no other characters should appear
- Bright, well-lit scene (this will be projected in a room with natural light)
- Child-friendly imagery appropriate for ages 5-10
- **ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO NUMBERS, NO WRITING OF ANY KIND IN THE IMAGE** - This is extremely important, the image must be purely visual with zero text elements
- Cinematic composition with good framing
- Warm, inviting atmosphere
- Focus on the emotional moment described in the scene
- If reference images are provided, the characters MUST look exactly like their references${visibleLandmarks.length > 0 ? '\n- The landmark/building MUST match the provided reference photos exactly' : ''}
- Do not include any signs, labels, captions, titles, or any form of written text
`.trim();
}

function buildCharacterSheetPrompt(styleId: string, visualDescription: string): string {
  return `${stylePromptFor(styleId)}

Character design sheet, full body view, white background.

Character: ${visualDescription}

The character should be shown in a neutral standing pose, facing slightly to the side, with a friendly expression. Show the full body from head to toe. Clean white background with no other elements.

Important:
- Bright, well-lit image
- Child-friendly appearance
- Expressive but not exaggerated features
- **ABSOLUTELY NO TEXT, NO WORDS, NO LETTERS, NO LABELS** - the image must contain zero text elements
- Suitable for children ages 5-10
- Pure visual illustration only
`.trim();
}

function buildCoverPrompt(
  styleId: string,
  title: string,
  protagonistDescription: string,
  location: LocationInput,
): string {
  return `${stylePromptFor(styleId)}

Book cover illustration for a children's story titled "${title}".

The image should show the main character:
${protagonistDescription}

Setting: ${location.name}, Chile. ${location.description}

The title "${title}" should appear at the top in a friendly, readable children's book font.

Important:
- Bright, colorful, and inviting
- The character should look friendly and approachable
- Include visual elements from the story's setting
- Professional children's book cover composition
- Child-friendly, suitable for ages 5-10
`.trim();
}

function buildCustomCoverPrompt(
  styleId: string,
  title: string,
  location: LocationInput,
  customPrompt: string,
): string {
  return `${stylePromptFor(styleId)}

PORTADA DEL CUENTO: "${title}"

Ubicación: ${location.name}. ${location.description}

${customPrompt}

Instrucciones críticas:
- Composición atractiva para portada de libro infantil
- **INCLUIR EL TÍTULO "${title}" en la parte superior de la imagen** en una fuente amigable y legible para niños
- El título debe verse como una portada real de libro infantil
- Escena brillante y bien iluminada
- Imágenes apropiadas para niños 5-10 años
- Atmósfera cálida y acogedora`;
}

function buildEndPrompt(styleId: string): string {
  return `${stylePromptFor(styleId)}

Simple, elegant end card for a children's story.

The word "Fin" in a decorative but readable children's book font, centered.

Decorated with subtle, child-friendly ornamental elements like small stars, leaves, or simple flourishes.

Warm, soft background color. Bright and cheerful mood.

No characters, just the text and decorative elements.
`.trim();
}

function buildCustomEndPrompt(styleId: string, customPrompt: string): string {
  return `${stylePromptFor(styleId)}

IMAGEN FINAL "FIN" PARA CUENTO INFANTIL

${customPrompt}

Instrucciones críticas:
- Composición atractiva para página final de libro infantil
- Escena brillante y bien iluminada
- Atmósfera de cierre y satisfacción
- Imágenes apropiadas para niños 5-10 años
- **ABSOLUTAMENTE SIN TEXTO, SIN PALABRAS, SIN LETRAS EN LA IMAGEN**
- Puede ser abstracta o con elementos del cuento`;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(
  source: Record<string, unknown>,
  key: string,
  path: string,
  max: number,
  required: boolean,
): string {
  const value = source[key];
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `Falta el campo requerido "${path}".`);
    return '';
  }
  if (typeof value !== 'string') throw new HttpError(400, `El campo "${path}" debe ser texto.`);
  if (value.length > max) {
    throw new HttpError(400, `El campo "${path}" excede el máximo de ${max} caracteres.`);
  }
  if (required && value.trim().length === 0) {
    throw new HttpError(400, `El campo "${path}" no puede estar vacío.`);
  }
  return value;
}

function readImageRef(
  source: Record<string, unknown>,
  key: string,
  path: string,
  limits: Limits,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new HttpError(400, `El campo "${path}" debe ser una URL o una imagen en base64.`);
  }
  if (value.length > limits.maxImageBase64Chars) {
    throw new HttpError(400, `La imagen de referencia "${path}" excede el tamaño máximo permitido.`);
  }
  return value;
}

function readCount(source: Record<string, unknown>, limits: Limits): number {
  const value = source.count;
  if (value === undefined || value === null) return limits.maxCount;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > limits.maxCount) {
    throw new HttpError(400, `El campo "count" debe ser un entero entre 1 y ${limits.maxCount}.`);
  }
  return value;
}

function readStyleId(source: Record<string, unknown>, limits: Limits): string {
  const value = source.styleId;
  if (value === undefined || value === null || value === '') return DEFAULT_STYLE;
  if (typeof value !== 'string' || value.length > limits.maxStyleIdChars) {
    throw new HttpError(400, 'El campo "styleId" no es válido.');
  }
  return value;
}

function readLocation(source: Record<string, unknown>, key: string, limits: Limits): LocationInput {
  const value = source[key];
  if (!isRecord(value)) throw new HttpError(400, `Falta el campo requerido "${key}" (name, description).`);
  return {
    name: readText(value, 'name', `${key}.name`, limits.maxTitleChars, true),
    description: readText(value, 'description', `${key}.description`, limits.maxDescriptionChars, false),
  };
}

function readCharacters(source: Record<string, unknown>, limits: Limits): CharacterInput[] {
  const value = source.characters;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'El campo "characters" debe ser una lista.');
  if (value.length > limits.maxCharacters) {
    throw new HttpError(400, `Demasiados personajes (máximo ${limits.maxCharacters}).`);
  }
  return value.map((item, index) => {
    const path = `characters[${index}]`;
    if (!isRecord(item)) throw new HttpError(400, `El elemento "${path}" no es válido.`);
    return {
      name: readText(item, 'name', `${path}.name`, limits.maxNameChars, true),
      visualDescription: readText(item, 'visualDescription', `${path}.visualDescription`, limits.maxDescriptionChars, false),
      referenceImage: readImageRef(item, 'referenceImage', `${path}.referenceImage`, limits),
    };
  });
}

function readLandmarks(source: Record<string, unknown>, limits: Limits): LandmarkInput[] {
  const value = source.landmarks;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'El campo "landmarks" debe ser una lista.');
  if (value.length > limits.maxLandmarks) {
    throw new HttpError(400, `Demasiados lugares emblemáticos (máximo ${limits.maxLandmarks}).`);
  }
  return value.map((item, index) => {
    const path = `landmarks[${index}]`;
    if (!isRecord(item)) throw new HttpError(400, `El elemento "${path}" no es válido.`);
    const refsRaw = item.referenceImages;
    let referenceImages: string[] = [];
    if (refsRaw !== undefined && refsRaw !== null) {
      if (!Array.isArray(refsRaw)) {
        throw new HttpError(400, `El campo "${path}.referenceImages" debe ser una lista.`);
      }
      if (refsRaw.length > limits.maxLandmarkReferences) {
        throw new HttpError(
          400,
          `Demasiadas imágenes de referencia en "${path}" (máximo ${limits.maxLandmarkReferences}).`,
        );
      }
      referenceImages = refsRaw.map((ref, refIndex) => {
        const holder: Record<string, unknown> = { ref };
        const parsed = readImageRef(holder, 'ref', `${path}.referenceImages[${refIndex}]`, limits);
        return parsed ?? '';
      }).filter((ref) => ref.length > 0);
    }
    return {
      name: readText(item, 'name', `${path}.name`, limits.maxNameChars, true),
      visualDescription: readText(item, 'visualDescription', `${path}.visualDescription`, limits.maxDescriptionChars, false),
      referenceImages,
    };
  });
}

function characterReferences(characters: CharacterInput[]): ReferenceInput[] {
  return characters
    .filter((c): c is CharacterInput & { referenceImage: string } => typeof c.referenceImage === 'string')
    .map((c) => ({ kind: 'character', source: c.referenceImage, label: `${c.name}: ${c.visualDescription}` }));
}

function buildJob(body: Record<string, unknown>, limits: Limits): Job {
  const type = body.type;
  if (typeof type !== 'string' || !REQUEST_TYPES.includes(type as RequestType)) {
    throw new HttpError(400, 'Tipo no válido. Use: scene, character, cover, end.');
  }
  const styleId = readStyleId(body, limits);
  const count = readCount(body, limits);
  let job: Job;

  switch (type as RequestType) {
    case 'scene': {
      const sceneRaw = body.scene;
      if (!isRecord(sceneRaw)) throw new HttpError(400, 'Se requiere scene y location para generar escena.');
      const scene: SceneInput = {
        text: readText(sceneRaw, 'text', 'scene.text', limits.maxTextChars, false),
        visualDescription: readText(sceneRaw, 'visualDescription', 'scene.visualDescription', limits.maxDescriptionChars, true),
        landmarkVisible: sceneRaw.landmarkVisible === true,
      };
      const location = readLocation(body, 'location', limits);
      const characters = readCharacters(body, limits);
      const landmarks = readLandmarks(body, limits);
      const references = characterReferences(characters);
      if (scene.landmarkVisible) {
        for (const landmark of landmarks) {
          // readLandmarks already rejected more than maxLandmarkReferences per landmark.
          for (const ref of landmark.referenceImages) {
            references.push({
              kind: 'landmark',
              source: ref,
              label: `LANDMARK REFERENCE - ${landmark.name}: ${landmark.visualDescription}. Render this building/landmark EXACTLY as shown in this photo.`,
            });
          }
        }
      }
      const styleRef = readImageRef(body, 'sceneReferenceImage', 'sceneReferenceImage', limits);
      if (styleRef) references.unshift({ kind: 'style', source: styleRef, label: 'SCENE STYLE REFERENCE' });
      job = {
        type: 'scene',
        count,
        prompt: buildScenePrompt(styleId, scene, characters, location, landmarks),
        references,
        detection: { scene, characters },
      };
      break;
    }
    case 'character': {
      const characterRaw = body.character;
      if (!isRecord(characterRaw)) throw new HttpError(400, 'Se requiere character para generar character sheet.');
      readText(characterRaw, 'name', 'character.name', limits.maxNameChars, true);
      const visualDescription = readText(characterRaw, 'visualDescription', 'character.visualDescription', limits.maxDescriptionChars, true);
      job = { type: 'character', count, prompt: buildCharacterSheetPrompt(styleId, visualDescription), references: [] };
      break;
    }
    case 'cover': {
      const title = readText(body, 'title', 'title', limits.maxTitleChars, true);
      const protagonistRaw = body.protagonist;
      if (!isRecord(protagonistRaw)) throw new HttpError(400, 'Se requiere title, protagonist y location para generar portada.');
      const protagonistDescription = readText(protagonistRaw, 'visualDescription', 'protagonist.visualDescription', limits.maxDescriptionChars, true);
      const location = readLocation(body, 'location', limits);
      const characters = readCharacters(body, limits);
      const customPrompt = readText(body, 'customPrompt', 'customPrompt', limits.maxCustomPromptChars, false);
      const references = characterReferences(characters);
      const styleRef = readImageRef(body, 'sceneReferenceImage', 'sceneReferenceImage', limits);
      if (styleRef) references.unshift({ kind: 'style', source: styleRef, label: 'COVER STYLE REFERENCE' });
      job = {
        type: 'cover',
        count,
        prompt: customPrompt.trim()
          ? buildCustomCoverPrompt(styleId, title, location, customPrompt)
          : buildCoverPrompt(styleId, title, protagonistDescription, location),
        references,
      };
      break;
    }
    case 'end': {
      const customPrompt = readText(body, 'customPrompt', 'customPrompt', limits.maxCustomPromptChars, false);
      const references: ReferenceInput[] = [];
      const styleRef = readImageRef(body, 'referenceImage', 'referenceImage', limits);
      if (styleRef) references.push({ kind: 'style', source: styleRef, label: 'END STYLE REFERENCE' });
      job = {
        type: 'end',
        count,
        prompt: customPrompt.trim() ? buildCustomEndPrompt(styleId, customPrompt) : buildEndPrompt(styleId),
        references,
      };
      break;
    }
  }

  if (job.references.length > limits.maxReferenceImages) {
    throw new HttpError(400, `Demasiadas imágenes de referencia (máximo ${limits.maxReferenceImages}).`);
  }
  return job;
}

// ─── Byte / base64 helpers ───────────────────────────────────────────────────

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function concatBytes(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Reads a stream fully, returning null when it exceeds `maxBytes`. */
async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return concatBytes(chunks, total);
}

async function discardBody(response: Response): Promise<void> {
  if (response.body) await response.body.cancel().catch(() => undefined);
}

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400);
}

function isValidImageBase64(data: string): boolean {
  return data.startsWith('iVBORw0KGgo') || data.startsWith('/9j/') || data.startsWith('UklGR');
}

function mimeTypeFor(data: string): string {
  if (data.startsWith('/9j/')) return 'image/jpeg';
  if (data.startsWith('UklGR')) return 'image/webp';
  return 'image/png';
}

// ─── Networking ──────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  ctx: Context,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Redirects are never followed: a 3xx from any upstream is treated as a failure
    // by the caller, so a redirect can never move a request to an unapproved host.
    return await ctx.fetch(url, { ...init, redirect: 'manual', signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new TimeoutError(timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Authentication & authorization ──────────────────────────────────────────

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const parsed: unknown = JSON.parse(base64UrlDecode(parts[1]));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function authenticate(req: Request, ctx: Context): Promise<{ userId: string; token: string }> {
  const header = req.headers.get('authorization');
  const match = header ? /^Bearer\s+([A-Za-z0-9_.-]+)$/i.exec(header.trim()) : null;
  if (!match) throw new HttpError(401, 'Se requiere autenticación.');
  const token = match[1];

  const payload = decodeJwtPayload(token);
  if (!payload) throw new HttpError(401, 'Token de autenticación inválido.');
  if (payload.role === 'service_role') {
    throw new HttpError(401, 'Credencial no permitida para esta función.');
  }
  if (payload.role !== 'authenticated' || typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new HttpError(401, 'Se requiere una sesión de usuario.');
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      ctx,
      `${ctx.supabaseUrl}/auth/v1/user`,
      { headers: { apikey: ctx.anonKey, Authorization: `Bearer ${token}` } },
      ctx.limits.authTimeoutMs,
    );
  } catch {
    throw new HttpError(503, 'No se pudo verificar la sesión.');
  }
  if (response.status === 401 || response.status === 403) {
    await discardBody(response);
    throw new HttpError(401, 'Sesión inválida o expirada.');
  }
  if (!response.ok) {
    await discardBody(response);
    throw new HttpError(503, 'No se pudo verificar la sesión.');
  }
  const user: unknown = await response.json().catch(() => null);
  if (!isRecord(user) || typeof user.id !== 'string' || user.id !== payload.sub) {
    throw new HttpError(401, 'Sesión inválida.');
  }
  return { userId: user.id, token };
}

async function authorize(ctx: Context, userId: string, token: string): Promise<void> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      ctx,
      `${ctx.supabaseUrl}/rest/v1/rpc/has_permission`,
      {
        method: 'POST',
        headers: {
          apikey: ctx.anonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_user_id: userId,
          p_resource: REQUIRED_PERMISSION.resource,
          p_action: REQUIRED_PERMISSION.action,
        }),
      },
      ctx.limits.authTimeoutMs,
    );
  } catch {
    throw new HttpError(503, 'No se pudo verificar la autorización.');
  }
  if (!response.ok) {
    await discardBody(response);
    throw new HttpError(503, 'No se pudo verificar la autorización.');
  }
  const allowed: unknown = await response.json().catch(() => null);
  if (allowed !== true) {
    throw new HttpError(403, 'Acceso denegado. Se requiere permiso de edición en el Constructor de Liturgias.');
  }
}

// ─── Request body ────────────────────────────────────────────────────────────

async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, 'La solicitud excede el tamaño máximo permitido.');
  }
  const bytes = await readStreamWithLimit(req.body, maxBytes);
  if (bytes === null) throw new HttpError(413, 'La solicitud excede el tamaño máximo permitido.');
  if (bytes.byteLength === 0) throw new HttpError(400, 'La solicitud no tiene cuerpo.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, 'El cuerpo de la solicitud no es JSON válido.');
  }
  if (!isRecord(parsed)) throw new HttpError(400, 'El cuerpo de la solicitud debe ser un objeto JSON.');
  return parsed;
}

// ─── Reference images ────────────────────────────────────────────────────────

/** Base64 characters produced by `bytes` raw bytes (4 chars per 3-byte group, padded). */
function base64CharsForBytes(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

/** Largest number of raw bytes whose base64 form fits in `chars` characters. */
function bytesForBase64Chars(chars: number): number {
  return Math.max(0, Math.floor(chars / 4) * 3);
}

function referenceBudgetExceeded(ctx: Context, refsRequested: number, usedChars: number): HttpError {
  ctx.log('reference_budget_exceeded', {
    refsRequested,
    usedChars,
    budgetChars: ctx.limits.maxTotalReferenceBase64Chars,
  });
  return new HttpError(413, 'Las imágenes de referencia exceden el tamaño total permitido.');
}

type DownloadOutcome =
  | { kind: 'ok'; data: string }
  /** Unusable download (not an image, failed, redirect, over the per-file cap): skipped. */
  | { kind: 'skipped' }
  /** The download would exceed the remaining cumulative reference allowance. */
  | { kind: 'overflow' };

/**
 * Downloads one reference image from an approved host. The body read is bounded by
 * BOTH the per-file cap and the remaining cumulative allowance, so no more bytes
 * than the request may still spend are ever buffered.
 */
async function downloadImage(ctx: Context, source: string, remainingBytes: number): Promise<DownloadOutcome> {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    throw new HttpError(400, 'URL de imagen de referencia inválida.');
  }
  const local = isLocalHostname(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new HttpError(400, 'La URL de imagen de referencia debe usar https.');
  }
  if (!ctx.allowedImageHosts.has(url.host.toLowerCase()) && !ctx.allowedImageHosts.has(url.hostname.toLowerCase())) {
    throw new HttpError(400, 'La URL de imagen de referencia no pertenece a un host permitido.');
  }
  try {
    const response = await fetchWithTimeout(ctx, url.toString(), { headers: { Accept: 'image/*' } }, ctx.limits.downloadTimeoutMs);
    if (isRedirect(response)) {
      // The approved host answered with a redirect. Its destination is never fetched.
      await discardBody(response);
      ctx.log('reference_download_failed', { reason: 'redirect_refused', status: response.status });
      return { kind: 'skipped' };
    }
    if (!response.ok) {
      await discardBody(response);
      ctx.log('reference_download_failed', { status: response.status });
      return { kind: 'skipped' };
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) {
      await discardBody(response);
      ctx.log('reference_download_failed', { reason: 'not_image' });
      return { kind: 'skipped' };
    }
    const perFileCap = ctx.limits.maxDownloadBytes;
    const declared = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(declared) && declared > perFileCap) {
      await discardBody(response);
      ctx.log('reference_download_failed', { reason: 'too_large' });
      return { kind: 'skipped' };
    }
    if (Number.isFinite(declared) && declared > remainingBytes) {
      // Declared size alone already exhausts the cumulative allowance: the body is never read.
      await discardBody(response);
      return { kind: 'overflow' };
    }
    const readCap = Math.min(perFileCap, remainingBytes);
    const bytes = await readStreamWithLimit(response.body, readCap);
    if (bytes === null) {
      if (remainingBytes < perFileCap) return { kind: 'overflow' };
      ctx.log('reference_download_failed', { reason: 'too_large' });
      return { kind: 'skipped' };
    }
    if (bytes.byteLength === 0) {
      ctx.log('reference_download_failed', { reason: 'empty' });
      return { kind: 'skipped' };
    }
    return { kind: 'ok', data: bytesToBase64(bytes) };
  } catch (error) {
    ctx.log('reference_download_failed', { reason: error instanceof TimeoutError ? 'timeout' : 'error' });
    return { kind: 'skipped' };
  }
}

function extractDataUrl(source: string): string {
  const comma = source.indexOf(',');
  return comma >= 0 ? source.slice(comma + 1) : '';
}

function isUrlSource(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

function totalReferenceChars(refs: ResolvedReference[]): number {
  return refs.reduce((sum, ref) => sum + ref.data.length, 0);
}

/**
 * Resolves reference images under the cumulative payload budget
 * (`limits.maxTotalReferenceBase64Chars`), preserving the caller's order:
 *   1. inline base64 / data URLs are accounted first (no I/O);
 *   2. URL references are then downloaded ONE AT A TIME, each read bounded by the
 *      remaining allowance, and downloading stops as soon as it is exhausted.
 * Exceeding the budget at any point rejects the request (413) before any Gemini call.
 */
async function resolveReferences(ctx: Context, refs: ReferenceInput[]): Promise<ResolvedReference[]> {
  const budget = ctx.limits.maxTotalReferenceBase64Chars;
  const resolved: Array<ResolvedReference | null> = refs.map(() => null);
  let usedChars = 0;

  for (let index = 0; index < refs.length; index++) {
    const ref = refs[index];
    if (isUrlSource(ref.source)) continue;
    const data = ref.source.startsWith('data:') ? extractDataUrl(ref.source) : ref.source;
    if (!isValidImageBase64(data)) {
      ctx.log('reference_skipped', { kind: ref.kind });
      continue;
    }
    usedChars += data.length;
    if (usedChars > budget) throw referenceBudgetExceeded(ctx, refs.length, usedChars);
    resolved[index] = { kind: ref.kind, label: ref.label, data, mimeType: mimeTypeFor(data) };
  }

  for (let index = 0; index < refs.length; index++) {
    const ref = refs[index];
    if (!isUrlSource(ref.source)) continue;
    const remainingBytes = bytesForBase64Chars(budget - usedChars);
    if (remainingBytes <= 0) throw referenceBudgetExceeded(ctx, refs.length, usedChars);
    const outcome = await downloadImage(ctx, ref.source, remainingBytes);
    if (outcome.kind === 'overflow') {
      throw referenceBudgetExceeded(ctx, refs.length, usedChars + base64CharsForBytes(remainingBytes));
    }
    if (outcome.kind === 'skipped') continue;
    if (!isValidImageBase64(outcome.data)) {
      ctx.log('reference_skipped', { kind: ref.kind });
      continue;
    }
    usedChars += outcome.data.length;
    if (usedChars > budget) throw referenceBudgetExceeded(ctx, refs.length, usedChars);
    resolved[index] = { kind: ref.kind, label: ref.label, data: outcome.data, mimeType: mimeTypeFor(outcome.data) };
  }

  const kept = resolved.filter((item): item is ResolvedReference => item !== null);
  if (totalReferenceChars(kept) > budget) throw referenceBudgetExceeded(ctx, refs.length, totalReferenceChars(kept));
  return kept;
}

// ─── Gemini request ──────────────────────────────────────────────────────────

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

function styleReferenceInstruction(total: number, hasLandmarkRef: boolean): string {
  return `CRITICAL REFERENCE IMAGES:
The FIRST image is a SCENE STYLE REFERENCE - use it to guide the visual style, composition, lighting, colors, and atmosphere of the generated scene.
${total > 1 ? `The remaining ${total - 1} image(s) show the EXACT appearance of characters${hasLandmarkRef ? ' and/or landmarks/buildings' : ''}.` : ''}

For character references, you MUST copy these visual details EXACTLY:
- Face shape, features, and expression style
- Hair color, style, and length
- Skin tone and body proportions
- Clothing colors, patterns, and style
- Any distinctive accessories or features
${hasLandmarkRef ? `
For LANDMARK/BUILDING references, you MUST copy these architectural details EXACTLY:
- Overall shape, proportions, and structure
- Colors of walls, roof, doors, windows
- Distinctive architectural features (towers, arches, columns, etc.)
- Materials and textures
- The landmark must be IMMEDIATELY RECOGNIZABLE to someone who knows the real building` : ''}

Study each reference carefully before generating.`;
}

function subjectReferenceInstruction(total: number, characterCount: number, landmarkCount: number): string {
  const subjects = `${characterCount > 0 ? 'characters' : ''}${characterCount > 0 && landmarkCount > 0 ? ' and ' : ''}${landmarkCount > 0 ? 'landmarks/buildings' : ''}`;
  return `CRITICAL REFERENCE IMAGES:
The following ${total} image(s) show the EXACT appearance of ${subjects} that must appear in the generated scene.

For CHARACTER references, you MUST copy these visual details EXACTLY:
- Face shape, features, and expression style
- Hair color, style, and length
- Skin tone and body proportions
- Clothing colors, patterns, and style
- Any distinctive accessories or features
${landmarkCount > 0 ? `
For LANDMARK/BUILDING references, you MUST copy these architectural details EXACTLY:
- Overall shape, proportions, and structure
- Colors of walls, roof, doors, windows
- Distinctive architectural features (towers, arches, columns, etc.)
- Materials and textures
- The landmark must be IMMEDIATELY RECOGNIZABLE to someone who knows the real building` : ''}

Study each reference carefully before generating. All subjects in your output MUST be visually identical to their references.`;
}

function buildParts(prompt: string, variation: number, refs: ResolvedReference[]): GeminiPart[] {
  const parts: GeminiPart[] = [];
  const hasStyleRef = refs.some((ref) => ref.kind === 'style');
  const hasLandmarkRef = refs.some((ref) => ref.kind === 'landmark');
  const characterCount = refs.filter((ref) => ref.kind === 'character').length;
  const landmarkCount = refs.filter((ref) => ref.kind === 'landmark').length;

  if (refs.length > 0) {
    parts.push({
      text: hasStyleRef
        ? styleReferenceInstruction(refs.length, hasLandmarkRef)
        : subjectReferenceInstruction(refs.length, characterCount, landmarkCount),
    });
    refs.forEach((ref, index) => {
      const caption = ref.kind === 'style'
        ? 'STYLE REFERENCE IMAGE - Copy the visual style, colors, lighting, and atmosphere from this image:'
        : ref.kind === 'landmark'
        ? `LANDMARK/BUILDING REFERENCE IMAGE - Render this building EXACTLY as shown, copying all architectural details: ${ref.label}`
        : `Character reference ${index + 1} - ${ref.label}:`;
      parts.push({ text: caption });
      parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.data } });
    });
  }

  let finalPrompt = prompt;
  if (refs.length > 0) {
    finalPrompt = hasStyleRef
      ? `CRITICAL: You MUST use the STYLE REFERENCE IMAGE above to match the visual style, color palette, lighting, and artistic atmosphere. Generate a scene that looks like it belongs in the same visual world as the reference.\n\n${prompt}`
      : `REMEMBER: The characters MUST match the reference images provided above EXACTLY.\n\n${prompt}`;
  }
  if (variation > 0) {
    finalPrompt += hasStyleRef
      ? `\n\nGenerate variation ${variation} with slightly different composition and poses, but MAINTAIN THE SAME VISUAL STYLE as the reference image - same color palette, same lighting style, same artistic atmosphere.`
      : `\n\nGenerate variation ${variation} with slightly different composition, poses, and background details. However, the characters MUST remain VISUALLY IDENTICAL to their reference images - same face, same hair, same clothes, same colors.`;
  }
  parts.push({ text: finalPrompt });
  return parts;
}

function extractImage(data: Record<string, unknown>): string {
  const candidates = data.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';
  const first: unknown = candidates[0];
  if (!isRecord(first) || !isRecord(first.content) || !Array.isArray(first.content.parts)) return '';
  for (const part of first.content.parts as unknown[]) {
    if (isRecord(part) && isRecord(part.inlineData) && typeof part.inlineData.data === 'string' &&
      isValidImageBase64(part.inlineData.data)) {
      return part.inlineData.data;
    }
  }
  return '';
}

async function generateVariation(
  ctx: Context,
  job: Job,
  variation: number,
  refs: ResolvedReference[],
): Promise<string> {
  const body = JSON.stringify({
    contents: [{ parts: buildParts(job.prompt, variation, refs) }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { aspectRatio: '4:3' },
    },
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(
      ctx,
      GEMINI_ENDPOINT,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ctx.googleKey },
        body,
      },
      ctx.limits.upstreamTimeoutMs,
    );
  } catch (error) {
    if (error instanceof TimeoutError) {
      ctx.log('upstream_timeout', { variation });
      throw new HttpError(504, 'Tiempo de espera agotado al generar la imagen.');
    }
    ctx.log('upstream_unreachable', { variation });
    throw new HttpError(502, 'No se pudo contactar al servicio de generación de imágenes.');
  }

  if (!response.ok) {
    await discardBody(response);
    ctx.log('upstream_error', { status: response.status, variation });
    if (response.status === 429) {
      throw new HttpError(429, 'Límite de uso del servicio de imágenes alcanzado. Intenta nuevamente en unos minutos.');
    }
    throw new HttpError(502, `Error del servicio de generación de imágenes (HTTP ${response.status}).`);
  }

  const data: unknown = await response.json().catch(() => null);
  if (!isRecord(data)) throw new HttpError(502, 'Respuesta inválida del servicio de generación de imágenes.');
  if (isRecord(data.promptFeedback) && typeof data.promptFeedback.blockReason === 'string') {
    ctx.log('upstream_blocked', { variation });
    throw new HttpError(422, 'El contenido fue bloqueado por el filtro de seguridad del servicio de imágenes.');
  }
  const image = extractImage(data);
  if (!image) {
    // A 200 without a usable image is an upstream failure, never a silent success.
    // Only metadata is logged: the response body is discarded here.
    ctx.log('upstream_no_image', { variation });
    throw new HttpError(502, 'El servicio de generación de imágenes no devolvió una imagen.');
  }
  return image;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

function resolveLimits(deps: HandlerDeps): Limits {
  const limits: Limits = { ...DEFAULT_LIMITS };
  const raw = deps.env.get('UPSTREAM_TIMEOUT_MS');
  const parsed = raw ? Number(raw) : Number.NaN;
  if (Number.isFinite(parsed)) {
    limits.upstreamTimeoutMs = Math.min(MAX_UPSTREAM_TIMEOUT_MS, Math.max(MIN_UPSTREAM_TIMEOUT_MS, Math.floor(parsed)));
  }
  return { ...limits, ...(deps.limits ?? {}) };
}

function buildContext(deps: HandlerDeps, limits: Limits, log: Logger, now: () => number): Context {
  const supabaseUrl = (deps.env.get('SUPABASE_URL') ?? '').trim().replace(/\/+$/, '');
  const anonKey = (deps.env.get('SUPABASE_ANON_KEY') ?? '').trim();
  const googleKey = (deps.env.get('GOOGLE_AI_API_KEY') ?? '').trim();

  if (!supabaseUrl || !anonKey) {
    throw new HttpError(500, 'Configuración del servidor incompleta (Supabase).');
  }
  if (!isCasaProjectUrl(supabaseUrl)) {
    throw new HttpError(500, 'Esta función solo puede ejecutarse en el proyecto Supabase de CASA.');
  }
  if (!googleKey) {
    throw new HttpError(500, 'Configuración del servidor incompleta (GOOGLE_AI_API_KEY).');
  }

  const supabaseHost = new URL(supabaseUrl);
  const allowedImageHosts = new Set<string>([supabaseHost.host.toLowerCase(), supabaseHost.hostname.toLowerCase()]);
  for (const host of (deps.env.get('ALLOWED_IMAGE_HOSTS') ?? '').split(',')) {
    const trimmed = host.trim().toLowerCase();
    if (trimmed) allowedImageHosts.add(trimmed);
  }

  return { fetch: deps.fetch, log, now, limits, supabaseUrl, anonKey, googleKey, allowedImageHosts };
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const log = deps.log ?? defaultLogger;
  const now = deps.now ?? (() => Date.now());
  const limits = resolveLimits(deps);
  const extraOrigins = parseOriginList(deps.env.get('ALLOWED_ORIGINS'));

  return async (req: Request): Promise<Response> => {
    const startedAt = now();
    const origin = req.headers.get('origin');
    const originAllowed = origin === null || isAllowedOrigin(origin, extraOrigins);
    const cors = originAllowed && origin ? corsHeadersFor(origin) : {};

    if (req.method === 'OPTIONS') {
      if (!originAllowed) return jsonResponse(403, { success: false, error: 'Origen no permitido.' }, {});
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (!originAllowed) throw new HttpError(403, 'Origen no permitido.');
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');

      const ctx = buildContext(deps, limits, log, now);
      const { userId, token } = await authenticate(req, ctx);
      await authorize(ctx, userId, token);

      const body = await readJsonBody(req, ctx.limits.maxBodyBytes);
      const job = buildJob(body, ctx.limits);
      const refs = await resolveReferences(ctx, job.references);
      if (totalReferenceChars(refs) > ctx.limits.maxTotalReferenceBase64Chars) {
        throw referenceBudgetExceeded(ctx, job.references.length, totalReferenceChars(refs));
      }

      const settled = await Promise.allSettled(
        Array.from({ length: job.count }, (_, variation) => generateVariation(ctx, job, variation, refs)),
      );

      const images: string[] = [];
      const errors: string[] = [];
      const failureStatuses: number[] = [];
      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          if (outcome.value) images.push(outcome.value);
        } else if (outcome.reason instanceof HttpError) {
          errors.push(outcome.reason.message);
          failureStatuses.push(outcome.reason.status);
        } else {
          errors.push('Error generando la imagen.');
          failureStatuses.push(500);
        }
      }

      const durationMs = now() - startedAt;
      if (images.length === 0 && errors.length > 0) {
        const status = failureStatuses.every((s) => s === 504)
          ? 504
          : failureStatuses.includes(429)
          ? 429
          : failureStatuses.includes(422)
          ? 422
          : 502;
        log('failed', { type: job.type, count: job.count, refsRequested: job.references.length, refsResolved: refs.length, status, durationMs });
        return jsonResponse(status, {
          success: false,
          error: errors[0],
          errors,
          images: [],
          referenceImagesCount: refs.length,
        }, cors);
      }

      log('completed', {
        type: job.type,
        count: job.count,
        refsRequested: job.references.length,
        refsResolved: refs.length,
        images: images.length,
        durationMs,
      });
      return jsonResponse(200, {
        success: images.length > 0,
        images,
        validCount: images.length,
        requestedCount: job.count,
        referenceImagesCount: refs.length,
        errors: errors.length > 0 ? errors : undefined,
        charactersDetected: job.detection
          ? detectCharactersInScene(job.detection.scene, job.detection.characters).map((c) => c.name)
          : undefined,
      }, cors);
    } catch (error) {
      const durationMs = now() - startedAt;
      if (error instanceof HttpError) {
        log('rejected', { status: error.status, durationMs });
        return jsonResponse(error.status, { success: false, error: error.message, images: [], ...error.extra }, cors);
      }
      log('error', { name: error instanceof Error ? error.name : 'unknown', durationMs });
      return jsonResponse(500, { success: false, error: 'Error interno generando imágenes.', images: [] }, cors);
    }
  };
}
