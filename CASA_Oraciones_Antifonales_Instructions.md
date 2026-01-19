# Instrucciones para Claude Code: Componente de Oraciones Antifonales CASA

## Resumen del Proyecto

Crear un componente React para generar oraciones antifonales para las liturgias dominicales de la Comunidad Anglicana San Andrés (CASA). El componente debe conectarse a la API de Claude usando el modelo Opus 4.5 para generar los textos, permitir edición por el usuario, y finalmente exportar slides en formato 4:3.

---

## Especificaciones Técnicas

### Stack Tecnológico
- **Framework**: Next.js con React
- **API**: Anthropic API (modelo `claude-opus-4-5-20251101`)
- **Estilizado**: Tailwind CSS siguiendo el Brand Kit de CASA
- **Exportación de slides**: html2canvas o similar para generar imágenes 4:3

### Brand Kit de CASA - Colores
```css
/* Colores Primarios */
--negro-principal: #1A1A1A;
--ambar-acento: #D4A853;
--blanco-calido: #F7F7F7;

/* Colores Secundarios */
--carbon: #333333;
--gris-oscuro: #555555;
--gris-medio: #8A8A8A;
--gris-claro: #E5E5E5;

/* Variaciones del Ámbar */
--ambar-claro: #E8C97A;
--ambar-oscuro: #B8923D;
```

### Brand Kit de CASA - Tipografía
```css
/* Títulos */
font-family: 'Merriweather', serif;
font-weight: 300; /* Light */

/* Cuerpo de texto */
font-family: 'Montserrat', sans-serif;
font-weight: 400; /* Regular */

/* Tamaño base: 14-16px */
/* Peso ligero con tracking amplio */
```

---

## Estructura del Componente

### 1. Formulario de Entrada

El usuario debe completar los siguientes campos antes de generar las oraciones:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| Fecha de liturgia | Date picker | Selector de fecha para el domingo |
| Título de liturgia | Input text | El título/tema de la reflexión |
| Resumen de liturgia | Textarea | Breve descripción del enfoque temático |
| Lecturas bíblicas | Input text (múltiple) | Citas bíblicas (ej: "Juan 3:16-21") |

### 2. Búsqueda de Lecturas Bíblicas

- El sistema debe buscar las citas bíblicas en la versión **NBI (Nueva Biblia al Día)** o **NVI (Nueva Versión Internacional)** como alternativa
- Usar una API de Biblia o tener los textos almacenados localmente
- Mostrar el texto completo de las lecturas para contexto

### 3. Generación de Oraciones

Estructura de cada oración antifonal:

```
ORACIÓN (Invocación/Arrepentimiento/Gratitud)
├── Tiempo 1
│   ├── Líder: [texto extenso]
│   └── Congregación: [respuesta corta]
├── Tiempo 2
│   ├── Líder: [texto extenso]
│   └── Congregación: [respuesta corta]
├── Tiempo 3
│   ├── Líder: [texto extenso]
│   └── Congregación: [respuesta corta]
└── Tiempo 4
    ├── Líder: [texto extenso]
    └── Congregación: [respuesta corta]
```

### 4. Editor de Textos

- Cada sección debe ser editable inline
- Distinguir visualmente entre texto del líder (negro) y congregación (ámbar)
- Botón para regenerar una oración específica
- Botón para aprobar/confirmar cada oración

### 5. Generación de Slides

Una vez aprobados los textos, generar slides con estas especificaciones:

- **Formato**: 4:3 (1024x768 px recomendado)
- **Fondo**: Blanco cálido (#F7F7F7)
- **Texto del líder**: Negro principal (#1A1A1A)
- **Texto de congregación**: Ámbar acento (#D4A853)
- **Tipografía**: Merriweather para títulos, Montserrat para cuerpo
- **Elementos decorativos**: Separadores con punto ámbar según Brand Kit

---

## Prompt del Sistema para Claude API

```
Eres un asistente litúrgico especializado en escribir oraciones antifonales para la Comunidad Anglicana San Andrés (CASA), una comunidad cristiana progresista e inclusiva en Santiago, Chile.

## Contexto de CASA
CASA es una comunidad abierta, inspirada en Jesús, donde cada persona es vista y celebrada en su singularidad. Los valores fundamentales son: inclusión, amor incondicional, esperanza, comunidad y evolución teológica ("una teología con puntos suspensivos, siempre en conversación").

## Tu Tarea
Escribir oraciones antifonales para la liturgia dominical basándote en:
- La lectura bíblica proporcionada
- El título y tema de la reflexión
- El resumen de la liturgia

## Estructura Requerida
Debes escribir TRES oraciones antifonales:
1. **Invocación**: Llamado inicial a la presencia de Dios
2. **Arrepentimiento**: Reconocimiento de nuestras limitaciones y necesidad de gracia
3. **Gratitud**: Acción de gracias y celebración

Cada oración tiene CUATRO tiempos. Cada tiempo incluye:
- **Líder**: Texto más extenso (2-4 oraciones), poético y reflexivo
- **Congregación**: Respuesta corta (1 frase breve), fácil de leer al unísono

## Estilo de Escritura
- Tono cálido, inclusivo y esperanzador
- Evitar lenguaje religioso excluyente o jerga compleja
- Usar lenguaje accesible que invite a la reflexión
- Incorporar imágenes y metáforas de la lectura bíblica
- Las respuestas de la congregación deben ser rítmicas y memorables
- Evitar lenguaje patriarcal exclusivo (usar "Dios" en lugar de solo pronombres masculinos)

## Formato de Respuesta
Responde en JSON con esta estructura:
{
  "invocacion": {
    "titulo": "Invocación",
    "tiempos": [
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."}
    ]
  },
  "arrepentimiento": {
    "titulo": "Arrepentimiento",
    "tiempos": [
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."}
    ]
  },
  "gratitud": {
    "titulo": "Gratitud",
    "tiempos": [
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."},
      {"lider": "...", "congregacion": "..."}
    ]
  }
}
```

---

## Estructura de Archivos Sugerida

```
/components
  /liturgia
    /oraciones-antifonales
      ├── OracionesForm.tsx        # Formulario de entrada
      ├── OracionEditor.tsx        # Editor de oraciones generadas
      ├── TiempoEditor.tsx         # Editor de cada tiempo individual
      ├── SlidePreview.tsx         # Vista previa de slides
      ├── SlideGenerator.tsx       # Generador de imágenes de slides
      ├── BibleFetcher.tsx         # Componente para buscar lecturas
      └── index.tsx                # Componente principal
    /shared
      ├── constants.ts             # Colores, fuentes del Brand Kit
      └── types.ts                 # TypeScript interfaces
/lib
  └── claude-api.ts                # Configuración de la API de Claude
/app
  /api
    /generate-oraciones
      └── route.ts                 # API route para llamar a Claude
```

---

## Interfaces TypeScript

```typescript
interface Tiempo {
  lider: string;
  congregacion: string;
}

interface Oracion {
  titulo: string;
  tiempos: Tiempo[];
}

interface OracionesAntifonales {
  invocacion: Oracion;
  arrepentimiento: Oracion;
  gratitud: Oracion;
}

interface LiturgiaInput {
  fecha: Date;
  titulo: string;
  resumen: string;
  lecturas: string[]; // Citas bíblicas
  textoLecturas?: string[]; // Textos completos de las lecturas
}

interface SlideData {
  tipo: 'invocacion' | 'arrepentimiento' | 'gratitud';
  tiempoNumero: number;
  lider: string;
  congregacion: string;
}
```

---

## Diseño de Slides

### Layout de cada slide (4:3)

```
┌─────────────────────────────────────────────┐
│                                             │
│         [Título de la Oración]              │  ← Merriweather Light, #1A1A1A
│              ────●────                      │  ← Separador con punto ámbar
│                                             │
│  "Texto del líder que es más extenso       │  ← Montserrat, #1A1A1A
│   y puede ocupar varias líneas,            │
│   reflexivo y poético."                    │
│                                             │
│              ────●────                      │
│                                             │
│       Respuesta de la congregación          │  ← Montserrat SemiBold, #D4A853
│                                             │
│                                    [1/4]    │  ← Indicador de tiempo
└─────────────────────────────────────────────┘
```

### Especificaciones visuales
- Padding: 48-64px en todos los lados
- Título: 28-32px, centrado
- Texto líder: 20-24px, centrado o justificado
- Texto congregación: 22-26px, centrado, negrita
- Separadores: línea fina #E5E5E5 con punto #D4A853 al centro
- Border radius general: 0 (slides cuadrados)

---

## Flujo de Usuario

1. **Entrada de datos**: Usuario completa formulario con fecha, título, resumen y citas bíblicas
2. **Búsqueda de lecturas**: Sistema obtiene el texto de las lecturas bíblicas
3. **Generación**: Usuario hace clic en "Generar Oraciones" → llamada a Claude API
4. **Revisión**: Se muestran las tres oraciones con opción de editar cada campo
5. **Edición**: Usuario puede modificar cualquier texto inline
6. **Regeneración**: Opción de regenerar una oración específica manteniendo las otras
7. **Aprobación**: Usuario aprueba cada oración individualmente
8. **Exportación**: Una vez aprobadas todas, generar slides en formato 4:3
9. **Descarga**: Opción de descargar slides como imágenes PNG o como componente para integrar en la presentación mayor

---

## Consideraciones Adicionales

### Manejo de errores
- Validar que todos los campos estén completos antes de generar
- Manejar errores de la API de Claude gracefully
- Fallback si no se encuentra la lectura bíblica

### Accesibilidad
- Labels claros en todos los inputs
- Contraste adecuado según Brand Kit
- Navegación por teclado

### Persistencia (opcional)
- Guardar borradores en localStorage
- Opción de guardar liturgias completadas para referencia futura

### Integración futura
- Este componente será parte de un sistema mayor de generación de liturgias
- Los slides generados deben poder integrarse con otros componentes de la presentación
- Considerar exportación en formato compatible con software de presentaciones (Google Slides, PowerPoint)

---

## Comando Inicial para Claude Code

```
Crea un componente React/Next.js para generar oraciones antifonales para liturgias. El componente debe:

1. Tener un formulario con: selector de fecha, título de liturgia, resumen, y campo para citas bíblicas
2. Conectarse a la API de Claude (modelo claude-opus-4-5-20251101) para generar las oraciones
3. Permitir edición inline de los textos generados
4. Generar slides en formato 4:3 siguiendo el Brand Kit de CASA

Usa estos colores:
- Negro principal: #1A1A1A
- Ámbar acento: #D4A853  
- Blanco cálido: #F7F7F7

Tipografías:
- Títulos: Merriweather Light
- Cuerpo: Montserrat Regular

En los slides, el texto del líder va en negro y la respuesta de la congregación en ámbar.

Revisa el archivo CASA_Oraciones_Antifonales_Instructions.md para las especificaciones completas del sistema prompt y la estructura de datos.
```
