/**
 * CASA Story Refinement — request handler.
 *
 * Extracted from `index.ts` so it can be imported by tests without starting a
 * server, reading the environment, or hitting the network. `index.ts` is the
 * only place that constructs production dependencies and calls `serve()`.
 *
 * Auth: OPTIONS is handled before the guard for CORS preflight. Every other
 * method must pass `requireLiturgyWriter` BEFORE the handler reads the body
 * or calls the Anthropic provider. Fail-closed by design.
 */

import {
  requireLiturgyWriter,
  type RequirePermissionDeps,
} from "../_shared/liturgyAuth.ts";
import {
  describeValidationErrors,
  ProviderOutputError,
  SCENE_COUNT_MAX,
  SCENE_COUNT_MIN,
  type StoryOutput,
  STORY_TOOL_SCHEMA,
  type StoryValidationError,
  trimmedString,
  validateAndNormalizeStory,
} from "../_shared/storyContract.ts";

// Bare alias only. A date-suffixed ID silently 404s the day it retires —
// that is how claude-sonnet-4-20250514 took down process-reflexion-pdf.
const MODEL = "claude-opus-5";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RefinementType =
  | "general"
  | "characters"
  | "plot"
  | "scenes"
  | "spiritual"
  | "length"
  | "tone";

const REFINEMENT_INSTRUCTIONS: Record<RefinementType, string> = {
  general:
    `Refina el cuento según el feedback del usuario. Mantén la estructura general (título, personajes, escenas) pero mejora según lo indicado.`,
  characters: `Enfócate en mejorar los personajes del cuento. Puedes:
- Agregar más profundidad a la personalidad del protagonista
- Mejorar las descripciones visuales de los personajes
- Ajustar los roles secundarios
- Hacer los personajes más memorables o relatables`,
  plot: `Enfócate en mejorar la trama del cuento. Puedes:
- Fortalecer el conflicto o tensión dramática
- Mejorar la resolución
- Agregar momentos de suspenso apropiados para niños
- Hacer la historia más coherente`,
  scenes: `Enfócate en mejorar las escenas individuales. Puedes:
- Mejorar las descripciones visuales
- Ajustar el ritmo entre escenas
- Agregar detalles sensoriales
- Hacer las escenas más cinematográficas`,
  spiritual: `Enfócate en mejorar la conexión espiritual del cuento. Puedes:
- Hacer la referencia a Jesús más natural y menos forzada
- Fortalecer la enseñanza del Evangelio
- Hacer la moraleja más sutil pero impactante
- Conectar mejor con las lecturas de la liturgia`,
  length: `Ajusta la duración del cuento. Si el usuario pide más largo:
- Agrega escenas o expande las existentes
- Incluye más detalles visuales
Si pide más corto:
- Combina escenas
- Reduce descripciones manteniendo el mensaje
Mantén siempre entre ${SCENE_COUNT_MIN} y ${SCENE_COUNT_MAX} escenas.`,
  tone: `Ajusta el tono del cuento. Puedes hacerlo:
- Más alegre y divertido
- Más reflexivo y profundo
- Más aventurero y emocionante
- Más tierno y emotivo
Según lo que pida el usuario.`,
};

// ---------------------------------------------------------------------------
// The strict tool (PD-REFINE, mirroring PD in `generate-story`)
// ---------------------------------------------------------------------------

const TOOL_NAME = "emit_refined_story";

/**
 * The refinement payload is the story shape PLUS `refinementNotes`.
 *
 * Built by SPREADING `STORY_TOOL_SCHEMA` rather than restating it: the refined
 * story must validate under exactly the same rules as a generated one, and a
 * second hand-written copy of a 60-line schema is the drift this phase exists to
 * remove. `refinementNotes` goes last for the reason the shared schema puts
 * `props` last — if the output ever reaches `max_tokens`, the cut lands on the
 * final field rather than on a prose field of the story itself.
 */
const REFINED_STORY_TOOL_SCHEMA = {
  ...STORY_TOOL_SCHEMA,
  required: [...STORY_TOOL_SCHEMA.required, "refinementNotes"],
  properties: {
    ...STORY_TOOL_SCHEMA.properties,
    refinementNotes: {
      type: "string",
      description: "Breve descripción de los cambios realizados en el refinamiento.",
    },
  },
} as const;

/** A refined story is a valid story plus the notes describing what changed. */
export interface RefinedStoryOutput extends StoryOutput {
  refinementNotes: string;
}

type RefinedStoryValidationResult =
  | { ok: true; story: RefinedStoryOutput }
  | { ok: false; errors: StoryValidationError[] };

/**
 * Second line of defence for the refinement payload.
 *
 * Delegates the whole story to the shared `validateAndNormalizeStory` — same
 * rules, same codes, no fork — and adds the one field that is refinement's own.
 * Unknown keys are ignored here exactly as they are there; the strict tool is
 * what rejects them at the source.
 *
 * Warnings are dropped on purpose: this envelope has never carried a `warnings`
 * key, and inventing one is a client-visible contract change that belongs to a
 * phase that owns the client (PD-REFINE scope).
 */
function validateAndNormalizeRefinedStory(
  data: unknown,
): RefinedStoryValidationResult {
  const validated = validateAndNormalizeStory(data);
  // `data` is an object whenever the story validated; the cast is safe only on
  // that branch, so the notes are read after it.
  const notes = validated.ok
    ? trimmedString((data as Record<string, unknown>).refinementNotes)
    : undefined;

  if (!validated.ok) return { ok: false, errors: validated.errors };
  if (notes === undefined) {
    return {
      ok: false,
      errors: [{ code: "EMPTY_STRING", path: "refinementNotes" }],
    };
  }
  return { ok: true, story: { ...validated.story, refinementNotes: notes } };
}

// La ventana de escenas se interpola desde `_shared/storyContract.ts`, que es
// su ÚNICA fuente de verdad.
//
// HISTORIA (resuelta en PD-REFINE, no vigente): este prompt y el texto de
// `REFINEMENT_INSTRUCTIONS.length` declaraban dos rangos distintos y ninguno
// coincidía con lo que el código aceptaba — porque el código no comprobaba el
// número de escenas en absoluto. Ahora ambos citan las mismas dos constantes
// que el validador aplica, y PDR1f lo verifica sobre los bytes que salen hacia
// el proveedor, no sobre este comentario.
const SYSTEM_PROMPT =
  `Eres un editor experto de cuentos infantiles para una comunidad cristiana progresiva e inclusiva (CASA - Comunidad Anglicana San Andrés).

Tu tarea es REFINAR un cuento existente basándote en el feedback del usuario.

## Reglas Importantes

1. MANTÉN la estructura del cuento (title, summary, characters, scenes, spiritualConnection, props)
2. NO cambies drásticamente la historia - haz mejoras incrementales
3. PRESERVA los nombres y roles básicos de los personajes
4. MANTÉN el mismo número de escenas (o similar, entre ${SCENE_COUNT_MIN}-${SCENE_COUNT_MAX})
5. El cuento debe seguir siendo apropiado para niños de 5-10 años
6. Las escenas deben poder visualizarse como imágenes estáticas
7. EVITA estos nombres de niños de la comunidad: Matías, Emilia, Tomás, Amanda, Matilde, Leonor, Timoteo, Rocío, Renato, Rafael, Sofía, Martín, etc.

## Formato de Respuesta
Emite el cuento refinado ÚNICAMENTE llamando a la herramienta \`${TOOL_NAME}\`.
No escribas el JSON en el texto de la respuesta: la herramienta es el único
formato de salida que este servicio lee.

Reglas que la herramienta no puede expresar por sí sola y que debes cumplir:
- Exactamente entre ${SCENE_COUNT_MIN} y ${SCENE_COUNT_MAX} escenas, numeradas 1..N sin huecos ni repeticiones.
- Un único personaje con role "protagonist".
- Ningún campo de texto vacío.
- \`props\`: lugares u objetos que aparecen en 2 o más escenas y deben verse
  idénticos entre ilustraciones. Usa [] si el cuento no tiene ninguno.
- \`refinementNotes\`: breve descripción de los cambios que hiciste.`;

export interface HandlerDeps {
  /** Anthropic API key. Read from env in production; injected in tests. */
  anthropicApiKey: string;
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
  const { anthropicApiKey, authzDeps } = deps;

  return async function handler(req: Request): Promise<Response> {
    // OPTIONS is handled before the auth guard so CORS preflight succeeds
    // for browsers without a bearer token.
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Fail-closed authz. Runs BEFORE req.json() or the Anthropic provider.
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
        currentStory,
        feedback,
        refinementType = "general",
        liturgyContext,
      } = requestData;

      if (!currentStory || !feedback) {
        throw new Error("Se requiere currentStory y feedback");
      }

      console.log(
        `[refine-story] Refinando cuento: "${currentStory.title}"`,
      );
      console.log(
        `[refine-story] Tipo de refinamiento: ${refinementType}`,
      );
      console.log(
        `[refine-story] Feedback: ${feedback.slice(0, 200)}...`,
      );

      const userPrompt = `## Cuento Actual a Refinar

\`\`\`json
${JSON.stringify(currentStory, null, 2)}
\`\`\`

## Contexto de la Liturgia
${
        liturgyContext
          ? `
- Título: ${liturgyContext.title || "No especificado"}
- Resumen: ${liturgyContext.summary || "No especificado"}
`
          : "No disponible"
      }

## Tipo de Refinamiento: ${refinementType}
${
        REFINEMENT_INSTRUCTIONS[refinementType as RefinementType] ||
        REFINEMENT_INSTRUCTIONS.general
      }

## Feedback del Usuario
"${feedback}"

---

Por favor, refina el cuento según este feedback. Mantén la estructura exacta que declara la herramienta \`${TOOL_NAME}\`, pero aplica las mejoras solicitadas.`;

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
          // would eat the budget the strict `emit_refined_story` tool_use needs.
          thinking: { type: "disabled" },
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: userPrompt,
            },
          ],
          tools: [
            {
              name: TOOL_NAME,
              description:
                "Emite el cuento refinado completo en formato estructurado",
              // Top-level, beside `name`/`description`/`input_schema` — that is
              // where the API reads it. Inside `input_schema` it is an ignored
              // extra key, which is silent: the request still succeeds and the
              // output is simply unconstrained.
              strict: true,
              input_schema: REFINED_STORY_TOOL_SCHEMA,
            },
          ],
          tool_choice: { type: "tool", name: TOOL_NAME },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          "[refine-story] Error de API:",
          response.status,
          errorText,
        );
        throw new Error(`Error de Claude API: ${response.status}`);
      }

      // ---- the response-body guard -------------------------------------
      //
      // A provider 200 is not yet a provider answer: the body is raw
      // provider-controlled bytes until the parse succeeds, and V8's
      // SyntaxError quotes those leading bytes back in its own message. Letting
      // that error escape to the generic 500 echoed provider text to the
      // client, so the engine error is never bound at all — the guard reports
      // through this module's fixed literals only.
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
      // the protocol: reading `stop_reason` off `null` is a TypeError whose
      // engine message would reach the client the same way.
      if (
        parsed === null || typeof parsed !== "object" || Array.isArray(parsed)
      ) {
        throw new ProviderOutputError(
          "INVALID_STORY",
          "response body not an object",
        );
      }
      const data = parsed as {
        stop_reason?: unknown;
        content?: unknown;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      // ---- the stop_reason protocol --------------------------------------
      //
      // `stop_reason` is read BEFORE any content, because strict mode has two
      // DOCUMENTED exceptions that both return HTTP 200 with output that does
      // not match the schema: `refusal` and `max_tokens`. Reading content first
      // would serve a refusal's leftovers as a refined story.
      //
      // A normal client tool completion is `stop_reason: 'tool_use'`. Anything
      // else — `end_turn`, `stop_sequence`, `pause_turn`, an absent reason, or
      // a value this code has never heard of — is not the success protocol, and
      // the safe direction is to say so rather than to guess.
      const stopReason: unknown = data.stop_reason;
      if (stopReason === "refusal") {
        throw new ProviderOutputError("REFUSAL");
      }
      if (stopReason === "max_tokens") {
        throw new ProviderOutputError("MAX_TOKENS");
      }
      if (stopReason !== "tool_use") {
        // Shape only: the raw reason is provider-controlled text, so it is
        // neither logged nor returned.
        throw new ProviderOutputError(
          "INVALID_STORY",
          "stop_reason not tool_use",
        );
      }

      const contentBlocks: Array<
        { type?: string; name?: string; input?: unknown }
      > = Array.isArray(data.content) ? data.content : [];

      // EXACTLY one matching block. Zero is no story; two is two stories and no
      // way to know which one the model meant.
      const storyBlocks = contentBlocks.filter(
        (b) => b?.type === "tool_use" && b?.name === TOOL_NAME,
      );
      if (storyBlocks.length !== 1) {
        throw new ProviderOutputError(
          "INVALID_STORY",
          `${TOOL_NAME} blocks n=${storyBlocks.length}`,
        );
      }

      // NO text/regex/JSON.parse fallback any more. With a forced strict tool,
      // prose is not a second success protocol — it is the model failing to
      // answer, and parsing it was how a refined story that never passed any
      // schema reached the client.
      const validated = validateAndNormalizeRefinedStory(storyBlocks[0].input);
      if (!validated.ok) {
        throw new ProviderOutputError(
          "INVALID_STORY",
          describeValidationErrors(validated.errors),
        );
      }
      const refinedStory = validated.story;

      // Counts only. The refined title and the model's own notes are
      // provider-controlled text, and a log line is not the place to echo it.
      console.log(
        `[refine-story] Cuento refinado exitosamente; escenas: ${refinedStory.scenes.length}, personajes: ${refinedStory.characters.length}`,
      );

      return new Response(
        JSON.stringify({
          success: true,
          story: refinedStory,
          refinementNotes: refinedStory.refinementNotes,
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
      // Typed errors are MAPPED here, not re-thrown: letting a
      // `ProviderOutputError` reach the generic 500 below is exactly the defect
      // this phase closes. The dispatch sits at the TOP of the catch, so the
      // 500 stays the fallback for something genuinely unexpected — a missing
      // API key, a provider non-2xx, a bug in this file.
      if (error instanceof ProviderOutputError) {
        console.error(
          `[refine-story] salida del proveedor rechazada: ${error.reason}` +
            (error.detail ? ` (${error.detail})` : ""),
        );
        return new Response(
          JSON.stringify({
            success: false,
            code: "PROVIDER_OUTPUT_INVALID",
            error: error.message,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.error("[refine-story] Error:", error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error
            ? error.message
            : "Error refinando cuento",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  };
}
