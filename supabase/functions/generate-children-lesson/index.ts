/**
 * Generate Children's Lesson Edge Function
 * Genera actividades para niños basadas en el cuentacuentos de la liturgia
 * usando Claude Sonnet 4.5
 *
 * Patrón: supabase/functions/generate-story/index.ts
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-sonnet-4-5-20250929';

interface GenerateChildrenLessonRequest {
  liturgyId: string;
  liturgyTitle: string;
  liturgySummary: string;
  bibleText: string;
  storyData: {
    title: string;
    summary: string;
    spiritualConnection: string;
    scenes: Array<{ text: string }>;
  };
  ageGroup: 'nursery' | 'preschool' | 'elementary' | 'mixed';
  ageGroupLabel: string;
  durationMax?: number;
  childrenCountMin?: number;
  childrenCountMax?: number;
  previewPromptOnly?: boolean;
}

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
  if (!Array.isArray(lesson.materials) || lesson.materials.length === 0) return false;

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

/**
 * Build the system prompt for children's lesson generation
 */
function buildSystemPrompt(): string {
  return `Eres un especialista en educación religiosa y pedagogía infantil para la comunidad anglicana progresista CASA.

Tu tarea es crear actividades educativas para niños pequeños basadas en un cuentacuentos litúrgico.

## Estructura de la Actividad

Las actividades deben seguir EXACTAMENTE esta estructura de 3 fases:

1. **FASE 1: Movimiento** (5-10 minutos)
   - Actividad física o lúdica que engage a los niños
   - Conecta con el tema del cuento
   - Calienta el grupo y prepara para la reflexión

2. **FASE 2: Expresión y Conversación** (5-10 minutos)
   - Expresión creativa (dibujo, dramatización, modelado, etc.)
   - Conversación guiada sobre el cuento
   - Los niños comparten sus impresiones y conexiones

3. **FASE 3: Reflexión y Meta-aprendizaje** (5-10 minutos)
   - Reflexión individual o grupal
   - Conexión con el mensaje espiritual
   - Cierre significativo

## Duración Total
- Máximo 30 minutos (por defecto)
- Las 3 fases deben sumar exactamente el tiempo estimado

## Grupo de Niños
- Rango: 2-15 niños
- Adaptaciones para grupos pequeños (2-5), medianos (6-10), grandes (11-15) y mixto (todas las edades)

## Equipo de Voluntarios
- Líder: descripción del rol y responsabilidades
- Apoyo: descripción del rol de apoyo

## Respuesta JSON

Tu respuesta DEBE ser ÚNICAMENTE un objeto JSON válido, sin texto antes o después. Usa esta estructura:

{
  "activityName": "string - Nombre corto de la actividad",
  "materials": ["lista", "de", "materiales", "necesarios"],
  "sequence": [
    {
      "phase": "movimiento",
      "title": "string",
      "description": "string",
      "minutes": number
    },
    {
      "phase": "expresion_conversacion",
      "title": "string",
      "description": "string",
      "minutes": number
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "string",
      "description": "string",
      "minutes": number
    }
  ],
  "adaptations": {
    "small": "Cómo adaptar para 2-5 niños",
    "medium": "Cómo adaptar para 6-10 niños",
    "large": "Cómo adaptar para 11-15 niños",
    "mixed": "Cómo adaptar para todas las edades juntas"
  },
  "volunteerPlan": {
    "leader": "Descripción del rol del líder",
    "support": "Descripción del rol de apoyo"
  },
  "estimatedTotalMinutes": number
}`;
}

/**
 * Build the user prompt with liturgy and story context
 */
function buildUserPrompt(request: GenerateChildrenLessonRequest): string {
  const {
    liturgyTitle,
    liturgySummary,
    bibleText,
    storyData,
    ageGroupLabel,
    durationMax = 30,
    childrenCountMin = 2,
    childrenCountMax = 15,
  } = request;

  return `## Contexto Litúrgico

### Título de la Liturgia
${liturgyTitle}

### Resumen del Mensaje
${liturgySummary}

### Texto Bíblico
${bibleText}

### Cuentacuentos
**Título:** ${storyData.title}
**Resumen:** ${storyData.summary}
**Conexión Espiritual:** ${storyData.spiritualConnection}

**Escenas del Cuento:**
${storyData.scenes.map((s, i) => `${i + 1}. ${s.text}`).join('\n')}

---

## Parámetros de la Actividad

**Grupo de Edad:** ${ageGroupLabel}
**Duración Máxima:** ${durationMax} minutos
**Rango de Niños:** ${childrenCountMin}-${childrenCountMax}

---

Por favor, crea una actividad educativa estructurada en 3 fases que:
- Esté basada en el cuentacuentos y mensaje litúrgico anterior
- Sea apropiada para el grupo de edad "${ageGroupLabel}"
- Tenga exactamente 3 fases (movimiento, expresión/conversación, reflexión)
- No exceda ${durationMax} minutos en total
- Incluya adaptaciones para diferentes tamaños de grupo
- Especifique claramente los roles del líder y apoyo
- Liste todos los materiales necesarios
- Sea divertida, educativa y espiritualmente significativa`;
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

    console.log(
      `[generate-children-lesson] Generando lección para: "${requestData.ageGroupLabel}" en "${requestData.liturgyTitle}"`
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
        max_tokens: 2048,
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

    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('La API no retornó contenido');
    }

    // Extract and parse JSON
    let jsonText = data.content[0].text;
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

    console.log('[generate-children-lesson] Lección generada exitosamente:', lesson.activityName);

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
