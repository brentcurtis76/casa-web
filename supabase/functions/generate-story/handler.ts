/**
 * CASA Story Generator — request handler.
 *
 * Extracted from `index.ts` so it can be imported by tests without starting a
 * server, reading the environment, or hitting the network. `index.ts` is the
 * only place that constructs production dependencies and calls `serve()`.
 *
 * Auth: OPTIONS is handled before the guard for CORS preflight. Every other
 * method must pass `requireLiturgyWriter` BEFORE the handler reads the body,
 * calls Gemini research, or calls the Anthropic provider. Fail-closed by design.
 */

import {
  requireLiturgyWriter,
  type RequirePermissionDeps,
} from "../_shared/liturgyAuth.ts";

// Bare alias only. A date-suffixed ID silently 404s the day it retires —
// that is how claude-sonnet-4-20250514 took down process-reflexion-pdf.
const MODEL = "claude-opus-5";
const GEMINI_MODEL = "gemini-2.0-flash";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function researchLocation(
  googleAiApiKey: string,
  location: string,
): Promise<string> {
  if (!googleAiApiKey) {
    console.log(
      "[generate-story] No GOOGLE_AI_API_KEY, skipping location research",
    );
    return "";
  }

  const researchPrompt =
    `Necesito información visual detallada sobre "${location}" en Chile para crear ilustraciones de un cuento infantil.

Por favor proporciona:
1. **Características geográficas**: ¿Es costa, montaña, isla, desierto, bosque, ciudad? Describe el paisaje.
2. **Elementos visuales distintivos**: ¿Qué edificios, monumentos, o elementos naturales son característicos? (faros, iglesias, volcanes, playas, etc.)
3. **Colores predominantes**: ¿Qué colores dominan el paisaje? (azul del mar, verde de bosques, colores de casas, etc.)
4. **Arquitectura local**: ¿Cómo son las casas y edificios típicos? (palafitos, casas de madera, adobe, etc.)
5. **Flora y fauna**: ¿Qué plantas y animales son típicos de la zona?
6. **Clima y luz**: ¿Cómo es la luz típica? ¿Hay niebla, sol fuerte, etc.?

Responde en español, de forma concisa pero detallada (máximo 300 palabras). Solo información visual útil para ilustraciones.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${googleAiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: researchPrompt }] }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      },
    );

    if (!response.ok) {
      console.error(
        "[generate-story] Error researching location:",
        response.status,
        await response.text(),
      );
      return "";
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(
      `[generate-story] Location research for "${location}":`,
      text.slice(0, 200) + "...",
    );
    return text;
  } catch (err) {
    console.error("[generate-story] Error in location research:", err);
    return "";
  }
}

function buildVisualAnalysisPrompt(
  name: string,
  narrativeRole: string,
  kind: "landmark" | "location" | "prop",
): string {
  if (kind === "prop") {
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

  if (kind === "location") {
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

async function analyzeImagesForVisualDescription(
  googleAiApiKey: string,
  params: {
    name: string;
    narrativeRole: string;
    referenceImages: string[];
    kind?: "landmark" | "location" | "prop";
  },
): Promise<string> {
  const { name, narrativeRole, referenceImages } = params;
  const kind = params.kind ?? "landmark";

  if (
    !googleAiApiKey || !Array.isArray(referenceImages) ||
    referenceImages.length === 0
  ) {
    console.log(
      `[generate-story] No API key or no ${kind} images for "${name}", skipping analysis`,
    );
    return "";
  }

  const analysisPrompt = buildVisualAnalysisPrompt(name, narrativeRole, kind);

  try {
    const parts: Array<
      { text?: string; inlineData?: { mimeType: string; data: string } }
    > = [];
    parts.push({ text: analysisPrompt });

    for (const img of referenceImages.slice(0, 4)) {
      let base64Data = img;
      let mimeType = "image/jpeg";

      if (img.startsWith("data:")) {
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

    console.log(
      `[generate-story] Analyzing ${referenceImages.length} ${kind} images for "${name}"`,
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${googleAiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: 400 },
        }),
      },
    );

    if (!response.ok) {
      console.error(
        `[generate-story] Error analyzing ${kind} "${name}":`,
        response.status,
        await response.text(),
      );
      return "";
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log(
      `[generate-story] ${kind} analysis for "${name}":`,
      text.slice(0, 200) + "...",
    );
    return text;
  } catch (err) {
    console.error(
      `[generate-story] Error in ${kind} analysis for "${name}":`,
      err,
    );
    return "";
  }
}

const FORBIDDEN_NAMES = [
  "Matías",
  "Emilia",
  "Tomás",
  "Amanda",
  "Matilde",
  "Leonor",
  "Timoteo",
  "Rocío",
  "Renato",
  "Rafael",
  "Sofía",
  "Martín",
  "Isidora",
  "Benjamín",
  "Florencia",
  "Agustín",
  "Catalina",
  "Vicente",
  "Valentina",
  "Joaquín",
  "Antonia",
  "Maximiliano",
  "Fernanda",
  "Sebastián",
  "Josefa",
  "Alonso",
  "Trinidad",
  "Nicolás",
  "Maite",
  "Lucas",
  "Ignacia",
  "Felipe",
  "Pascuala",
  "Diego",
  "Esperanza",
  "Gabriel",
  "Paz",
  "Daniel",
  "Colomba",
  "Samuel",
  "Montserrat",
  "Facundo",
  "Javiera",
  "Gaspar",
  "Julieta",
  "Simón",
  "Agustina",
  "Mateo",
  "Isabella",
  "Santiago",
  "Antonella",
  "José",
  "María",
  "Pedro",
  "Juan",
  "Francisca",
  "Francisco",
  "Camila",
  "Pablo",
  "Constanza",
];

const SYSTEM_PROMPT =
  `Eres un cuentacuentos experto en crear historias para niños pequeños en el contexto de una comunidad cristiana progresiva e inclusiva (CASA - Comunidad Anglicana San Andrés).

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
${FORBIDDEN_NAMES.join(", ")}

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
  landmarks?: Array<
    {
      name: string;
      narrativeRole: string;
      visualDescription: string;
      role: string;
    }
  >;
  props?: Array<
    {
      name: string;
      kind: string;
      narrativeRole: string;
      visualDescription: string;
      role: string;
    }
  >;
  style: string;
  additionalNotes: string;
}): string {
  const {
    context,
    location,
    locationResearch,
    characters,
    landmarks,
    props,
    style,
    additionalNotes,
  } = data;

  const readings = Array.isArray(context?.readings) ? context.readings : [];
  const readingsText = readings.length > 0
    ? readings.map((r, i) =>
      `### Lectura ${i + 1}: ${r?.reference || "Sin referencia"}\n${
        r?.text || ""
      }`
    ).join("\n\n")
    : "### Lecturas\nNo hay lecturas disponibles";

  const styleDescriptions: Record<string, string> = {
    aventura: "emocionante, con acción y momentos de suspenso positivo",
    reflexivo:
      "contemplativo, con momentos de silencio y descubrimiento interior",
    humoristico: "divertido, con situaciones graciosas y personajes simpáticos",
    misterio: "intrigante, con un pequeño misterio que resolver",
  };

  const safeCharacters = Array.isArray(characters) ? characters : [];

  const reflexionSection = context?.reflexionText
    ? `

### Texto de la Reflexión del Predicador
${context.reflexionText}

NOTA IMPORTANTE: Este es el texto completo de la reflexión que el predicador dará después del cuento.
El cuento debe preparar a los niños para recibir este mensaje, usando metáforas y situaciones que
conecten con los temas de la reflexión de manera natural y apropiada para su edad.
`
    : "";

  return `## Información de la Liturgia

### Título/Tema
${context?.title || "Sin título"}

### Resumen del Mensaje
${context?.summary || "No disponible"}

${readingsText}
${reflexionSection}
---

## Parámetros del Cuento

### Lugar
${location || "Chile"}
(Ambienta la historia en este lugar de Chile, usando detalles locales reconocibles)

${
    locationResearch
      ? `### Información Visual del Lugar (investigación real)
${locationResearch}
`
      : ""
  }### Personajes Sugeridos
${
    safeCharacters.length > 0
      ? safeCharacters.join(", ")
      : "A tu elección - crea personajes apropiados para la historia"
  }

### Estilo Narrativo
${styleDescriptions[style] || style}

### Notas Adicionales del Usuario
${additionalNotes || "Ninguna"}
${
    landmarks && landmarks.length > 0
      ? `
### Landmark / Edificio como "Personaje" Visual
${
        landmarks.map((lm) => `
**${lm.name}**
- Rol narrativo: ${lm.narrativeRole}
- Prominencia: ${
          lm.role === "primary"
            ? "PRINCIPAL — debe aparecer en muchas escenas (al menos la mitad)"
            : "SECUNDARIO — aparece en algunas escenas (3-4)"
        }
${
          lm.visualDescription
            ? `- Descripción visual (analizada de fotos reales): ${lm.visualDescription}`
            : ""
        }

IMPORTANTE: Trata "${lm.name}" casi como un personaje más. Cuando aparezca en una escena, incluye detalles visuales específicos del landmark en la visualDescription de esa escena. Marca "landmarkVisible": true en cada escena donde el landmark debe verse en la ilustración.
`).join("\n")
      }`
      : ""
  }
${
    props && props.length > 0
      ? `
### Referencias visuales (elementos recurrentes)
${
        props.map((p) => `
**${p.name}**
- Tipo: ${p.kind === "location" ? "Lugar / escenario" : "Objeto / prop"}
- Rol narrativo: ${p.narrativeRole}
${
          p.visualDescription
            ? `- Descripción visual (analizada de fotos reales): ${p.visualDescription}`
            : ""
        }
`).join("\n")
      }
IMPORTANTE: Estos elementos deben aparecer de manera consistente en cualquier escena cuya descripción visual (visualDescription) los mencione. Cuando incluyas uno de estos elementos en una escena, usa los mismos detalles visuales descritos arriba para mantener coherencia entre ilustraciones.
`
      : ""
  }
---

Por favor, crea un cuento original basándote en esta información. El cuento debe:
- Durar 3-5 minutos al ser leído en voz alta (aproximadamente 400-600 palabras)
- Estar dividido en párrafos cortos para facilitar la lectura
- Transmitir el mensaje espiritual de forma implícita, no explícita
- Ser apropiado para niños de 5-10 años${
    context?.reflexionText
      ? "\n- Conectar con los temas de la reflexión del predicador de manera sutil"
      : ""
  }`;
}

function validateStory(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;

  const story = data as Record<string, unknown>;

  if (typeof story.title !== "string") return false;
  if (typeof story.summary !== "string") return false;
  if (typeof story.spiritualConnection !== "string") return false;

  if (!Array.isArray(story.characters) || story.characters.length === 0) {
    return false;
  }

  if (!Array.isArray(story.scenes) || story.scenes.length === 0) return false;

  for (const scene of story.scenes as Array<Record<string, unknown>>) {
    if (typeof scene.number !== "number") return false;
    if (typeof scene.text !== "string") return false;
    if (typeof scene.visualDescription !== "string") return false;
  }

  return true;
}

export interface HandlerDeps {
  /** Anthropic API key. Read from env in production; injected in tests. */
  anthropicApiKey: string;
  /** Google AI (Gemini) API key. Optional — location research is skipped when absent. */
  googleAiApiKey: string;
  /** Authz dependencies for `requireLiturgyWriter`. */
  authzDeps: RequirePermissionDeps;
}

/**
 * Factory that returns the actual request handler. Building the handler
 * does not touch env, network, or storage — all side effects happen when
 * the returned function is invoked with a Request.
 */
export function createHandler(
  deps: HandlerDeps,
): (req: Request) => Promise<Response> {
  const { anthropicApiKey, googleAiApiKey, authzDeps } = deps;

  return async function handler(req: Request): Promise<Response> {
    // OPTIONS is handled before the auth guard so CORS preflight succeeds
    // for browsers without a bearer token.
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Fail-closed authz. Runs BEFORE req.json(), Gemini research, or Claude.
    const authz = await requireLiturgyWriter(req, authzDeps, corsHeaders);
    if (!authz.ok) {
      return authz.response;
    }

    try {
      if (!anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY no está configurada");
      }

      const requestData = await req.json();

      const {
        context,
        location,
        characters,
        landmarks,
        props,
        style,
        additionalNotes,
        previewPromptOnly,
      } = requestData;

      if (!context || !location) {
        throw new Error("Se requiere contexto de la liturgia y ubicación");
      }

      console.log(
        `[generate-story] Generando cuento para: "${context.title}"`,
      );
      console.log(
        `[generate-story] Ubicación: ${location}, Estilo: ${style}`,
      );
      console.log(
        `[generate-story] Landmarks: ${landmarks?.length || 0}, Props: ${
          props?.length || 0
        }`,
      );
      console.log(
        `[generate-story] Texto de reflexión: ${
          context.reflexionText
            ? `${context.reflexionText.length} caracteres`
            : "No disponible"
        }`,
      );

      console.log(`[generate-story] Investigando ubicación: ${location}...`);
      const locationResearch = await researchLocation(googleAiApiKey, location);

      const landmarkAnalyses: Array<
        {
          name: string;
          narrativeRole: string;
          visualDescription: string;
          role: string;
        }
      > = [];
      if (landmarks && Array.isArray(landmarks) && landmarks.length > 0) {
        for (const lm of landmarks) {
          console.log(
            `[generate-story] Analyzing landmark: "${lm.name}" with ${
              lm.referenceImages?.length || 0
            } images`,
          );
          const visualDescription = await analyzeImagesForVisualDescription(
            googleAiApiKey,
            {
              name: lm.name,
              narrativeRole: lm.narrativeRole,
              referenceImages: lm.referenceImages || [],
              kind: "landmark",
            },
          );
          landmarkAnalyses.push({
            name: lm.name,
            narrativeRole: lm.narrativeRole,
            visualDescription,
            role: lm.role || "primary",
          });
        }
      }

      const propAnalyses: Array<
        {
          id: string;
          name: string;
          kind: string;
          narrativeRole: string;
          visualDescription: string;
          role: string;
        }
      > = [];
      if (props && Array.isArray(props) && props.length > 0) {
        for (const p of props) {
          const propKind: "location" | "prop" = p.kind === "location"
            ? "location"
            : "prop";
          console.log(
            `[generate-story] Analyzing ${propKind}: "${p.name}" (id=${p.id}) with ${
              p.referenceImages?.length || 0
            } images`,
          );
          const visualDescription = await analyzeImagesForVisualDescription(
            googleAiApiKey,
            {
              name: p.name,
              narrativeRole: p.narrativeRole || "",
              referenceImages: p.referenceImages || [],
              kind: propKind,
            },
          );
          propAnalyses.push({
            id: p.id,
            name: p.name,
            kind: propKind,
            narrativeRole: p.narrativeRole || "",
            visualDescription,
            role: p.role || "secondary",
          });
        }
      }

      if (previewPromptOnly) {
        const userPrompt = buildUserPrompt({
          context,
          location,
          locationResearch,
          characters: characters || [],
          landmarks: landmarkAnalyses.length > 0 ? landmarkAnalyses : undefined,
          props: propAnalyses.length > 0 ? propAnalyses : undefined,
          style: style || "reflexivo",
          additionalNotes: additionalNotes || "",
        });
        return new Response(
          JSON.stringify({
            success: true,
            promptPreview: {
              systemPrompt: SYSTEM_PROMPT,
              userPrompt,
            },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const userPrompt = buildUserPrompt({
        context,
        location,
        locationResearch,
        characters: characters || [],
        landmarks: landmarkAnalyses.length > 0 ? landmarkAnalyses : undefined,
        props: propAnalyses.length > 0 ? propAnalyses : undefined,
        style: style || "reflexivo",
        additionalNotes: additionalNotes || "",
      });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          // Opus 4.5 did no thinking unless asked; Opus 5 thinks by default.
          // max_tokens caps thinking + response together, so leaving it on
          // would eat the budget and truncate the JSON parsed below.
          thinking: { type: "disabled" },
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: userPrompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[generate-story] Error de API:",
          response.status,
          errorText,
        );
        throw new Error(`Error de Claude API: ${response.status}`);
      }

      const data = await response.json();

      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error("La API no retornó contenido");
      }

      // Truncated output is still syntactically "a JSON prefix", so every
      // parse attempt below fails with a generic syntax error and the real
      // cause (hitting max_tokens) stays invisible. Catch it here instead.
      if (data.stop_reason === "max_tokens") {
        console.error(
          "[generate-story] Respuesta truncada en max_tokens. output_tokens:",
          data.usage?.output_tokens,
        );
        throw new Error(
          "El cuento superó el límite de tokens y quedó incompleto. " +
            "Reduce el número de escenas, personajes o referencias visuales e inténtalo de nuevo.",
        );
      }

      let jsonText = data.content[0].text;
      console.log(
        "[generate-story] Respuesta cruda (primeros 500 chars):",
        jsonText.slice(0, 500),
      );

      let jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error("[generate-story] No se encontró JSON en:", jsonText);
          throw new Error("No se encontró JSON válido en la respuesta");
        }
        jsonText = jsonMatch[0];
      }

      jsonText = jsonText
        // deno-lint-ignore no-control-regex -- intentional: strips ASCII control chars from model output before JSON.parse (same expression exists on origin/main)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
        .trim();

      console.log(
        "[generate-story] JSON limpio (primeros 1000 chars):",
        jsonText.slice(0, 1000),
      );

      let story: unknown;
      const parseAttempts: Array<() => unknown> = [
        () => JSON.parse(jsonText),
        () => {
          const cleaned = jsonText.replace(
            /("(?:[^"\\]|\\.)*")|[\n\r\t]/g,
            (_match: string, group: string | undefined) => {
              if (group) return group;
              return " ";
            },
          );
          return JSON.parse(cleaned);
        },
        () => {
          const cleaned = jsonText
            .replace(/'/g, "'")
            .replace(/"/g, '"')
            .replace(/"/g, '"')
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");
          return JSON.parse(cleaned);
        },
        () => {
          const cleaned = jsonText
            .replace(/\s+/g, " ")
            .replace(/"\s*:\s*/g, '":')
            .replace(/,\s*/g, ",")
            .replace(/\[\s*/g, "[")
            .replace(/\s*\]/g, "]")
            .replace(/\{\s*/g, "{")
            .replace(/\s*\}/g, "}");
          return JSON.parse(cleaned);
        },
      ];

      for (let i = 0; i < parseAttempts.length; i++) {
        try {
          story = parseAttempts[i]();
          console.log(
            `[generate-story] Parseado exitoso en intento ${i + 1}`,
          );
          break;
        } catch (err) {
          console.log(
            `[generate-story] Intento ${i + 1} falló:`,
            err instanceof Error ? err.message : "Error",
          );
          if (i === parseAttempts.length - 1) {
            console.error(
              "[generate-story] Todos los intentos de parsing fallaron",
            );
            console.error(
              "[generate-story] JSON que falló (últimos 500 chars):",
              jsonText.slice(-500),
            );
            throw new Error(
              "Error parseando la respuesta de Claude - JSON inválido",
            );
          }
        }
      }

      if (!validateStory(story)) {
        console.error(
          "[generate-story] Estructura inválida:",
          JSON.stringify(story).slice(0, 500),
        );
        throw new Error("La respuesta no tiene la estructura esperada");
      }

      const storyRecord = story as Record<string, unknown>;
      const scenes = storyRecord.scenes as Array<{ text: string }>;

      console.log(
        "[generate-story] Cuento generado exitosamente:",
        storyRecord.title,
      );
      console.log(
        `[generate-story] Escenas: ${scenes?.length || 0}, Personajes: ${
          (storyRecord.characters as Array<unknown>)?.length || 0
        }`,
      );

      const contentText = Array.isArray(scenes)
        ? scenes.map((s) => s.text).join("\n\n")
        : "";

      return new Response(
        JSON.stringify({
          success: true,
          title: storyRecord.title,
          summary: storyRecord.summary,
          characters: storyRecord.characters,
          scenes: storyRecord.scenes,
          spiritualConnection: storyRecord.spiritualConnection,
          landmarkAnalyses: landmarkAnalyses.length > 0
            ? landmarkAnalyses
            : undefined,
          propAnalyses: propAnalyses.map(({ id, visualDescription }) => ({
            id,
            visualDescription,
          })),
          content: contentText,
          story: contentText,
          moral: storyRecord.spiritualConnection,
          suggestedDuration: Math.ceil((scenes?.length || 12) / 3),
          model: MODEL,
          usage: {
            input_tokens: data.usage?.input_tokens || 0,
            output_tokens: data.usage?.output_tokens || 0,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("[generate-story] Error:", error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error
            ? error.message
            : "Error generando cuento",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  };
}
