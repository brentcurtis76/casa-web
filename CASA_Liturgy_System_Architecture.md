# Arquitectura del Sistema de Liturgias CASA

## Visión General

Sistema integrado para crear liturgias dominicales completas para la Comunidad Anglicana San Andrés (CASA). El **Constructor de Liturgias** guía al usuario paso a paso desde la definición del tema hasta la generación de la presentación final.

---

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONSTRUCTOR DE LITURGIAS                              │
│                         (Flujo Paso a Paso)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PASO 0: DEFINICIÓN DE LA LITURGIA (Contexto Transversal)           │   │
│  │  • Fecha           • Título          • Lecturas        • Resumen    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────────┐        │
│         ▼                          ▼                              ▼        │
│  ┌─────────────┐  ┌─────────────────────────┐  ┌─────────────────────┐    │
│  │  PORTADAS   │  │  ORACIONES ANTIFONALES  │  │  LECTURA BÍBLICA    │    │
│  │  • Principal│  │  • Invocación           │  │  • Slides del texto │    │
│  │  • Reflexión│  │  • Arrepentimiento      │  │                     │    │
│  │             │  │  • Gratitud             │  │                     │    │
│  └─────────────┘  └─────────────────────────┘  └─────────────────────┘    │
│         │                          │                              │        │
│         └──────────────────────────┼──────────────────────────────┘        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CUENTACUENTOS (Opcional)                                           │   │
│  │  Claude API + Nano Banana Pro • 12-14 escenas • 14 estilos visuales │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SELECTOR DE CANCIONES                                              │   │
│  │  • Recomendaciones por tema, tempo e historial                      │   │
│  │  • 4 posiciones: Rápida → Intermedia → Lenta → Lenta                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ANUNCIOS                                                           │   │
│  │  • Crear nuevos o seleccionar de biblioteca                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ELEMENTOS FIJOS (se agregan automáticamente)                       │   │
│  │  Padre Nuestro • La Paz • Santa Cena • Acción de Gracias           │   │
│  │  Ofrenda • Bendición Final                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ORDENAR Y EXPORTAR                                                 │   │
│  │  • Drag & drop para ajustar orden                                   │   │
│  │  • Vista previa completa                                            │   │
│  │  • Exportar: PPTX / PDF / Google Slides                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Contexto de Liturgia (Datos Transversales)

Estos datos se definen al inicio y se comparten con todos los módulos generadores.

```typescript
// types/liturgy-context.ts

interface LiturgyContext {
  id: string;
  date: string;                    // Fecha del domingo (ISO)
  title: string;                   // Título/tema de la liturgia
  readings: BiblicalReading[];     // Lecturas bíblicas
  summary: string;                 // Resumen/descripción del tema
  preacher: string;                // Nombre del predicador
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    status: 'draft' | 'in-progress' | 'ready' | 'archived';
  };
}

interface BiblicalReading {
  citation: string;                // Ej: "Juan 14:1-6"
  text?: string;                   // Texto completo (se busca automáticamente)
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
}
```

### Formulario de Definición de Liturgia

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NUEVA LITURGIA                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Fecha del domingo *                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 📅 12 de Enero, 2025                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Título de la liturgia *                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ El camino de la esperanza                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Lecturas bíblicas *                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Juan 14:1-6                                                    [x]  │   │
│  │ Efesios 1:15-19                                                [x]  │   │
│  │ [+ Agregar lectura]                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Resumen / Descripción del tema *                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Reflexión sobre la confianza en Dios en tiempos de incertidumbre.  │   │
│  │ Jesús como el camino que nos guía. La esperanza como ancla del     │   │
│  │ alma en medio de las tormentas de la vida.                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Predicador *                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Brent González                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                              [Comenzar a crear liturgia →] │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Orden Estándar de la Liturgia

```typescript
const STANDARD_LITURGY_ORDER = [
  { order: 1,  type: 'cover-main',        label: 'Portada Principal',    source: 'generator' },
  { order: 2,  type: 'prayer-invocation', label: 'Invocación',           source: 'generator' },
  { order: 3,  type: 'song',              label: 'Canción 1',            source: 'selector', tempo: 'rápida' },
  { order: 4,  type: 'prayer-repentance', label: 'Arrepentimiento',      source: 'generator' },
  { order: 5,  type: 'song',              label: 'Canción 2',            source: 'selector', tempo: 'intermedia' },
  { order: 6,  type: 'prayer-gratitude',  label: 'Gratitud',             source: 'generator' },
  { order: 7,  type: 'song',              label: 'Canción 3',            source: 'selector', tempo: 'lenta' },
  { order: 8,  type: 'reading',           label: 'Lectura Bíblica',      source: 'generator' },
  { order: 9,  type: 'story',             label: 'Cuentacuentos',        source: 'generator', optional: true },
  { order: 10, type: 'cover-reflection',  label: 'Portada Reflexión',    source: 'generator' },
  { order: 11, type: 'our-father',        label: 'Padre Nuestro',        source: 'fixed' },
  { order: 12, type: 'peace',             label: 'La Paz',               source: 'fixed' },
  { order: 13, type: 'communion',         label: 'Santa Cena',           source: 'fixed' },
  { order: 14, type: 'thanksgiving',      label: 'Acción de Gracias',    source: 'fixed' },
  { order: 15, type: 'song',              label: 'Canción 4',            source: 'selector', tempo: 'lenta' },
  { order: 16, type: 'offering',          label: 'Ofrenda',              source: 'fixed' },
  { order: 17, type: 'announcements',     label: 'Anuncios',             source: 'generator' },
  { order: 18, type: 'blessing',          label: 'Bendición Final',      source: 'fixed' },
];
```

---

## Flujo del Constructor de Liturgias

### Paso 0: Definición de la Liturgia
- Usuario ingresa fecha, título, lecturas y resumen
- Sistema busca automáticamente el texto de las lecturas (API Biblia)
- Este contexto se usa en todos los pasos siguientes

### Paso 1: Generar Portadas
- **Portada Principal**: Título de la liturgia + fecha + imagen
- **Portada Reflexión**: Título de la reflexión (puede ser igual o diferente)

### Paso 2: Generar Oraciones Antifonales
- Sistema genera Invocación, Arrepentimiento y Gratitud usando Claude API
- Usuario puede aprobar, editar o regenerar

### Paso 3: Generar Slides de Lectura Bíblica
- Sistema crea slides con el texto de las lecturas
- Formato apropiado para proyección (no demasiado texto por slide)

### Paso 4: Generar Cuentacuentos (Opcional)
- Usuario configura lugar, personajes, estilo
- Sistema genera cuento + imágenes

### Paso 5: Seleccionar Canciones
- Sistema recomienda canciones basadas en:
  - Temática de la liturgia (tags)
  - Tempo sugerido para cada posición
  - Historial de uso (evitar repetición)
- Usuario puede aceptar recomendaciones o elegir otras

### Paso 6: Generar/Seleccionar Anuncios
- Crear nuevos anuncios o seleccionar de una biblioteca
- Típicamente: eventos de la semana, cumpleaños, información importante

### Paso 7: Ordenar y Exportar
- Vista previa de todos los elementos en orden
- Drag & drop para ajustar orden si es necesario
- Exportar presentación final

---

## Sistema de Canciones con Tags

### Estructura de Canción con Tags

```typescript
interface Song {
  id: string;
  number: number;
  title: string;
  artist?: string;
  slug: string;
  verses: Verse[];
  tags: SongTags;
  usageHistory: SongUsage[];
  metadata: SongMetadata;
}

interface SongTags {
  // Temáticos
  themes: string[];           // ['esperanza', 'alabanza', 'Espíritu Santo', 'amor de Dios']
  
  // Tempo/Ritmo
  tempo: 'rápida' | 'intermedia' | 'lenta';
  
  // Momento litúrgico sugerido
  suggestedMoments: LiturgySongMoment[];
  
  // Época del año (opcional)
  season?: ('adviento' | 'navidad' | 'cuaresma' | 'pascua' | 'pentecostés' | 'ordinario')[];
  
  // Características adicionales
  characteristics?: ('contemplativa' | 'celebrativa' | 'meditativa' | 'procesional')[];
}

type LiturgySongMoment = 
  | 'entrada'               // Canción 1 - típicamente rápida
  | 'post-arrepentimiento'  // Canción 2 - intermedia
  | 'post-gratitud'         // Canción 3 - lenta
  | 'comunión'              // Canción 4 - lenta
  | 'salida'                // Opcional - puede ser rápida o lenta
  | 'cualquiera';           // Flexible

interface SongUsage {
  liturgyId: string;
  liturgyDate: string;
  position: number;          // En qué posición se usó (1, 2, 3, 4)
  moment: LiturgySongMoment;
}
```

### Ejemplo de Canción con Tags

```json
{
  "id": "01-el-espiritu",
  "title": "El Espíritu",
  "tags": {
    "themes": ["Espíritu Santo", "celebración", "comunidad", "fuego"],
    "tempo": "rápida",
    "suggestedMoments": ["entrada", "salida"],
    "season": ["pentecostés"],
    "characteristics": ["celebrativa"]
  },
  "usageHistory": [
    {
      "liturgyId": "2024-12-15",
      "liturgyDate": "2024-12-15",
      "position": 1,
      "moment": "entrada"
    }
  ]
}
```

### Motor de Recomendación de Canciones

```typescript
interface SongRecommendation {
  song: Song;
  score: number;
  reasons: string[];
  lastUsed: string | null;        // Fecha de último uso o null si nunca
  daysSinceLastUse: number | null;
}

interface RecommendationRequest {
  liturgyContext: LiturgyContext;
  position: number;               // 1, 2, 3, o 4
  suggestedTempo: 'rápida' | 'intermedia' | 'lenta';
  excludeSongIds?: string[];      // Canciones ya seleccionadas para esta liturgia
}

function recommendSongs(request: RecommendationRequest): SongRecommendation[] {
  const allSongs = getAllSongs();
  const recommendations: SongRecommendation[] = [];
  
  for (const song of allSongs) {
    let score = 0;
    const reasons: string[] = [];
    
    // 1. Coincidencia de tempo (peso alto)
    if (song.tags.tempo === request.suggestedTempo) {
      score += 30;
      reasons.push(`Tempo ${request.suggestedTempo} coincide`);
    }
    
    // 2. Coincidencia temática con la liturgia
    const themeMatches = findThemeMatches(
      song.tags.themes, 
      request.liturgyContext
    );
    score += themeMatches.length * 15;
    if (themeMatches.length > 0) {
      reasons.push(`Temas relacionados: ${themeMatches.join(', ')}`);
    }
    
    // 3. Momento litúrgico sugerido
    const moment = positionToMoment(request.position);
    if (song.tags.suggestedMoments.includes(moment)) {
      score += 20;
      reasons.push(`Sugerida para ${moment}`);
    }
    
    // 4. Historial de uso (penalizar uso reciente)
    const lastUsage = getLastUsage(song);
    const daysSinceLastUse = lastUsage 
      ? daysBetween(lastUsage.liturgyDate, new Date()) 
      : null;
    
    if (daysSinceLastUse === null) {
      score += 10;
      reasons.push('Nunca usada');
    } else if (daysSinceLastUse > 60) {
      score += 15;
      reasons.push(`Última vez: hace ${daysSinceLastUse} días`);
    } else if (daysSinceLastUse > 30) {
      score += 5;
      reasons.push(`Última vez: hace ${daysSinceLastUse} días`);
    } else if (daysSinceLastUse < 14) {
      score -= 20;
      reasons.push(`⚠️ Usada hace solo ${daysSinceLastUse} días`);
    }
    
    // 5. No repetir en la misma liturgia
    if (request.excludeSongIds?.includes(song.id)) {
      continue; // Saltar esta canción
    }
    
    recommendations.push({
      song,
      score,
      reasons,
      lastUsed: lastUsage?.liturgyDate || null,
      daysSinceLastUse
    });
  }
  
  // Ordenar por score descendente
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Top 10 recomendaciones
}

function positionToMoment(position: number): LiturgySongMoment {
  switch (position) {
    case 1: return 'entrada';
    case 2: return 'post-arrepentimiento';
    case 3: return 'post-gratitud';
    case 4: return 'comunión';
    default: return 'cualquiera';
  }
}
```

### UI del Selector de Canciones

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SELECCIONAR CANCIONES                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CANCIÓN 1 - Entrada (sugerido: rápida)                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Recomendadas:                                                       │   │
│  │                                                                     │   │
│  │ ⭐ El Espíritu (92 pts)                              Última: 45 días │   │
│  │    Rápida • Celebrativa • Temas: Espíritu Santo                     │   │
│  │    [Seleccionar]  [Vista previa]                                    │   │
│  │                                                                     │   │
│  │ ⭐ Canta la esperanza (87 pts)                       Última: 60 días │   │
│  │    Rápida • Celebrativa • Temas: esperanza, alegría                 │   │
│  │    [Seleccionar]  [Vista previa]                                    │   │
│  │                                                                     │   │
│  │ ⭐ Vamos celebrando (78 pts)                         Última: nunca   │   │
│  │    Rápida • Procesional • Temas: celebración                        │   │
│  │    [Seleccionar]  [Vista previa]                                    │   │
│  │                                                                     │   │
│  │ [Ver todas las canciones]  [Buscar por nombre]                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ✅ Seleccionada: El Espíritu                            [Cambiar]         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CANCIÓN 2 - Post-arrepentimiento (sugerido: intermedia)                    │
│  ...                                                                        │
│                                                                             │
│  CANCIÓN 3 - Post-gratitud (sugerido: lenta)                                │
│  ...                                                                        │
│                                                                             │
│  CANCIÓN 4 - Comunión (sugerido: lenta)                                     │
│  ...                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Interfaz del Constructor de Liturgias

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONSTRUCTOR DE LITURGIAS                                                   │
│  12 de Enero, 2025 - El camino de la esperanza                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Progreso: ████████░░░░░░░░ 45%                                             │
│                                                                             │
│  ┌─────┬──────────────────────┬────────────────────────────────┐           │
│  │ ✅  │ 0. Definición        │ Completado                     │           │
│  ├─────┼──────────────────────┼────────────────────────────────┤           │
│  │ ✅  │ 1. Portadas          │ Completado                     │           │
│  ├─────┼──────────────────────┼────────────────────────────────┤           │
│  │ ✅  │ 2. Oraciones         │ Completado                     │           │
│  ├─────┼──────────────────────┼────────────────────────────────┤           │
│  │ ✅  │ 3. Lectura Bíblica   │ Completado                     │           │
│  ├─────┼──────────────────────┼────────────────────────────────┤           │
│  │ 🔄  │ 4. Cuentacuentos     │ En progreso - Generando imgs   │  [Ir →]  │
│  ├─────┼──────────────────────┼────────────────────────────────┤           │
│  │ ⏳  │ 5. Canciones         │ Pendiente                      │           │
│  ├─────┼──────────────────────┼────────────────────────────────┤           │
│  │ ⏳  │ 6. Anuncios          │ Pendiente                      │           │
│  ├─────┼──────────────────────┼────────────────────────────────┤           │
│  │ ⏳  │ 7. Ordenar y Exportar│ Pendiente                      │           │
│  └─────┴──────────────────────┴────────────────────────────────┘           │
│                                                                             │
│  Elementos fijos: Se agregarán automáticamente ✓                            │
│  (Padre Nuestro, La Paz, Santa Cena, Acción de Gracias, Ofrenda, Bendición)│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Vista de Ordenamiento Final

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ORDENAR LITURGIA                                         [Vista Previa]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Arrastra para reordenar                                    Total: 47 slides│
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ≡  1. 📄 Portada Principal                              (1 slide)  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  2. 🙏 Invocación                                     (4 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  3. 🎵 El Espíritu                                    (8 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  4. 🙏 Arrepentimiento                                (4 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  5. 🎵 Como la brisa                                  (6 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  6. 🙏 Gratitud                                       (4 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  7. 🎵 Océanos                                        (7 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  8. 📖 Lectura Bíblica                                (5 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  9. 📚 Cuentacuentos: "El faro de Bahía Inglesa"     (14 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 10. 📄 Portada Reflexión                              (1 slide)  │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 11. 🙏 Padre Nuestro                                  (7 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 12. ✋ La Paz                                          (6 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 13. 🍞 Santa Cena                                      (8 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 14. 🙏 Acción de Gracias                              (11 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 15. 🎵 Fija tus ojos en Cristo                        (9 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 16. 💰 Ofrenda                                         (3 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 17. 📢 Anuncios                                        (2 slides) │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ≡ 18. 🙏 Bendición Final                                (11 slides) │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  [Guardar Borrador]      [Vista Previa Completa]      [Exportar →]         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Interfaz Compartida: Slide

**CRÍTICO**: Todos los componentes deben generar slides usando esta interfaz.

```typescript
// types/slide.ts

type SlideType = 
  | 'title'           // Títulos y portadas
  | 'song-title'      // Título de canción
  | 'song-lyrics'     // Letra de canción
  | 'prayer-leader'   // Oración - parte del líder
  | 'prayer-response' // Oración - respuesta congregación
  | 'prayer-full'     // Oración completa (líder + respuesta)
  | 'reading'         // Lectura bíblica
  | 'story-cover'     // Portada del cuento
  | 'story-scene'     // Escena del cuento
  | 'story-end'       // Final del cuento
  | 'announcement'    // Anuncio
  | 'blank';          // Slide en blanco / transición

interface Slide {
  id: string;
  type: SlideType;
  content: {
    primary: string;             // Texto principal
    secondary?: string;          // Texto secundario (respuesta, etc.)
    subtitle?: string;           // Subtítulo
    imageUrl?: string;           // URL de imagen
    narratorText?: string;       // Texto para el narrador (no se proyecta)
  };
  style: {
    primaryColor: string;
    secondaryColor?: string;
    backgroundColor: string;
    primaryFont: string;
    secondaryFont?: string;
  };
  metadata: {
    sourceComponent: string;
    sourceId: string;
    order: number;
    groupTotal: number;
  };
}

interface SlideGroup {
  id: string;
  type: string;
  title: string;
  slides: Slide[];
  metadata: {
    sourceComponent: string;
    createdAt: string;
  };
}
```

---

## Generadores de Contenido

### Generador de Portadas

```typescript
function generateMainCover(context: LiturgyContext): SlideGroup {
  return {
    id: generateId(),
    type: 'cover',
    title: 'Portada Principal',
    slides: [{
      id: generateId(),
      type: 'title',
      content: {
        primary: context.title,
        subtitle: formatDate(context.date)
      },
      style: {
        primaryColor: '#1A1A1A',
        backgroundColor: '#F7F7F7',
        primaryFont: 'Merriweather'
      },
      metadata: {
        sourceComponent: 'portadas',
        sourceId: context.id,
        order: 1,
        groupTotal: 1
      }
    }],
    metadata: {
      sourceComponent: 'portadas',
      createdAt: new Date().toISOString()
    }
  };
}
```

### Generador de Slides de Lectura Bíblica

```typescript
function generateReadingSlides(readings: BiblicalReading[]): SlideGroup {
  const slides: Slide[] = [];
  
  // Slide de título
  slides.push({
    id: generateId(),
    type: 'title',
    content: { primary: 'LECTURA' },
    // ...
  });
  
  for (const reading of readings) {
    // Dividir el texto en slides (máximo 4-5 líneas por slide)
    const textChunks = splitTextForProjection(reading.text, {
      maxLines: 5,
      maxCharsPerLine: 50
    });
    
    for (const chunk of textChunks) {
      slides.push({
        id: generateId(),
        type: 'reading',
        content: {
          primary: chunk,
          subtitle: reading.citation
        },
        // ...
      });
    }
  }
  
  return {
    id: generateId(),
    type: 'reading',
    title: 'Lectura Bíblica',
    slides,
    metadata: {
      sourceComponent: 'lecturas',
      createdAt: new Date().toISOString()
    }
  };
}
```

### Generador de Anuncios

```typescript
interface Announcement {
  id: string;
  title: string;
  description?: string;
  date?: string;
  imageUrl?: string;
  isRecurring: boolean;
}

interface AnnouncementsLibrary {
  recurring: Announcement[];
  templates: Announcement[];
  recent: Announcement[];
}
```

---

## Checklist de Desarrollo

### Fase 1: Componentes Base
- [x] Diseño del módulo de Oraciones Antifonales
- [x] Diseño del módulo de Canciones (PDF + nuevas + tags + recomendaciones)
- [x] Diseño del módulo de Elementos Fijos
- [x] Diseño del módulo de Cuentacuentos
- [x] Diseño del módulo de Portadas
- [x] Diseño del Constructor de Liturgias (flujo integrado)
- [ ] Implementación de contexto de liturgia transversal
- [ ] Implementación de Oraciones Antifonales
- [ ] Implementación de Repositorio de Canciones con tags
- [ ] Implementación de motor de recomendación de canciones
- [ ] Implementación de Elementos Fijos
- [ ] Implementación de Cuentacuentos
- [ ] Implementación de Generador de Portadas
- [ ] Implementación de Generador de Lectura Bíblica
- [ ] Implementación de Generador de Anuncios

### Fase 2: Integración
- [ ] Constructor de Liturgias (flujo paso a paso)
- [ ] Vista de ordenamiento (drag & drop)
- [ ] Vista previa completa
- [ ] Exportación a PPTX
- [ ] Exportación a PDF
- [ ] Historial de liturgias

### Fase 3: Mejoras
- [ ] Integración con Google Slides
- [ ] Plantillas personalizables
- [ ] Estadísticas de uso de canciones
- [ ] Búsqueda en liturgias pasadas

---

## Brand Kit CASA

```typescript
export const CASA_BRAND = {
  colors: {
    primary: {
      black: '#1A1A1A',
      amber: '#D4A853',
      white: '#F7F7F7'
    },
    secondary: {
      carbon: '#333333',
      grayDark: '#555555',
      grayMedium: '#8A8A8A',
      grayLight: '#E5E5E5'
    }
  },
  fonts: {
    heading: 'Merriweather',
    body: 'Montserrat'
  },
  slide: {
    width: 1024,
    height: 768,
    padding: 48,
    borderRadius: 8
  }
} as const;
```

---

## Estructura de Archivos del Proyecto

```
/casa-liturgias/
├── app/
│   ├── page.tsx                      # Dashboard principal
│   ├── liturgias/
│   │   ├── page.tsx                  # Lista de liturgias
│   │   ├── nueva/page.tsx            # Crear nueva liturgia (Paso 0)
│   │   └── [id]/
│   │       ├── page.tsx              # Constructor de liturgia
│   │       ├── portadas/page.tsx     # Paso 1
│   │       ├── oraciones/page.tsx    # Paso 2
│   │       ├── lectura/page.tsx      # Paso 3
│   │       ├── cuento/page.tsx       # Paso 4
│   │       ├── canciones/page.tsx    # Paso 5
│   │       ├── anuncios/page.tsx     # Paso 6
│   │       └── ordenar/page.tsx      # Paso 7
│   └── canciones/
│       ├── page.tsx                  # Repositorio de canciones
│       └── nueva/page.tsx            # Agregar canción
├── components/
│   ├── liturgy/
│   │   ├── LiturgyContextForm.tsx
│   │   ├── LiturgyBuilder.tsx
│   │   ├── LiturgyOrderEditor.tsx
│   │   └── LiturgyPreview.tsx
│   ├── oraciones/
│   ├── canciones/
│   ├── elementos-fijos/
│   ├── cuentacuentos/
│   ├── portadas/
│   ├── lecturas/
│   └── anuncios/
├── lib/
│   ├── liturgy-context.ts
│   ├── song-recommendations.ts
│   ├── slide-generator.ts
│   └── export/
├── types/
│   ├── liturgy.ts
│   ├── song.ts
│   ├── slide.ts
│   └── story.ts
└── data/
    ├── canciones/
    ├── elementos-fijos/
    ├── liturgias/
    └── cuentos/
```

---

## APIs del Sistema

```typescript
// Contexto de Liturgia
POST   /api/liturgias                    // Crear nueva liturgia
GET    /api/liturgias                    // Listar liturgias
GET    /api/liturgias/:id                // Obtener liturgia
PATCH  /api/liturgias/:id                // Actualizar liturgia

// Generadores
POST   /api/liturgias/:id/portadas       // Generar portadas
POST   /api/liturgias/:id/oraciones      // Generar oraciones
POST   /api/liturgias/:id/lectura        // Generar slides de lectura
POST   /api/liturgias/:id/cuento         // Generar cuento
POST   /api/liturgias/:id/anuncios       // Generar anuncios

// Canciones
GET    /api/canciones                    // Listar canciones
GET    /api/canciones/recomendar         // Obtener recomendaciones
POST   /api/canciones                    // Agregar canción
PATCH  /api/canciones/:id                // Actualizar canción

// Exportación
POST   /api/liturgias/:id/exportar       // Exportar presentación

// Biblia
GET    /api/biblia/buscar                // Buscar texto bíblico
```
