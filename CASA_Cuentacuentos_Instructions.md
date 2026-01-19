# Instrucciones para Claude Code: Módulo Cuentacuentos CASA

## Resumen del Proyecto

Crear un módulo para generar cuentos ilustrados para niños que se narran durante la liturgia dominical. El sistema usa Claude API para escribir el cuento y **Nano Banana Pro** (Gemini 3 Pro Image) de Google DeepMind para generar las ilustraciones.

---

## API de Generación de Imágenes: Nano Banana Pro

### Información del Modelo

| Característica | Valor |
|----------------|-------|
| Nombre comercial | Nano Banana Pro |
| Modelo técnico | Gemini 3 Pro Image |
| ID del modelo | `gemini-3-pro-image-preview` |
| Alternativa rápida | Nano Banana (`gemini-2.5-flash-image`) |
| Resolución máxima | Hasta 4K |
| Imágenes de referencia | Hasta 14 imágenes |
| Consistencia de personajes | Hasta 5 personajes |
| Watermark | SynthID (automático) |

### Acceso a la API

```python
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_API_KEY")

# Generar imagen con Nano Banana Pro
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",  # Nano Banana Pro
    contents=[prompt]
)

# Procesar respuesta
for part in response.parts:
    if part.inline_data is not None:
        image = part.as_image()
        image.save("generated_image.png")
```

### Acceso via Google AI Studio

1. Ir a Google AI Studio (aistudio.google.com)
2. Seleccionar "Create images" (🍌)
3. Elegir modelo "Thinking" para Nano Banana Pro
4. Ingresar prompt

### Ventajas para Cuentacuentos

- **Texto legible**: Puede generar texto dentro de las imágenes (útil para portada y "Fin")
- **Consistencia de personajes**: Mantiene apariencia de hasta 5 personajes
- **Múltiples referencias**: Puede usar hasta 14 imágenes de referencia
- **Conocimiento del mundo**: Entiende lugares reales de Chile para descripciones precisas
- **Estilos artísticos**: Excelente para estilos como Ghibli, Pixar, etc.

---

## Flujo del Usuario

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CREADOR DE CUENTOS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PASO 1: Contexto                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Seleccionar liturgia: [12 de Enero - El camino de la esperanza ▼]   │   │
│  │ (Automáticamente carga el tema, lecturas y resumen)                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PASO 2: Configuración del Cuento                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Lugar: [Bahía Inglesa, Chile                                    ]   │   │
│  │                                                                     │   │
│  │ Personajes:                                                         │   │
│  │ ┌─────────────────────────────────────────────────────────────┐    │   │
│  │ │ Personaje 1: [Niña de 8 años        ] Nombre: [           ] │    │   │
│  │ │ Personaje 2: [Su hermano menor      ] Nombre: [           ] │    │   │
│  │ │ [+ Agregar personaje]                                       │    │   │
│  │ └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                     │   │
│  │ Estilo visual: [Studio Ghibli ▼]                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PASO 3: Generación del Cuento                                              │
│  [Generar Cuento] → Claude escribe → Usuario aprueba/edita                  │
│                                                                             │
│  PASO 4: Generación de Imágenes                                             │
│  [Generar Personajes] → Usuario aprueba character sheets                    │
│  [Generar Escenas] → 3-4 opciones por escena → Usuario selecciona           │
│                                                                             │
│  PASO 5: Exportación                                                        │
│  [Guardar Cuento] → Se guarda como elemento para el compositor              │
│  [Exportar PDF] → PDF con texto e imágenes para el narrador                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Especificaciones del Cuento

### Parámetros Base

| Parámetro | Valor |
|-----------|-------|
| Público objetivo | Niños y niñas de ~7 años |
| Duración | Máximo 5 minutos de lectura en voz alta |
| Número de escenas | 12-14 escenas |
| Protagonista | Un personaje principal claramente definido |
| Estructura | Tensión dramática + resolución clara |
| Enfoque | Cristocéntrico (referencia a Jesús o enseñanza del Evangelio) |

### Nombres Prohibidos

Estos nombres pertenecen a niños de la comunidad y no deben usarse:

```typescript
const FORBIDDEN_NAMES = [
  // Lista original
  'Matías', 'Emilia', 'Tomás', 'Amanda', 'Matilde', 
  'Leonor', 'Timoteo', 'Rocío', 'Renato', 'Rafael',
  
  // Nombres comunes adicionales a evitar
  'Sofía', 'Martín', 'Isidora', 'Benjamín', 'Florencia',
  'Agustín', 'Catalina', 'Vicente', 'Valentina', 'Joaquín',
  'Antonia', 'Maximiliano', 'Fernanda', 'Sebastián', 'Josefa',
  'Alonso', 'Trinidad', 'Nicolás', 'Maite', 'Lucas',
  'Ignacia', 'Felipe', 'Pascuala', 'Diego', 'Esperanza',
  'Gabriel', 'Paz', 'Daniel', 'Colomba', 'Samuel',
  'Montserrat', 'Facundo', 'Javiera', 'Gaspar', 'Julieta',
  'Simón', 'Agustina', 'Mateo', 'Isabella', 'Santiago',
  'Antonella', 'José', 'María', 'Pedro', 'Juan',
  'Francisca', 'Francisco', 'Camila', 'Pablo', 'Constanza'
];
```

### Lugares de Chile (Ejemplos para Inspiración)

El usuario puede escribir cualquier lugar. El sistema debe investigar las características del lugar para describirlo en los prompts.

```typescript
const EXAMPLE_LOCATIONS = [
  // Costa
  'Bahía Inglesa', 'La Serena', 'Viña del Mar', 'Pichilemu', 
  'Puerto Varas', 'Chiloé', 'Caleta Tortel',
  
  // Montaña/Valle
  'Valle del Elqui', 'Cajón del Maipo', 'Torres del Paine',
  'San Pedro de Atacama', 'Villarrica', 'Pucón',
  
  // Altiplano/Desierto
  'Desierto de Atacama', 'Geysers del Tatio', 'Salar de Atacama',
  'Valle de la Luna', 'Altiplano de Arica',
  
  // Bosque/Sur
  'Parque Huerquehue', 'Bosque de Arrayanes', 'Selva Valdiviana',
  'Carretera Austral', 'Lago General Carrera',
  
  // Urbano
  'Valparaíso', 'Barrio Bellavista', 'Plaza de Armas de Santiago'
];
```

---

## Estilos de Ilustración Disponibles

```typescript
const ILLUSTRATION_STYLES = [
  {
    id: 'ghibli',
    name: 'Studio Ghibli',
    prompt: 'Studio Ghibli animation style, soft watercolor backgrounds, detailed natural environments, warm lighting, whimsical atmosphere, hand-drawn aesthetic',
    description: 'Estilo suave y cálido con fondos acuarelados'
  },
  {
    id: 'pixar',
    name: 'Pixar',
    prompt: 'Pixar 3D animation style, expressive characters, vibrant colors, cinematic lighting, detailed textures, emotional storytelling',
    description: 'Animación 3D expresiva y colorida'
  },
  {
    id: 'disney-classic',
    name: 'Disney Clásico',
    prompt: 'Classic Disney 2D animation style, golden age aesthetic, fluid lines, warm colors, fairytale atmosphere, hand-painted backgrounds',
    description: 'Animación 2D tradicional estilo cuentos de hadas'
  },
  {
    id: 'dreamworks',
    name: 'DreamWorks',
    prompt: 'DreamWorks animation style, dynamic poses, bold colors, expressive faces, cinematic composition, playful energy',
    description: 'Animación dinámica y expresiva'
  },
  {
    id: 'storybook',
    name: 'Libro de Cuentos',
    prompt: 'Children\'s storybook illustration style, soft pastel colors, gentle brushstrokes, cozy atmosphere, whimsical details, picture book aesthetic',
    description: 'Ilustración clásica de libro infantil'
  },
  {
    id: 'watercolor',
    name: 'Acuarela Infantil',
    prompt: 'Children\'s watercolor illustration, soft washes, gentle colors, dreamy atmosphere, delicate lines, artistic and tender',
    description: 'Acuarelas suaves y delicadas'
  },
  {
    id: 'eric-carle',
    name: 'Estilo Eric Carle',
    prompt: 'Eric Carle collage illustration style, bold colors, textured paper cutouts, simple shapes, vibrant and playful, The Very Hungry Caterpillar aesthetic',
    description: 'Collage colorido con texturas de papel'
  },
  {
    id: 'quentin-blake',
    name: 'Estilo Quentin Blake',
    prompt: 'Quentin Blake illustration style, loose pen and ink drawings, energetic lines, splashes of watercolor, whimsical and expressive characters, Roald Dahl book aesthetic',
    description: 'Dibujos sueltos y expresivos con tinta'
  },
  {
    id: 'papercut',
    name: 'Papel Recortado',
    prompt: 'Paper cut-out illustration style, layered paper effect, soft shadows, colorful shapes, handcrafted aesthetic, dimensional depth',
    description: 'Efecto de papel recortado en capas'
  },
  {
    id: 'claymation',
    name: 'Claymation',
    prompt: 'Claymation stop-motion style, 3D clay figures, textured surfaces, warm lighting, handcrafted charm, Aardman animation aesthetic',
    description: 'Estilo plastilina/stop motion'
  },
  {
    id: 'folk-art',
    name: 'Arte Folk Latinoamericano',
    prompt: 'Latin American folk art style, vibrant colors, decorative patterns, naive art aesthetic, cultural motifs, warm and festive',
    description: 'Arte popular latinoamericano colorido'
  },
  {
    id: 'anime-soft',
    name: 'Anime Suave',
    prompt: 'Soft anime illustration style, big expressive eyes, pastel colors, gentle lighting, kawaii aesthetic, heartwarming atmosphere',
    description: 'Anime tierno con colores pastel'
  },
  {
    id: 'cartoon-network',
    name: 'Cartoon Network',
    prompt: 'Modern cartoon style, bold outlines, flat colors, geometric shapes, playful proportions, Adventure Time / Steven Universe aesthetic',
    description: 'Dibujo animado moderno y geométrico'
  },
  {
    id: 'beatrix-potter',
    name: 'Estilo Beatrix Potter',
    prompt: 'Beatrix Potter illustration style, detailed naturalistic animals, soft watercolors, English countryside aesthetic, gentle and refined, Peter Rabbit style',
    description: 'Acuarelas naturalistas estilo clásico inglés'
  }
];
```

---

## Prompt del Sistema para Claude (Escritura del Cuento)

```
Eres un cuentacuentos experto en crear historias para niños pequeños en el contexto de una comunidad cristiana progresiva e inclusiva (CASA - Comunidad Anglicana San Andrés).

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

## Información del Lugar: {LOCATION}
{LOCATION_DESCRIPTION}

## Personajes
{CHARACTERS_DESCRIPTION}

## Contexto de la Liturgia
- Título: {LITURGY_TITLE}
- Lecturas: {READINGS}
- Resumen: {LITURGY_SUMMARY}

## Nombres Prohibidos
NO uses estos nombres porque pertenecen a niños de la comunidad:
{FORBIDDEN_NAMES}

## Formato de Respuesta

Responde en JSON con esta estructura:

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
      "visualDescription": "Descripción visual de la escena para generar la imagen. Incluye: ambiente, personajes presentes, acciones, expresiones, iluminación."
    }
  ],
  "spiritualConnection": "Breve explicación de cómo el cuento conecta con el tema de la liturgia o el Evangelio"
}
```

---

## Generación de Imágenes con Nano Banana Pro

### Character Sheets

Antes de generar las escenas, crear un "character sheet" para cada personaje.

```typescript
interface CharacterSheet {
  characterName: string;
  role: 'protagonist' | 'secondary';
  visualDescription: string;  // Descripción detallada para el prompt
  referencePrompt: string;    // Prompt usado para generar la referencia
  referenceImageUrl?: string; // URL de la imagen aprobada
}

function generateCharacterSheetPrompt(
  character: Character,
  style: IllustrationStyle
): string {
  return `
Character design sheet, full body view, white background, ${style.prompt}.

Character: ${character.description}

The character should be shown in a neutral standing pose, facing slightly to the side, with a friendly expression. Show the full body from head to toe. Clean white background with no other elements.

Important: Bright, well-lit image. Child-friendly appearance. Expressive but not exaggerated features.
`.trim();
}
```

### Prompts de Escenas

**CRÍTICO**: Cada prompt debe describir los personajes completos, como si fuera la primera vez. Nano Banana Pro puede mantener consistencia de hasta 5 personajes si se le dan referencias adecuadas, pero es mejor describir completamente en cada prompt.

```typescript
function generateScenePrompt(
  scene: Scene,
  characters: CharacterSheet[],
  location: LocationInfo,
  style: IllustrationStyle
): string {
  // Obtener descripciones de personajes que aparecen en la escena
  const characterDescriptions = characters
    .filter(c => scene.visualDescription.toLowerCase().includes(c.characterName.toLowerCase()))
    .map(c => c.visualDescription)
    .join('\n\n');

  return `
${style.prompt}

Scene: ${scene.visualDescription}

Location: ${location.name}, Chile. ${location.description}

Characters in this scene:
${characterDescriptions}

Important instructions:
- Bright, well-lit scene (this will be projected in a room with natural light)
- Child-friendly imagery
- No text or words in the image
- Cinematic composition
- Warm, inviting atmosphere
`.trim();
}
```

### Prompt de Portada

```typescript
function generateCoverPrompt(
  title: string,
  characters: CharacterSheet[],
  location: LocationInfo,
  style: IllustrationStyle
): string {
  const protagonistDescription = characters.find(c => c.role === 'protagonist')?.visualDescription;

  return `
${style.prompt}

Book cover illustration for a children's story titled "${title}".

The image should show the main character:
${protagonistDescription}

Setting: ${location.name}, Chile. ${location.description}

The title "${title}" should appear at the top in a friendly, readable children's book font.

Important:
- Bright, colorful, and inviting
- The character should look friendly and approachable
- Include visual elements from the story's setting
- Professional children's book cover composition
`.trim();
}
```

### Prompt de Imagen Final

```typescript
function generateEndPrompt(style: IllustrationStyle): string {
  return `
${style.prompt}

Simple, elegant end card for a children's story.

The word "Fin" in a decorative but readable children's book font, centered.

Decorated with subtle, child-friendly ornamental elements like small stars, leaves, or simple flourishes.

Warm, soft background color. Bright and cheerful mood.

No characters, just the text and decorative elements.
`.trim();
}
```

---

## Interfaces TypeScript

```typescript
// types/story.ts

interface StoryCharacter {
  id: string;
  name: string;
  role: 'protagonist' | 'secondary';
  description: string;          // Descripción narrativa
  visualDescription: string;    // Descripción visual detallada para prompts
  characterSheetUrl?: string;   // URL de la imagen del character sheet aprobado
}

interface StoryScene {
  number: number;
  text: string;                 // Texto que se lee en voz alta
  visualDescription: string;    // Descripción para generar la imagen
  imageOptions?: string[];      // URLs de las 3-4 imágenes generadas
  selectedImageUrl?: string;    // URL de la imagen seleccionada por el usuario
}

interface Story {
  id: string;
  title: string;
  summary: string;
  liturgyId: string;            // ID de la liturgia asociada
  location: {
    name: string;
    description: string;        // Descripción investigada del lugar
  };
  illustrationStyle: string;    // ID del estilo seleccionado
  characters: StoryCharacter[];
  scenes: StoryScene[];
  coverImageUrl?: string;
  endImageUrl?: string;
  spiritualConnection: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    status: 'draft' | 'generating' | 'ready';
  };
}

interface StorySlideGroup {
  storyId: string;
  title: string;
  slides: StorySlide[];
}

interface StorySlide {
  type: 'cover' | 'scene' | 'end';
  sceneNumber?: number;
  imageUrl: string;
  narratorText?: string;        // Texto que lee el narrador
}
```

---

## Flujo de Generación de Imágenes

### Paso 1: Generar Character Sheets

```typescript
async function generateCharacterSheets(
  characters: StoryCharacter[],
  style: IllustrationStyle
): Promise<CharacterSheetResult[]> {
  const results = [];
  
  for (const character of characters) {
    const prompt = generateCharacterSheetPrompt(character, style);
    
    // Generar 3-4 opciones para que el usuario elija
    const images = await generateImages(prompt, { count: 4 });
    
    results.push({
      characterId: character.id,
      characterName: character.name,
      prompt,
      imageOptions: images
    });
  }
  
  return results;
}
```

### Paso 2: Usuario Aprueba Character Sheets

El usuario ve las opciones y selecciona la mejor para cada personaje. Esta imagen aprobada se puede usar como referencia para mantener consistencia (Nano Banana Pro soporta hasta 14 imágenes de referencia).

### Paso 3: Generar Escenas

```typescript
async function generateSceneImages(
  story: Story,
  approvedCharacterSheets: CharacterSheet[]
): Promise<SceneImageResult[]> {
  const results = [];
  
  for (const scene of story.scenes) {
    const prompt = generateScenePrompt(
      scene,
      approvedCharacterSheets,
      story.location,
      getStyleById(story.illustrationStyle)
    );
    
    // Generar 3-4 opciones por escena
    const images = await generateImages(prompt, { count: 4 });
    
    results.push({
      sceneNumber: scene.number,
      prompt,
      imageOptions: images
    });
  }
  
  return results;
}
```

### Paso 4: Generar Portada y Final

```typescript
async function generateCoverAndEnd(
  story: Story,
  characterSheets: CharacterSheet[]
): Promise<{ cover: string[], end: string[] }> {
  const style = getStyleById(story.illustrationStyle);
  
  const coverPrompt = generateCoverPrompt(
    story.title,
    characterSheets,
    story.location,
    style
  );
  
  const endPrompt = generateEndPrompt(style);
  
  const [coverImages, endImages] = await Promise.all([
    generateImages(coverPrompt, { count: 4 }),
    generateImages(endPrompt, { count: 4 })
  ]);
  
  return { cover: coverImages, end: endImages };
}
```

---

## Investigación de Lugares

Cuando el usuario ingresa un lugar, el sistema debe investigar sus características:

```typescript
async function investigateLocation(locationName: string): Promise<LocationInfo> {
  // Usar Claude para investigar el lugar
  const prompt = `
Investiga el lugar "${locationName}" en Chile y proporciona una descripción visual detallada.

Incluye:
1. Características geográficas (costa, montaña, desierto, bosque, etc.)
2. Elementos naturales distintivos (tipo de vegetación, fauna, formaciones rocosas, etc.)
3. Colores predominantes del paisaje
4. Clima típico y luminosidad
5. Elementos arquitectónicos o culturales si los hay

Responde en JSON:
{
  "name": "Nombre del lugar",
  "region": "Región de Chile",
  "type": "costa" | "montaña" | "desierto" | "bosque" | "urbano" | "altiplano" | "lago",
  "description": "Descripción visual detallada de 2-3 oraciones que se usará en prompts de generación de imágenes",
  "visualElements": ["elemento1", "elemento2", "elemento3"],
  "colors": ["color1", "color2", "color3"],
  "lighting": "Descripción de la luz típica del lugar"
}
`;

  const response = await callClaudeAPI(prompt);
  return JSON.parse(response);
}
```

---

## Exportación a PDF

El PDF incluye el texto de cada escena con su imagen correspondiente para que el narrador pueda seguir el cuento.

```typescript
interface StoryPDFContent {
  coverPage: {
    title: string;
    imageUrl: string;
    liturgyDate: string;
    liturgyTitle: string;
  };
  scenes: {
    number: number;
    imageUrl: string;
    text: string;
  }[];
  endPage: {
    imageUrl: string;
  };
  metadata: {
    generatedAt: string;
    location: string;
    style: string;
  };
}

async function generateStoryPDF(story: Story): Promise<Blob> {
  // Generar PDF con:
  // - Portada con título e imagen
  // - Cada escena en una página: imagen arriba, texto abajo
  // - Página final con "Fin"
  // - Opcional: página de metadata al final
}
```

---

## Integración con el Compositor de Liturgias

El cuento se guarda como un `SlideGroup` que puede seleccionarse en el compositor:

```typescript
function storyToSlideGroup(story: Story): SlideGroup {
  const slides: Slide[] = [];
  
  // Slide de portada
  if (story.coverImageUrl) {
    slides.push({
      id: generateId(),
      type: 'story-cover',
      content: {
        primary: story.title,
        imageUrl: story.coverImageUrl
      },
      style: {
        backgroundColor: '#F7F7F7',
        primaryFont: 'Merriweather'
      },
      metadata: {
        sourceComponent: 'cuentacuentos',
        sourceId: story.id,
        order: 1,
        groupTotal: story.scenes.length + 2
      }
    });
  }
  
  // Slides de escenas
  story.scenes.forEach((scene, index) => {
    if (scene.selectedImageUrl) {
      slides.push({
        id: generateId(),
        type: 'story-scene',
        content: {
          imageUrl: scene.selectedImageUrl,
          narratorText: scene.text  // Para referencia del operador
        },
        metadata: {
          sourceComponent: 'cuentacuentos',
          sourceId: story.id,
          order: index + 2,
          groupTotal: story.scenes.length + 2
        }
      });
    }
  });
  
  // Slide final
  if (story.endImageUrl) {
    slides.push({
      id: generateId(),
      type: 'story-end',
      content: {
        imageUrl: story.endImageUrl
      },
      metadata: {
        sourceComponent: 'cuentacuentos',
        sourceId: story.id,
        order: story.scenes.length + 2,
        groupTotal: story.scenes.length + 2
      }
    });
  }
  
  return {
    id: generateId(),
    type: 'story',
    title: story.title,
    slides,
    metadata: {
      sourceComponent: 'cuentacuentos',
      createdAt: new Date().toISOString()
    }
  };
}
```

---

## Estructura de Archivos

```
/cuentacuentos/
├── data/
│   ├── index.json                    # Índice de cuentos
│   ├── styles.json                   # Estilos de ilustración
│   ├── forbidden-names.json          # Nombres prohibidos
│   └── stories/
│       ├── {story-id}/
│       │   ├── story.json            # Datos del cuento
│       │   ├── characters/           # Character sheets
│       │   └── scenes/               # Imágenes de escenas
│       └── ...
├── components/
│   ├── StoryCreator.tsx              # Componente principal
│   ├── LiturgySelector.tsx           # Selector de liturgia
│   ├── StoryConfigForm.tsx           # Formulario de configuración
│   ├── CharacterInput.tsx            # Input de personajes
│   ├── LocationInput.tsx             # Input de lugar con investigación
│   ├── StyleSelector.tsx             # Selector de estilo visual
│   ├── StoryEditor.tsx               # Editor del texto del cuento
│   ├── CharacterSheetApproval.tsx    # Aprobación de character sheets
│   ├── SceneImageSelector.tsx        # Selector de imágenes por escena
│   ├── StoryPreview.tsx              # Vista previa completa
│   └── StoryPDFExport.tsx            # Exportación a PDF
├── lib/
│   ├── storyGeneration.ts            # Generación del cuento con Claude
│   ├── imageGeneration.ts            # Generación de imágenes con Nano Banana Pro
│   ├── locationResearch.ts           # Investigación de lugares
│   ├── promptBuilders.ts             # Constructores de prompts
│   ├── storyToSlides.ts              # Conversión a SlideGroup
│   └── pdfExport.ts                  # Exportación a PDF
├── api/
│   ├── generate-story/route.ts       # API para generar cuento
│   ├── generate-images/route.ts      # API para generar imágenes
│   └── research-location/route.ts    # API para investigar lugares
└── types/
    └── story.ts                      # Interfaces TypeScript
```

---

## Comando Inicial para Claude Code

```
Crea el módulo Cuentacuentos para el sistema de liturgias CASA.

Este módulo genera cuentos ilustrados para niños (7 años) que se narran durante la liturgia.

## Flujo:
1. Usuario selecciona liturgia (carga tema, lecturas)
2. Usuario configura: lugar (Chile), personajes, estilo de ilustración
3. Sistema investiga el lugar con Claude para describirlo en prompts
4. Claude genera el cuento (12-14 escenas, 5 min lectura)
5. Sistema genera character sheets con Nano Banana Pro (4 opciones cada uno)
6. Usuario aprueba personajes
7. Sistema genera imágenes de escenas (3-4 opciones por escena)
8. Usuario selecciona las mejores
9. Se genera portada y página final
10. Se guarda como elemento para el compositor + se exporta PDF

## Componentes a crear:
- StoryCreator.tsx (principal)
- StoryConfigForm.tsx (lugar, personajes, estilo)
- CharacterSheetApproval.tsx
- SceneImageSelector.tsx
- StoryPreview.tsx
- Funciones de generación de prompts

## APIs a conectar:
- Claude API (claude-opus-4-5-20251101) para escribir el cuento
- Nano Banana Pro API (gemini-3-pro-image-preview) para generar imágenes

## Especificaciones:
- 14 estilos de ilustración disponibles (Ghibli, Pixar, Disney, etc.)
- Nombres prohibidos (niños de la comunidad)
- Cada prompt de imagen debe describir personajes completos (para mejor consistencia)
- Imágenes brillantes (evitar oscuras por la proyección)
- Enfoque cristocéntrico pero no forzado

Lee CASA_Cuentacuentos_Instructions.md para especificaciones completas.
```
