/**
 * Prompt construction for refine-children-lesson.
 *
 * Extracted verbatim from index.ts (which has a top-level serve() and is
 * therefore not importable from a test) so the prompt contract can be
 * golden-tested. The only behavioural addition is the optional
 * `availableMaterials` section (PLAN-MATERIALES M-D2/M-D4), applied for EVERY
 * refinementType: absent or empty ⇒ byte-identical output to the
 * pre-extraction prompt.
 */

import { sanitizeAvailableMaterials } from '../_shared/availableMaterials.ts';

export type RefinementType =
  | 'general'
  | 'materials'
  | 'duration'
  | 'adaptations'
  | 'phases'
  | 'spiritual'
  | 'volunteer'
  | 'tone';

export interface LessonPhase {
  phase: 'movimiento' | 'expresion_conversacion' | 'reflexion_metaprendizaje';
  title: string;
  description: string;
  minutes: number;
}

export interface CurrentLesson {
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

export interface RefineRequest {
  currentLesson: CurrentLesson;
  feedback: string;
  refinementType?: RefinementType;
  liturgyContext?: {
    title?: string;
    summary?: string;
  };
  ageGroupLabel: string;
  /** Canonical church inventory snapshot the refinement must stay inside (PLAN-MATERIALES M-D2/M-D3) */
  availableMaterials?: string[];
}

export const REFINEMENT_INSTRUCTIONS: Record<RefinementType, string> = {
  general: `Refina la lección según el feedback del usuario. Mantén la estructura general (nombre, 3 fases, adaptaciones, voluntarios, materiales) pero mejora según lo indicado.`,
  materials: `Enfócate EXCLUSIVAMENTE en los materiales. Sustituye, agrega o elimina materiales según el feedback, PERO debes preservar la intención pedagógica de cada fase. No cambies las actividades ni su propósito — solo ajusta qué se usa para ejecutarlas.`,
  duration: `Ajusta la duración total y la distribución de minutos entre las 3 fases. Respeta el rango [15, 45] minutos a menos que el usuario pida explícitamente algo distinto. Asegúrate de que la suma de minutos de las 3 fases coincida con estimatedTotalMinutes.`,
  adaptations: `Enfócate en mejorar las adaptaciones por tamaño de grupo (small 2-5, medium 6-10, large 11-15, mixed edades mezcladas). Hazlas más concretas, prácticas y diferenciadas entre sí.`,
  phases: `Enfócate en mejorar el contenido de las 3 fases (movimiento, expresion_conversacion, reflexion_metaprendizaje). Puedes refinar títulos y descripciones, pero DEBES preservar exactamente los 3 phase keys en ese orden.`,
  spiritual: `Fortalece la conexión espiritual de la lección. Mejora la vinculación con el mensaje litúrgico y el cuentacuentos sin volverla moralista ni forzada.`,
  volunteer: `Mejora el plan de voluntarios (líder y apoyo). Hazlo más claro, con responsabilidades concretas y manejables.`,
  tone: `Ajusta el tono de la lección para que sea más alegre, más reflexiva, más aventurera o más tierna según lo que pida el usuario, manteniendo la apropiedad para la edad.`,
};

export function buildSystemPrompt(ageGroupLabel: string): string {
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
8. La lista "materials" puede estar vacía si la actividad no requiere materiales (por ejemplo, una actividad de movimiento o canto). Incluye materiales solo si son realmente necesarios.

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

/**
 * Normative "Materiales Disponibles" section (PLAN-MATERIALES M-D4), applied for
 * EVERY refinementType.
 *
 * Returns '' when the canonical list is empty, so the surrounding template
 * collapses back to the blank line the base prompt had between the refinement
 * instructions and the user feedback heading.
 */
function buildMaterialsSection(availableMaterials: unknown): string {
  const items = sanitizeAvailableMaterials(availableMaterials);
  if (items.length === 0) return '';

  return `
## Materiales Disponibles
La iglesia dispone únicamente de estos materiales:
${items.map((item) => `- ${item}`).join('\n')}

Cualquier material que agregues o sustituyas DEBE provenir de esta lista. No propongas
materiales fuera de la lista. Las actividades o fases sin materiales están permitidas.
`;
}

export function buildUserPrompt(request: RefineRequest): string {
  const {
    currentLesson,
    feedback,
    refinementType = 'general',
    liturgyContext,
    ageGroupLabel,
    availableMaterials,
  } = request;

  const instructions =
    REFINEMENT_INSTRUCTIONS[refinementType] ?? REFINEMENT_INSTRUCTIONS.general;

  const materialsSection = buildMaterialsSection(availableMaterials);

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
${materialsSection}
## Feedback del Usuario
"${feedback}"

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`;
}
