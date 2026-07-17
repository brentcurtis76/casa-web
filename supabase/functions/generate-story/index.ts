/**
 * CASA Story Generator Edge Function
 * Genera cuentos para niños usando Claude Opus 4.5
 * Basado en el contexto litúrgico y parámetros del usuario
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createSupabaseAuthzDeps, requireLiturgyWriter } from '../_shared/liturgyAuth.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const GOOGLE_AI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

// F0 AuthN/AuthZ: service-role client + injectable authz deps for the shared
// fail-closed guard. Request logic for this function is still monolithic on
// cc-cleanup (overhaul fases 0-2); the handler.ts split is deferred to the
// edge-function phases (F/C/D). The guard itself is the reviewed F0 module.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authzDeps = createSupabaseAuthzDeps(supabaseAdmin);
const MODEL = 'claude-opus-4-5-20251101';
const GEMINI_MODEL = 'gemini-2.0-flash';

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
        console.warn(`[generate-story] ${label}: error de red/timeout, reintentando:`, err instanceof Error ? err.message : err);
        await new Promise((r) => setTimeout(r, 2_000 + Math.random() * 3_000));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Investiga información visual sobre una ubicación en Chile usando Gemini
 */
async function researchLocation(location: string): Promise<string> {
  if (!GOOGLE_AI_API_KEY) {
    console.log('[generate-story] No GOOGLE_AI_API_KEY, skipping location research');
    return '';
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

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: researchPrompt }] }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      },
      30_000,
      'investigación de ubicación'
    );

    if (!response.ok) {
      console.error('[generate-story] Error researching location:', response.status);
      return '';
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[generate-story] Location research for "${location}":`, text.slice(0, 200) + '...');
    return text;
  } catch (err) {
    console.error('[generate-story] Error in location research:', err);
    return '';
  }
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
  referenceImages: string[];
  kind?: 'landmark' | 'location' | 'prop';
}): Promise<string> {
  const { name, narrativeRole, referenceImages } = params;
  const kind = params.kind ?? 'landmark';

  if (!GOOGLE_AI_API_KEY || !Array.isArray(referenceImages) || referenceImages.length === 0) {
    console.log(`[generate-story] No API key or no ${kind} images for "${name}", skipping analysis`);
    return '';
  }

  const analysisPrompt = buildVisualAnalysisPrompt(name, narrativeRole, kind);

  try {
    // Build multimodal request with images
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
    parts.push({ text: analysisPrompt });

    for (const img of referenceImages.slice(0, 4)) {
      let base64Data = img;
      let mimeType = 'image/jpeg';

      // Handle data URLs
      if (img.startsWith('data:')) {
        const match = img.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        } else {
          continue;
        }
      }

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    console.log(`[generate-story] Analyzing ${referenceImages.length} ${kind} images for "${name}"`);

    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: 400 },
        }),
      },
      45_000,
      `análisis visual de "${name}"`
    );

    if (!response.ok) {
      console.error(`[generate-story] Error analyzing ${kind} "${name}":`, response.status);
      return '';
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[generate-story] ${kind} analysis for "${name}":`, text.slice(0, 200) + '...');
    return text;
  } catch (err) {
    console.error(`[generate-story] Error in ${kind} analysis for "${name}":`, err);
    return '';
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // F0 fail-closed authz: runs BEFORE req.json(), any download, Storage, or the
  // provider. Missing/invalid token => 401, denied => 403, backend error => 503.
  const authz = await requireLiturgyWriter(req, authzDeps, corsHeaders);
  if (!authz.ok) {
    return authz.response;
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no está configurada');
    }

    const requestData = await req.json();

    const { context, location, characters, landmarks, props, style, additionalNotes, previewPromptOnly } = requestData;

    if (!context || !location) {
      throw new Error('Se requiere contexto de la liturgia y ubicación');
    }

    console.log(`[generate-story] Generando cuento para: "${context.title}"`);
    console.log(`[generate-story] Ubicación: ${location}, Estilo: ${style}`);
    console.log(`[generate-story] Landmarks: ${landmarks?.length || 0}, Props: ${props?.length || 0}`);
    console.log(`[generate-story] Texto de reflexión: ${context.reflexionText ? `${context.reflexionText.length} caracteres` : 'No disponible'}`);

    // Investigación de ubicación + análisis de fotos de landmarks/props en paralelo:
    // son llamadas independientes a Gemini y ninguna lanza excepciones (devuelven '' en error).
    const landmarkList: Array<{ name: string; narrativeRole: string; referenceImages?: string[]; role?: string }> =
      Array.isArray(landmarks) ? landmarks : [];
    const propList: Array<{ id: string; name: string; kind?: string; narrativeRole?: string; referenceImages?: string[]; role?: string }> =
      Array.isArray(props) ? props : [];

    console.log(`[generate-story] Investigando ubicación "${location}" y analizando ${landmarkList.length} landmarks + ${propList.length} props en paralelo...`);

    const [locationResearch, landmarkAnalyses, propAnalyses] = await Promise.all([
      researchLocation(location),
      Promise.all(landmarkList.map(async (lm) => ({
        name: lm.name,
        narrativeRole: lm.narrativeRole,
        visualDescription: await analyzeImagesForVisualDescription({
          name: lm.name,
          narrativeRole: lm.narrativeRole,
          referenceImages: lm.referenceImages || [],
          kind: 'landmark',
        }),
        role: lm.role || 'primary',
      }))),
      // Each incoming prop must include `id` so the visual description can be merged
      // back to the originating prop without relying on array order or duplicate names.
      Promise.all(propList.map(async (p) => {
        const propKind: 'location' | 'prop' = p.kind === 'location' ? 'location' : 'prop';
        return {
          id: p.id,
          name: p.name,
          kind: propKind,
          narrativeRole: p.narrativeRole || '',
          visualDescription: await analyzeImagesForVisualDescription({
            name: p.name,
            narrativeRole: p.narrativeRole || '',
            referenceImages: p.referenceImages || [],
            kind: propKind,
          }),
          role: p.role || 'secondary',
        };
      })),
    ]);

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
          'x-api-key': ANTHROPIC_API_KEY,
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
      console.error('[generate-story] Error de API:', response.status, errorText);
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
        console.error('[generate-story] Sin tool_use ni texto. stop_reason:', data.stop_reason);
        throw new Error('La API no retornó contenido');
      }

      console.warn('[generate-story] Sin bloque tool_use, extrayendo JSON del texto (fallback)');
      const rawText = textBlock.text;
      const fenced = rawText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = (fenced ? fenced[1] : rawText.match(/\{[\s\S]*\}/)?.[0])
        ?.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        .trim();

      if (!jsonText) {
        console.error('[generate-story] No se encontró JSON en:', rawText.slice(0, 500));
        throw new Error('No se encontró JSON válido en la respuesta');
      }

      story = JSON.parse(jsonText) as StoryOutput;
    }

    // Validar estructura
    if (!validateStory(story)) {
      console.error('[generate-story] Estructura inválida:', JSON.stringify(story).slice(0, 500));
      throw new Error('La respuesta no tiene la estructura esperada');
    }

    console.log('[generate-story] Cuento generado exitosamente:', story.title);
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

  } catch (error) {
    console.error('[generate-story] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Error generando cuento',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
