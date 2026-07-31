/**
 * Prompt construction for generate-children-lesson.
 *
 * Extracted verbatim from index.ts (which has a top-level serve() and is
 * therefore not importable from a test) so the prompt contract can be
 * golden-tested. The only behavioural addition is the optional
 * `availableMaterials` block (PLAN-MATERIALES M-D2/M-D4): absent or empty ⇒
 * byte-identical output to the pre-extraction prompt.
 */

import { sanitizeAvailableMaterials } from '../_shared/availableMaterials.ts';

export interface GenerateChildrenLessonRequest {
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
  /** Optional client-supplied correlation id for log joining across the EF and the orchestrator */
  requestId?: string;
  /** Canonical church inventory the activity must be designed with (PLAN-MATERIALES M-D2) */
  availableMaterials?: string[];
}

/**
 * Build the system prompt for children's lesson generation
 */
export function buildSystemPrompt(): string {
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
 * Normative "Materiales Disponibles" block (PLAN-MATERIALES M-D4).
 *
 * Returns '' when the canonical list is empty, so the surrounding template
 * collapses back to the blank line the base prompt had between the
 * "Rango de Niños" line and the following separator.
 */
function buildMaterialsBlock(availableMaterials: unknown): string {
  const items = sanitizeAvailableMaterials(availableMaterials);
  if (items.length === 0) return '';

  return `
**Materiales Disponibles (inventario de la iglesia):**
${items.map((item) => `- ${item}`).join('\n')}

**Restricción de Materiales:**
- Diseña la actividad usando ÚNICAMENTE materiales de la lista anterior.
- NO propongas comprar, conseguir ni pedir materiales que no estén en la lista.
- No es necesario usar todos los materiales; elige solo los que aporten a la actividad.
- Las fases sin materiales (movimiento, canto, conversación) son bienvenidas y válidas.
- En el campo "materials" incluye únicamente elementos de la lista anterior.
`;
}

/**
 * Build the user prompt with liturgy and story context
 */
export function buildUserPrompt(request: GenerateChildrenLessonRequest): string {
  const {
    liturgyTitle,
    liturgySummary,
    bibleText,
    storyData,
    ageGroupLabel,
    durationMax = 30,
    childrenCountMin = 2,
    childrenCountMax = 15,
    availableMaterials,
  } = request;

  const materialsBlock = buildMaterialsBlock(availableMaterials);

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
${materialsBlock}
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
