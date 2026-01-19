# Instrucciones para Claude Code: Base de Datos de Canciones CASA

## Resumen del Proyecto

Procesar el PDF de canciones de CASA (1098 páginas, 74 canciones) para crear un repositorio donde cada canción sea un archivo individual. El sistema debe identificar los límites de cada canción, extraer las letras, y generar archivos con el diseño del Brand Kit de CASA.

---

## Información del PDF Fuente

- **Archivo**: `0__CANCIONES_CASA_2025_pptx.pdf`
- **Total de páginas**: 1098
- **Total de canciones**: 74
- **Estructura**:
  - Página 1: Índice con lista de canciones y páginas de inicio
  - Cada canción: Página de título + múltiples páginas de letras

### Estructura del Índice (Página 1)

El índice tiene el formato:
```
1. El espíritu (2)
2. Canta la esperanza (11)
3. Tu modo (25)
...
```

Donde el número entre paréntesis indica la página de inicio de cada canción.

**Nota**: Algunas canciones no tienen número de página en el índice. En esos casos, usar la página siguiente a la última página de la canción anterior.

---

## Lista Completa de Canciones

```
1. El espíritu (2)
2. Canta la esperanza (11)
3. Tu modo (25)
4. Capitán (55)
5. Oh criaturas del Señor (69)
6. Danza conmigo (76)
7. Abba Padre (89)
8. Ahora y para siempre (110)
9. Oh tu fidelidad (117)
10. Tu eres Dios (130)
11. Como la brisa (146)
12. Señor mi Dios (163)
13. Cristo te amamos (173)
14. Sin miedo (188)
15. La noche pasó (209)
16. Ven, Espíritu de Dios (224)
17. Tu amor y tu bondad (226)
18. Tu amor me asombra (243)
19. Brazos del Padre (250)
20. Sumérgeme (263)
21. No hay paredes (sin número - después de 263)
22. Instrumento de tu paz (305)
23. En este lugar (318)
24. Pequeñas aclaraciones (329)
25. Como ama (346)
26. Quiero ver su amor (370)
27. Yo vengo a ofrecer mi corazón (sin número - después de 370)
28. Siempre hay lugar (405)
29. Quiero respirar (426)
30. Cuidame (447)
31. Atráeme a ti (472)
32. Me guía Él (sin número)
33. Jardín (sin número)
34. Tenemos esperanza (sin número)
35. Fija tus ojos en Cristo (555)
36. Quiero andar cerca de ti (sin número)
37. Respirar (581)
38. Enséñame a volar (590)
39. Cante al Señor (600)
40. Océanos (617)
41. Ya no existe el miedo (632)
42. Sólo el amor (655)
43. Aún en medio del dolor (670)
44. Abre mis ojos (692)
45. Vamos celebrando (698)
46. El buen pastor (727)
47. No hay paredes (sin número - repetida?)
48. Jesús es el Señor (748)
49. Jesús mi buen pastor (sin número)
50. El corazón de la alabanza (sin número)
51. Noël (sin número)
52. Venid fieles todos (sin número)
53. Oh Ven Emmanuel (sin número)
54. A ti me rindo (sin número)
55. Amor furioso (863)
56. Nada más (sin número)
57. Nueva vida (886)
58. En tí confío (896)
59. Si, tu amor (907)
60. Inhala, exhala (933)
61. Abba (959)
62. Llévame a la cruz (sin número)
63. Honrar la vida (sin número)
64. Cuán dulce paz (sin número)
65. Sublime gracia (sin número)
66. Fuente de Vida Eterna (1027)
67. Santo, Santo, Santo (1034)
68. Gloria cantemos (1041)
69. Gratitud (1046)
70. El Vacío (sin número)
71. Santa la noche (1064)
72. Pequeña Aldea de Belén (sin número)
73. María sabes qué (sin número)
74. Aclaró (1093)
```

---

## Algoritmo de Procesamiento

### Paso 1: Parsear el Índice

```python
import re

def parse_index(index_text):
    """
    Parsea el índice y retorna lista de canciones con páginas.
    """
    songs = []
    lines = index_text.strip().split('\n')
    
    for line in lines:
        # Buscar patrón: número. nombre (página)
        match = re.match(r'(\d+)\.\s+(.+?)(?:\s*\((\d+)\))?$', line.strip())
        if match:
            number = int(match.group(1))
            name = match.group(2).strip()
            page = int(match.group(3)) if match.group(3) else None
            songs.append({
                'number': number,
                'name': name,
                'start_page': page
            })
    
    return songs
```

### Paso 2: Identificar Límites de Canciones

La página de título de cada canción contiene SOLO el nombre de la canción en mayúsculas (o con formato título). Usar esto para identificar dónde comienza cada canción.

```python
def is_title_page(text, expected_title):
    """
    Verifica si una página es la página de título de una canción.
    """
    text_clean = text.strip().upper()
    title_clean = expected_title.strip().upper()
    
    # La página de título solo tiene el nombre (pocas palabras)
    if len(text_clean) < 100 and title_clean in text_clean:
        return True
    return False
```

### Paso 3: Extraer Contenido de Cada Canción

```python
def extract_song_content(doc, start_page, end_page):
    """
    Extrae el contenido de una canción entre dos páginas.
    """
    content = {
        'title': '',
        'verses': []
    }
    
    for i in range(start_page - 1, end_page - 1):  # -1 porque índice empieza en 0
        page = doc[i]
        text = page.get_text().strip()
        
        if i == start_page - 1:
            content['title'] = text
        else:
            if text:
                content['verses'].append(text)
    
    return content
```

---

## Estructura de Archivos de Salida

### Directorio de Salida

```
/canciones-casa/
├── data/
│   ├── index.json                    # Índice completo de canciones
│   ├── 01-el-espiritu.json
│   ├── 01-el-espiritu.md
│   ├── 02-canta-la-esperanza.json
│   ├── 02-canta-la-esperanza.md
│   ├── ...
│   └── custom/                       # Canciones agregadas por usuarios
│       ├── custom-amazing-grace.json
│       └── ...
├── components/
│   ├── SongRepository.tsx            # Componente principal del repositorio
│   ├── SongCard.tsx                  # Tarjeta de canción para el listado
│   ├── SongSlide.tsx                 # Slide individual para proyección
│   ├── SongViewer.tsx                # Vista completa de una canción
│   ├── NewSongEditor.tsx             # Editor para agregar canciones nuevas
│   ├── SlidePreview.tsx              # Vista previa de slides generados
│   ├── SlideEditor.tsx               # Editor individual de cada slide
│   ├── LyricsInput.tsx               # Textarea para pegar letra
│   └── SlideNavigator.tsx            # Navegación entre slides
├── lib/
│   ├── splitLyrics.ts                # Algoritmo de división de letras
│   ├── songStorage.ts                # Funciones de almacenamiento
│   └── songSearch.ts                 # Búsqueda de canciones
├── types/
│   └── song.ts                       # TypeScript interfaces
└── styles/
    └── slides.css                    # Estilos específicos para slides
```

---

## Interfaces TypeScript

```typescript
// types/song.ts

interface Verse {
  number: number;
  type: 'verse' | 'chorus' | 'bridge' | 'outro';
  content: string;
}

interface SongMetadata {
  verseCount: number;
  hasChorus?: boolean;
  estimatedDuration?: string;
  tags?: string[];
  isCustom?: boolean;
  addedAt?: string;
  addedBy?: string;
  source?: 'pdf' | 'manual';
}

interface Song {
  id: string;
  number: number;
  title: string;
  artist?: string;
  slug: string;
  startPage?: number;
  endPage?: number;
  verses: Verse[];
  metadata: SongMetadata;
}

interface SongIndex {
  total: number;
  songs: {
    id: string;
    number: number;
    title: string;
    artist?: string;
  }[];
}

// Para slides de proyección
interface SlideContent {
  slideNumber: number;
  type: 'title' | 'lyrics';
  content: string;
  lines: string[];
}

interface SongPresentation {
  songId: string;
  title: string;
  slides: SlideContent[];
  totalSlides: number;
}

// Para el editor de canciones nuevas
interface NewSongInput {
  title: string;
  artist?: string;
  lyrics: string;
  linesPerSlide: number;
  tags?: string[];
}

interface SlideEditAction {
  type: 'edit' | 'split' | 'merge' | 'delete' | 'reorder' | 'add';
  slideIndex: number;
  payload?: any;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
```

### Formato JSON de Cada Canción

```json
{
  "id": "01-el-espiritu",
  "number": 1,
  "title": "El Espíritu",
  "slug": "el-espiritu",
  "startPage": 2,
  "endPage": 10,
  "verses": [
    {
      "number": 1,
      "type": "verse",
      "content": "El Espíritu anda en el aire,\nse pasea por las cabezas\nY me trajo una certeza y también\nuna canción"
    },
    {
      "number": 2,
      "type": "verse", 
      "content": "El Espíritu me dio la mano,\nme llevó a lo más profundo\nMe miró fijo a los ojos\ny me dijo este soy yo"
    },
    {
      "number": 3,
      "type": "chorus",
      "content": "Dijo ven acercate a la fiesta\nVen acercate al calor\nAquí danzamos a la llama\nAl compas de mi tambor"
    }
  ],
  "metadata": {
    "hasChorus": true,
    "verseCount": 6,
    "estimatedDuration": "3-4 min",
    "tags": ["Espíritu Santo", "celebración", "comunidad"]
  }
}
```

### Formato Markdown de Cada Canción

```markdown
---
id: 01-el-espiritu
number: 1
title: El Espíritu
---

# El Espíritu

## Verso 1
El Espíritu anda en el aire,
se pasea por las cabezas
Y me trajo una certeza y también
una canción

## Verso 2
El Espíritu me dio la mano,
me llevó a lo más profundo
Me miró fijo a los ojos
y me dijo este soy yo

## Coro
Dijo ven acercate a la fiesta
Ven acercate al calor
Aquí danzamos a la llama
Al compas de mi tambor

...
```

---

## Brand Kit de CASA - Aplicación al Diseño

### Colores

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

### Tipografía

```css
/* Títulos de canciones */
font-family: 'Merriweather', serif;
font-weight: 300; /* Light */
letter-spacing: 0.05em;

/* Letras/versos */
font-family: 'Montserrat', sans-serif;
font-weight: 400; /* Regular */
line-height: 1.6;
```

---

## Componentes React

### SongCard.tsx - Tarjeta de Canción para el Repositorio

```tsx
interface SongCardProps {
  song: {
    id: string;
    number: number;
    title: string;
    verseCount: number;
  };
  onClick: () => void;
}

// Diseño según Brand Kit:
// - Border radius: 8px
// - Border: 1px #E5E5E5
// - Padding: 16-24px
// - Número en ámbar (#D4A853)
// - Título en negro (#1A1A1A) con Merriweather
```

### SongSlide.tsx - Slide para Proyección

```tsx
interface SongSlideProps {
  song: Song;
  currentVerse: number;
  showTitle?: boolean;
}

// Diseño de slides (4:3 - 1024x768):
// - Fondo: Blanco cálido (#F7F7F7)
// - Título: Merriweather Light, #1A1A1A, centrado
// - Versos: Montserrat Regular, #1A1A1A
// - Número de verso: pequeño en esquina, #8A8A8A
// - Separador decorativo con punto ámbar
```

### SongRepository.tsx - Repositorio Principal

```tsx
// Features:
// - Búsqueda por título
// - Filtro por tags
// - Lista scrolleable de canciones
// - Vista previa de letra
// - Selección para agregar a liturgia
```

---

## Script de Procesamiento Completo

```python
#!/usr/bin/env python3
"""
Script para procesar el PDF de canciones CASA y generar repositorio.
"""

import fitz  # PyMuPDF
import json
import re
import os
from pathlib import Path

def slugify(text):
    """Convierte texto a slug URL-friendly."""
    text = text.lower()
    text = re.sub(r'[áàäâ]', 'a', text)
    text = re.sub(r'[éèëê]', 'e', text)
    text = re.sub(r'[íìïî]', 'i', text)
    text = re.sub(r'[óòöô]', 'o', text)
    text = re.sub(r'[úùüû]', 'u', text)
    text = re.sub(r'[ñ]', 'n', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    text = text.strip('-')
    return text

def parse_index_page(text):
    """Parsea la página de índice."""
    songs = []
    pattern = r'(\d+)\.\s+(.+?)(?:\s*\((\d+)\))?(?:\s|$)'
    
    for match in re.finditer(pattern, text):
        number = int(match.group(1))
        name = match.group(2).strip()
        page = int(match.group(3)) if match.group(3) else None
        
        songs.append({
            'number': number,
            'name': name,
            'start_page': page
        })
    
    return songs

def identify_song_boundaries(doc, songs):
    """Identifica las páginas de inicio/fin de cada canción."""
    # Ordenar por página de inicio conocida
    known_pages = [(s['name'], s['start_page']) for s in songs if s['start_page']]
    known_pages.sort(key=lambda x: x[1])
    
    # Para cada canción, encontrar su página de fin
    for i, song in enumerate(songs):
        if song['start_page']:
            # Buscar la siguiente canción con página conocida
            next_page = None
            for j in range(i + 1, len(songs)):
                if songs[j]['start_page']:
                    next_page = songs[j]['start_page']
                    break
            
            if next_page:
                song['end_page'] = next_page - 1
            else:
                song['end_page'] = len(doc)
    
    return songs

def extract_song_content(doc, start_page, end_page):
    """Extrae las letras de una canción."""
    verses = []
    title = ""
    
    for i in range(start_page - 1, end_page):
        if i >= len(doc):
            break
            
        page = doc[i]
        text = page.get_text().strip()
        
        if not text:
            continue
            
        if i == start_page - 1:
            title = text
        else:
            verses.append(text)
    
    return {
        'title': title,
        'verses': verses
    }

def create_song_json(song_data, number):
    """Crea el objeto JSON de una canción."""
    song_id = f"{number:02d}-{slugify(song_data['title'])}"
    
    return {
        'id': song_id,
        'number': number,
        'title': song_data['title'].strip(),
        'slug': slugify(song_data['title']),
        'verses': [
            {
                'number': i + 1,
                'type': 'verse',
                'content': verse
            }
            for i, verse in enumerate(song_data['verses'])
        ],
        'metadata': {
            'verseCount': len(song_data['verses'])
        }
    }

def create_song_markdown(song_json):
    """Crea el archivo Markdown de una canción."""
    md = f"""---
id: {song_json['id']}
number: {song_json['number']}
title: {song_json['title']}
---

# {song_json['title']}

"""
    for verse in song_json['verses']:
        md += f"## Verso {verse['number']}\n{verse['content']}\n\n"
    
    return md

def main():
    # Abrir PDF
    doc = fitz.open('0__CANCIONES_CASA_2025_pptx.pdf')
    
    # Parsear índice (página 1)
    index_text = doc[0].get_text()
    songs = parse_index_page(index_text)
    
    # Identificar límites de canciones
    songs = identify_song_boundaries(doc, songs)
    
    # Crear directorio de salida
    output_dir = Path('canciones-casa')
    output_dir.mkdir(exist_ok=True)
    
    # Procesar cada canción
    all_songs = []
    for song in songs:
        if song['start_page'] and song.get('end_page'):
            content = extract_song_content(doc, song['start_page'], song['end_page'])
            song_json = create_song_json(content, song['number'])
            
            # Guardar JSON
            json_path = output_dir / f"{song_json['id']}.json"
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(song_json, f, ensure_ascii=False, indent=2)
            
            # Guardar Markdown
            md_path = output_dir / f"{song_json['id']}.md"
            with open(md_path, 'w', encoding='utf-8') as f:
                f.write(create_song_markdown(song_json))
            
            all_songs.append(song_json)
            print(f"✓ Procesada: {song_json['title']}")
    
    # Crear índice general
    index_path = output_dir / 'index.json'
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump({
            'total': len(all_songs),
            'songs': [{'id': s['id'], 'number': s['number'], 'title': s['title']} for s in all_songs]
        }, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Repositorio creado con {len(all_songs)} canciones")

if __name__ == '__main__':
    main()
```

---

## Comando Inicial para Claude Code

```
Crea un sistema de repositorio de canciones para CASA con dos funcionalidades principales:

### PARTE 1: Procesar PDF existente
Procesa el PDF de canciones CASA (0__CANCIONES_CASA_2025_pptx.pdf) para crear el repositorio inicial.
- El PDF tiene 1098 páginas con 74 canciones
- La página 1 contiene el índice con formato "número. nombre (página)"
- Usa PyMuPDF (fitz) para extraer el texto
- Genera archivos JSON y Markdown para cada canción
- Crea un archivo index.json con el índice completo

### PARTE 2: Agregar canciones nuevas
Crea un componente para que usuarios agreguen canciones nuevas:
- Formulario con: título, artista (opcional), textarea para la letra
- Selector de "líneas por slide" (default: 4)
- Al generar, crear automáticamente los slides:
  - Slide 1: Título de la canción (centrado, con separadores decorativos)
  - Slides siguientes: 4 líneas de letra por slide
- Editor visual para ajustar los slides antes de guardar
- Funciones: dividir slide, unir slides, reordenar, editar texto

### Componentes React a crear:
1. SongRepository.tsx - Lista y búsqueda de canciones
2. SongCard.tsx - Tarjeta de canción en el listado
3. SongSlide.tsx - Slide individual para proyección (4:3)
4. NewSongEditor.tsx - Formulario y editor para canciones nuevas
5. SlidePreview.tsx - Vista previa de slides generados

### Brand Kit de CASA:
- Negro principal: #1A1A1A
- Ámbar acento: #D4A853
- Blanco cálido: #F7F7F7
- Títulos: Merriweather Light
- Cuerpo: Montserrat Regular
- Border radius: 8px
- Separadores: línea fina con punto ámbar al centro

### Diseño de Slides:
- Formato: 4:3 (1024x768)
- Fondo: #F7F7F7
- Slide de título: Merriweather Light 48px, centrado, con separadores ámbar
- Slides de letra: Montserrat Regular 28px, centrado, line-height 1.8
- Indicador de slide en esquina inferior derecha (#8A8A8A, 14px)

Revisa CASA_Canciones_Repository_Instructions.md para especificaciones completas.
```

---

## Integración Futura

Este repositorio de canciones se integrará con:

1. **Componente de Oraciones Antifonales**: Para la generación de liturgias completas
2. **Sistema de Presentación de Liturgia**: Para proyectar las canciones durante el servicio
3. **Planificador de Liturgias**: Para seleccionar canciones para cada domingo

### API de Canciones

```typescript
// Funciones para acceder al repositorio
async function getAllSongs(): Promise<Song[]>
async function getSongById(id: string): Promise<Song>
async function searchSongs(query: string): Promise<Song[]>
async function getSongsByTag(tag: string): Promise<Song[]>
```

---

## Funcionalidad: Agregar Canciones Nuevas

### Descripción

Los usuarios pueden agregar canciones nuevas al repositorio pegando el texto de la letra. El sistema debe:

1. Recibir el título y el texto de la canción
2. Dividir automáticamente el texto en slides (4 líneas por slide por defecto)
3. Generar el primer slide con el título de la canción
4. Permitir ajustes manuales antes de guardar
5. Aplicar el diseño del Brand Kit de CASA

### Formulario de Nueva Canción

```typescript
interface NewSongForm {
  title: string;           // Título de la canción
  artist?: string;         // Artista/compositor (opcional)
  lyrics: string;          // Texto completo de la letra (textarea grande)
  linesPerSlide: number;   // Líneas por slide (default: 4)
  tags?: string[];         // Tags para categorizar
}
```

### Interfaz de Usuario

```
┌─────────────────────────────────────────────────────────────┐
│  AGREGAR NUEVA CANCIÓN                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Título de la canción *                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Amazing Grace                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Artista (opcional)                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ John Newton                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Letra de la canción *                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Amazing grace, how sweet the sound                  │   │
│  │ That saved a wretch like me                         │   │
│  │ I once was lost, but now I'm found                  │   │
│  │ Was blind, but now I see                            │   │
│  │                                                      │   │
│  │ 'Twas grace that taught my heart to fear            │   │
│  │ And grace my fears relieved                         │   │
│  │ How precious did that grace appear                  │   │
│  │ The hour I first believed                           │   │
│  │ ...                                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Líneas por slide: [ 4 ▼ ]                                  │
│                                                             │
│  ┌──────────────────┐                                       │
│  │  Generar Slides  │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### Algoritmo de División de Slides

```typescript
interface SlideContent {
  slideNumber: number;
  type: 'title' | 'lyrics';
  content: string;
  lines: string[];
}

function splitLyricsIntoSlides(
  title: string,
  lyrics: string,
  linesPerSlide: number = 4
): SlideContent[] {
  const slides: SlideContent[] = [];
  
  // Slide 1: Título de la canción
  slides.push({
    slideNumber: 1,
    type: 'title',
    content: title,
    lines: [title]
  });
  
  // Procesar letra
  const lines = lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // Agrupar líneas en slides
  let currentSlide: string[] = [];
  let slideNumber = 2;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detectar línea vacía como separador de estrofa
    if (line === '' && currentSlide.length > 0) {
      // Guardar slide actual
      slides.push({
        slideNumber: slideNumber++,
        type: 'lyrics',
        content: currentSlide.join('\n'),
        lines: [...currentSlide]
      });
      currentSlide = [];
      continue;
    }
    
    currentSlide.push(line);
    
    // Si alcanzamos el límite de líneas, crear nuevo slide
    if (currentSlide.length >= linesPerSlide) {
      slides.push({
        slideNumber: slideNumber++,
        type: 'lyrics',
        content: currentSlide.join('\n'),
        lines: [...currentSlide]
      });
      currentSlide = [];
    }
  }
  
  // Agregar últimas líneas si quedan
  if (currentSlide.length > 0) {
    slides.push({
      slideNumber: slideNumber++,
      type: 'lyrics',
      content: currentSlide.join('\n'),
      lines: [...currentSlide]
    });
  }
  
  return slides;
}
```

### Reglas de División Inteligente

El algoritmo debe considerar:

1. **Líneas vacías como separadores**: Una línea vacía indica fin de estrofa/verso
2. **Máximo 4 líneas por slide** (configurable)
3. **No cortar en medio de una frase**: Si una línea termina sin puntuación y la siguiente comienza en minúscula, mantenerlas juntas
4. **Detectar coros**: Si un bloque de texto se repite, marcarlo como coro
5. **Respetar la estructura poética**: Mantener rimas juntas cuando sea posible

```typescript
function intelligentSplit(lyrics: string, maxLines: number = 4): string[][] {
  const paragraphs = lyrics.split(/\n\s*\n/); // Dividir por líneas vacías
  const slides: string[][] = [];
  
  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').filter(l => l.trim());
    
    if (lines.length <= maxLines) {
      // El párrafo cabe en un slide
      slides.push(lines);
    } else {
      // Dividir párrafo largo
      for (let i = 0; i < lines.length; i += maxLines) {
        const chunk = lines.slice(i, i + maxLines);
        slides.push(chunk);
      }
    }
  }
  
  return slides;
}
```

### Editor de Slides Generados

Después de generar los slides, el usuario puede:

1. **Reordenar slides**: Drag and drop
2. **Editar contenido**: Click para editar el texto de cada slide
3. **Dividir slide**: Separar un slide en dos
4. **Unir slides**: Combinar dos slides consecutivos
5. **Agregar slide**: Insertar un slide vacío
6. **Eliminar slide**: Quitar un slide
7. **Marcar como coro**: Identificar slides que son el coro

```
┌─────────────────────────────────────────────────────────────┐
│  VISTA PREVIA DE SLIDES                          [Guardar] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ AMAZING │  │Amazing  │  │'Twas    │  │Through  │        │
│  │ GRACE   │  │grace,   │  │grace    │  │many     │        │
│  │         │  │how sweet│  │that     │  │dangers  │        │
│  │ Título  │  │the sound│  │taught   │  │toils... │        │
│  │         │  │That...  │  │my heart │  │         │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│    [1/8]        [2/8]        [3/8]        [4/8]            │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │When we  │  │Yes, when│  │Amazing  │  │Amazing  │        │
│  │'ve been │  │this     │  │grace,   │  │grace,   │        │
│  │there ten│  │flesh... │  │how sweet│  │how sweet│        │
│  │thousand │  │         │  │(repeat) │  │(final)  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│    [5/8]        [6/8]        [7/8]        [8/8]            │
│                                                             │
│  [+ Agregar Slide]                                          │
└─────────────────────────────────────────────────────────────┘
```

### Componente React: NewSongEditor

```tsx
interface NewSongEditorProps {
  onSave: (song: Song) => void;
  onCancel: () => void;
}

const NewSongEditor: React.FC<NewSongEditorProps> = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [linesPerSlide, setLinesPerSlide] = useState(4);
  const [slides, setSlides] = useState<SlideContent[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  
  const generateSlides = () => {
    const generatedSlides = splitLyricsIntoSlides(title, lyrics, linesPerSlide);
    setSlides(generatedSlides);
    setIsPreviewMode(true);
  };
  
  const handleSlideEdit = (index: number, newContent: string) => {
    const updated = [...slides];
    updated[index].content = newContent;
    updated[index].lines = newContent.split('\n');
    setSlides(updated);
  };
  
  const handleSplitSlide = (index: number, splitAtLine: number) => {
    // Lógica para dividir un slide en dos
  };
  
  const handleMergeSlides = (index: number) => {
    // Lógica para unir slide[index] con slide[index + 1]
  };
  
  const handleSave = () => {
    const newSong: Song = {
      id: `custom-${slugify(title)}`,
      number: 0, // Se asignará al guardar
      title,
      artist,
      slug: slugify(title),
      verses: slides.filter(s => s.type === 'lyrics').map((s, i) => ({
        number: i + 1,
        type: 'verse',
        content: s.content
      })),
      metadata: {
        verseCount: slides.length - 1,
        isCustom: true,
        addedAt: new Date().toISOString()
      }
    };
    onSave(newSong);
  };
  
  return (
    // Renderizado del componente
  );
};
```

### Diseño del Slide de Título (Brand Kit)

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│                                             │
│              ────●────                      │  ← Separador con punto ámbar
│                                             │
│           AMAZING GRACE                     │  ← Merriweather Light, 48px
│                                             │  ← #1A1A1A, centrado
│              ────●────                      │  ← Separador con punto ámbar
│                                             │
│                                             │
│                                             │
└─────────────────────────────────────────────┘

Especificaciones:
- Fondo: #F7F7F7 (blanco cálido)
- Título: Merriweather Light, 48px, #1A1A1A
- Título en MAYÚSCULAS o Title Case según preferencia
- Centrado vertical y horizontal
- Separadores decorativos con punto ámbar (#D4A853)
```

### Diseño del Slide de Letra (Brand Kit)

```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│       Amazing grace, how sweet the sound    │  ← Montserrat Regular, 28px
│       That saved a wretch like me           │  ← #1A1A1A, centrado
│       I once was lost, but now I'm found    │  ← Line-height: 1.8
│       Was blind, but now I see              │
│                                             │
│                                             │
│                                    [2/8]    │  ← Indicador de slide
└─────────────────────────────────────────────┘

Especificaciones:
- Fondo: #F7F7F7 (blanco cálido)
- Texto: Montserrat Regular, 28px, #1A1A1A
- Centrado vertical y horizontal
- Line-height: 1.8 para legibilidad
- Indicador de slide: Montserrat, 14px, #8A8A8A, esquina inferior derecha
```

### Almacenamiento de Canciones Nuevas

Las canciones agregadas por el usuario se guardan con metadata adicional:

```json
{
  "id": "custom-amazing-grace",
  "number": 75,
  "title": "Amazing Grace",
  "artist": "John Newton",
  "slug": "amazing-grace",
  "verses": [...],
  "metadata": {
    "verseCount": 6,
    "isCustom": true,
    "addedAt": "2025-01-06T15:30:00Z",
    "addedBy": "user",
    "source": "manual"
  }
}
```

### Validaciones

```typescript
const validateNewSong = (title: string, lyrics: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!title.trim()) {
    errors.push('El título es requerido');
  }
  
  if (!lyrics.trim()) {
    errors.push('La letra es requerida');
  }
  
  if (lyrics.trim().split('\n').length < 2) {
    errors.push('La letra debe tener al menos 2 líneas');
  }
  
  // Verificar si ya existe una canción con el mismo título
  // ...
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
```

---

## Notas Adicionales

### Detección de Coros vs Versos

Algunas canciones tienen coros que se repiten. Para detectarlos:
- Buscar texto que aparece múltiples veces
- Buscar palabras clave como "Coro:" o patrones de repetición
- Marcar estos como `type: "chorus"` en el JSON

### Manejo de Caracteres Especiales

El PDF puede tener ligaduras (fi, fl) que se renderizan como caracteres especiales. Normalizar:
```python
text = text.replace('ﬁ', 'fi').replace('ﬂ', 'fl')
```

### Canciones Sin Página de Inicio

Para las canciones que no tienen número de página en el índice, buscar el título en las páginas del PDF para encontrar dónde comienza.
