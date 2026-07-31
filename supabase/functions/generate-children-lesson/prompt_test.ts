// Prompt-contract suite for generate-children-lesson.
//
// The goldens below are CAPTURED, never retyped: they are the literal output of
// the base builder as it exists at main@d79d329, produced by running that base
// source and spliced into this file mechanically (see the round report). The
// contract they lock is PLAN-MATERIALES M-D2 — with `availableMaterials` absent
// AND with it set to `[]`, the prompt must be byte-identical to base, so any
// front-end / edge-function deploy order interoperates.

import { assertEquals, assertNotEquals, assertStringIncludes } from "@std/assert";

import {
  buildSystemPrompt,
  buildUserPrompt,
  type GenerateChildrenLessonRequest,
} from "./prompt.ts";

export const GENERATE_REQUEST_FIXTURE: GenerateChildrenLessonRequest = {
  liturgyId: "lit-0001",
  liturgyTitle: "Domingo de la Semilla",
  liturgySummary: "Dios hace crecer lo pequeño.",
  bibleText: "Marcos 4:30-32",
  storyData: {
    title: "La semilla escondida",
    summary: "Una semilla diminuta se vuelve un árbol grande.",
    spiritualConnection: "Lo pequeño importa en el Reino.",
    scenes: [
      { text: "Una niña guarda una semilla en su bolsillo." },
      { text: "La semilla brota en el jardín de la iglesia." },
    ],
  },
  ageGroup: "elementary",
  ageGroupLabel: "Escolares (6-9 años)",
  durationMax: 25,
  childrenCountMin: 3,
  childrenCountMax: 12,
};

// Captured from main@d79d329 — do not edit by hand.
export const GENERATE_SYSTEM_GOLDEN_BASE = `Eres un especialista en educación religiosa y pedagogía infantil para la comunidad anglicana progresista CASA.

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

// Captured from main@d79d329 for GENERATE_REQUEST_FIXTURE — do not edit by hand.
export const GENERATE_USER_GOLDEN_BASE = `## Contexto Litúrgico

### Título de la Liturgia
Domingo de la Semilla

### Resumen del Mensaje
Dios hace crecer lo pequeño.

### Texto Bíblico
Marcos 4:30-32

### Cuentacuentos
**Título:** La semilla escondida
**Resumen:** Una semilla diminuta se vuelve un árbol grande.
**Conexión Espiritual:** Lo pequeño importa en el Reino.

**Escenas del Cuento:**
1. Una niña guarda una semilla en su bolsillo.
2. La semilla brota en el jardín de la iglesia.

---

## Parámetros de la Actividad

**Grupo de Edad:** Escolares (6-9 años)
**Duración Máxima:** 25 minutos
**Rango de Niños:** 3-12

---

Por favor, crea una actividad educativa estructurada en 3 fases que:
- Esté basada en el cuentacuentos y mensaje litúrgico anterior
- Sea apropiada para el grupo de edad "Escolares (6-9 años)"
- Tenga exactamente 3 fases (movimiento, expresión/conversación, reflexión)
- No exceda 25 minutos en total
- Incluya adaptaciones para diferentes tamaños de grupo
- Especifique claramente los roles del líder y apoyo
- Liste todos los materiales necesarios
- Sea divertida, educativa y espiritualmente significativa`;

// The line the materials block is spliced after (index.ts:233 at base).
const RANGO_LINE = "**Rango de Niños:** 3-12";

// Normative block, PLAN-MATERIALES M1 / M-D4 — stated here independently of the
// implementation so a wording drift on either side turns this suite red.
const EXPECTED_MATERIALS_BLOCK = `
**Materiales Disponibles (inventario de la iglesia):**
- papel
- tijeras
- témpera

**Restricción de Materiales:**
- Diseña la actividad usando ÚNICAMENTE materiales de la lista anterior.
- NO propongas comprar, conseguir ni pedir materiales que no estén en la lista.
- No es necesario usar todos los materiales; elige solo los que aporten a la actividad.
- Las fases sin materiales (movimiento, canto, conversación) son bienvenidas y válidas.
- En el campo "materials" incluye únicamente elementos de la lista anterior.
`;

const MATERIALS = ["papel", "tijeras", "témpera"];

Deno.test("[A3] system prompt is byte-identical to the base literal", () => {
  assertEquals(buildSystemPrompt(), GENERATE_SYSTEM_GOLDEN_BASE);
});

Deno.test("[A3] user prompt with availableMaterials ABSENT is byte-identical to base", () => {
  assertEquals(buildUserPrompt(GENERATE_REQUEST_FIXTURE), GENERATE_USER_GOLDEN_BASE);
});

Deno.test("[A3] user prompt with availableMaterials: [] is byte-identical to base", () => {
  assertEquals(
    buildUserPrompt({ ...GENERATE_REQUEST_FIXTURE, availableMaterials: [] }),
    GENERATE_USER_GOLDEN_BASE,
  );
});

Deno.test("[A3] a non-array or all-noise field still yields the base prompt", () => {
  for (const field of [undefined, [] as string[], ["   "], ["", "\t"]]) {
    assertEquals(
      buildUserPrompt({ ...GENERATE_REQUEST_FIXTURE, availableMaterials: field }),
      GENERATE_USER_GOLDEN_BASE,
    );
  }
});

Deno.test("[A4] present field splices the normative block, items in order", () => {
  const anchor = `${RANGO_LINE}\n\n---`;
  assertStringIncludes(GENERATE_USER_GOLDEN_BASE, anchor);

  const expected = GENERATE_USER_GOLDEN_BASE.replace(
    anchor,
    `${RANGO_LINE}\n${EXPECTED_MATERIALS_BLOCK}\n---`,
  );
  // Guard against a no-op replace silently making this assertion vacuous.
  assertNotEquals(expected, GENERATE_USER_GOLDEN_BASE);

  assertEquals(
    buildUserPrompt({ ...GENERATE_REQUEST_FIXTURE, availableMaterials: MATERIALS }),
    expected,
  );
});

Deno.test("[A4] the block is the ONLY difference from the base prompt", () => {
  const withMaterials = buildUserPrompt({
    ...GENERATE_REQUEST_FIXTURE,
    availableMaterials: MATERIALS,
  });
  // The block carries its own leading and trailing newline, so excising it
  // whole must restore the base prompt exactly.
  assertEquals(
    withMaterials.replace(EXPECTED_MATERIALS_BLOCK, ""),
    GENERATE_USER_GOLDEN_BASE,
  );
});

Deno.test("[A4]/[A6] the prompt bullets are the CANONICAL list, not the raw field", () => {
  const withNoise = buildUserPrompt({
    ...GENERATE_REQUEST_FIXTURE,
    availableMaterials: ["  Papel   blanco ", "papel BLANCO", "", "tijeras"],
  });
  assertStringIncludes(
    withNoise,
    "**Materiales Disponibles (inventario de la iglesia):**\n- Papel blanco\n- tijeras\n",
  );
});

Deno.test("[A9] the request type carries availableMaterials?: string[]", () => {
  const typed: GenerateChildrenLessonRequest = {
    ...GENERATE_REQUEST_FIXTURE,
    availableMaterials: ["papel"],
  };
  assertEquals(typed.availableMaterials, ["papel"]);
});
