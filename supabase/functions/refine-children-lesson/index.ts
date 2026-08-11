/**
 * CASA Children's Lesson Refinement Edge Function
 * Refina lecciones infantiles existentes basándose en feedback del usuario
 * Usa Claude Opus 4.5 para mejorar aspectos específicos sin regenerar todo
 *
 * Patrón: supabase/functions/refine-story/index.ts
 * Esquema de salida: mismo de generate-children-lesson + refinementNotes
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

import {
  buildSystemPrompt,
  buildUserPrompt,
  type CurrentLesson,
  type RefineRequest,
} from './prompt.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
// Bare alias only. A date-suffixed ID silently 404s the day it retires —
// that is how claude-sonnet-4-20250514 took down process-reflexion-pdf.
const MODEL = 'claude-opus-5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY no está configurada');
    }

    const requestData = (await req.json()) as RefineRequest;
    const { currentLesson, feedback, refinementType = 'general', ageGroupLabel } = requestData;

    if (!currentLesson || !feedback) {
      throw new Error('Se requiere currentLesson y feedback');
    }
    if (!ageGroupLabel) {
      throw new Error('Se requiere ageGroupLabel');
    }

    console.log(
      `[refine-children-lesson] Refinando lección: "${currentLesson.activityName}" (${ageGroupLabel})`
    );
    console.log(`[refine-children-lesson] Tipo de refinamiento: ${refinementType}`);
    console.log(`[refine-children-lesson] Feedback: ${feedback.slice(0, 200)}...`);

    const systemPrompt = buildSystemPrompt(ageGroupLabel);
    const userPrompt = buildUserPrompt(requestData);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[refine-children-lesson] Error de API:', response.status, errorText);
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
    let jsonText = textBlocks.map((b) => b.text).join('');
    console.log('[refine-children-lesson] Respuesta cruda (primeros 500 chars):', jsonText.slice(0, 500));

    let jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON válido en la respuesta');
      }
      jsonText = jsonMatch[0];
    }

    jsonText = jsonText
      // eslint-disable-next-line no-control-regex -- Model output must be stripped of JSON-invalid control bytes.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
      .trim();

    let refinedLesson: RefinedLesson | null = null;
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
        const cleaned = jsonText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        return JSON.parse(cleaned);
      },
    ];

    for (let i = 0; i < parseAttempts.length; i++) {
      try {
        const parsed = parseAttempts[i]();
        if (validateRefinedLesson(parsed)) {
          refinedLesson = parsed;
          console.log(`[refine-children-lesson] Parseado exitoso en intento ${i + 1}`);
          break;
        }
      } catch (err) {
        console.log(
          `[refine-children-lesson] Intento ${i + 1} falló:`,
          err instanceof Error ? err.message : 'Error'
        );
        if (i === parseAttempts.length - 1) {
          throw new Error('Error parseando la respuesta de Claude - JSON inválido');
        }
      }
    }

    if (!refinedLesson) {
      throw new Error('La respuesta no tiene la estructura esperada');
    }

    const sumMinutes = refinedLesson.sequence.reduce(
      (acc: number, p: { minutes?: number }) => acc + (typeof p.minutes === 'number' ? p.minutes : 0),
      0
    );
    if (sumMinutes !== refinedLesson.estimatedTotalMinutes) {
      throw new Error(
        `Suma de minutos por fase (${sumMinutes}) no coincide con estimatedTotalMinutes (${refinedLesson.estimatedTotalMinutes})`
      );
    }

    if (refinementType !== 'duration') {
      if (refinedLesson.estimatedTotalMinutes < 15 || refinedLesson.estimatedTotalMinutes > 45) {
        throw new Error(
          `estimatedTotalMinutes (${refinedLesson.estimatedTotalMinutes}) fuera del rango válido [15, 45]`
        );
      }
    }

    console.log(
      `[refine-children-lesson] Lección refinada exitosamente: ${refinedLesson.activityName}`
    );
    console.log(
      `[refine-children-lesson] Cambios: ${refinedLesson.refinementNotes || 'No especificados'}`
    );

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
  } catch (error) {
    console.error('[refine-children-lesson] Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Error refinando lección',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
