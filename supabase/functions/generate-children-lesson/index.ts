/**
 * Generate Children's Lesson Edge Function
 * Genera actividades para niños basadas en el cuentacuentos de la liturgia
 * usando Claude Sonnet 4.5
 *
 * Patrón: supabase/functions/generate-story/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

import {
  buildSystemPrompt,
  buildUserPrompt,
  type GenerateChildrenLessonRequest,
} from './prompt.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
// claude-sonnet-4-6 is the current confirmed-valid Sonnet model (2026-03).
// The prior ID 'claude-sonnet-4-5-20250929' used a date-suffix variant that is no longer valid.
const MODEL = 'claude-sonnet-4-6';

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no está configurada');
    }

    const requestData = (await req.json()) as GenerateChildrenLessonRequest;

    // Validate required fields
    if (!requestData.liturgyId || !requestData.storyData) {
      throw new Error('Se requiere liturgyId y storyData');
    }

    const reqIdTag = requestData.requestId ? ` [req=${requestData.requestId}]` : '';
    console.log(
      `[generate-children-lesson]${reqIdTag} Generando lección para: "${requestData.ageGroupLabel}" en "${requestData.liturgyTitle}"`
    );

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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-children-lesson] Claude API error:', response.status, errorText);
      throw new Error(`Error de Claude API: ${response.status}`);
    }

    const data = await response.json();

    const textBlocks = Array.isArray(data?.content)
      ? data.content.filter((b: unknown): b is { type: 'text'; text: string } =>
          typeof b === 'object' && b !== null &&
          (b as { type?: unknown }).type === 'text' &&
          typeof (b as { text?: unknown }).text === 'string'
        )
      : [];
    if (textBlocks.length === 0) {
      throw new Error('La API no retornó contenido de texto');
    }
    // Extract and parse JSON
    let jsonText = textBlocks.map((b) => b.text).join('');
    console.log('[generate-children-lesson] Response (first 500 chars):', jsonText.slice(0, 500));

    // Try to find JSON in the response
    let jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Look for JSON object directly
      jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[generate-children-lesson] No JSON found:', jsonText);
        throw new Error('No se encontró JSON válido en la respuesta');
      }
      jsonText = jsonMatch[0];
    }

    // Clean up
    jsonText = jsonText
      // eslint-disable-next-line no-control-regex -- Model output must be stripped of JSON-invalid control bytes.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .trim();

    // Parse JSON with multiple attempts
    let lesson: GeneratedLesson | null = null;
    const parseAttempts = [
      () => JSON.parse(jsonText),
      () => {
        const cleaned = jsonText.replace(/("(?:[^"\\]|\\.)*")|[\n\r\t]/g, (match, group) => {
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

    for (let i = 0; i < parseAttempts.length; i++) {
      try {
        const parsed = parseAttempts[i]();
        if (validateLesson(parsed)) {
          lesson = parsed;
          console.log(`[generate-children-lesson] Parseado exitoso en intento ${i + 1}`);
          break;
        }
      } catch (err) {
        console.log(
          `[generate-children-lesson] Intento ${i + 1} falló:`,
          err instanceof Error ? err.message : 'Error'
        );
        if (i === parseAttempts.length - 1) {
          throw new Error('Error parseando la respuesta de Claude - JSON inválido');
        }
      }
    }

    if (!lesson) {
      throw new Error('La respuesta no tiene la estructura esperada');
    }

    // Validate total minutes
    if (lesson.estimatedTotalMinutes > (requestData.durationMax || 30)) {
      throw new Error(
        `Tiempo total (${lesson.estimatedTotalMinutes}min) excede máximo (${requestData.durationMax}min)`
      );
    }

    console.log(
      `[generate-children-lesson]${reqIdTag} Lección generada exitosamente:`,
      lesson.activityName,
    );

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
  } catch (error) {
    console.error('[generate-children-lesson] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error generando actividad',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
