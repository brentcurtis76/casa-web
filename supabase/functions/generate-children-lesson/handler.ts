/**
 * Generate Children's Lesson Edge Function
 * Genera actividades para niños basadas en el cuentacuentos de la liturgia
 * usando Claude Sonnet 4.5
 *
 * Patrón: supabase/functions/generate-story/handler.ts
 *
 * Request handler extracted from `index.ts` so tests can import it without
 * starting a server, reading the environment, or hitting the network.
 *
 * Auth: OPTIONS is answered before the guard; every other method must pass
 * `requireLiturgyWriter` BEFORE the body is read or Anthropic is called.
 *
 * Bounded reads (Codex round 3): the request body AND the untrusted provider
 * reply are read through the STREAMING caps in `_shared/boundedBody.ts`. The
 * cap IS the read — it cancels the stream at the chunk that crosses it, so
 * nothing past that chunk is pulled, decoded or parsed, and neither an
 * oversized upload nor a provider reply that never ends can be materialised
 * first and judged after. A failed provider response is not read at all: its
 * body is cancelled and only the HTTP status is kept.
 *
 * Value suppression (Codex round 3): logs carry FIXED event text plus, at most,
 * the provider's HTTP status — never the request, the member/application
 * content, the prompts, the provider body, the model's output, the parsed
 * lesson, or an exception. Failures answer with a fixed Spanish message and a
 * stable `code` from FAILURES; no caught `error.message`, stack, provider body
 * or payload is ever echoed to the browser.
 */


import { readBoundedJson } from '../_shared/boundedBody.ts';
import {
  requireLiturgyWriter,
  type RequirePermissionDeps,
} from '../_shared/liturgyAuth.ts';
import {
  buildSystemPrompt,
  buildUserPrompt,
  type GenerateChildrenLessonRequest,
} from './prompt.ts';

export interface HandlerDeps {
  /** ANTHROPIC_API_KEY. Empty/absent => the handler reports a config error. */
  anthropicApiKey: string;
  /** Injectable authz backend for the shared fail-closed guard. */
  authzDeps: RequirePermissionDeps;
}
// claude-sonnet-4-6 is the current confirmed-valid Sonnet model (2026-03).
// The prior ID 'claude-sonnet-4-5-20250929' used a date-suffix variant that is no longer valid.
const MODEL = 'claude-sonnet-4-6';

/**
 * Request cap. The largest legitimate payload is the liturgy summary + Bible
 * text + the storyteller scenes + the church materials inventory; the biggest
 * ones observed are a few tens of KiB, so 64 KiB leaves generous headroom while
 * still bounding an isolate's memory. Enforced by the read, not after it.
 */
export const MAX_BODY_BYTES = 65_536;
/**
 * Provider cap. `max_tokens` is 4096, so a complete Anthropic reply is a few
 * tens of KiB; 1 MB is ~30× the largest legitimate answer and still a bound.
 */
export const MAX_PROVIDER_RESPONSE_BYTES = 1_000_000;

interface LessonPhase {
  phase: 'movimiento' | 'expresion_conversacion' | 'reflexion_metaprendizaje';
  title: string;
  description: string;
  minutes: number;
}

interface GeneratedLesson {
  activityName: string;
  materials: string[];
  sequence: [LessonPhase, LessonPhase, LessonPhase];
  adaptations: {
    small: string;
    medium: string;
    large: string;
    mixed: string;
  };
  volunteerPlan: {
    leader: string;
    support: string;
  };
  estimatedTotalMinutes: number;
}

/**
 * Validate the structure of the generated lesson JSON
 */
function validateLesson(data: unknown): data is GeneratedLesson {
  if (!data || typeof data !== 'object') return false;

  const lesson = data as Record<string, unknown>;

  // Validate required fields
  if (typeof lesson.activityName !== 'string' || !lesson.activityName.trim()) return false;
  if (!Array.isArray(lesson.materials)) return false;
  if (lesson.materials.some((m) => typeof m !== 'string')) return false;

  // Validate sequence array (must be exactly 3 phases)
  if (!Array.isArray(lesson.sequence) || lesson.sequence.length !== 3) return false;

  // Validate each phase
  const phases = ['movimiento', 'expresion_conversacion', 'reflexion_metaprendizaje'];
  for (let i = 0; i < lesson.sequence.length; i++) {
    const phase = (lesson.sequence as unknown[])[i] as Record<string, unknown>;
    if (typeof phase.phase !== 'string' || !phases.includes(phase.phase)) return false;
    if (typeof phase.title !== 'string' || !phase.title.trim()) return false;
    if (typeof phase.description !== 'string' || !phase.description.trim()) return false;
    if (typeof phase.minutes !== 'number' || phase.minutes <= 0) return false;
  }

  // Validate adaptations
  if (!lesson.adaptations || typeof lesson.adaptations !== 'object') return false;
  const adaptations = lesson.adaptations as Record<string, unknown>;
  if (
    typeof adaptations.small !== 'string' ||
    typeof adaptations.medium !== 'string' ||
    typeof adaptations.large !== 'string' ||
    typeof adaptations.mixed !== 'string'
  ) {
    return false;
  }

  // Validate volunteer plan
  if (!lesson.volunteerPlan || typeof lesson.volunteerPlan !== 'object') return false;
  const plan = lesson.volunteerPlan as Record<string, unknown>;
  if (typeof plan.leader !== 'string' || typeof plan.support !== 'string') return false;

  // Validate estimated total minutes
  if (typeof lesson.estimatedTotalMinutes !== 'number' || lesson.estimatedTotalMinutes <= 0) {
    return false;
  }

  return true;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * The complete set of failures this handler can report, each a FIXED status,
 * message and stable code. Nothing derived from the request, the prompts, the
 * provider or a caught exception appears here — which is what makes every
 * error response value-suppressed by construction rather than by review.
 */
export const FAILURES = {
  CONFIG_ERROR: { status: 500, error: 'El servicio de actividades no está configurado' },
  INVALID_REQUEST: { status: 400, error: 'Cuerpo de la solicitud inválido' },
  REQUEST_TOO_LARGE: { status: 413, error: 'Solicitud demasiado grande' },
  PROVIDER_UNAVAILABLE: { status: 502, error: 'No se pudo contactar al servicio de generación' },
  PROVIDER_ERROR: { status: 502, error: 'El servicio de generación no está disponible' },
  INVALID_PROVIDER_RESPONSE: {
    status: 502,
    error: 'El servicio de generación no devolvió una actividad válida',
  },
  LESSON_TOO_LONG: { status: 502, error: 'La actividad generada excede la duración solicitada' },
  UNEXPECTED_ERROR: { status: 500, error: 'Error generando actividad' },
} as const;

export type FailureCode = keyof typeof FAILURES;

function fail(code: FailureCode): Response {
  const { status, error } = FAILURES[code];
  return new Response(JSON.stringify({ success: false, error, code }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const ANTHROPIC_API_KEY = deps.anthropicApiKey;

  return async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Fail-closed authz (liturgy_builder / write, the Constructor de Liturgias
  // permission that gates the children's-activity workflow in the browser):
  // runs BEFORE the body is read and before Anthropic. A request carrying only
  // the project's publishable key is refused here with 401.
  const authz = await requireLiturgyWriter(req, deps.authzDeps, corsHeaders);
  if (!authz.ok) {
    return authz.response;
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      console.error('[generate-children-lesson] falta la configuración del proveedor');
      return fail('CONFIG_ERROR');
    }

    // Bounded, streamed request read: MAX_BODY_BYTES is enforced BY the read,
    // so an oversized or headerless upload cannot buy isolate memory or
    // provider work by arriving in chunks.
    const body = await readBoundedJson(req, MAX_BODY_BYTES);
    if (!body.ok) {
      return body.reason === 'too_large' ? fail('REQUEST_TOO_LARGE') : fail('INVALID_REQUEST');
    }
    if (!body.value || typeof body.value !== 'object' || Array.isArray(body.value)) {
      return fail('INVALID_REQUEST');
    }
    const requestData = body.value as GenerateChildrenLessonRequest;

    // Validate required fields
    if (!requestData.liturgyId || !requestData.storyData) {
      return fail('INVALID_REQUEST');
    }

    // Log hygiene: the request id, the age group and the liturgy title are all
    // request content and are never logged.
    console.log('[generate-children-lesson] solicitud autorizada');

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(requestData);

    // If only preview mode, return prompts without calling Claude
    if (requestData.previewPromptOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          promptPreview: {
            systemPrompt,
            userPrompt,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Call Claude API
    let response: Response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        }),
      });
    } catch {
      // The transport error can name the endpoint and carry request detail; it
      // is neither logged nor returned.
      console.error('[generate-children-lesson] no se pudo contactar al proveedor');
      return fail('PROVIDER_UNAVAILABLE');
    }

    if (!response.ok) {
      // The provider's error body is NOT read: it can echo the prompt back.
      // Only the HTTP status — bounded, non-sensitive metadata — is kept.
      console.error(`[generate-children-lesson] el proveedor respondió ${response.status}`);
      await response.body?.cancel().catch(() => {});
      return fail('PROVIDER_ERROR');
    }

    // The provider is untrusted: the reply is read under a streaming cap that
    // cuts the download at the crossing chunk. Over-limit, interrupted and
    // malformed replies collapse to one value-suppressed 502.
    const provider = await readBoundedJson(response, MAX_PROVIDER_RESPONSE_BYTES);
    if (!provider.ok) {
      console.error('[generate-children-lesson] respuesta del proveedor inválida');
      return fail('INVALID_PROVIDER_RESPONSE');
    }
    const data = provider.value as {
      content?: unknown;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const textBlocks = Array.isArray(data?.content)
      ? data.content.filter((b: unknown): b is { type: 'text'; text: string } =>
          typeof b === 'object' && b !== null &&
          (b as { type?: unknown }).type === 'text' &&
          typeof (b as { text?: unknown }).text === 'string'
        )
      : [];
    if (textBlocks.length === 0) {
      console.error('[generate-children-lesson] respuesta del proveedor inválida');
      return fail('INVALID_PROVIDER_RESPONSE');
    }
    // Extract and parse JSON. The model's raw output is never logged.
    let jsonText = textBlocks.map((b: { text: string }) => b.text).join('');

    // Try to find JSON in the response
    let jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Look for JSON object directly
      jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[generate-children-lesson] respuesta del proveedor inválida');
        return fail('INVALID_PROVIDER_RESPONSE');
      }
      jsonText = jsonMatch[0];
    }

    // Clean up
    jsonText = jsonText
      // deno-lint-ignore no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .trim();

    // Parse JSON with multiple attempts
    let lesson: GeneratedLesson | null = null;
    const parseAttempts = [
      () => JSON.parse(jsonText),
      () => {
        const cleaned = jsonText.replace(/("(?:[^"\\]|\\.)*")|[\n\r\t]/g, (_match: string, group: string | undefined) => {
          if (group) return group;
          return ' ';
        });
        return JSON.parse(cleaned);
      },
      () => {
        const cleaned = jsonText
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        return JSON.parse(cleaned);
      },
    ];

    for (const attempt of parseAttempts) {
      try {
        const parsed = attempt();
        if (validateLesson(parsed)) {
          lesson = parsed;
          break;
        }
      } catch {
        // A SyntaxError quotes the offending provider output verbatim, so the
        // failure detail is dropped rather than logged. The next attempt runs.
        continue;
      }
    }

    if (!lesson) {
      console.error('[generate-children-lesson] respuesta del proveedor inválida');
      return fail('INVALID_PROVIDER_RESPONSE');
    }

    // Validate total minutes. The generated and requested durations are
    // application content and stay out of both the log and the response.
    if (lesson.estimatedTotalMinutes > (requestData.durationMax || 30)) {
      console.error('[generate-children-lesson] la actividad excede la duración solicitada');
      return fail('LESSON_TOO_LONG');
    }

    console.log('[generate-children-lesson] actividad generada');

    return new Response(
      JSON.stringify({
        success: true,
        activityName: lesson.activityName,
        materials: lesson.materials,
        sequence: lesson.sequence,
        adaptations: lesson.adaptations,
        volunteerPlan: lesson.volunteerPlan,
        estimatedTotalMinutes: lesson.estimatedTotalMinutes,
        model: MODEL,
        requestId: requestData.requestId ?? null,
        usage: {
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch {
    // The exception object is deliberately not bound: an Error here can carry
    // the prompt, the provider URL or the request payload in its message and
    // stack, and binding it is how those reach a log or a response.
    console.error('[generate-children-lesson] error inesperado');
    return fail('UNEXPECTED_ERROR');
  }
  };
}
