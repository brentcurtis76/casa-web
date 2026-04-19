/**
 * CASA Children's Lesson Refinement Edge Function
 * Refina lecciones infantiles existentes basándose en feedback del usuario
 * Usa Claude Opus 4.5 para mejorar aspectos específicos sin regenerar todo
 *
 * Patrón: supabase/functions/refine-story/index.ts
 * Esquema de salida: mismo de generate-children-lesson + refinementNotes
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-opus-4-5-20251101';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type RefinementType =
  | 'general'
  | 'materials'
  | 'duration'
  | 'adaptations'
  | 'phases'
  | 'spiritual'
  | 'volunteer'
  | 'tone';

interface LessonPhase {
  phase: 'movimiento' | 'expresion_conversacion' | 'reflexion_metaprendizaje';
  title: string;
  description: string;
  minutes: number;
}

interface CurrentLesson {
  activityName: string;
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
  materials: string[];
  estimatedTotalMinutes: number;
}

interface RefinedLesson extends CurrentLesson {
  refinementNotes: string;
}

interface RefineRequest {
  currentLesson: CurrentLesson;
  feedback: string;
  refinementType?: RefinementType;
  liturgyContext?: {
    title?: string;
    summary?: string;
  };
  ageGroupLabel: string;
}

const REFINEMENT_INSTRUCTIONS: Record<RefinementType, string> = {
  general: `Refina la lección según el feedback del usuario. Mantén la estructura general (nombre, 3 fases, adaptaciones, voluntarios, materiales) pero mejora según lo indicado.`,
  materials: `Enfócate EXCLUSIVAMENTE en los materiales. Sustituye, agrega o elimina materiales según el feedback, PERO debes preservar la intención pedagógica de cada fase. No cambies las actividades ni su propósito — solo ajusta qué se usa para ejecutarlas.`,
  duration: `Ajusta la duración total y la distribución de minutos entre las 3 fases. Respeta el rango [15, 45] minutos a menos que el usuario pida explícitamente algo distinto. Asegúrate de que la suma de minutos de las 3 fases coincida con estimatedTotalMinutes.`,
  adaptations: `Enfócate en mejorar las adaptaciones por tamaño de grupo (small 2-5, medium 6-10, large 11-15, mixed edades mezcladas). Hazlas más concretas, prácticas y diferenciadas entre sí.`,
  phases: `Enfócate en mejorar el contenido de las 3 fases (movimiento, expresion_conversacion, reflexion_metaprendizaje). Puedes refinar títulos y descripciones, pero DEBES preservar exactamente los 3 phase keys en ese orden.`,
  spiritual: `Fortalece la conexión espiritual de la lección. Mejora la vinculación con el mensaje litúrgico y el cuentacuentos sin volverla moralista ni forzada.`,
  volunteer: `Mejora el plan de voluntarios (líder y apoyo). Hazlo más claro, con responsabilidades concretas y manejables.`,
  tone: `Ajusta el tono de la lección para que sea más alegre, más reflexiva, más aventurera o más tierna según lo que pida el usuario, manteniendo la apropiedad para la edad.`,
};

function buildSystemPrompt(ageGroupLabel: string): string {
  return `Eres un especialista en educación religiosa y pedagogía infantil para la comunidad anglicana progresista CASA.

Tu tarea es REFINAR una lección infantil existente basándote en el feedback del usuario.

## Reglas Importantes

1. PRESERVA la apropiedad para el grupo de edad: "${ageGroupLabel}". Todo vocabulario, duración, materiales y dinámicas deben seguir siendo adecuados para este grupo.
2. PRESERVA el contrato de 3 fases en este orden exacto: "movimiento", "expresion_conversacion", "reflexion_metaprendizaje". No agregues, elimines ni reordenes fases.
3. MANTÉN la duración total entre 15 y 45 minutos, a menos que el usuario explícitamente pida algo fuera de ese rango.
4. La suma de minutos de las 3 fases DEBE coincidir con "estimatedTotalMinutes".
5. Si el refinamiento es de tipo "materials", SOLO sustituye materiales — no cambies la intención pedagógica ni la descripción de las fases.
6. Haz mejoras incrementales; no reescribas la lección completa a menos que el feedback lo pida.
7. La lección debe seguir siendo divertida, educativa y espiritualmente significativa.

## Formato de Respuesta

Tu respuesta DEBE ser ÚNICAMENTE un objeto JSON válido con ESTA estructura exacta (sin texto antes o después):

{
  "activityName": "string",
  "materials": ["string", ...],
  "sequence": [
    { "phase": "movimiento", "title": "string", "description": "string", "minutes": number },
    { "phase": "expresion_conversacion", "title": "string", "description": "string", "minutes": number },
    { "phase": "reflexion_metaprendizaje", "title": "string", "description": "string", "minutes": number }
  ],
  "adaptations": {
    "small": "string",
    "medium": "string",
    "large": "string",
    "mixed": "string"
  },
  "volunteerPlan": {
    "leader": "string",
    "support": "string"
  },
  "estimatedTotalMinutes": number,
  "refinementNotes": "string - breve descripción de los cambios realizados"
}`;
}

function buildUserPrompt(request: RefineRequest): string {
  const {
    currentLesson,
    feedback,
    refinementType = 'general',
    liturgyContext,
    ageGroupLabel,
  } = request;

  const instructions =
    REFINEMENT_INSTRUCTIONS[refinementType] ?? REFINEMENT_INSTRUCTIONS.general;

  return `## Lección Actual a Refinar

\`\`\`json
${JSON.stringify(currentLesson, null, 2)}
\`\`\`

## Grupo de Edad
${ageGroupLabel}

## Contexto de la Liturgia
${
  liturgyContext
    ? `- Título: ${liturgyContext.title || 'No especificado'}
- Resumen: ${liturgyContext.summary || 'No especificado'}`
    : 'No disponible'
}

## Tipo de Refinamiento: ${refinementType}
${instructions}

## Feedback del Usuario
"${feedback}"

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`;
}

function validateRefinedLesson(data: unknown): data is RefinedLesson {
  if (!data || typeof data !== 'object') return false;
  const lesson = data as Record<string, unknown>;

  if (typeof lesson.activityName !== 'string' || !lesson.activityName.trim()) return false;
  if (!Array.isArray(lesson.materials) || lesson.materials.length === 0) return false;

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
        max_tokens: 4096,
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
