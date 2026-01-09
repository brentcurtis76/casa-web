# Mejora de Calidad PPTX - Renderizado Híbrido

## Problema Actual

Los archivos PPTX/Keynote exportados tienen dos problemas:
1. **Fondo gris** - html2canvas no captura correctamente el color de fondo `#F7F7F7`
2. **Baja resolución** - Las imágenes renderizadas se ven pixeladas al escalar

## Solución Propuesta

Usar **renderizado híbrido** con pptxgenjs:
- **Nativo (texto)**: Para slides de texto puro - usa elementos nativos de PowerPoint
- **Imagen**: Solo para slides con ilustraciones/imágenes de fondo

### Distribución por Tipo de Slide

| Renderizado | Tipos de Slide | Razón |
|-------------|----------------|-------|
| **Nativo** | song-title, song-lyrics, prayer-leader, prayer-response, prayer-full, reading, blessing, title, announcement, blank | Texto plano con estilos simples |
| **Imagen** | portadas (main/reflexion), announcement-image, cuentacuentos | Tienen ilustraciones de fondo |

## Archivos a Crear/Modificar

### Nuevo: `src/lib/liturgia/pptxNativeRenderer.ts`

```typescript
/**
 * Renderizador nativo para pptxgenjs
 * Crea slides usando elementos nativos de PowerPoint en lugar de imágenes
 */

import pptxgen from 'pptxgenjs';
import type { Slide } from '@/types/shared/slide';

// Estilos para pptxgenjs (colores sin #)
const PPTX_STYLES = {
  fonts: {
    heading: 'Georgia',      // Fallback para Merriweather
    body: 'Arial'            // Fallback para Montserrat
  },
  colors: {
    black: '1A1A1A',
    amber: 'D4A853',
    white: 'F7F7F7',
    grayMedium: '8A8A8A',
    grayLight: 'E5E5E5'
  },
  layout: {
    width: 10,               // pulgadas
    height: 7.5,             // pulgadas (4:3)
    padding: 0.5,
    logoSize: 0.35,
    logoPosition: { x: 9.15, y: 0.5 }
  }
};

// Logo CASA en base64 (necesita generarse)
let CASA_LOGO_BASE64: string | null = null;

/**
 * Precarga el logo CASA como base64
 */
export async function preloadLogo(): Promise<void> {
  try {
    const response = await fetch('/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png');
    const blob = await response.blob();
    CASA_LOGO_BASE64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('No se pudo cargar el logo CASA para PPTX');
  }
}

/**
 * Determina si un slide debe renderizarse como imagen
 */
export function shouldUseImageRendering(slide: Slide): boolean {
  // Portadas siempre como imagen (tienen ilustración de fondo)
  if (slide.metadata?.sourceComponent === 'portadas-main') return true;
  if (slide.metadata?.sourceComponent === 'portadas-reflection') return true;

  // Cuentacuentos como imagen (ilustraciones)
  if (slide.metadata?.sourceComponent === 'cuentacuentos') return true;

  // Anuncios con imagen
  if (slide.type === 'announcement-image') return true;

  // Todo lo demás: renderizado nativo
  return false;
}

/**
 * Renderiza un slide usando elementos nativos de pptxgenjs
 */
export function renderSlideNative(pptSlide: pptxgen.Slide, slide: Slide): void {
  // Configurar fondo blanco explícitamente
  pptSlide.background = { color: PPTX_STYLES.colors.white };

  switch (slide.type) {
    case 'song-title':
    case 'title':
      renderTitleSlide(pptSlide, slide);
      break;
    case 'song-lyrics':
    case 'prayer-leader':
      renderTextSlide(pptSlide, slide, { bold: false });
      break;
    case 'prayer-response':
      renderTextSlide(pptSlide, slide, { bold: true, color: PPTX_STYLES.colors.amber });
      break;
    case 'prayer-full':
      renderAntiphonalSlide(pptSlide, slide);
      break;
    case 'reading':
      renderReadingSlide(pptSlide, slide);
      break;
    case 'blessing':
      renderBlessingSlide(pptSlide, slide);
      break;
    case 'announcement':
      renderAnnouncementSlide(pptSlide, slide);
      break;
    case 'blank':
      // Solo fondo, sin contenido
      break;
    default:
      renderDefaultSlide(pptSlide, slide);
  }

  // Agregar logo CASA (excepto títulos)
  if (slide.type !== 'song-title' && slide.type !== 'title') {
    addCasaLogo(pptSlide);
  }

  // Agregar indicador de slide
  if (slide.metadata) {
    addSlideIndicator(pptSlide, slide.metadata.order, slide.metadata.groupTotal);
  }
}

/**
 * Agrega separador decorativo (línea + punto ámbar + línea)
 */
function addSeparator(pptSlide: pptxgen.Slide, yPosition: number): void {
  const centerX = 5;
  const lineWidth = 0.8;

  // Línea izquierda
  pptSlide.addShape('rect', {
    x: centerX - lineWidth - 0.15,
    y: yPosition,
    w: lineWidth,
    h: 0.01,
    fill: { color: PPTX_STYLES.colors.grayLight }
  });

  // Punto ámbar central
  pptSlide.addShape('ellipse', {
    x: centerX - 0.04,
    y: yPosition - 0.04,
    w: 0.08,
    h: 0.08,
    fill: { color: PPTX_STYLES.colors.amber }
  });

  // Línea derecha
  pptSlide.addShape('rect', {
    x: centerX + 0.15,
    y: yPosition,
    w: lineWidth,
    h: 0.01,
    fill: { color: PPTX_STYLES.colors.grayLight }
  });
}

/**
 * Renderiza slide de título (canción o sección)
 */
function renderTitleSlide(pptSlide: pptxgen.Slide, slide: Slide): void {
  // Separador superior
  addSeparator(pptSlide, 2.8);

  // Texto del título
  pptSlide.addText(slide.content.primary.toUpperCase(), {
    x: 0.5,
    y: 3.0,
    w: 9,
    h: 1.5,
    align: 'center',
    valign: 'middle',
    fontFace: PPTX_STYLES.fonts.heading,
    fontSize: 42,
    color: PPTX_STYLES.colors.black,
    charSpacing: 2
  });

  // Subtítulo si existe
  if (slide.content.subtitle) {
    pptSlide.addText(slide.content.subtitle, {
      x: 0.5,
      y: 4.3,
      w: 9,
      h: 0.5,
      align: 'center',
      fontFace: PPTX_STYLES.fonts.body,
      fontSize: 18,
      color: PPTX_STYLES.colors.grayMedium
    });
  }

  // Separador inferior
  addSeparator(pptSlide, 4.7);
}

/**
 * Renderiza slide de texto simple (letras, oración líder)
 */
function renderTextSlide(
  pptSlide: pptxgen.Slide,
  slide: Slide,
  options: { bold: boolean; color?: string }
): void {
  pptSlide.addText(slide.content.primary, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 4.5,
    align: 'center',
    valign: 'middle',
    fontFace: PPTX_STYLES.fonts.body,
    fontSize: 28,
    bold: options.bold,
    color: options.color || PPTX_STYLES.colors.black,
    lineSpacing: 42
  });
}

/**
 * Renderiza slide antifonal (líder + respuesta)
 */
function renderAntiphonalSlide(pptSlide: pptxgen.Slide, slide: Slide): void {
  // Parte del líder
  pptSlide.addText(slide.content.primary, {
    x: 0.5,
    y: 1.2,
    w: 9,
    h: 2,
    align: 'center',
    valign: 'middle',
    fontFace: PPTX_STYLES.fonts.body,
    fontSize: 24,
    color: PPTX_STYLES.colors.black,
    lineSpacing: 36
  });

  // Separador
  addSeparator(pptSlide, 3.5);

  // Respuesta congregación
  if (slide.content.secondary) {
    pptSlide.addText(slide.content.secondary, {
      x: 0.5,
      y: 3.8,
      w: 9,
      h: 2,
      align: 'center',
      valign: 'middle',
      fontFace: PPTX_STYLES.fonts.body,
      fontSize: 28,
      bold: true,
      color: PPTX_STYLES.colors.amber,
      lineSpacing: 42
    });
  }
}

/**
 * Renderiza slide de lectura bíblica
 */
function renderReadingSlide(pptSlide: pptxgen.Slide, slide: Slide): void {
  // Texto de la lectura (itálica)
  pptSlide.addText(slide.content.primary, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 4,
    align: 'center',
    valign: 'middle',
    fontFace: PPTX_STYLES.fonts.body,
    fontSize: 26,
    italic: true,
    color: PPTX_STYLES.colors.black,
    lineSpacing: 40
  });

  // Referencia
  if (slide.content.subtitle) {
    pptSlide.addText(`— ${slide.content.subtitle}`, {
      x: 0.5,
      y: 5.8,
      w: 9,
      h: 0.5,
      align: 'center',
      fontFace: PPTX_STYLES.fonts.body,
      fontSize: 18,
      color: PPTX_STYLES.colors.amber
    });
  }
}

/**
 * Renderiza slide de bendición
 */
function renderBlessingSlide(pptSlide: pptxgen.Slide, slide: Slide): void {
  // Separador superior
  addSeparator(pptSlide, 2.5);

  // Texto de bendición
  pptSlide.addText(slide.content.primary, {
    x: 0.5,
    y: 2.8,
    w: 9,
    h: 2,
    align: 'center',
    valign: 'middle',
    fontFace: PPTX_STYLES.fonts.heading,
    fontSize: 36,
    color: PPTX_STYLES.colors.amber,
    charSpacing: 2,
    lineSpacing: 48
  });

  // Separador inferior
  addSeparator(pptSlide, 5);
}

/**
 * Renderiza slide de anuncio (texto)
 */
function renderAnnouncementSlide(pptSlide: pptxgen.Slide, slide: Slide): void {
  pptSlide.addText(slide.content.primary, {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 4.5,
    align: 'center',
    valign: 'middle',
    fontFace: PPTX_STYLES.fonts.body,
    fontSize: 22,
    color: PPTX_STYLES.colors.grayMedium,
    lineSpacing: 36
  });
}

/**
 * Renderiza slide por defecto
 */
function renderDefaultSlide(pptSlide: pptxgen.Slide, slide: Slide): void {
  pptSlide.addText(slide.content.primary || '(Sin contenido)', {
    x: 0.5,
    y: 1.5,
    w: 9,
    h: 4.5,
    align: 'center',
    valign: 'middle',
    fontFace: PPTX_STYLES.fonts.body,
    fontSize: 24,
    color: PPTX_STYLES.colors.black,
    lineSpacing: 38
  });

  if (slide.content.secondary) {
    addSeparator(pptSlide, 4);
    pptSlide.addText(slide.content.secondary, {
      x: 0.5,
      y: 4.3,
      w: 9,
      h: 2,
      align: 'center',
      valign: 'middle',
      fontFace: PPTX_STYLES.fonts.body,
      fontSize: 24,
      bold: true,
      color: PPTX_STYLES.colors.amber,
      lineSpacing: 38
    });
  }
}

/**
 * Agrega logo CASA en esquina superior derecha
 */
function addCasaLogo(pptSlide: pptxgen.Slide): void {
  if (CASA_LOGO_BASE64) {
    pptSlide.addImage({
      data: CASA_LOGO_BASE64,
      x: PPTX_STYLES.layout.logoPosition.x,
      y: PPTX_STYLES.layout.logoPosition.y,
      w: PPTX_STYLES.layout.logoSize,
      h: PPTX_STYLES.layout.logoSize
    });
  }
}

/**
 * Agrega indicador de slide (ej: 3/15)
 */
function addSlideIndicator(pptSlide: pptxgen.Slide, order: number, total: number): void {
  pptSlide.addText(`${order}/${total}`, {
    x: 8.8,
    y: 7,
    w: 1,
    h: 0.3,
    align: 'right',
    fontFace: PPTX_STYLES.fonts.body,
    fontSize: 12,
    color: PPTX_STYLES.colors.grayMedium
  });
}
```

### Modificar: `src/lib/liturgia/exportService.ts`

Actualizar la función `exportToPPTX`:

```typescript
import {
  shouldUseImageRendering,
  renderSlideNative,
  preloadLogo
} from './pptxNativeRenderer';

async function exportToPPTX(
  elements: Map<LiturgyElementType, LiturgyElement>,
  elementOrder: LiturgyElementType[],
  liturgyContext: LiturgyContext | null,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  const pptx = new pptxgen();

  // Configurar presentación 4:3
  pptx.defineLayout({ name: 'CASA_4_3', width: 10, height: 7.5 });
  pptx.layout = 'CASA_4_3';
  pptx.title = liturgyContext?.title || 'Liturgia CASA';
  pptx.author = 'CASA - Comunidad Anglicana San Andrés';

  // Recolectar todos los slides
  const allSlides = collectAllSlides(elements, elementOrder);

  if (allSlides.length === 0) {
    throw new Error('No hay slides para exportar');
  }

  // Precargar recursos
  onProgress?.(0, allSlides.length, 'Preparando recursos...');
  await preloadLogo();

  // Solo precargar imágenes para slides que las necesitan
  const imageSlides = allSlides.filter(shouldUseImageRendering);
  if (imageSlides.length > 0) {
    await preloadExternalImages(imageSlides);
  }

  // Renderizar cada slide
  for (let i = 0; i < allSlides.length; i++) {
    const slide = allSlides[i];
    const pptSlide = pptx.addSlide();

    if (shouldUseImageRendering(slide)) {
      // Slides con imágenes: renderizar como imagen
      onProgress?.(i + 1, allSlides.length, `Renderizando imagen ${i + 1}/${allSlides.length}`);
      const imageData = await renderSlideToImage(slide);
      pptSlide.addImage({
        data: imageData,
        x: 0,
        y: 0,
        w: '100%',
        h: '100%',
      });
    } else {
      // Slides de texto: usar renderizado nativo
      onProgress?.(i + 1, allSlides.length, `Creando slide ${i + 1}/${allSlides.length}`);
      renderSlideNative(pptSlide, slide);
    }
  }

  // Descargar archivo
  onProgress?.(allSlides.length, allSlides.length, 'Generando archivo...');
  const fileName = generateFileName(liturgyContext, 'pptx');
  await pptx.writeFile({ fileName });
}
```

## Verificación

Después de implementar, verificar:

1. **Fondo correcto**: Todos los slides tienen fondo blanco `#F7F7F7`, no gris
2. **Calidad de texto**: Texto nítido y escalable (no pixelado)
3. **Estilos aplicados**:
   - Títulos: Georgia (Merriweather fallback), mayúsculas, separadores ámbar
   - Letras: Arial (Montserrat fallback), centrado
   - Oraciones congregación: Texto ámbar `#D4A853`, bold
   - Lecturas: Texto en itálica con referencia
4. **Logo CASA**: Visible en esquina superior derecha (excepto títulos)
5. **Indicador**: Visible en esquina inferior derecha (ej: 3/15)
6. **Portadas/Cuentacuentos**: Renderizados como imagen con ilustración

### Tests de Compatibilidad

1. **PowerPoint (Windows)**: Abrir y verificar fuentes
2. **Keynote (Mac)**: Abrir PPTX y verificar
3. **Google Slides**: Subir a Drive y convertir
4. **LibreOffice Impress**: Verificar compatibilidad

## Notas Técnicas

- pptxgenjs usa **pulgadas** para posicionamiento (10" x 7.5" = 4:3)
- Colores **sin #** (ej: `'D4A853'` no `'#D4A853'`)
- Logo necesita convertirse a **base64** para incluir en PPTX
- Fuentes: Usar fallbacks seguros (Georgia, Arial) ya que Merriweather/Montserrat pueden no estar instaladas

---

## Problema Pendiente: Slides con Imagen

Los slides que usan html2canvas (portadas, cuentacuentos, anuncios con imagen) pueden seguir teniendo fondo gris y baja resolución.

### Solución: Configurar html2canvas correctamente

Modificar `src/lib/liturgia/slideRenderer.ts`:

```typescript
import html2canvas from 'html2canvas';

export async function renderSlideToImage(slide: Slide): Promise<string> {
  // Crear contenedor temporal
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '1024px';
  container.style.height = '768px';
  document.body.appendChild(container);

  // Renderizar el componente React
  const root = createRoot(container);
  root.render(<UniversalSlide slide={slide} scale={1} showIndicator={true} />);

  // Esperar renderizado
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    // CONFIGURACIÓN CLAVE para resolver fondo gris y resolución
    const canvas = await html2canvas(container, {
      // Forzar fondo blanco
      backgroundColor: '#F7F7F7',

      // Aumentar resolución (2x = 2048x1536)
      scale: 2,

      // Usar canvas nativo para mejor calidad
      useCORS: true,
      allowTaint: false,

      // Logging para debug
      logging: false,

      // Dimensiones explícitas
      width: 1024,
      height: 768,

      // Evitar problemas de scroll
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1024,
      windowHeight: 768,
    });

    return canvas.toDataURL('image/png');
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
```

### Cambios Clave

1. **`backgroundColor: '#F7F7F7'`** - Fuerza el fondo blanco correcto
2. **`scale: 2`** - Duplica la resolución (2048x1536 en lugar de 1024x768)
3. **`useCORS: true`** - Permite cargar imágenes externas correctamente

### Para Anuncios con Imagen (imageUrl de Supabase)

Los anuncios con imagen del generador de gráficos ya vienen como URLs de Supabase. En este caso, podemos insertar la imagen directamente en el PPTX sin usar html2canvas:

```typescript
// En exportToPPTX, caso especial para announcement-image
if (slide.type === 'announcement-image' && slide.content.imageUrl) {
  // Insertar imagen directamente desde URL
  pptSlide.background = { color: 'F7F7F7' };
  pptSlide.addImage({
    path: slide.content.imageUrl,  // URL directa de Supabase
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
  });
} else if (shouldUseImageRendering(slide)) {
  // Portadas y cuentacuentos: usar html2canvas mejorado
  const imageData = await renderSlideToImage(slide);
  pptSlide.addImage({ data: imageData, x: 0, y: 0, w: '100%', h: '100%' });
}
```

### Resumen de Cobertura

| Tipo de Slide | Método | Fondo | Resolución |
|---------------|--------|-------|------------|
| Texto (canciones, oraciones, etc.) | Nativo pptxgenjs | ✅ Correcto | ✅ Escalable |
| Portadas | html2canvas mejorado | ✅ backgroundColor forzado | ✅ scale: 2 |
| Cuentacuentos | html2canvas mejorado | ✅ backgroundColor forzado | ✅ scale: 2 |
| Anuncios con imagen | URL directa | ✅ Imagen original | ✅ Resolución original |

Con estos cambios, **todos los slides** deberían exportarse correctamente.
