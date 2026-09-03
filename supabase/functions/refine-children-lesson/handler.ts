/**
 * CASA Children's Lesson Refinement Edge Function
 * Refina lecciones infantiles existentes basándose en feedback del usuario
 * Usa Claude Opus 4.5 para mejorar aspectos específicos sin regenerar todo
 *
 * Patrón: supabase/functions/refine-story/handler.ts
 *
 * Request handler extracted from `index.ts` so tests can import it without
 * starting a server, reading the environment, or hitting the network.
 *
 * Auth: OPTIONS is answered before the guard; every other method must pass
 * `requireLiturgyWriter` BEFORE the body is read or Anthropic is called.
 * Esquema de salida: mismo de generate-children-lesson + refinementNotes
 *
 * Bounded reads (Codex round 3): the request body AND the untrusted provider
 * reply are read through the STREAMING caps in `_shared/boundedBody.ts`. The
 * cap IS the read — it cancels the stream at the chunk that crosses it, so
 * nothing past that chunk is pulled, decoded or parsed, and neither an
 * oversized upload nor a provider reply that never ends can be materialised
 * first and judged after. A failed provider response is not read at all: its
 * body is cancelled and only the HTTP status is kept.
 *
 * Value suppression (Codex round 3): the user's feedback, the current lesson,
 * the age group, the refinement type, the prompts, the provider body, the
 * model's output and the refined lesson are all request/application content and
 * never reach a log. Logs carry FIXED event text plus, at most, the provider's
 * HTTP status. Failures answer with a fixed Spanish message and a stable `code`
 * from FAILURES; no caught `error.message`, stack, provider body or payload is
 * ever echoed to the browser.
 */


import { readBoundedJson } from '../_shared/boundedBody.ts';
import {
  requireLiturgyWriter,
  type RequirePermissionDeps,
} from '../_shared/liturgyAuth.ts';
import {
  buildSystemPrompt,
  buildUserPrompt,
  type CurrentLesson,
  type RefineRequest,
} from './prompt.ts';

export interface HandlerDeps {
  /** ANTHROPIC_API_KEY. Empty/absent => the handler reports a config error. */
  anthropicApiKey: string;
  /** Injectable authz backend for the shared fail-closed guard. */
  authzDeps: RequirePermissionDeps;
}
// Bare alias only. A date-suffixed ID silently 404s the day it retires —
// that is how claude-sonnet-4-20250514 took down process-reflexion-pdf.
const MODEL = 'claude-opus-5';

/**
 * Request cap. The largest legitimate payload is the current lesson (a few KiB),
 * the user's free-text feedback, the liturgy context and the church materials
 * snapshot; 64 KiB leaves generous headroom while still bounding an isolate's
 * memory. Enforced by the read, not after it.
 */
export const MAX_BODY_BYTES = 65_536;
/**
 * Provider cap. `max_tokens` is 8192, so a complete Anthropic reply is a few
 * tens of KiB; 1 MB is well over an order of magnitude of headroom and still a
 * bound on a provider that could otherwise stream forever.
 */
export const MAX_PROVIDER_RESPONSE_BYTES = 1_000_000;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * The complete set of failures this handler can report, each a FIXED status,
 * message and stable code. Nothing derived from the request, the feedback, the
 * prompts, the provider or a caught exception appears here — which is what
 * makes every error response value-suppressed by construction.
 */
export const FAILURES = {
  CONFIG_ERROR: { status: 500, error: 'El servicio de refinamiento no está configurado' },
  INVALID_REQUEST: { status: 400, error: 'Cuerpo de la solicitud inválido' },
  REQUEST_TOO_LARGE: { status: 413, error: 'Solicitud demasiado grande' },
  PROVIDER_UNAVAILABLE: { status: 502, error: 'No se pudo contactar al servicio de refinamiento' },
  PROVIDER_ERROR: { status: 502, error: 'El servicio de refinamiento no está disponible' },
  INVALID_PROVIDER_RESPONSE: {
    status: 502,
    error: 'El servicio de refinamiento no devolvió una lección válida',
  },
  LESSON_OUT_OF_RANGE: {
    status: 502,
    error: 'La lección refinada no respeta la duración esperada',
  },
  UNEXPECTED_ERROR: { status: 500, error: 'Error refinando lección' },
} as const;

export type FailureCode = keyof typeof FAILURES;

function fail(code: FailureCode): Response {
  const { status, error } = FAILURES[code];
  return new Response(JSON.stringify({ success: false, error, code }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface RefinedLesson extends CurrentLesson {
  refinementNotes: string;
}

function validateRefinedLesson(data: unknown): data is RefinedLesson {
  if (!data || typeof data !== 'object') return false;
  const lesson = data as Record<string, unknown>;

  if (typeof lesson.activityName !== 'string' || !lesson.activityName.trim()) return false;
  if (!Array.isArray(lesson.materials)) return false;
  if (lesson.materials.some((m) => typeof m !== 'string')) return false;

  if (!Array.isArray(lesson.sequence) || lesson.sequence.length !== 3) return false;
  const expectedPhases = ['movimiento', 'expresion_conversacion', 'reflexion_metaprendizaje'];
  for (let i = 0; i < 3; i++) {
    const phase = (lesson.sequence as unknown[])[i] as Record<string, unknown>;
    if (phase.phase !== expectedPhases[i]) return false;
    if (typeof phase.title !== 'string' || !phase.title.trim()) return false;
    if (typeof phase.description !== 'string' || !phase.description.trim()) return false;
    if (typeof phase.minutes !== 'number' || phase.minutes <= 0) return false;
  }

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

  if (!lesson.volunteerPlan || typeof lesson.volunteerPlan !== 'object') return false;
  const plan = lesson.volunteerPlan as Record<string, unknown>;
  if (typeof plan.leader !== 'string' || typeof plan.support !== 'string') return false;

  if (typeof lesson.estimatedTotalMinutes !== 'number' || lesson.estimatedTotalMinutes <= 0) {
    return false;
  }

  if (typeof lesson.refinementNotes !== 'string') return false;

  return true;
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const ANTHROPIC_API_KEY = deps.anthropicApiKey;

  return async function handler(req: Request): Promise<Response> {
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
      console.error('[refine-children-lesson] falta la configuración del proveedor');
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
    const requestData = body.value as RefineRequest;
    const { currentLesson, feedback, refinementType = 'general', ageGroupLabel } = requestData;

    if (!currentLesson || !feedback || !ageGroupLabel) {
      return fail('INVALID_REQUEST');
    }

    // Log hygiene: the feedback, the current lesson, the age group and the
    // refinement type are all request content and are never logged.
    console.log('[refine-children-lesson] solicitud autorizada');

    const systemPrompt = buildSystemPrompt(ageGroupLabel);
    const userPrompt = buildUserPrompt(requestData);

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
          // Opus 4.5 did no thinking unless asked; Opus 5 thinks by default.
          // max_tokens caps thinking + response together, so leaving it on
          // would eat the budget and truncate the JSON parsed below.
          thinking: { type: 'disabled' },
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
    } catch {
      // The transport error can name the endpoint and carry request detail; it
      // is neither logged nor returned.
      console.error('[refine-children-lesson] no se pudo contactar al proveedor');
      return fail('PROVIDER_UNAVAILABLE');
    }

    if (!response.ok) {
      // The provider's error body is NOT read: it can echo the prompt (and so
      // the member's feedback) back. Only the HTTP status is kept.
      console.error(`[refine-children-lesson] el proveedor respondió ${response.status}`);
      await response.body?.cancel().catch(() => {});
      return fail('PROVIDER_ERROR');
    }

    // The provider is untrusted: the reply is read under a streaming cap that
    // cuts the download at the crossing chunk. Over-limit, interrupted and
    // malformed replies collapse to one value-suppressed 502.
    const provider = await readBoundedJson(response, MAX_PROVIDER_RESPONSE_BYTES);
    if (!provider.ok) {
      console.error('[refine-children-lesson] respuesta del proveedor inválida');
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
      console.error('[refine-children-lesson] respuesta del proveedor inválida');
      return fail('INVALID_PROVIDER_RESPONSE');
    }
    // The model's raw output is never logged.
    let jsonText = textBlocks.map((b: { text: string }) => b.text).join('');

    let jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[refine-children-lesson] respuesta del proveedor inválida');
        return fail('INVALID_PROVIDER_RESPONSE');
      }
      jsonText = jsonMatch[0];
    }

    jsonText = jsonText
      // deno-lint-ignore no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .trim();

    let refinedLesson: RefinedLesson | null = null;
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
        const cleaned = jsonText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(cleaned);
      },
    ];

    for (const attempt of parseAttempts) {
      try {
        const parsed = attempt();
        if (validateRefinedLesson(parsed)) {
          refinedLesson = parsed;
          break;
        }
      } catch {
        // A SyntaxError quotes the offending provider output verbatim, so the
        // failure detail is dropped rather than logged. The next attempt runs.
        continue;
      }
    }

    if (!refinedLesson) {
      console.error('[refine-children-lesson] respuesta del proveedor inválida');
      return fail('INVALID_PROVIDER_RESPONSE');
    }

    // Duration coherence. The concrete minute values are application content
    // and stay out of both the log and the response.
    const sumMinutes = refinedLesson.sequence.reduce(
      (acc: number, p: { minutes?: number }) => acc + (typeof p.minutes === 'number' ? p.minutes : 0),
      0
    );
    if (sumMinutes !== refinedLesson.estimatedTotalMinutes) {
      console.error('[refine-children-lesson] la lección refinada no respeta la duración esperada');
      return fail('LESSON_OUT_OF_RANGE');
    }

    if (refinementType !== 'duration') {
      if (refinedLesson.estimatedTotalMinutes < 15 || refinedLesson.estimatedTotalMinutes > 45) {
        console.error('[refine-children-lesson] la lección refinada no respeta la duración esperada');
        return fail('LESSON_OUT_OF_RANGE');
      }
    }

    console.log('[refine-children-lesson] lección refinada');

    return new Response(
      JSON.stringify({
        success: true,
        activityName: refinedLesson.activityName,
        materials: refinedLesson.materials,
        sequence: refinedLesson.sequence,
        adaptations: refinedLesson.adaptations,
        volunteerPlan: refinedLesson.volunteerPlan,
        estimatedTotalMinutes: refinedLesson.estimatedTotalMinutes,
        refinementNotes: refinedLesson.refinementNotes,
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
  } catch {
    // The exception object is deliberately not bound: an Error here can carry
    // the prompt, the member's feedback, the provider URL or the request
    // payload in its message and stack, and binding it is how those reach a
    // log or a response.
    console.error('[refine-children-lesson] error inesperado');
    return fail('UNEXPECTED_ERROR');
  }
  };
}
