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
 * pair: enough budget for a ~300-word Spanish answer, and the cheapest thinking
 * tier the model offers.
 */
const RESEARCH_THINKING_LEVEL = 'LOW';
const RESEARCH_MAX_OUTPUT_TOKENS = 1024;

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
 */
function warningMessage(source: WarningSource, code: ResearchFailureCode): string {
  return `${WARNING_REASONS[code]} en ${WARNING_SOURCES[source]}. ` +
    'El cuento se generó sin esa información.';
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
 * `finishReason` is provider-controlled text that this handler both logs and
 * echoes to the client, so it is classified by SHAPE before either: the real
 * field is an upper-snake-case enum (`STOP`, `MAX_TOKENS`, `SAFETY`, …), and
 * anything else — a URL, a token, a sentence — collapses to `DESCONOCIDO`.
 *
 * Shape rather than an enumerated allowlist so a new provider reason still
 * reports itself instead of being flattened, per PF's log-hygiene invariant.
 */
function safeFinishReason(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  return /^[A-Z_]{1,40}$/.test(raw) ? raw : 'DESCONOCIDO';
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

  {
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
{"title":"string","summary":"string","characters":[{"name":"string","role":"protagonist|secondary|minor","description":"string","visualDescription":"string","appearsInScenes":[1,2,3]}],"scenes":[{"number":1,"text":"string","visualDescription":"string","charactersInScene":["name1","name2"],"landmarkVisible":true}],"spiritualConnection":"string"}

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
- spiritualConnection: conexión con el Evangelio`;

/**
 * Schema del tool `emit_story`: fuerza salida estructurada de Claude y elimina
 * el parsing frágil de JSON embebido en texto.
 */
const STORY_TOOL_SCHEMA = {
  type: 'object',
  required: ['title', 'summary', 'characters', 'scenes', 'spiritualConnection'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        required: ['name', 'role', 'description', 'visualDescription'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: ['protagonist', 'secondary', 'minor'] },
          description: { type: 'string' },
          visualDescription: { type: 'string' },
          appearsInScenes: { type: 'array', items: { type: 'number' } },
        },
      },
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['number', 'text', 'visualDescription'],
        properties: {
          number: { type: 'number' },
          text: { type: 'string' },
          visualDescription: { type: 'string' },
          charactersInScene: { type: 'array', items: { type: 'string' } },
          landmarkVisible: { type: 'boolean' },
        },
      },
    },
    // spiritualConnection va ANTES de props: si el output alcanza max_tokens,
    // el corte cae en props (opcional) y no en un campo requerido.
    spiritualConnection: { type: 'string' },
    props: {
      type: 'array',
      description: 'Lugares y objetos que aparecen en 2+ escenas y deben verse idénticos entre ilustraciones',
      items: {
        type: 'object',
        required: ['name', 'kind', 'narrativeRole', 'visualDescription', 'sceneNumbers'],
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: ['location', 'prop'] },
          narrativeRole: { type: 'string' },
          visualDescription: { type: 'string' },
          sceneNumbers: { type: 'array', items: { type: 'number' } },
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
 * Valida la estructura de la respuesta JSON (nuevo formato con escenas)
 */
function validateStory(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;

  const story = data as Record<string, unknown>;

  // Validar campos requeridos
  if (typeof story.title !== 'string') return false;
  if (typeof story.summary !== 'string') return false;
  if (typeof story.spiritualConnection !== 'string') return false;

  // Validar characters array
  if (!Array.isArray(story.characters) || story.characters.length === 0) return false;

  // Validar scenes array
  if (!Array.isArray(story.scenes) || story.scenes.length === 0) return false;

  // Validar estructura de cada escena
  for (const scene of story.scenes as Array<Record<string, unknown>>) {
    if (typeof scene.number !== 'number') return false;
    if (typeof scene.text !== 'string') return false;
    if (typeof scene.visualDescription !== 'string') return false;
  }

  return true;
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
  const warnings: ResponseWarning[] = [];

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
      throw new Error('Se requiere contexto de la liturgia y ubicación');
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

    const data = await response.json();

    if (data.stop_reason === 'max_tokens') {
      console.error('[generate-story] Output truncado por max_tokens');
      throw new Error('El cuento generado es demasiado largo y quedó incompleto. Intenta con menos escenas o notas más breves.');
    }

    // Con tool_choice forzado el cuento llega como bloque tool_use ya parseado.
    interface StoryOutput {
      title: string;
      summary: string;
      characters: Array<Record<string, unknown>>;
      scenes: Array<{ number: number; text: string; visualDescription: string; landmarkVisible?: boolean }>;
      props?: Array<{
        name: string;
        kind: 'location' | 'prop';
        narrativeRole: string;
        visualDescription: string;
        sceneNumbers: number[];
      }>;
      spiritualConnection: string;
    }

    const contentBlocks: Array<{ type?: string; name?: string; text?: string; input?: unknown }> =
      Array.isArray(data.content) ? data.content : [];

    let story = contentBlocks.find(
      (b) => b.type === 'tool_use' && b.name === 'emit_story'
    )?.input as StoryOutput | undefined;

    if (!story) {
      // Fallback: extraer JSON del texto (respuestas sin bloque tool_use)
      const textBlock = contentBlocks.find((b) => b.type === 'text' && typeof b.text === 'string');
      if (!textBlock?.text) {
        console.error(`[generate-story] Sin tool_use ni texto. stop_reason: ${charCount(data.stop_reason)}`);
        throw new Error('La API no retornó contenido');
      }

      console.warn('[generate-story] Sin bloque tool_use, extrayendo JSON del texto (fallback)');
      const rawText = textBlock.text;
      const fenced = rawText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = (fenced ? fenced[1] : rawText.match(/\{[\s\S]*\}/)?.[0])
        ?.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .trim();

      if (!jsonText) {
        console.error(`[generate-story] No se encontró JSON en la respuesta: ${charCount(rawText)}`);
        throw new Error('No se encontró JSON válido en la respuesta');
      }

      story = JSON.parse(jsonText) as StoryOutput;
    }

    // Validar estructura
    if (!validateStory(story)) {
      console.error(`[generate-story] Estructura inválida: ${bodyShape(JSON.stringify(story))}`);
      throw new Error('La respuesta no tiene la estructura esperada');
    }

    console.log(`[generate-story] Cuento generado exitosamente; título ${charCount(story.title)}`);
    console.log(`[generate-story] Escenas: ${story.scenes?.length || 0}, Personajes: ${story.characters?.length || 0}, Props sugeridos: ${story.props?.length || 0}`);

    // Props sugeridos por el modelo (lugares/objetos recurrentes inventados por
    // el cuento). Se excluyen los que el usuario ya definió con fotos propias
    // (match por nombre, sin distinguir mayúsculas ni artículos iniciales).
    const normalizePropName = (n: string) =>
      n.toLowerCase().trim().replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '').trim();
    const userPropNames = new Set(propList.map((p) => normalizePropName(p.name || '')));
    const suggestedProps = (story.props || []).filter(
      (p) => p?.name && p.visualDescription && !userPropNames.has(normalizePropName(p.name))
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
