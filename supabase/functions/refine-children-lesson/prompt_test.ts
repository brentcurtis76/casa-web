// Prompt-contract suite for refine-children-lesson.
//
// The goldens below are CAPTURED, never retyped: they are the literal output of
// the base builder as it exists at main@d79d329, produced by running that base
// source and spliced into this file mechanically (see the round report). One
// golden per refinementType, because the base output differs per type.
//
// Contract: PLAN-MATERIALES M-D2 (absent AND `[]` ⇒ byte-identical to base) and
// M-D4 (the constraint applies for EVERY refinementType, not just "materials").

import { assertEquals, assertNotEquals, assertStringIncludes } from "@std/assert";

import {
  buildSystemPrompt,
  buildUserPrompt,
  REFINEMENT_INSTRUCTIONS,
  type RefineRequest,
  type RefinementType,
} from "./prompt.ts";

export const REFINEMENT_TYPES: RefinementType[] = [
  "general",
  "materials",
  "duration",
  "adaptations",
  "phases",
  "spiritual",
  "volunteer",
  "tone",
];

export const REFINE_REQUEST_FIXTURE: RefineRequest = {
  currentLesson: {
    activityName: "Sembrar juntos",
    sequence: [
      {
        phase: "movimiento",
        title: "Semillas al viento",
        description: "Corren por la sala como semillas llevadas por el viento.",
        minutes: 8,
      },
      {
        phase: "expresion_conversacion",
        title: "Dibuja tu semilla",
        description: "Dibujan la semilla que quisieran ser y la comparten.",
        minutes: 10,
      },
      {
        phase: "reflexion_metaprendizaje",
        title: "Lo pequeño crece",
        description: "Cierre en círculo nombrando algo pequeño que creció.",
        minutes: 7,
      },
    ],
    adaptations: {
      small: "Trabajan en una sola mesa.",
      medium: "Se dividen en dos grupos.",
      large: "Cuatro estaciones rotativas.",
      mixed: "Parejas de edades distintas.",
    },
    volunteerPlan: {
      leader: "Guía la ronda y marca los tiempos.",
      support: "Reparte materiales y acompaña a los más pequeños.",
    },
    materials: ["papel", "lápices"],
    estimatedTotalMinutes: 25,
  },
  feedback: "Hazla más tranquila en la fase final.",
  liturgyContext: {
    title: "Domingo de la Semilla",
    summary: "Dios hace crecer lo pequeño.",
  },
  ageGroupLabel: "Escolares (6-9 años)",
};

// Captured from main@d79d329 — do not edit by hand.
export const REFINE_SYSTEM_GOLDEN_BASE = `Eres un especialista en educación religiosa y pedagogía infantil para la comunidad anglicana progresista CASA.

Tu tarea es REFINAR una lección infantil existente basándote en el feedback del usuario.

## Reglas Importantes

1. PRESERVA la apropiedad para el grupo de edad: "Escolares (6-9 años)". Todo vocabulario, duración, materiales y dinámicas deben seguir siendo adecuados para este grupo.
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

// Captured from main@d79d329 for REFINE_REQUEST_FIXTURE, one per refinementType
// — do not edit by hand.
export const REFINE_USER_GOLDENS_BASE: Record<RefinementType, string> = {
  general: `## Lección Actual a Refinar

\`\`\`json
{
  "activityName": "Sembrar juntos",
  "sequence": [
    {
      "phase": "movimiento",
      "title": "Semillas al viento",
      "description": "Corren por la sala como semillas llevadas por el viento.",
      "minutes": 8
    },
    {
      "phase": "expresion_conversacion",
      "title": "Dibuja tu semilla",
      "description": "Dibujan la semilla que quisieran ser y la comparten.",
      "minutes": 10
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "Lo pequeño crece",
      "description": "Cierre en círculo nombrando algo pequeño que creció.",
      "minutes": 7
    }
  ],
  "adaptations": {
    "small": "Trabajan en una sola mesa.",
    "medium": "Se dividen en dos grupos.",
    "large": "Cuatro estaciones rotativas.",
    "mixed": "Parejas de edades distintas."
  },
  "volunteerPlan": {
    "leader": "Guía la ronda y marca los tiempos.",
    "support": "Reparte materiales y acompaña a los más pequeños."
  },
  "materials": [
    "papel",
    "lápices"
  ],
  "estimatedTotalMinutes": 25
}
\`\`\`

## Grupo de Edad
Escolares (6-9 años)

## Contexto de la Liturgia
- Título: Domingo de la Semilla
- Resumen: Dios hace crecer lo pequeño.

## Tipo de Refinamiento: general
Refina la lección según el feedback del usuario. Mantén la estructura general (nombre, 3 fases, adaptaciones, voluntarios, materiales) pero mejora según lo indicado.

## Feedback del Usuario
"Hazla más tranquila en la fase final."

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`,
  materials: `## Lección Actual a Refinar

\`\`\`json
{
  "activityName": "Sembrar juntos",
  "sequence": [
    {
      "phase": "movimiento",
      "title": "Semillas al viento",
      "description": "Corren por la sala como semillas llevadas por el viento.",
      "minutes": 8
    },
    {
      "phase": "expresion_conversacion",
      "title": "Dibuja tu semilla",
      "description": "Dibujan la semilla que quisieran ser y la comparten.",
      "minutes": 10
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "Lo pequeño crece",
      "description": "Cierre en círculo nombrando algo pequeño que creció.",
      "minutes": 7
    }
  ],
  "adaptations": {
    "small": "Trabajan en una sola mesa.",
    "medium": "Se dividen en dos grupos.",
    "large": "Cuatro estaciones rotativas.",
    "mixed": "Parejas de edades distintas."
  },
  "volunteerPlan": {
    "leader": "Guía la ronda y marca los tiempos.",
    "support": "Reparte materiales y acompaña a los más pequeños."
  },
  "materials": [
    "papel",
    "lápices"
  ],
  "estimatedTotalMinutes": 25
}
\`\`\`

## Grupo de Edad
Escolares (6-9 años)

## Contexto de la Liturgia
- Título: Domingo de la Semilla
- Resumen: Dios hace crecer lo pequeño.

## Tipo de Refinamiento: materials
Enfócate EXCLUSIVAMENTE en los materiales. Sustituye, agrega o elimina materiales según el feedback, PERO debes preservar la intención pedagógica de cada fase. No cambies las actividades ni su propósito — solo ajusta qué se usa para ejecutarlas.

## Feedback del Usuario
"Hazla más tranquila en la fase final."

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`,
  duration: `## Lección Actual a Refinar

\`\`\`json
{
  "activityName": "Sembrar juntos",
  "sequence": [
    {
      "phase": "movimiento",
      "title": "Semillas al viento",
      "description": "Corren por la sala como semillas llevadas por el viento.",
      "minutes": 8
    },
    {
      "phase": "expresion_conversacion",
      "title": "Dibuja tu semilla",
      "description": "Dibujan la semilla que quisieran ser y la comparten.",
      "minutes": 10
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "Lo pequeño crece",
      "description": "Cierre en círculo nombrando algo pequeño que creció.",
      "minutes": 7
    }
  ],
  "adaptations": {
    "small": "Trabajan en una sola mesa.",
    "medium": "Se dividen en dos grupos.",
    "large": "Cuatro estaciones rotativas.",
    "mixed": "Parejas de edades distintas."
  },
  "volunteerPlan": {
    "leader": "Guía la ronda y marca los tiempos.",
    "support": "Reparte materiales y acompaña a los más pequeños."
  },
  "materials": [
    "papel",
    "lápices"
  ],
  "estimatedTotalMinutes": 25
}
\`\`\`

## Grupo de Edad
Escolares (6-9 años)

## Contexto de la Liturgia
- Título: Domingo de la Semilla
- Resumen: Dios hace crecer lo pequeño.

## Tipo de Refinamiento: duration
Ajusta la duración total y la distribución de minutos entre las 3 fases. Respeta el rango [15, 45] minutos a menos que el usuario pida explícitamente algo distinto. Asegúrate de que la suma de minutos de las 3 fases coincida con estimatedTotalMinutes.

## Feedback del Usuario
"Hazla más tranquila en la fase final."

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`,
  adaptations: `## Lección Actual a Refinar

\`\`\`json
{
  "activityName": "Sembrar juntos",
  "sequence": [
    {
      "phase": "movimiento",
      "title": "Semillas al viento",
      "description": "Corren por la sala como semillas llevadas por el viento.",
      "minutes": 8
    },
    {
      "phase": "expresion_conversacion",
      "title": "Dibuja tu semilla",
      "description": "Dibujan la semilla que quisieran ser y la comparten.",
      "minutes": 10
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "Lo pequeño crece",
      "description": "Cierre en círculo nombrando algo pequeño que creció.",
      "minutes": 7
    }
  ],
  "adaptations": {
    "small": "Trabajan en una sola mesa.",
    "medium": "Se dividen en dos grupos.",
    "large": "Cuatro estaciones rotativas.",
    "mixed": "Parejas de edades distintas."
  },
  "volunteerPlan": {
    "leader": "Guía la ronda y marca los tiempos.",
    "support": "Reparte materiales y acompaña a los más pequeños."
  },
  "materials": [
    "papel",
    "lápices"
  ],
  "estimatedTotalMinutes": 25
}
\`\`\`

## Grupo de Edad
Escolares (6-9 años)

## Contexto de la Liturgia
- Título: Domingo de la Semilla
- Resumen: Dios hace crecer lo pequeño.

## Tipo de Refinamiento: adaptations
Enfócate en mejorar las adaptaciones por tamaño de grupo (small 2-5, medium 6-10, large 11-15, mixed edades mezcladas). Hazlas más concretas, prácticas y diferenciadas entre sí.

## Feedback del Usuario
"Hazla más tranquila en la fase final."

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`,
  phases: `## Lección Actual a Refinar

\`\`\`json
{
  "activityName": "Sembrar juntos",
  "sequence": [
    {
      "phase": "movimiento",
      "title": "Semillas al viento",
      "description": "Corren por la sala como semillas llevadas por el viento.",
      "minutes": 8
    },
    {
      "phase": "expresion_conversacion",
      "title": "Dibuja tu semilla",
      "description": "Dibujan la semilla que quisieran ser y la comparten.",
      "minutes": 10
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "Lo pequeño crece",
      "description": "Cierre en círculo nombrando algo pequeño que creció.",
      "minutes": 7
    }
  ],
  "adaptations": {
    "small": "Trabajan en una sola mesa.",
    "medium": "Se dividen en dos grupos.",
    "large": "Cuatro estaciones rotativas.",
    "mixed": "Parejas de edades distintas."
  },
  "volunteerPlan": {
    "leader": "Guía la ronda y marca los tiempos.",
    "support": "Reparte materiales y acompaña a los más pequeños."
  },
  "materials": [
    "papel",
    "lápices"
  ],
  "estimatedTotalMinutes": 25
}
\`\`\`

## Grupo de Edad
Escolares (6-9 años)

## Contexto de la Liturgia
- Título: Domingo de la Semilla
- Resumen: Dios hace crecer lo pequeño.

## Tipo de Refinamiento: phases
Enfócate en mejorar el contenido de las 3 fases (movimiento, expresion_conversacion, reflexion_metaprendizaje). Puedes refinar títulos y descripciones, pero DEBES preservar exactamente los 3 phase keys en ese orden.

## Feedback del Usuario
"Hazla más tranquila en la fase final."

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`,
  spiritual: `## Lección Actual a Refinar

\`\`\`json
{
  "activityName": "Sembrar juntos",
  "sequence": [
    {
      "phase": "movimiento",
      "title": "Semillas al viento",
      "description": "Corren por la sala como semillas llevadas por el viento.",
      "minutes": 8
    },
    {
      "phase": "expresion_conversacion",
      "title": "Dibuja tu semilla",
      "description": "Dibujan la semilla que quisieran ser y la comparten.",
      "minutes": 10
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "Lo pequeño crece",
      "description": "Cierre en círculo nombrando algo pequeño que creció.",
      "minutes": 7
    }
  ],
  "adaptations": {
    "small": "Trabajan en una sola mesa.",
    "medium": "Se dividen en dos grupos.",
    "large": "Cuatro estaciones rotativas.",
    "mixed": "Parejas de edades distintas."
  },
  "volunteerPlan": {
    "leader": "Guía la ronda y marca los tiempos.",
    "support": "Reparte materiales y acompaña a los más pequeños."
  },
  "materials": [
    "papel",
    "lápices"
  ],
  "estimatedTotalMinutes": 25
}
\`\`\`

## Grupo de Edad
Escolares (6-9 años)

## Contexto de la Liturgia
- Título: Domingo de la Semilla
- Resumen: Dios hace crecer lo pequeño.

## Tipo de Refinamiento: spiritual
Fortalece la conexión espiritual de la lección. Mejora la vinculación con el mensaje litúrgico y el cuentacuentos sin volverla moralista ni forzada.

## Feedback del Usuario
"Hazla más tranquila en la fase final."

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`,
  volunteer: `## Lección Actual a Refinar

\`\`\`json
{
  "activityName": "Sembrar juntos",
  "sequence": [
    {
      "phase": "movimiento",
      "title": "Semillas al viento",
      "description": "Corren por la sala como semillas llevadas por el viento.",
      "minutes": 8
    },
    {
      "phase": "expresion_conversacion",
      "title": "Dibuja tu semilla",
      "description": "Dibujan la semilla que quisieran ser y la comparten.",
      "minutes": 10
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "Lo pequeño crece",
      "description": "Cierre en círculo nombrando algo pequeño que creció.",
      "minutes": 7
    }
  ],
  "adaptations": {
    "small": "Trabajan en una sola mesa.",
    "medium": "Se dividen en dos grupos.",
    "large": "Cuatro estaciones rotativas.",
    "mixed": "Parejas de edades distintas."
  },
  "volunteerPlan": {
    "leader": "Guía la ronda y marca los tiempos.",
    "support": "Reparte materiales y acompaña a los más pequeños."
  },
  "materials": [
    "papel",
    "lápices"
  ],
  "estimatedTotalMinutes": 25
}
\`\`\`

## Grupo de Edad
Escolares (6-9 años)

## Contexto de la Liturgia
- Título: Domingo de la Semilla
- Resumen: Dios hace crecer lo pequeño.

## Tipo de Refinamiento: volunteer
Mejora el plan de voluntarios (líder y apoyo). Hazlo más claro, con responsabilidades concretas y manejables.

## Feedback del Usuario
"Hazla más tranquila en la fase final."

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`,
  tone: `## Lección Actual a Refinar

\`\`\`json
{
  "activityName": "Sembrar juntos",
  "sequence": [
    {
      "phase": "movimiento",
      "title": "Semillas al viento",
      "description": "Corren por la sala como semillas llevadas por el viento.",
      "minutes": 8
    },
    {
      "phase": "expresion_conversacion",
      "title": "Dibuja tu semilla",
      "description": "Dibujan la semilla que quisieran ser y la comparten.",
      "minutes": 10
    },
    {
      "phase": "reflexion_metaprendizaje",
      "title": "Lo pequeño crece",
      "description": "Cierre en círculo nombrando algo pequeño que creció.",
      "minutes": 7
    }
  ],
  "adaptations": {
    "small": "Trabajan en una sola mesa.",
    "medium": "Se dividen en dos grupos.",
    "large": "Cuatro estaciones rotativas.",
    "mixed": "Parejas de edades distintas."
  },
  "volunteerPlan": {
    "leader": "Guía la ronda y marca los tiempos.",
    "support": "Reparte materiales y acompaña a los más pequeños."
  },
  "materials": [
    "papel",
    "lápices"
  ],
  "estimatedTotalMinutes": 25
}
\`\`\`

## Grupo de Edad
Escolares (6-9 años)

## Contexto de la Liturgia
- Título: Domingo de la Semilla
- Resumen: Dios hace crecer lo pequeño.

## Tipo de Refinamiento: tone
Ajusta el tono de la lección para que sea más alegre, más reflexiva, más aventurera o más tierna según lo que pida el usuario, manteniendo la apropiedad para la edad.

## Feedback del Usuario
"Hazla más tranquila en la fase final."

---

Por favor, refina la lección según este feedback. Mantén la estructura JSON exacta y aplica las mejoras solicitadas.`,
};

// The heading the materials section is spliced before (index.ts:157 at base).
const FEEDBACK_HEADING = "\n\n## Feedback del Usuario\n";

// Normative section, PLAN-MATERIALES M1 / M-D4 — stated here independently of
// the implementation so a wording drift on either side turns this suite red.
const EXPECTED_MATERIALS_SECTION = `
## Materiales Disponibles
La iglesia dispone únicamente de estos materiales:
- papel
- tijeras
- témpera

Cualquier material que agregues o sustituyas DEBE provenir de esta lista. No propongas
materiales fuera de la lista. Las actividades o fases sin materiales están permitidas.
`;

const MATERIALS = ["papel", "tijeras", "témpera"];

Deno.test("[A5] the suite covers every refinementType the module declares", () => {
  assertEquals(
    [...REFINEMENT_TYPES].sort(),
    Object.keys(REFINEMENT_INSTRUCTIONS).sort(),
  );
  assertEquals(REFINEMENT_TYPES.length, 8);
});

Deno.test("[A3] system prompt is byte-identical to the base literal", () => {
  assertEquals(
    buildSystemPrompt(REFINE_REQUEST_FIXTURE.ageGroupLabel),
    REFINE_SYSTEM_GOLDEN_BASE,
  );
});

for (const refinementType of REFINEMENT_TYPES) {
  Deno.test(`[A3]/[A5] ${refinementType}: availableMaterials ABSENT is byte-identical to base`, () => {
    assertEquals(
      buildUserPrompt({ ...REFINE_REQUEST_FIXTURE, refinementType }),
      REFINE_USER_GOLDENS_BASE[refinementType],
    );
  });

  Deno.test(`[A3]/[A5] ${refinementType}: availableMaterials [] is byte-identical to base`, () => {
    assertEquals(
      buildUserPrompt({ ...REFINE_REQUEST_FIXTURE, refinementType, availableMaterials: [] }),
      REFINE_USER_GOLDENS_BASE[refinementType],
    );
  });

  Deno.test(`[A5] ${refinementType}: a non-empty field splices the normative section`, () => {
    const golden = REFINE_USER_GOLDENS_BASE[refinementType];
    assertStringIncludes(golden, FEEDBACK_HEADING);

    const expected = golden.replace(
      FEEDBACK_HEADING,
      `\n${EXPECTED_MATERIALS_SECTION}\n## Feedback del Usuario\n`,
    );
    // Guard against a no-op replace silently making this assertion vacuous.
    assertNotEquals(expected, golden);

    assertEquals(
      buildUserPrompt({ ...REFINE_REQUEST_FIXTURE, refinementType, availableMaterials: MATERIALS }),
      expected,
    );
  });

  Deno.test(`[A5] ${refinementType}: the section is the ONLY difference from base`, () => {
    const withMaterials = buildUserPrompt({
      ...REFINE_REQUEST_FIXTURE,
      refinementType,
      availableMaterials: MATERIALS,
    });
    // The section carries its own leading and trailing newline, so excising it
    // whole must restore the base prompt exactly.
    assertEquals(
      withMaterials.replace(EXPECTED_MATERIALS_SECTION, ""),
      REFINE_USER_GOLDENS_BASE[refinementType],
    );
  });
}

Deno.test("[A3] omitting refinementType still yields the 'general' base prompt", () => {
  assertEquals(buildUserPrompt(REFINE_REQUEST_FIXTURE), REFINE_USER_GOLDENS_BASE.general);
});

Deno.test("[A5]/[A6] the section bullets are the CANONICAL list, not the raw field", () => {
  const withNoise = buildUserPrompt({
    ...REFINE_REQUEST_FIXTURE,
    availableMaterials: ["  Papel   blanco ", "papel BLANCO", "", "tijeras"],
  });
  assertStringIncludes(
    withNoise,
    "La iglesia dispone únicamente de estos materiales:\n- Papel blanco\n- tijeras\n",
  );
});

Deno.test("[A9] the request type carries availableMaterials?: string[]", () => {
  const typed: RefineRequest = {
    ...REFINE_REQUEST_FIXTURE,
    availableMaterials: ["papel"],
  };
  assertEquals(typed.availableMaterials, ["papel"]);
});
