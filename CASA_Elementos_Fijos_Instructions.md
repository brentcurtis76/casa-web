# Instrucciones para Claude Code: Elementos Fijos de la Liturgia CASA

## Resumen del Proyecto

Crear un módulo con los elementos litúrgicos que NO cambian cada domingo. Estos textos son estáticos y se reutilizan en cada liturgia. El sistema debe almacenarlos y convertirlos a slides según el Brand Kit de CASA.

---

## Elementos Fijos Identificados

### 1. La Paz

```json
{
  "id": "la-paz",
  "title": "La Paz",
  "type": "paz",
  "slides": [
    {
      "type": "title",
      "content": "LA PAZ"
    },
    {
      "type": "liturgy-leader",
      "content": "Cristo es nuestra paz.\nMediante su cruz nos ha\nreconciliado con Dios en\nun solo cuerpo."
    },
    {
      "type": "liturgy-leader",
      "content": "Unidos en Él compartimos\nsu paz y amor."
    },
    {
      "type": "liturgy-leader",
      "content": "La paz de Dios\nsea con todos ustedes."
    },
    {
      "type": "liturgy-response",
      "content": "¡Y también contigo!"
    },
    {
      "type": "instruction",
      "content": "LA PAZ",
      "note": "Momento para compartir la paz"
    }
  ]
}
```

### 2. Padre Nuestro

```json
{
  "id": "padre-nuestro",
  "title": "Padre Nuestro",
  "type": "oracion-comunitaria",
  "slides": [
    {
      "type": "title",
      "content": "PADRE\nNUESTRO"
    },
    {
      "type": "prayer-congregational",
      "content": "Padre nuestro,\nque estás en los cielos.\nSantificado sea tu nombre;"
    },
    {
      "type": "prayer-congregational",
      "content": "Venga tu reino,\nhágase tu voluntad así en\nla tierra, como en el cielo."
    },
    {
      "type": "prayer-congregational",
      "content": "El pan nuestro de cada día,\ndánoslo hoy y perdona\nnuestras ofensas,"
    },
    {
      "type": "prayer-congregational",
      "content": "así como nosotros perdonamos\na los que nos ofenden."
    },
    {
      "type": "prayer-congregational",
      "content": "No nos dejes caer en tentación,\nmas líbranos del mal,"
    },
    {
      "type": "prayer-congregational",
      "content": "porque tuyo es el reino,\nel poder, y la gloria,\npor siempre jamás\nAmén"
    }
  ]
}
```

### 3. Santa Cena (Oración de Humildad)

```json
{
  "id": "santa-cena",
  "title": "Santa Cena",
  "type": "comunion",
  "slides": [
    {
      "type": "title",
      "content": "SANTA\nCENA"
    },
    {
      "type": "prayer-congregational",
      "content": "No presumimos venir a ésta tu\nmesa, misericordioso Señor,"
    },
    {
      "type": "prayer-congregational",
      "content": "confiados en nuestra rectitud\nsino en tu gracia divina."
    },
    {
      "type": "prayer-congregational",
      "content": "No somos dignos de recoger las\nmigajas debajo de tu mesa."
    },
    {
      "type": "prayer-congregational",
      "content": "Mas Tú eres el Señor\ncuya misericordia nunca falla,"
    },
    {
      "type": "prayer-congregational",
      "content": "Concédenos, entonces,\nPadre nuestro, de tal manera\nrecibir con fe este pan y esta copa,"
    },
    {
      "type": "prayer-congregational",
      "content": "Que podamos participar del\ncuerpo y de la sangre de tu\namado hijo Jesucristo"
    },
    {
      "type": "prayer-congregational",
      "content": "y que vivamos siempre en\nÉl y Él en nosotros."
    }
  ]
}
```

### 4. Acción de Gracias (Liturgia Eucarística)

```json
{
  "id": "accion-de-gracias",
  "title": "Acción de Gracias",
  "type": "eucaristia",
  "slides": [
    {
      "type": "title",
      "content": "ACCIÓN DE\nGRACIAS"
    },
    {
      "type": "liturgy-antiphonal",
      "leader": "El Señor está aquí",
      "response": "Su espíritu está con nosotros."
    },
    {
      "type": "liturgy-antiphonal",
      "leader": "Elevemos los corazones",
      "response": "Los elevamos al Señor."
    },
    {
      "type": "liturgy-antiphonal",
      "leader": "Demos gracias al Señor, nuestro Dios",
      "response": "Es justo darle gracias y alabanzas."
    },
    {
      "type": "liturgy-leader",
      "content": "En verdad es digno y justo darte\ngracias en todo tiempo y lugar"
    },
    {
      "type": "liturgy-leader",
      "content": "Padre omnipotente,\ncreador del cielo y tierra,\nmediante Jesucristo,\ntu único hijo."
    },
    {
      "type": "liturgy-leader",
      "content": "Por tanto, te alabamos uniendo\nnuestras voces con todos quienes\nhan venido antes que nosotros"
    },
    {
      "type": "liturgy-leader",
      "content": "y proclamando la gloria de tu nombre,\npor siempre cantamos este himno:"
    },
    {
      "type": "prayer-congregational",
      "content": "Santo es el nombre de Cristo\nen quien tenemos esperanza"
    },
    {
      "type": "prayer-congregational",
      "content": "venimos a su mesa a\ncompartir de su vida plena"
    },
    {
      "type": "title",
      "content": "SANTA\nCENA"
    }
  ]
}
```

### 5. Ofrenda

```json
{
  "id": "ofrenda",
  "title": "Ofrenda",
  "type": "ofrenda",
  "slides": [
    {
      "type": "title",
      "content": "OFRENDA"
    },
    {
      "type": "scripture",
      "content": "Cada uno debe dar según lo que haya\ndecidido en su corazón, no de mala\ngana ni por obligación, porque Dios\nama al que da con alegría.",
      "reference": "2 Corintios 9:7"
    },
    {
      "type": "info",
      "content": "Corporación Anglicana de Chile\nRut: 70.043.500-8\nBanco Santander\nCuenta: 73922194\nmail: eriffocontreras@gmail.com"
    }
  ]
}
```

### 6. Bendición Final

```json
{
  "id": "bendicion-final",
  "title": "Bendición Final",
  "type": "bendicion",
  "slides": [
    {
      "type": "title",
      "content": "BENDICIÓN\nFINAL"
    },
    {
      "type": "liturgy-leader",
      "content": "Salgamos al mundo en paz;\ntengamos buen ánimo;"
    },
    {
      "type": "liturgy-leader",
      "content": "retengamos firmemente lo bueno\nno paguemos a nadie mal por mal;"
    },
    {
      "type": "liturgy-leader",
      "content": "fortalezcamos a los desanimados;\nsostengamos a los débiles;"
    },
    {
      "type": "liturgy-leader",
      "content": "ayudemos a los afligidos;\nhonremos a todas y todos;"
    },
    {
      "type": "liturgy-leader",
      "content": "Amemos y sirvamos al Señor,\nregocijándonos en el poder del\nEspíritu Santo;"
    },
    {
      "type": "liturgy-leader",
      "content": "y la bendición de Dios,\nel Padre, el Hijo y el Espíritu Santo,"
    },
    {
      "type": "liturgy-leader",
      "content": "sea sobre nosotros y viva con\nnosotros por siempre, Amén"
    },
    {
      "type": "liturgy-antiphonal",
      "leader": "Salgamos con gozo\nen el poder del Espíritu.",
      "response": "¡Gloria a Dios!\nBendito para siempre."
    },
    {
      "type": "liturgy-antiphonal",
      "leader": "Amigos, amigas…\nvamos a servir al Señor con alegría.",
      "response": "Amén. Serviremos al\nSeñor con alegría."
    },
    {
      "type": "closing",
      "content": "¡¡Aleluya!!"
    }
  ]
}
```

---

## Interfaces TypeScript

```typescript
// types/fixed-elements.ts

/**
 * Tipos de slides para elementos fijos
 */
type FixedSlideType = 
  | 'title'                  // Título de sección
  | 'liturgy-leader'         // Texto que lee el líder
  | 'liturgy-response'       // Respuesta de la congregación (sola)
  | 'liturgy-antiphonal'     // Líder + respuesta en mismo slide
  | 'prayer-congregational'  // Oración que dice toda la congregación
  | 'scripture'              // Cita bíblica
  | 'info'                   // Información (datos bancarios, etc.)
  | 'instruction'            // Instrucción (momento de la paz, etc.)
  | 'closing';               // Cierre (Aleluya, Amén final)

/**
 * Slide de elemento fijo
 */
interface FixedSlide {
  type: FixedSlideType;
  content?: string;          // Texto principal
  leader?: string;           // Texto del líder (para antiphonal)
  response?: string;         // Respuesta congregación (para antiphonal)
  reference?: string;        // Referencia bíblica (para scripture)
  note?: string;             // Nota adicional
}

/**
 * Elemento fijo completo
 */
interface FixedElement {
  id: string;
  title: string;
  type: 'paz' | 'oracion-comunitaria' | 'comunion' | 'eucaristia' | 'ofrenda' | 'bendicion';
  slides: FixedSlide[];
  metadata?: {
    editable?: boolean;      // Si el usuario puede editar el texto
    variations?: string[];   // IDs de variaciones alternativas
  };
}

/**
 * Colección de elementos fijos
 */
interface FixedElementsCollection {
  version: string;
  lastUpdated: string;
  elements: FixedElement[];
}
```

---

## Diseño Visual de Slides (Brand Kit)

### Slide de Título de Sección

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│              ────●────                      │
│                                             │
│              LA PAZ                         │  ← Merriweather Light, 48px
│                                             │  ← #1A1A1A, centrado
│              ────●────                      │
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

### Slide de Texto del Líder

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│       Cristo es nuestra paz.                │  ← Montserrat Regular, 28px
│       Mediante su cruz nos ha               │  ← #1A1A1A, centrado
│       reconciliado con Dios en              │  ← Line-height: 1.8
│       un solo cuerpo.                       │
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

### Slide de Respuesta de la Congregación

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│                                             │
│         ¡Y también contigo!                 │  ← Montserrat SemiBold, 32px
│                                             │  ← #D4A853 (ámbar), centrado
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

### Slide Antifonal (Líder + Respuesta)

```
┌─────────────────────────────────────────────┐
│                                             │
│       El Señor está aquí                    │  ← Montserrat Regular, 24px
│                                             │  ← #1A1A1A
│              ────●────                      │
│                                             │
│       Su espíritu está con                  │  ← Montserrat SemiBold, 28px
│       nosotros.                             │  ← #D4A853 (ámbar)
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

### Slide de Oración Congregacional

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│       Padre nuestro,                        │  ← Montserrat Regular, 28px
│       que estás en los cielos.              │  ← #333333 (carbón)
│       Santificado sea tu nombre;            │  ← Centrado
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

### Slide de Información (Ofrenda)

```
┌─────────────────────────────────────────────┐
│                                             │
│       Corporación Anglicana de Chile        │  ← Montserrat Regular, 20px
│       Rut: 70.043.500-8                     │  ← #555555 (gris oscuro)
│       Banco Santander                       │  ← Centrado
│       Cuenta: 73922194                      │
│       mail: eriffocontreras@gmail.com       │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Estructura de Archivos

```
/elementos-fijos/
├── data/
│   ├── index.json                    # Índice de todos los elementos
│   ├── la-paz.json
│   ├── padre-nuestro.json
│   ├── santa-cena.json
│   ├── accion-de-gracias.json
│   ├── ofrenda.json
│   └── bendicion-final.json
├── components/
│   ├── FixedElementsList.tsx         # Lista de elementos disponibles
│   ├── FixedElementViewer.tsx        # Visualizador de un elemento
│   ├── FixedElementSlide.tsx         # Slide individual
│   ├── FixedElementEditor.tsx        # Editor (para variaciones)
│   └── AntiphonalSlide.tsx           # Slide especial líder+respuesta
├── lib/
│   ├── fixedElementToSlides.ts       # Convierte a SlideGroup
│   └── fixedElementsStorage.ts       # Almacenamiento
└── types/
    └── fixed-elements.ts             # Interfaces TypeScript
```

---

## Conversión a SlideGroup (Arquitectura Compartida)

```typescript
// lib/fixedElementToSlides.ts

import { Slide, SlideGroup } from '@/types/shared/slide';
import { FixedElement, FixedSlide } from '@/types/fixed-elements';
import { CASA_BRAND } from '@/lib/brand-kit';

function fixedSlideToSlide(
  fixedSlide: FixedSlide, 
  elementId: string,
  order: number,
  total: number
): Slide {
  const baseSlide: Slide = {
    id: generateId(),
    type: mapFixedTypeToSlideType(fixedSlide.type),
    content: {
      primary: '',
    },
    style: {
      primaryColor: CASA_BRAND.colors.primary.black,
      backgroundColor: CASA_BRAND.colors.primary.white,
      primaryFont: CASA_BRAND.fonts.body,
    },
    metadata: {
      sourceComponent: 'elementos-fijos',
      sourceId: elementId,
      order,
      groupTotal: total,
    },
  };

  switch (fixedSlide.type) {
    case 'title':
      return {
        ...baseSlide,
        type: 'title',
        content: { primary: fixedSlide.content || '' },
        style: {
          ...baseSlide.style,
          primaryFont: CASA_BRAND.fonts.heading,
        },
      };

    case 'liturgy-leader':
      return {
        ...baseSlide,
        type: 'prayer-leader',
        content: { primary: fixedSlide.content || '' },
      };

    case 'liturgy-response':
      return {
        ...baseSlide,
        type: 'prayer-response',
        content: { primary: fixedSlide.content || '' },
        style: {
          ...baseSlide.style,
          primaryColor: CASA_BRAND.colors.primary.amber,
        },
      };

    case 'liturgy-antiphonal':
      return {
        ...baseSlide,
        type: 'prayer-full',
        content: {
          primary: fixedSlide.leader || '',
          secondary: fixedSlide.response || '',
        },
        style: {
          ...baseSlide.style,
          secondaryColor: CASA_BRAND.colors.primary.amber,
          secondaryFont: CASA_BRAND.fonts.body,
        },
      };

    case 'prayer-congregational':
      return {
        ...baseSlide,
        type: 'prayer-response',
        content: { primary: fixedSlide.content || '' },
        style: {
          ...baseSlide.style,
          primaryColor: CASA_BRAND.colors.secondary.carbon,
        },
      };

    case 'scripture':
      return {
        ...baseSlide,
        type: 'reading',
        content: {
          primary: fixedSlide.content || '',
          subtitle: fixedSlide.reference,
        },
      };

    default:
      return {
        ...baseSlide,
        content: { primary: fixedSlide.content || '' },
      };
  }
}

export function fixedElementToSlides(element: FixedElement): SlideGroup {
  const slides = element.slides.map((slide, index) =>
    fixedSlideToSlide(slide, element.id, index + 1, element.slides.length)
  );

  return {
    id: generateId(),
    type: 'prayer', // O el tipo que corresponda
    title: element.title,
    slides,
    metadata: {
      sourceComponent: 'elementos-fijos',
      createdAt: new Date().toISOString(),
    },
  };
}
```

---

## Funcionalidades del Módulo

### 1. Visualización de Elementos

- Lista de todos los elementos fijos disponibles
- Vista previa de cada elemento con todos sus slides
- Navegación entre slides

### 2. Selección para Liturgia

- Checkbox o botón para agregar a la liturgia actual
- Drag & drop para reordenar en el compositor

### 3. Edición (Opcional/Futuro)

- Permitir crear variaciones de los textos
- Ej: Bendición alternativa para fechas especiales
- Guardar variaciones como elementos separados

---

## Comando Inicial para Claude Code

```
Crea el módulo de Elementos Fijos para el sistema de liturgias CASA.

Este módulo contiene los textos litúrgicos que NO cambian cada domingo:
1. La Paz
2. Padre Nuestro
3. Santa Cena (oración de humildad)
4. Acción de Gracias (liturgia eucarística)
5. Ofrenda
6. Bendición Final

Tareas:
1. Crear archivos JSON para cada elemento con sus slides
2. Crear los tipos TypeScript (FixedElement, FixedSlide, etc.)
3. Implementar fixedElementToSlides() para convertir al formato SlideGroup compartido
4. Crear componentes React para visualización:
   - FixedElementsList.tsx
   - FixedElementViewer.tsx
   - FixedElementSlide.tsx
   - AntiphonalSlide.tsx (para slides con líder + respuesta)

Diseño de slides según Brand Kit:
- Títulos: Merriweather Light, 48px, #1A1A1A
- Texto líder: Montserrat Regular, 28px, #1A1A1A
- Respuesta congregación: Montserrat SemiBold, 28-32px, #D4A853 (ámbar)
- Oración congregacional: Montserrat Regular, 28px, #333333
- Fondo: #F7F7F7
- Formato: 4:3 (1024x768)

Los slides antifonales (líder + respuesta) deben mostrar ambos textos:
- Texto del líder arriba en negro
- Separador con punto ámbar
- Respuesta abajo en ámbar

Usa las interfaces de CASA_Liturgy_System_Architecture.md para compatibilidad con otros módulos.
```

---

## Integración con el Compositor de Liturgias

Cuando el usuario está armando una liturgia en el compositor:

1. Ve la lista de elementos fijos en la biblioteca
2. Hace clic en "La Paz" → se agrega al orden de la liturgia
3. El elemento trae todos sus slides pre-configurados
4. Puede reordenarlo con drag & drop
5. Al exportar, los slides se incluyen en la presentación final

```typescript
// En el compositor
const addFixedElement = (elementId: string) => {
  const element = getFixedElement(elementId);
  const slideGroup = fixedElementToSlides(element);
  
  addToLiturgy({
    id: generateId(),
    type: element.type,
    order: getNextOrder(),
    slideGroup,
  });
};
```
