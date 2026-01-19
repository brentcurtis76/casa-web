# Instrucciones para Claude Code: Módulo de Portadas CASA

## Resumen

Genera las dos portadas de la liturgia (Principal y Reflexión) usando una imagen generada con Nano Banana Pro en estilo Matisse/Picasso, basada en el tema de la liturgia.

---

## Portadas a Generar

### 1. Portada Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                                              ┌─────────┐        │
│                                              │  LOGO   │        │
│                                              │  CASA   │        │
│                                              └─────────┘        │
│                                                                 │
│                                                                 │
│                    [IMAGEN GENERADA                             │
│                     ESTILO MATISSE/PICASSO                      │
│                     BASADA EN EL TEMA]                          │
│                                                                 │
│                                                                 │
│                                                                 │
│                                        El camino de             │
│                                           la esperanza          │  ← Título
│                                        12 de enero, 2025        │  ← Fecha
└─────────────────────────────────────────────────────────────────┘
```

### 2. Portada Reflexión

```
┌─────────────────────────────────────────────────────────────────┐
│                                              ┌─────────┐        │
│                                              │  LOGO   │        │
│                                              │  CASA   │        │
│                                              └─────────┘        │
│                                                                 │
│                                                                 │
│                    [IMAGEN GENERADA                             │
│                     ESTILO MATISSE/PICASSO                      │
│                     (MISMA IMAGEN)                              │
│                                                                 │
│                                                                 │
│                                                                 │
│                                        El camino de             │
│                                           la esperanza          │  ← Título
│                                              Brent González     │  ← Predicador
└─────────────────────────────────────────────────────────────────┘
```

---

## Especificaciones de Diseño

### Layout

| Elemento | Posición | Especificación |
|----------|----------|----------------|
| Logo CASA | Esquina superior derecha | Desde repositorio |
| Imagen de fondo | Centro, ocupa la mayor parte | Generada con Nano Banana Pro |
| Título | Inferior derecha, sobre fecha/predicador | Merriweather, grande |
| Fecha/Predicador | Inferior derecha, bajo título | Montserrat, pequeño |

### Tipografía

```typescript
const COVER_TYPOGRAPHY = {
  title: {
    font: 'Merriweather',
    weight: 'Light',
    size: '48px',
    color: '#1A1A1A',  // o #F7F7F7 si el fondo es oscuro
    align: 'right'
  },
  subtitle: {  // fecha o predicador
    font: 'Montserrat',
    weight: 'Regular',
    size: '24px',
    color: '#555555',  // o #E5E5E5 si el fondo es oscuro
    align: 'right'
  }
};
```

### Contraste de Texto

La imagen generada puede tener zonas claras u oscuras. Opciones para asegurar legibilidad:

1. **Overlay semi-transparente** en la zona del texto
2. **Sombra de texto** sutil
3. **Instrucción en el prompt** para dejar la zona inferior derecha más clara/simple

---

## Generación de Imagen

### Input (del Contexto Transversal)

```typescript
interface LiturgyContext {
  title: string;           // "El camino de la esperanza"
  date: string;            // "2025-01-12"
  readings: BiblicalReading[];
  summary: string;         // Resumen del tema
  preacher: string;        // "Brent González"
}
```

### Prompt para Nano Banana Pro

```typescript
function generateCoverImagePrompt(context: LiturgyContext): string {
  return `
Abstract artistic illustration in the style of Henri Matisse and Pablo Picasso.

Theme: "${context.title}"
Context: ${context.summary}

Style requirements:
- Bold, simplified shapes with strong outlines
- Vibrant but harmonious color palette
- Abstract interpretation of the theme
- Warm, inviting atmosphere
- Modern art aesthetic with spiritual undertones

Composition requirements:
- Keep the bottom-right corner relatively simple/lighter for text overlay
- No text in the image
- Horizontal format (4:3 aspect ratio)
- Bright overall tonality (will be projected in a room with natural light)

Do not include any religious symbols like crosses, doves, or halos. 
Interpret the theme through abstract forms, colors, and movement.
`.trim();
}
```

### Llamada a la API

```typescript
import { GoogleGenAI } from "@google/genai";

async function generateCoverImage(context: LiturgyContext): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const prompt = generateCoverImagePrompt(context);
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",  // Nano Banana Pro
    contents: prompt,
  });
  
  // Extraer imagen de la respuesta
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const imageData = part.inlineData.data;
      // Guardar imagen y retornar URL
      return saveImage(imageData);
    }
  }
  
  throw new Error("No image generated");
}
```

---

## Composición Final de las Portadas

Una vez generada la imagen, se componen las dos portadas:

```typescript
interface CoverSlide {
  type: 'cover-main' | 'cover-reflection';
  backgroundImage: string;  // URL de la imagen generada
  logoUrl: string;          // URL del logo CASA
  title: string;
  subtitle: string;         // fecha formateada o nombre del predicador
}

function createCovers(
  context: LiturgyContext,
  generatedImageUrl: string,
  logoUrl: string
): { main: CoverSlide; reflection: CoverSlide } {
  const formattedDate = formatDate(context.date);  // "12 de enero, 2025"
  
  return {
    main: {
      type: 'cover-main',
      backgroundImage: generatedImageUrl,
      logoUrl,
      title: context.title,
      subtitle: formattedDate
    },
    reflection: {
      type: 'cover-reflection',
      backgroundImage: generatedImageUrl,  // MISMA imagen
      logoUrl,
      title: context.title,
      subtitle: context.preacher
    }
  };
}
```

---

## Conversión a SlideGroup

```typescript
function coversToSlideGroup(
  covers: { main: CoverSlide; reflection: CoverSlide }
): SlideGroup[] {
  const mainSlide: Slide = {
    id: generateId(),
    type: 'cover-main',
    content: {
      primary: covers.main.title,
      secondary: covers.main.subtitle,
      imageUrl: covers.main.backgroundImage,
      logoUrl: covers.main.logoUrl
    },
    style: {
      primaryColor: CASA_BRAND.colors.primary.black,
      secondaryColor: CASA_BRAND.colors.secondary.grayDark,
      backgroundColor: CASA_BRAND.colors.primary.white,
      primaryFont: CASA_BRAND.fonts.heading,
      secondaryFont: CASA_BRAND.fonts.body
    },
    metadata: {
      sourceComponent: 'portadas',
      sourceId: 'cover-main',
      order: 1,
      groupTotal: 1
    }
  };

  const reflectionSlide: Slide = {
    ...mainSlide,
    id: generateId(),
    type: 'cover-reflection',
    content: {
      ...mainSlide.content,
      secondary: covers.reflection.subtitle  // predicador en vez de fecha
    },
    metadata: {
      ...mainSlide.metadata,
      sourceId: 'cover-reflection'
    }
  };

  return [
    {
      id: generateId(),
      type: 'cover',
      title: 'Portada Principal',
      slides: [mainSlide],
      metadata: {
        sourceComponent: 'portadas',
        createdAt: new Date().toISOString()
      }
    },
    {
      id: generateId(),
      type: 'cover',
      title: 'Portada Reflexión',
      slides: [reflectionSlide],
      metadata: {
        sourceComponent: 'portadas',
        createdAt: new Date().toISOString()
      }
    }
  ];
}
```

---

## UI del Componente

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GENERAR PORTADAS                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Título: El camino de la esperanza                                          │
│  Fecha: 12 de enero, 2025                                                   │
│  Predicador: Brent González                                                 │
│                                                                             │
│                              [Generar Imagen]                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                │
│  │                         │    │                         │                │
│  │    PORTADA PRINCIPAL    │    │   PORTADA REFLEXIÓN     │                │
│  │                         │    │                         │                │
│  │    [Vista previa]       │    │    [Vista previa]       │                │
│  │                         │    │                         │                │
│  └─────────────────────────┘    └─────────────────────────┘                │
│                                                                             │
│  [Regenerar Imagen]                              [Aprobar y Continuar →]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Estructura de Archivos

```
/portadas/
├── components/
│   ├── CoverGenerator.tsx       # Componente principal
│   ├── CoverPreview.tsx         # Vista previa de una portada
│   └── CoverComparison.tsx      # Muestra ambas portadas lado a lado
├── lib/
│   ├── generateCoverImage.ts    # Llamada a Nano Banana Pro
│   ├── composeCover.ts          # Composición de imagen + texto + logo
│   └── coversToSlides.ts        # Conversión a SlideGroup
└── types/
    └── cover.ts                 # Interfaces
```

---

## Notas Importantes

1. **Una sola imagen**: Se genera una imagen y se reutiliza para ambas portadas
2. **Logo desde repositorio**: No generar, usar el existente
3. **Estilo consistente**: Siempre Matisse/Picasso, no dar opción al usuario
4. **Sin símbolos religiosos explícitos**: La IA puede generar cruces, evitarlo en el prompt
5. **Zona de texto**: Instruir a la IA para mantener la esquina inferior derecha simple
6. **Brillo**: Imágenes claras para proyección
