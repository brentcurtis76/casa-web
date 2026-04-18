/**
 * Generadores de prompts para el módulo Cuentacuentos
 * Construye prompts para Claude (escritura) e Imagen 3 (ilustraciones)
 */

import type {
  StoryCharacter,
  StoryLandmark,
  StoryScene,
  LocationInfo,
  IllustrationStyle,
  LandmarkRole,
  PropKind,
  PropRole,
} from '@/types/shared/story';
import forbiddenNames from '@/data/cuentacuentos/forbidden-names.json';

/**
 * Genera el prompt del sistema para Claude para escribir el cuento
 */
export function buildStorySystemPrompt(): string {
  return `Eres un cuentacuentos experto en crear historias para niños pequeños en el contexto de una comunidad cristiana progresiva e inclusiva (CASA - Comunidad Anglicana San Andrés).

## Tu Tarea
Escribir un cuento breve para el momento del "Cuentacuento" durante la liturgia dominical.

## Especificaciones del Cuento

### Audiencia
- Niños y niñas de aproximadamente 7 años
- Lenguaje claro, sencillo y accesible
- Oraciones cortas y vocabulario apropiado para la edad

### Duración
- Máximo 5 minutos de lectura en voz alta
- Aproximadamente 12-14 escenas cortas

### Estructura Narrativa
- UN personaje principal claramente definido (no pueden haber dos protagonistas)
- Puede haber personajes secundarios que acompañen o desafíen al protagonista
- Debe tener tensión dramática: un problema, dilema o conflicto
- Debe tener una resolución clara y satisfactoria

### Enfoque Cristocéntrico
- La historia debe tener una referencia a Jesús, ya sea directa o simbólica
- O bien debe conectar con una enseñanza del Evangelio
- Esta referencia debe ser significativa pero NO forzada ni doctrinal
- Evitar ser predicador o moralizante; que la enseñanza emerja naturalmente

### Para las Ilustraciones
- Cada escena debe poder visualizarse como una imagen estática
- Describir escenas con buena iluminación (evitar escenas oscuras porque la proyección no se ve bien)
- Las escenas deben tener elementos visuales interesantes

## Nombres Prohibidos
NO uses estos nombres porque pertenecen a niños de la comunidad:
${forbiddenNames.names.join(', ')}

## Formato de Respuesta
Responde SOLO con JSON válido (sin markdown, sin comentarios) con esta estructura:

{
  "title": "Título del Cuento",
  "summary": "Resumen en una oración",
  "characters": [
    {
      "name": "Nombre del personaje",
      "role": "protagonist" | "secondary",
      "description": "Descripción breve del personaje"
    }
  ],
  "scenes": [
    {
      "number": 1,
      "text": "Texto que se leerá en voz alta para esta escena. Debe ser 2-4 oraciones.",
      "visualDescription": "Descripción visual de la escena para generar la imagen. Incluye: ambiente, personajes presentes, acciones, expresiones, iluminación.",
      "landmarkVisible": true
    }
  ],
  "spiritualConnection": "Breve explicación de cómo el cuento conecta con el tema de la liturgia o el Evangelio"
}`;
}

/**
 * Genera el prompt de usuario para Claude con el contexto específico
 */
export function buildStoryUserPrompt(
  location: LocationInfo,
  characters: { description: string; name?: string }[],
  landmarks?: { name: string; narrativeRole: string; visualDescription?: string; role: LandmarkRole }[],
  liturgyTitle?: string,
  liturgyReadings?: string,
  liturgySummary?: string,
  props?: { name: string; kind: PropKind; narrativeRole: string; visualDescription?: string; role?: PropRole }[],
): string {
  const charactersText = characters
    .map((c, i) => `Personaje ${i + 1}: ${c.description}${c.name ? ` (nombre sugerido: ${c.name})` : ''}`)
    .join('\n');

  let prompt = `## Información del Lugar: ${location.name}
${location.description}
Tipo: ${location.type}
Elementos visuales característicos: ${location.visualElements.join(', ')}
Colores predominantes: ${location.colors.join(', ')}
Iluminación típica: ${location.lighting}

## Personajes
${charactersText}
`;

  // Include landmark info if provided
  if (landmarks && landmarks.length > 0) {
    prompt += `\n## Landmark / Edificio como "Personaje" Visual\n`;
    for (const lm of landmarks) {
      prompt += `\n### ${lm.name}
- Rol narrativo: ${lm.narrativeRole}
- Prominencia: ${lm.role === 'primary' ? 'PRINCIPAL — debe aparecer en muchas escenas como elemento central' : 'SECUNDARIO — aparece en algunas escenas como telón de fondo'}
${lm.visualDescription ? `- Descripción visual detallada: ${lm.visualDescription}` : ''}

IMPORTANTE sobre el landmark:
- El landmark "${lm.name}" debe ser tratado casi como un personaje más de la historia
- Debe aparecer de forma reconocible y consistente en las escenas donde sea visible
- En cada escena, indica "landmarkVisible": true si el landmark debe aparecer en la ilustración
- La descripción visual de las escenas donde aparece DEBE incluir detalles específicos del landmark
- ${lm.role === 'primary' ? 'Como landmark principal, debe aparecer en al menos la mitad de las escenas' : 'Como landmark secundario, debe aparecer en al menos 3-4 escenas'}
`;
    }
  }

  // Include recurring visual references (props: lugares y objetos) if provided
  if (props && props.length > 0) {
    prompt += `\n## Referencias visuales (elementos recurrentes)\n`;
    for (const p of props) {
      const kindLabel = p.kind === 'location' ? 'Lugar / escenario' : 'Objeto / prop';
      prompt += `\n### ${p.name}
- Tipo: ${kindLabel}
- Rol narrativo: ${p.narrativeRole}
${p.visualDescription ? `- Descripción visual detallada: ${p.visualDescription}` : ''}
`;
    }
    prompt += `\nIMPORTANTE: Estos elementos deben aparecer de manera consistente en cualquier escena cuya descripción visual (visualDescription) los mencione. Cuando incluyas uno de estos elementos en una escena, usa los mismos detalles visuales descritos arriba para mantener coherencia entre ilustraciones.
`;
  }

  if (liturgyTitle || liturgyReadings || liturgySummary) {
    prompt += `
## Contexto de la Liturgia`;
    if (liturgyTitle) prompt += `\n- Título: ${liturgyTitle}`;
    if (liturgyReadings) prompt += `\n- Lecturas: ${liturgyReadings}`;
    if (liturgySummary) prompt += `\n- Resumen: ${liturgySummary}`;
  }

  prompt += `

Escribe el cuento siguiendo las especificaciones. Recuerda que debe tener 12-14 escenas y durar máximo 5 minutos de lectura.`;

  return prompt;
}

/**
 * Genera prompt para investigar un lugar de Chile con Claude
 */
export function buildLocationResearchPrompt(locationName: string): string {
  return `Investiga el lugar "${locationName}" en Chile y proporciona una descripción visual detallada para usarla en prompts de generación de imágenes de un cuento infantil.

Incluye:
1. Características geográficas (costa, montaña, desierto, bosque, etc.)
2. Elementos naturales distintivos (tipo de vegetación, fauna, formaciones rocosas, etc.)
3. Colores predominantes del paisaje
4. Clima típico y luminosidad
5. Elementos arquitectónicos o culturales si los hay

Responde SOLO con JSON válido (sin markdown, sin comentarios):

{
  "name": "Nombre del lugar",
  "region": "Región de Chile",
  "type": "costa" | "montaña" | "desierto" | "bosque" | "urbano" | "altiplano" | "lago" | "valle",
  "description": "Descripción visual detallada de 2-3 oraciones que se usará en prompts de generación de imágenes",
  "visualElements": ["elemento1", "elemento2", "elemento3"],
  "colors": ["color1", "color2", "color3"],
  "lighting": "Descripción de la luz típica del lugar"
}`;
}

/**
 * Genera prompt para character sheet
 */
export function buildCharacterSheetPrompt(
  character: StoryCharacter,
  style: IllustrationStyle
): string {
  return `Character design sheet, full body view, white background, ${style.prompt}.

Character: ${character.description}
${character.visualDescription ? `Visual details: ${character.visualDescription}` : ''}

The character should be shown in a neutral standing pose, facing slightly to the side, with a friendly expression. Show the full body from head to toe. Clean white background with no other elements.

Important:
- Bright, well-lit image
- Child-friendly appearance
- Expressive but not exaggerated features
- No text or words in the image`;
}

/**
 * Genera prompt para una escena del cuento
 * IMPORTANTE: Debe describir los personajes completos porque Imagen 3 no tiene memoria
 */
export function buildScenePrompt(
  scene: StoryScene,
  characters: StoryCharacter[],
  location: LocationInfo,
  style: IllustrationStyle,
  landmarks?: StoryLandmark[]
): string {
  // Identificar qué personajes aparecen en la escena
  const charactersInScene = characters.filter((c) =>
    scene.visualDescription.toLowerCase().includes(c.name.toLowerCase())
  );

  const characterDescriptions = charactersInScene
    .map((c) => `${c.name}: ${c.editedVisualDescription ?? c.visualDescription ?? c.description}`)
    .join('\n\n');

  // Determine if landmark should appear in this scene
  const visibleLandmarks = (landmarks || []).filter(
    (lm) => scene.landmarkVisible && lm.visualDescription
  );

  const landmarkSection = visibleLandmarks.length > 0
    ? `\nLANDMARK visible in this scene (use reference images to render faithfully):
${visibleLandmarks.map((lm) => `- ${lm.name}: ${lm.visualDescription}`).join('\n')}
IMPORTANT: The landmark must be rendered with EXACT architectural details matching the reference photos provided. It should be recognizable and consistent across all scenes.`
    : '';

  return `${style.prompt}

Scene: ${scene.visualDescription}

Location: ${location.name}, Chile. ${location.description}
Visual elements: ${location.visualElements.join(', ')}
Lighting: ${location.lighting}

${charactersInScene.length > 0 ? `Characters in this scene:
${characterDescriptions}` : ''}
${landmarkSection}

Important instructions:
- Bright, well-lit scene (this will be projected in a room with natural light)
- Child-friendly imagery
- No text or words in the image
- Cinematic composition
- Warm, inviting atmosphere
- Colors: ${location.colors.join(', ')}${visibleLandmarks.length > 0 ? '\n- The landmark MUST match the provided reference photos exactly' : ''}`;
}

/**
 * Genera prompt para la portada del cuento
 */
export function buildCoverPrompt(
  title: string,
  characters: StoryCharacter[],
  location: LocationInfo,
  style: IllustrationStyle
): string {
  const protagonist = characters.find((c) => c.role === 'protagonist');
  const protagonistDescription = protagonist?.visualDescription || protagonist?.description || '';

  return `${style.prompt}

Book cover illustration for a children's story.

The image should show the main character:
${protagonistDescription}

Setting: ${location.name}, Chile. ${location.description}

The composition should be inviting and magical, suggesting adventure and wonder.

Important:
- Bright, colorful, and inviting
- The character should look friendly and approachable
- Include visual elements from the story's setting: ${location.visualElements.join(', ')}
- Professional children's book cover composition
- No text or words in the image (title will be added separately)
- Colors: ${location.colors.join(', ')}`;
}

/**
 * Genera prompt para la página final "Fin"
 */
export function buildEndPrompt(style: IllustrationStyle): string {
  return `${style.prompt}

Simple, elegant end card for a children's story.

Decorated with subtle, child-friendly ornamental elements like small stars, leaves, or simple flourishes.

Warm, soft background color. Bright and cheerful mood.

Important:
- No characters, just decorative elements
- No text or words in the image (the word "Fin" will be added separately)
- Centered composition
- Soft, warm colors
- Simple and elegant design`;
}

/**
 * Genera prompt para que Gemini analice fotos de referencia de un landmark
 * y produzca una descripción visual detallada para usar en prompts de generación de imágenes
 *
 * NOTE: This is the frontend version for preview/testing. The canonical version used at runtime
 * is in supabase/functions/generate-story/index.ts analyzeLandmarkImages()
 */
export function buildLandmarkAnalysisPrompt(landmarkName: string, narrativeRole: string): string {
  return `Analiza las fotos de referencia de "${landmarkName}" y proporciona una descripción visual extremadamente detallada para usar en prompts de generación de imágenes de un cuento infantil ilustrado.

Contexto narrativo: ${narrativeRole}

Describe con el máximo detalle posible:
1. **Forma y estructura**: Forma general del edificio/landmark, número de pisos, torres, techos, cúpulas
2. **Materiales y texturas**: Tipo de construcción (piedra, madera, adobe, concreto), texturas visibles
3. **Colores específicos**: Colores exactos de paredes, techos, puertas, ventanas, detalles
4. **Elementos arquitectónicos**: Puertas, ventanas, columnas, arcos, campanarios, escaleras, balcones
5. **Elementos decorativos**: Cruces, vitrales, molduras, inscripciones, ornamentos
6. **Proporciones**: Relación de tamaño con personas, árboles u otros elementos de escala
7. **Entorno inmediato**: Tipo de suelo, vegetación, elementos que rodean el landmark

Responde en español, en un solo párrafo denso de máximo 200 palabras. Solo información visual útil para que un modelo de IA pueda recrear fielmente este landmark en ilustraciones infantiles. NO incluyas historia ni datos culturales — solo lo visual.`;
}

/**
 * Valida que un nombre no esté en la lista de prohibidos
 */
export function isNameForbidden(name: string): boolean {
  const normalizedName = name.trim().toLowerCase();
  return forbiddenNames.names.some(
    (forbidden) => forbidden.toLowerCase() === normalizedName
  );
}

/**
 * Obtiene la lista de nombres prohibidos
 */
export function getForbiddenNames(): string[] {
  return forbiddenNames.names;
}
