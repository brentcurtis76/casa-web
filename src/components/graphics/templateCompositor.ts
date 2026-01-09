/**
 * CASA Template Compositor
 * Genera gráficos con coordenadas exactas de Canva
 * Portado de casa_template.py
 */

// ============================================
// TIPOS
// ============================================
export interface EventData {
  title: string;
  subtitle?: string;
  date: string;
  time: string;
  location: string;
}

export type FormatType = 'ppt_4_3' | 'instagram_post' | 'instagram_story' | 'facebook_post';

export interface GeneratedGraphic {
  format: FormatType;
  base64: string;
  width: number;
  height: number;
}

// Ajustes de ilustración por formato
export interface IllustrationAdjustment {
  scale: number;   // 0.5 a 2.0 (1.0 = tamaño default)
  offsetX: number; // -100 a 100 (porcentaje de desplazamiento)
  offsetY: number; // -100 a 100 (porcentaje de desplazamiento)
  opacity: number; // 0.05 a 1.0 (opacidad de la ilustración, 5% a 100%)
}

export type IllustrationAdjustments = Record<FormatType, IllustrationAdjustment>;

// Ajustes de posición para campos individuales (fecha, hora, ubicación)
export interface FieldPositionAdjustment {
  offsetX: number; // -200 a 200 (píxeles de desplazamiento)
  offsetY: number; // -200 a 200 (píxeles de desplazamiento)
}

export interface FieldPositionAdjustments {
  title: FieldPositionAdjustment;
  subtitle: FieldPositionAdjustment;
  date: FieldPositionAdjustment;
  time: FieldPositionAdjustment;
  location: FieldPositionAdjustment;
}

export type AllFieldPositionAdjustments = Record<FormatType, FieldPositionAdjustments>;

// Valores default para posición de campos (sin ajuste)
export const DEFAULT_FIELD_POSITION_ADJUSTMENTS: AllFieldPositionAdjustments = {
  ppt_4_3: {
    title: { offsetX: 0, offsetY: 0 },
    subtitle: { offsetX: 0, offsetY: 0 },
    date: { offsetX: 0, offsetY: 0 },
    time: { offsetX: 0, offsetY: 0 },
    location: { offsetX: 0, offsetY: 0 },
  },
  instagram_post: {
    title: { offsetX: 0, offsetY: 0 },
    subtitle: { offsetX: 0, offsetY: 0 },
    date: { offsetX: 0, offsetY: 0 },
    time: { offsetX: 0, offsetY: 0 },
    location: { offsetX: 0, offsetY: 0 },
  },
  instagram_story: {
    title: { offsetX: 0, offsetY: 0 },
    subtitle: { offsetX: 0, offsetY: 0 },
    date: { offsetX: 0, offsetY: 0 },
    time: { offsetX: 0, offsetY: 0 },
    location: { offsetX: 0, offsetY: 0 },
  },
  facebook_post: {
    title: { offsetX: 0, offsetY: 0 },
    subtitle: { offsetX: 0, offsetY: 0 },
    date: { offsetX: 0, offsetY: 0 },
    time: { offsetX: 0, offsetY: 0 },
    location: { offsetX: 0, offsetY: 0 },
  },
};

// Valores default por formato (los tamaños actuales del código)
export const DEFAULT_ILLUSTRATION_ADJUSTMENTS: IllustrationAdjustments = {
  ppt_4_3: { scale: 1.0, offsetX: 0, offsetY: 0, opacity: 0.15 },
  instagram_post: { scale: 1.0, offsetX: 0, offsetY: 0, opacity: 0.15 },
  instagram_story: { scale: 1.0, offsetX: 0, offsetY: 0, opacity: 0.15 },
  facebook_post: { scale: 1.0, offsetX: 0, offsetY: 0, opacity: 0.13 }, // FB usa 13% por default
};

// ============================================
// CONSTANTES
// ============================================
const COLORS = {
  amber: { r: 184, g: 146, b: 61 },      // #b8923d - líneas/iconos/detalles
  black: { r: 26, g: 26, b: 26 },        // #1A1A1A - texto título
  cream: { r: 249, g: 247, b: 245 },     // #F9F7F5 - fondo
  white: { r: 255, g: 255, b: 255 },
};

const FORMATS: Record<FormatType, { width: number; height: number; scale: number }> = {
  ppt_4_3: { width: 1024, height: 768, scale: 2 },
  instagram_post: { width: 1080, height: 1080, scale: 2 },
  instagram_story: { width: 1080, height: 1920, scale: 2 },
  facebook_post: { width: 1200, height: 630, scale: 2 },
};

// ============================================
// UTILIDADES
// ============================================
function rgbToString(color: { r: number; g: number; b: number }, alpha = 1): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

/**
 * Divide texto en múltiples líneas para que no exceda maxWidth
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine: string[] = [];

  for (const word of words) {
    const testLine = [...currentLine, word].join(' ');
    const metrics = ctx.measureText(testLine);

    if (metrics.width <= maxWidth) {
      currentLine.push(word);
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine.join(' '));
      }
      currentLine = [word];
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }

  return lines;
}

/**
 * Auto-escala el tamaño de fuente para que el texto quepa en un área específica
 * Devuelve el fontSize óptimo y las líneas de texto ya divididas
 */
function fitTextToArea(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxHeight: number,
  baseFontSize: number,
  minFontSize: number,
  fontWeight: string,
  fontFamily: string,
  lineHeightRatio: number = 0.85 // Ratio de lineHeight respecto al fontSize
): { fontSize: number; lines: string[] } {
  let fontSize = baseFontSize;
  let lines: string[] = [];

  while (fontSize >= minFontSize) {
    // Establecer fuente con el tamaño actual
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    // Procesar texto: reemplazar \\n con \n real
    let processedText = text.replace(/\\n/g, '\n');

    // Si tiene saltos de línea manuales, respetarlos
    if (processedText.includes('\n')) {
      lines = processedText.split('\n');
    } else {
      // Hacer wrap automático
      const words = processedText.split(' ');
      lines = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }

    // Calcular altura total del texto
    const lineHeight = fontSize * lineHeightRatio;
    const totalHeight = lines.length * lineHeight;

    // Verificar que todas las líneas quepan en el ancho
    let allLinesFit = true;
    for (const line of lines) {
      if (ctx.measureText(line).width > maxWidth) {
        allLinesFit = false;
        break;
      }
    }

    // Si cabe en altura y todas las líneas caben en ancho, tenemos el tamaño correcto
    if (totalHeight <= maxHeight && allLinesFit) {
      return { fontSize, lines };
    }

    // Reducir tamaño de fuente
    fontSize -= 4;
  }

  // Si llegamos al mínimo, usar ese tamaño
  ctx.font = `${fontWeight} ${minFontSize}px ${fontFamily}`;
  let processedText = text.replace(/\\n/g, '\n');

  if (processedText.includes('\n')) {
    lines = processedText.split('\n');
  } else {
    const words = processedText.split(' ');
    lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return { fontSize: minFontSize, lines };
}

// ============================================
// ICONOS
// ============================================
function drawCalendarIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: { r: number; g: number; b: number }
): void {
  const lineWidth = Math.max(2, Math.floor(size / 12));
  ctx.strokeStyle = rgbToString(color);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Rectángulo principal
  const rectX = x;
  const rectY = y + size * 0.15;
  const rectW = size;
  const rectH = size * 0.85;
  ctx.strokeRect(rectX, rectY, rectW, rectH);

  // Línea divisoria horizontal (cabecera)
  const divY = y + size * 0.35;
  ctx.beginPath();
  ctx.moveTo(x, divY);
  ctx.lineTo(x + size, divY);
  ctx.stroke();

  // Dos "ganchos" superiores
  const hangWidth = size * 0.15;
  const hangX1 = x + size * 0.25;
  const hangX2 = x + size * 0.75;
  ctx.beginPath();
  ctx.moveTo(hangX1, y + size * 0.15);
  ctx.lineTo(hangX1, y);
  ctx.moveTo(hangX2, y + size * 0.15);
  ctx.lineTo(hangX2, y);
  ctx.stroke();

  // Grid interior (2x3 puntos)
  ctx.fillStyle = rgbToString(color);
  const dotSize = lineWidth * 1.5;
  const gridStartX = x + size * 0.2;
  const gridStartY = y + size * 0.5;
  const gridSpacingX = size * 0.3;
  const gridSpacingY = size * 0.2;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const dotX = gridStartX + col * gridSpacingX;
      const dotY = gridStartY + row * gridSpacingY;
      ctx.beginPath();
      ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawClockIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: { r: number; g: number; b: number }
): void {
  const lineWidth = Math.max(2, Math.floor(size / 12));
  ctx.strokeStyle = rgbToString(color);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2 - lineWidth;

  // Círculo exterior
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Punto central
  ctx.fillStyle = rgbToString(color);
  ctx.beginPath();
  ctx.arc(centerX, centerY, lineWidth, 0, Math.PI * 2);
  ctx.fill();

  // Manecilla de hora (apunta a las 12)
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX, centerY - radius * 0.5);
  ctx.stroke();

  // Manecilla de minutos (apunta a las 3)
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(centerX + radius * 0.65, centerY);
  ctx.stroke();
}

function drawLocationIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: { r: number; g: number; b: number }
): void {
  const lineWidth = Math.max(2, Math.floor(size / 12));
  ctx.strokeStyle = rgbToString(color);
  ctx.fillStyle = rgbToString(color);
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const centerX = x + size / 2;

  // Pin de ubicación clásico (forma de gota invertida)
  // El pin tiene una cabeza circular arriba y termina en punta abajo

  const pinTop = y + size * 0.05;           // Parte superior del pin
  const pinBottom = y + size * 0.95;        // Punta inferior
  const circleRadius = size * 0.32;         // Radio de la parte circular
  const circleCenterY = pinTop + circleRadius; // Centro del círculo

  ctx.beginPath();

  // Dibujar la forma del pin usando arco + curvas bezier
  // Empezamos en el punto izquierdo donde el círculo se une con la punta

  // Arco superior (el círculo del pin) - de 140° a 40° (pasando por arriba)
  // 140° está abajo-izquierda, 40° está abajo-derecha
  const startAngle = Math.PI * 0.75;  // ~135° - lado izquierdo inferior
  const endAngle = Math.PI * 0.25;    // ~45° - lado derecho inferior

  ctx.arc(centerX, circleCenterY, circleRadius, startAngle, endAngle, false);

  // Curva bezier cuadrática desde el lado derecho hacia la punta
  ctx.quadraticCurveTo(
    centerX + circleRadius * 0.3, // Control point X (ligeramente a la derecha)
    circleCenterY + circleRadius * 1.5, // Control point Y
    centerX, // End X (centro - punta)
    pinBottom // End Y (punta)
  );

  // Curva bezier cuadrática desde la punta hacia el lado izquierdo
  ctx.quadraticCurveTo(
    centerX - circleRadius * 0.3, // Control point X (ligeramente a la izquierda)
    circleCenterY + circleRadius * 1.5, // Control point Y
    centerX - circleRadius * Math.cos(Math.PI - startAngle), // End X (lado izquierdo del círculo)
    circleCenterY + circleRadius * Math.sin(Math.PI - startAngle) // End Y
  );

  ctx.closePath();
  ctx.stroke();

  // Punto/círculo interior (el "hueco" del pin)
  const innerRadius = circleRadius * 0.4;
  ctx.beginPath();
  ctx.arc(centerX, circleCenterY, innerRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  type: 'calendar' | 'clock' | 'location',
  x: number,
  y: number,
  size: number,
  color: { r: number; g: number; b: number }
): void {
  switch (type) {
    case 'calendar':
      drawCalendarIcon(ctx, x, y, size, color);
      break;
    case 'clock':
      drawClockIcon(ctx, x, y, size, color);
      break;
    case 'location':
      drawLocationIcon(ctx, x, y, size, color);
      break;
  }
}

// ============================================
// CARGA DE RECURSOS
// ============================================
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
  return loadImage(`data:image/png;base64,${base64}`);
}

/**
 * Procesa una imagen para hacer el fondo blanco/claro transparente
 * Esto permite que la ilustración se integre con el fondo crema del slide
 */
async function processIllustrationWithTransparentBackground(
  sourceImage: HTMLImageElement
): Promise<HTMLCanvasElement> {
  // Crear canvas temporal para procesar la imagen
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sourceImage.width;
  tempCanvas.height = sourceImage.height;
  const tempCtx = tempCanvas.getContext('2d')!;

  // Dibujar imagen original
  tempCtx.drawImage(sourceImage, 0, 0);

  // Obtener datos de píxeles
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imageData.data;

  // Umbral más permisivo para detectar fondos claros (blanco, crema, beige claro)
  // Detectamos píxeles donde todos los canales RGB son altos Y similares entre sí
  const minBrightness = 220; // Mínimo valor para cada canal
  const maxColorDiff = 25;   // Máxima diferencia entre canales (para detectar tonos neutros/claros)

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Verificar si es un píxel claro (todos los canales > minBrightness)
    const isBright = r > minBrightness && g > minBrightness && b > minBrightness;

    // Verificar si los colores son similares (no es un color saturado)
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const isNeutral = (maxChannel - minChannel) < maxColorDiff;

    // Si el píxel es claro y neutro, hacerlo transparente
    if (isBright && isNeutral) {
      data[i + 3] = 0; // Alpha = 0 (transparente)
    }
  }

  // Aplicar cambios
  tempCtx.putImageData(imageData, 0, 0);

  return tempCanvas;
}

// ============================================
// LAYOUTS
// ============================================

/**
 * PPT 4:3 Layout (1024x768 base)
 * Coordenadas exactas de Canva
 */
async function createPptLayout(
  ctx: CanvasRenderingContext2D,
  event: EventData,
  illustrationBase64: string | null,
  logoBase64: string | null,
  width: number,
  height: number,
  illustrationAdj?: IllustrationAdjustment,
  fieldPosAdj?: FieldPositionAdjustments
): Promise<void> {
  const s = width / 1024; // Scale factor
  const lineThickness = Math.round(4 * s);

  // Fondo crema
  ctx.fillStyle = rgbToString(COLORS.cream);
  ctx.fillRect(0, 0, width, height);

  // ILUSTRACIÓN (dibujada primero, detrás de todo)
  // Tamaño base del área: 470x513, pero mantenemos aspect ratio de la imagen
  if (illustrationBase64) {
    try {
      const illustImg = await loadImageFromBase64(illustrationBase64);
      // Procesar para hacer el fondo blanco transparente
      const illust = await processIllustrationWithTransparentBackground(illustImg);

      // Tamaño base del área donde se dibuja la ilustración
      const areaW = 470;
      const areaH = 513;
      const baseX = 530;
      const baseY = 140;

      // Calcular tamaño manteniendo aspect ratio de la imagen original
      const imgAspect = illust.width / illust.height;
      const areaAspect = areaW / areaH;

      let drawW: number, drawH: number;
      if (imgAspect > areaAspect) {
        // Imagen más ancha que el área - ajustar por ancho
        drawW = areaW;
        drawH = areaW / imgAspect;
      } else {
        // Imagen más alta que el área - ajustar por alto
        drawH = areaH;
        drawW = areaH * imgAspect;
      }

      // Aplicar ajustes
      const adj = illustrationAdj || { scale: 1, offsetX: 0, offsetY: 0, opacity: 0.15 };
      const illustW = Math.round(drawW * adj.scale * s);
      const illustH = Math.round(drawH * adj.scale * s);
      // Offset como porcentaje del canvas
      const illustX = Math.round((baseX + (adj.offsetX / 100) * 500) * s);
      const illustY = Math.round((baseY + (adj.offsetY / 100) * 400) * s);

      ctx.globalAlpha = adj.opacity;
      ctx.drawImage(illust, illustX, illustY, illustW, illustH);
      ctx.globalAlpha = 1;
    } catch (e) {
      console.warn('No se pudo cargar ilustración:', e);
    }
  }

  // LÍNEAS ÁMBAR
  ctx.strokeStyle = rgbToString(COLORS.amber);
  ctx.lineWidth = lineThickness;
  ctx.lineCap = 'round';

  // Línea superior izquierda: (77, 83) → (425, 83)
  ctx.beginPath();
  ctx.moveTo(77 * s, 83 * s);
  ctx.lineTo(425 * s, 83 * s);
  ctx.stroke();

  // Línea superior derecha: (599, 83) → (947, 83)
  ctx.beginPath();
  ctx.moveTo(599 * s, 83 * s);
  ctx.lineTo(947 * s, 83 * s);
  ctx.stroke();

  // Línea inferior: (75, 690) → (947, 690)
  ctx.beginPath();
  ctx.moveTo(75 * s, 690 * s);
  ctx.lineTo(947 * s, 690 * s);
  ctx.stroke();

  // LOGO (centrado arriba entre las líneas)
  // Width 110, X 457, Y 34
  if (logoBase64) {
    try {
      const logo = await loadImageFromBase64(logoBase64);
      const logoSize = Math.round(110 * s);
      ctx.drawImage(logo, Math.round(457 * s), Math.round(34 * s), logoSize, logoSize);
    } catch (e) {
      console.warn('No se pudo cargar logo:', e);
    }
  }

  // TÍTULO - Montserrat Light 115px base, auto-escalado si es muy largo
  // Área del título: desde Y=151 hasta Y=420 (antes de los detalles en Y=440)
  const titleStartY = Math.round(151 * s);
  const titleMaxWidth = Math.round(600 * s);
  const titleMaxHeight = Math.round(270 * s); // 420 - 151 = 269px de altura disponible
  const baseTitleFontSize = Math.round(115 * s);
  const minTitleFontSize = Math.round(60 * s);

  const { fontSize: titleFontSize, lines: titleLines } = fitTextToArea(
    ctx,
    event.title,
    titleMaxWidth,
    titleMaxHeight,
    baseTitleFontSize,
    minTitleFontSize,
    '300',
    'Montserrat, sans-serif',
    1.0 // line height ratio
  );

  ctx.font = `300 ${titleFontSize}px Montserrat, sans-serif`;
  ctx.fillStyle = rgbToString(COLORS.black);
  ctx.textBaseline = 'top';

  // Obtener ajustes de posición del título
  const titleAdj = fieldPosAdj?.title || { offsetX: 0, offsetY: 0 };
  let titleY = titleStartY + Math.round(titleAdj.offsetY * s);
  const titleX = Math.round(59 * s) + Math.round(titleAdj.offsetX * s);
  const titleLineSpacing = titleFontSize; // Espaciado igual al tamaño de fuente

  for (const line of titleLines) {
    ctx.fillText(line, titleX, titleY);
    titleY += titleLineSpacing;
  }

  // SUBTÍTULO - Merriweather Italic, debajo del título (solo si hay valor)
  const subtitleAdj = fieldPosAdj?.subtitle || { offsetX: 0, offsetY: 0 };
  if (event.subtitle) {
    const subtitleFontSize = Math.round(36 * s);
    ctx.font = `italic 400 ${subtitleFontSize}px Merriweather, serif`;
    ctx.fillStyle = rgbToString(COLORS.amber);
    const subtitleY = titleY + Math.round(15 * s) + Math.round(subtitleAdj.offsetY * s);
    const subtitleX = Math.round(59 * s) + Math.round(subtitleAdj.offsetX * s);
    ctx.fillText(event.subtitle, subtitleX, subtitleY);
  }

  // Restaurar baseline
  ctx.textBaseline = 'alphabetic';

  // DETALLES - Merriweather Italic 31px (como en Python)
  const detailFontSize = Math.round(31 * s);
  ctx.font = `italic 400 ${detailFontSize}px Merriweather, serif`;
  ctx.fillStyle = rgbToString(COLORS.amber);
  const iconSize = Math.round(40 * s);
  ctx.textBaseline = 'top';

  // Alinear iconos con texto - el icono debe estar centrado con la línea de texto
  const iconOffsetY = Math.round(3 * s); // Pequeño ajuste para alinear icono con texto

  // Obtener ajustes de posición (o defaults)
  const dateAdj = fieldPosAdj?.date || { offsetX: 0, offsetY: 0 };
  const timeAdj = fieldPosAdj?.time || { offsetX: 0, offsetY: 0 };
  const locationAdj = fieldPosAdj?.location || { offsetX: 0, offsetY: 0 };

  // Offset adicional si hay subtítulo (para dar más espacio)
  const subtitleExtraOffset = event.subtitle ? Math.round(50 * s) : 0;

  // Fecha - texto en Y=444 (solo si hay valor)
  if (event.date) {
    const dateY = Math.round(444 * s) + Math.round(dateAdj.offsetY * s) + subtitleExtraOffset;
    const dateIconX = Math.round(75 * s) + Math.round(dateAdj.offsetX * s);
    const dateTextX = Math.round(129 * s) + Math.round(dateAdj.offsetX * s);
    drawIcon(ctx, 'calendar', dateIconX, dateY - iconOffsetY, iconSize, COLORS.amber);
    ctx.fillText(event.date, dateTextX, dateY);
  }

  // Hora - texto en Y=500 (solo si hay valor)
  if (event.time) {
    const timeY = Math.round(500 * s) + Math.round(timeAdj.offsetY * s) + subtitleExtraOffset;
    const timeIconX = Math.round(77 * s) + Math.round(timeAdj.offsetX * s);
    const timeTextX = Math.round(129 * s) + Math.round(timeAdj.offsetX * s);
    drawIcon(ctx, 'clock', timeIconX, timeY - iconOffsetY, Math.round(39 * s), COLORS.amber);
    ctx.fillText(event.time, timeTextX, timeY);
  }

  // Ubicación - texto en Y=557 (solo si hay valor)
  if (event.location) {
    const locationY = Math.round(557 * s) + Math.round(locationAdj.offsetY * s) + subtitleExtraOffset;
    const locationIconX = Math.round(75 * s) + Math.round(locationAdj.offsetX * s);
    const locationTextX = Math.round(131 * s) + Math.round(locationAdj.offsetX * s);
    drawIcon(ctx, 'location', locationIconX, locationY - iconOffsetY, iconSize, COLORS.amber);
    ctx.fillText(event.location, locationTextX, locationY);
  }

  ctx.textBaseline = 'alphabetic';
}

/**
 * Instagram Story 9:16 Layout (1080x1920 base)
 * Sin logo ni líneas
 */
async function createIgStoryLayout(
  ctx: CanvasRenderingContext2D,
  event: EventData,
  illustrationBase64: string | null,
  _logoBase64: string | null,
  width: number,
  height: number,
  illustrationAdj?: IllustrationAdjustment,
  fieldPosAdj?: FieldPositionAdjustments
): Promise<void> {
  const s = width / 1080;

  // Fondo crema
  ctx.fillStyle = rgbToString(COLORS.cream);
  ctx.fillRect(0, 0, width, height);

  // ILUSTRACIÓN - área base 954x1041, manteniendo aspect ratio
  if (illustrationBase64) {
    try {
      const illustImg = await loadImageFromBase64(illustrationBase64);
      // Procesar para hacer el fondo blanco transparente
      const illust = await processIllustrationWithTransparentBackground(illustImg);

      // Tamaño base del área
      const areaW = 954;
      const areaH = 1041;
      const baseX = 63;
      const baseY = 750;

      // Calcular tamaño manteniendo aspect ratio
      const imgAspect = illust.width / illust.height;
      const areaAspect = areaW / areaH;

      let drawW: number, drawH: number;
      if (imgAspect > areaAspect) {
        drawW = areaW;
        drawH = areaW / imgAspect;
      } else {
        drawH = areaH;
        drawW = areaH * imgAspect;
      }

      // Aplicar ajustes
      const adj = illustrationAdj || { scale: 1, offsetX: 0, offsetY: 0, opacity: 0.15 };
      const illustW = Math.round(drawW * adj.scale * s);
      const illustH = Math.round(drawH * adj.scale * s);
      // Offset como porcentaje del canvas
      const illustX = Math.round((baseX + (adj.offsetX / 100) * 500) * s);
      const illustY = Math.round((baseY + (adj.offsetY / 100) * 800) * s);

      ctx.globalAlpha = adj.opacity;
      ctx.drawImage(illust, illustX, illustY, illustW, illustH);
      ctx.globalAlpha = 1;
    } catch (e) {
      console.warn('No se pudo cargar ilustración:', e);
    }
  }

  // TÍTULO - Montserrat Regular 175px base, auto-escalado si es muy largo
  // Área del título: desde Y=286 hasta Y=780 (antes de los detalles en Y=807)
  const titleStartY = Math.round(286 * s);
  const titleMaxWidth = Math.round(900 * s);
  const titleMaxHeight = Math.round(490 * s); // 780 - 286 = 494px de altura disponible
  const baseTitleFontSize = Math.round(175 * s);
  const minTitleFontSize = Math.round(90 * s);

  const { fontSize: titleFontSize, lines: titleLines } = fitTextToArea(
    ctx,
    event.title,
    titleMaxWidth,
    titleMaxHeight,
    baseTitleFontSize,
    minTitleFontSize,
    '400',
    'Montserrat, sans-serif',
    1.0
  );

  ctx.font = `400 ${titleFontSize}px Montserrat, sans-serif`;
  ctx.fillStyle = rgbToString(COLORS.black);
  ctx.textBaseline = 'top';

  // Obtener ajustes de posición del título
  const titleAdj = fieldPosAdj?.title || { offsetX: 0, offsetY: 0 };
  let titleY = titleStartY + Math.round(titleAdj.offsetY * s);
  const titleX = Math.round(72 * s) + Math.round(titleAdj.offsetX * s);
  const titleLineSpacing = titleFontSize;

  for (const line of titleLines) {
    ctx.fillText(line, titleX, titleY);
    titleY += titleLineSpacing;
  }

  // SUBTÍTULO - Merriweather Italic, debajo del título (solo si hay valor)
  const subtitleAdj = fieldPosAdj?.subtitle || { offsetX: 0, offsetY: 0 };
  if (event.subtitle) {
    const subtitleFontSize = Math.round(55 * s);
    ctx.font = `italic 400 ${subtitleFontSize}px Merriweather, serif`;
    ctx.fillStyle = rgbToString(COLORS.amber);
    const subtitleY = titleY + Math.round(20 * s) + Math.round(subtitleAdj.offsetY * s);
    const subtitleX = Math.round(72 * s) + Math.round(subtitleAdj.offsetX * s);
    ctx.fillText(event.subtitle, subtitleX, subtitleY);
  }

  // DETALLES - Merriweather Regular 65px
  const detailFontSize = Math.round(65 * s);
  ctx.font = `400 ${detailFontSize}px Merriweather, serif`;
  ctx.fillStyle = rgbToString(COLORS.amber);
  const iconSize = Math.round(69 * s);

  // Los iconos deben estar alineados verticalmente con el texto
  // Con textBaseline='top', el texto empieza en Y. El icono debe empezar un poco más arriba
  // para centrarse visualmente con el texto (ajuste de ~5px hacia arriba)
  const iconOffsetY = Math.round(5 * s); // Pequeño ajuste para centrar icono con texto

  // Obtener ajustes de posición (o defaults)
  const dateAdj = fieldPosAdj?.date || { offsetX: 0, offsetY: 0 };
  const timeAdj = fieldPosAdj?.time || { offsetX: 0, offsetY: 0 };
  const locationAdj = fieldPosAdj?.location || { offsetX: 0, offsetY: 0 };

  // Offset adicional si hay subtítulo (para dar más espacio)
  const subtitleExtraOffset = event.subtitle ? Math.round(80 * s) : 0;

  // Fecha - texto en Y=807, icono alineado (solo si hay valor)
  if (event.date) {
    const dateY = Math.round(807 * s) + Math.round(dateAdj.offsetY * s) + subtitleExtraOffset;
    const dateIconX = Math.round(72 * s) + Math.round(dateAdj.offsetX * s);
    const dateTextX = Math.round(161 * s) + Math.round(dateAdj.offsetX * s);
    drawIcon(ctx, 'calendar', dateIconX, dateY - iconOffsetY, iconSize, COLORS.amber);
    ctx.fillText(event.date, dateTextX, dateY);
  }

  // Hora - texto en Y=970, icono alineado (solo si hay valor)
  if (event.time) {
    const timeY = Math.round(970 * s) + Math.round(timeAdj.offsetY * s) + subtitleExtraOffset;
    const timeIconX = Math.round(72 * s) + Math.round(timeAdj.offsetX * s);
    const timeTextX = Math.round(161 * s) + Math.round(timeAdj.offsetX * s);
    drawIcon(ctx, 'clock', timeIconX, timeY - iconOffsetY, iconSize, COLORS.amber);
    ctx.fillText(event.time, timeTextX, timeY);
  }

  // Ubicación (con wrap) - texto en Y=1133, icono alineado (solo si hay valor)
  if (event.location) {
    const locationStartY = Math.round(1133 * s) + Math.round(locationAdj.offsetY * s) + subtitleExtraOffset;
    const locationIconX = Math.round(72 * s) + Math.round(locationAdj.offsetX * s);
    const locationTextX = Math.round(161 * s) + Math.round(locationAdj.offsetX * s);
    drawIcon(ctx, 'location', locationIconX, locationStartY - iconOffsetY, iconSize, COLORS.amber);
    const maxTextWidth = Math.round(850 * s);
    const locationLines = wrapText(ctx, event.location, maxTextWidth);
    let locY = locationStartY;
    const locLineHeight = Math.round(70 * s);

    for (const line of locationLines) {
      ctx.fillText(line, locationTextX, locY);
      locY += locLineHeight;
    }
  }

  ctx.textBaseline = 'alphabetic';
}

/**
 * Instagram Post 1:1 Layout (1080x1080 base)
 */
async function createIgPostLayout(
  ctx: CanvasRenderingContext2D,
  event: EventData,
  illustrationBase64: string | null,
  logoBase64: string | null,
  width: number,
  height: number,
  illustrationAdj?: IllustrationAdjustment,
  fieldPosAdj?: FieldPositionAdjustments
): Promise<void> {
  const s = width / 1080;
  const lineThickness = Math.round(4 * s);

  // Fondo crema
  ctx.fillStyle = rgbToString(COLORS.cream);
  ctx.fillRect(0, 0, width, height);

  // ILUSTRACIÓN - área base 954x1041, manteniendo aspect ratio
  if (illustrationBase64) {
    try {
      const illustImg = await loadImageFromBase64(illustrationBase64);
      // Procesar para hacer el fondo blanco transparente
      const illust = await processIllustrationWithTransparentBackground(illustImg);

      // Tamaño base del área
      const areaW = 954;
      const areaH = 1041;
      const baseX = 240;
      const baseY = 0;

      // Calcular tamaño manteniendo aspect ratio
      const imgAspect = illust.width / illust.height;
      const areaAspect = areaW / areaH;

      let drawW: number, drawH: number;
      if (imgAspect > areaAspect) {
        drawW = areaW;
        drawH = areaW / imgAspect;
      } else {
        drawH = areaH;
        drawW = areaH * imgAspect;
      }

      // Aplicar ajustes
      const adj = illustrationAdj || { scale: 1, offsetX: 0, offsetY: 0, opacity: 0.15 };
      const illustW = Math.round(drawW * adj.scale * s);
      const illustH = Math.round(drawH * adj.scale * s);
      // Offset como porcentaje del canvas
      const illustX = Math.round((baseX + (adj.offsetX / 100) * 500) * s);
      const illustY = Math.round((baseY + (adj.offsetY / 100) * 500) * s);

      ctx.globalAlpha = adj.opacity;
      ctx.drawImage(illust, illustX, illustY, illustW, illustH);
      ctx.globalAlpha = 1;
    } catch (e) {
      console.warn('No se pudo cargar ilustración:', e);
    }
  }

  // LÍNEAS ÁMBAR
  ctx.strokeStyle = rgbToString(COLORS.amber);
  ctx.lineWidth = lineThickness;
  ctx.lineCap = 'round';

  // Línea superior completa: (42, 109) → (1038, 109)
  ctx.beginPath();
  ctx.moveTo(42 * s, 109 * s);
  ctx.lineTo(1038 * s, 109 * s);
  ctx.stroke();

  // Línea inferior izquierda: (42, 940) → (461, 940)
  ctx.beginPath();
  ctx.moveTo(42 * s, 940 * s);
  ctx.lineTo(461 * s, 940 * s);
  ctx.stroke();

  // Línea inferior derecha: (613, 940) → (1032, 940)
  ctx.beginPath();
  ctx.moveTo(613 * s, 940 * s);
  ctx.lineTo(1032 * s, 940 * s);
  ctx.stroke();

  // LOGO (centrado abajo entre las líneas)
  // Width 87, X 497, Y 901
  if (logoBase64) {
    try {
      const logo = await loadImageFromBase64(logoBase64);
      const logoSize = Math.round(87 * s);
      ctx.drawImage(logo, Math.round(497 * s), Math.round(901 * s), logoSize, logoSize);
    } catch (e) {
      console.warn('No se pudo cargar logo:', e);
    }
  }

  // TÍTULO - Montserrat Regular 140px base, auto-escalado si es muy largo
  // Área del título: desde Y=140 hasta Y=460 (antes de los detalles en Y=486)
  const titleStartY = Math.round(140 * s);
  const titleMaxWidth = Math.round(900 * s);
  const titleMaxHeight = Math.round(320 * s); // 460 - 140 = 320px de altura disponible
  const baseTitleFontSize = Math.round(140 * s);
  const minTitleFontSize = Math.round(70 * s);

  const { fontSize: titleFontSize, lines: titleLines } = fitTextToArea(
    ctx,
    event.title,
    titleMaxWidth,
    titleMaxHeight,
    baseTitleFontSize,
    minTitleFontSize,
    '400',
    'Montserrat, sans-serif',
    1.0
  );

  ctx.font = `400 ${titleFontSize}px Montserrat, sans-serif`;
  ctx.fillStyle = rgbToString(COLORS.black);
  ctx.textBaseline = 'top';

  // Obtener ajustes de posición del título
  const titleAdj = fieldPosAdj?.title || { offsetX: 0, offsetY: 0 };
  let titleY = titleStartY + Math.round(titleAdj.offsetY * s);
  const titleX = Math.round(42 * s) + Math.round(titleAdj.offsetX * s);
  const titleLineSpacing = titleFontSize;

  for (const line of titleLines) {
    ctx.fillText(line, titleX, titleY);
    titleY += titleLineSpacing;
  }

  // SUBTÍTULO - Merriweather Italic, debajo del título (solo si hay valor)
  const subtitleAdj = fieldPosAdj?.subtitle || { offsetX: 0, offsetY: 0 };
  if (event.subtitle) {
    const subtitleFontSize = Math.round(45 * s);
    ctx.font = `italic 400 ${subtitleFontSize}px Merriweather, serif`;
    ctx.fillStyle = rgbToString(COLORS.amber);
    const subtitleY = titleY + Math.round(15 * s) + Math.round(subtitleAdj.offsetY * s);
    const subtitleX = Math.round(42 * s) + Math.round(subtitleAdj.offsetX * s);
    ctx.fillText(event.subtitle, subtitleX, subtitleY);
  }

  // DETALLES - Merriweather Regular 47px
  const detailFontSize = Math.round(47 * s);
  ctx.font = `400 ${detailFontSize}px Merriweather, serif`;
  ctx.fillStyle = rgbToString(COLORS.amber);
  const iconSize = Math.round(52 * s);

  // Alinear iconos con texto
  const iconOffsetY = Math.round(4 * s); // Pequeño ajuste para alinear icono con texto

  // Obtener ajustes de posición (o defaults)
  const dateAdj = fieldPosAdj?.date || { offsetX: 0, offsetY: 0 };
  const timeAdj = fieldPosAdj?.time || { offsetX: 0, offsetY: 0 };
  const locationAdj = fieldPosAdj?.location || { offsetX: 0, offsetY: 0 };

  // Offset adicional si hay subtítulo (para dar más espacio)
  const subtitleExtraOffset = event.subtitle ? Math.round(60 * s) : 0;

  // Fecha - texto en Y=486 (solo si hay valor)
  if (event.date) {
    const dateY = Math.round(486 * s) + Math.round(dateAdj.offsetY * s) + subtitleExtraOffset;
    const dateIconX = Math.round(42 * s) + Math.round(dateAdj.offsetX * s);
    const dateTextX = Math.round(109 * s) + Math.round(dateAdj.offsetX * s);
    drawIcon(ctx, 'calendar', dateIconX, dateY - iconOffsetY, iconSize, COLORS.amber);
    ctx.fillText(event.date, dateTextX, dateY);
  }

  // Hora - texto en Y=613 (solo si hay valor)
  if (event.time) {
    const timeY = Math.round(613 * s) + Math.round(timeAdj.offsetY * s) + subtitleExtraOffset;
    const timeIconX = Math.round(42 * s) + Math.round(timeAdj.offsetX * s);
    const timeTextX = Math.round(109 * s) + Math.round(timeAdj.offsetX * s);
    drawIcon(ctx, 'clock', timeIconX, timeY - iconOffsetY, iconSize, COLORS.amber);
    ctx.fillText(event.time, timeTextX, timeY);
  }

  // Ubicación (con wrap) - texto en Y=740 (solo si hay valor)
  if (event.location) {
    const locationStartY = Math.round(740 * s) + Math.round(locationAdj.offsetY * s) + subtitleExtraOffset;
    const locationIconX = Math.round(42 * s) + Math.round(locationAdj.offsetX * s);
    const locationTextX = Math.round(109 * s) + Math.round(locationAdj.offsetX * s);
    drawIcon(ctx, 'location', locationIconX, locationStartY - iconOffsetY, iconSize, COLORS.amber);
    const maxTextWidth = Math.round(500 * s);
    const locationLines = wrapText(ctx, event.location, maxTextWidth);
    let locY = locationStartY;
    const locLineHeight = Math.round(50 * s);

    for (const line of locationLines) {
      ctx.fillText(line, locationTextX, locY);
      locY += locLineHeight;
    }
  }

  ctx.textBaseline = 'alphabetic';
}

/**
 * Facebook Post Layout (1200x630 base)
 */
async function createFbPostLayout(
  ctx: CanvasRenderingContext2D,
  event: EventData,
  illustrationBase64: string | null,
  logoBase64: string | null,
  width: number,
  height: number,
  illustrationAdj?: IllustrationAdjustment,
  fieldPosAdj?: FieldPositionAdjustments
): Promise<void> {
  const s = width / 1200;
  const lineThickness = Math.round(4 * s);

  // Fondo crema
  ctx.fillStyle = rgbToString(COLORS.cream);
  ctx.fillRect(0, 0, width, height);

  // ILUSTRACIÓN - área base 545x595, manteniendo aspect ratio, opacidad 13%
  if (illustrationBase64) {
    try {
      const illustImg = await loadImageFromBase64(illustrationBase64);
      // Procesar para hacer el fondo blanco transparente
      const illust = await processIllustrationWithTransparentBackground(illustImg);

      // Tamaño base del área
      const areaW = 545;
      const areaH = 595;
      const baseX = 50;
      const baseY = 20;

      // Calcular tamaño manteniendo aspect ratio
      const imgAspect = illust.width / illust.height;
      const areaAspect = areaW / areaH;

      let drawW: number, drawH: number;
      if (imgAspect > areaAspect) {
        drawW = areaW;
        drawH = areaW / imgAspect;
      } else {
        drawH = areaH;
        drawW = areaH * imgAspect;
      }

      // Aplicar ajustes
      const adj = illustrationAdj || { scale: 1, offsetX: 0, offsetY: 0, opacity: 0.13 };
      const illustW = Math.round(drawW * adj.scale * s);
      const illustH = Math.round(drawH * adj.scale * s);
      // Offset como porcentaje del canvas
      const illustX = Math.round((baseX + (adj.offsetX / 100) * 600) * s);
      const illustY = Math.round((baseY + (adj.offsetY / 100) * 300) * s);

      ctx.globalAlpha = adj.opacity;
      ctx.drawImage(illust, illustX, illustY, illustW, illustH);
      ctx.globalAlpha = 1;
    } catch (e) {
      console.warn('No se pudo cargar ilustración:', e);
    }
  }

  // LÍNEAS ÁMBAR
  ctx.strokeStyle = rgbToString(COLORS.amber);
  ctx.lineWidth = lineThickness;
  ctx.lineCap = 'round';

  // Línea superior: (63, 63) → (1137, 63)
  ctx.beginPath();
  ctx.moveTo(63 * s, 63 * s);
  ctx.lineTo(1137 * s, 63 * s);
  ctx.stroke();

  // Línea inferior (corta): (63, 560) → (1025, 560)
  ctx.beginPath();
  ctx.moveTo(63 * s, 560 * s);
  ctx.lineTo(1025 * s, 560 * s);
  ctx.stroke();

  // LOGO (esquina inferior derecha)
  // Width 93, X 1044, Y 512
  if (logoBase64) {
    try {
      const logo = await loadImageFromBase64(logoBase64);
      const logoSize = Math.round(93 * s);
      ctx.drawImage(logo, Math.round(1044 * s), Math.round(512 * s), logoSize, logoSize);
    } catch (e) {
      console.warn('No se pudo cargar logo:', e);
    }
  }

  // TÍTULO - Montserrat Regular 130px base, auto-escalado si es muy largo
  // El título está en el lado izquierdo (columna de 63 a ~600), centrado verticalmente
  // Área vertical disponible: desde línea superior (63) hasta línea inferior (560) = 497px
  const titleAreaTop = 63;
  const titleAreaBottom = 560;
  const titleAreaHeight = titleAreaBottom - titleAreaTop; // 497px
  const titleMaxWidth = Math.round(550 * s); // Más estrecho para FB (columna izquierda)
  const titleMaxHeight = Math.round(400 * s); // Máximo que puede ocupar el título
  const baseTitleFontSize = Math.round(130 * s);
  const minTitleFontSize = Math.round(65 * s);

  const { fontSize: titleFontSize, lines: titleLines } = fitTextToArea(
    ctx,
    event.title,
    titleMaxWidth,
    titleMaxHeight,
    baseTitleFontSize,
    minTitleFontSize,
    '400',
    'Montserrat, sans-serif',
    1.0
  );

  ctx.font = `400 ${titleFontSize}px Montserrat, sans-serif`;
  ctx.fillStyle = rgbToString(COLORS.black);
  ctx.textBaseline = 'top';

  // Calcular altura total del título para centrarlo verticalmente
  const titleLineSpacing = titleFontSize;
  const totalTitleHeight = titleLines.length * titleLineSpacing;

  // Centrar verticalmente dentro del área disponible
  const titleStartY = Math.round((titleAreaTop + (titleAreaHeight - totalTitleHeight / s) / 2) * s);

  // Obtener ajustes de posición del título
  const titleAdj = fieldPosAdj?.title || { offsetX: 0, offsetY: 0 };
  let titleY = titleStartY + Math.round(titleAdj.offsetY * s);
  const titleX = Math.round(63 * s) + Math.round(titleAdj.offsetX * s);

  for (const line of titleLines) {
    ctx.fillText(line, titleX, titleY);
    titleY += titleLineSpacing;
  }

  // SUBTÍTULO - Merriweather Italic, debajo del título (solo si hay valor)
  const subtitleAdj = fieldPosAdj?.subtitle || { offsetX: 0, offsetY: 0 };
  if (event.subtitle) {
    const subtitleFontSize = Math.round(38 * s);
    ctx.font = `italic 400 ${subtitleFontSize}px Merriweather, serif`;
    ctx.fillStyle = rgbToString(COLORS.amber);
    const subtitleY = titleY + Math.round(10 * s) + Math.round(subtitleAdj.offsetY * s);
    const subtitleX = Math.round(63 * s) + Math.round(subtitleAdj.offsetX * s);
    ctx.fillText(event.subtitle, subtitleX, subtitleY);
  }

  // DETALLES - Merriweather Regular 34px
  // Centrados verticalmente en el área entre líneas (Y=63 a Y=560, ~497px)
  const detailFontSize = Math.round(34 * s);
  ctx.font = `400 ${detailFontSize}px Merriweather, serif`;
  ctx.fillStyle = rgbToString(COLORS.amber);
  const iconSize = Math.round(36 * s);

  // Calcular posición vertical centrada
  // Area disponible: desde la línea superior (63) hasta la inferior (560) = 497px
  const detailStartY = 200; // Centrado visualmente
  const detailSpacing = 95; // Espaciado entre cada item

  // Alinear iconos con texto
  const iconOffsetY = Math.round(3 * s); // Pequeño ajuste para alinear icono con texto

  // Obtener ajustes de posición (o defaults)
  const dateAdj = fieldPosAdj?.date || { offsetX: 0, offsetY: 0 };
  const timeAdj = fieldPosAdj?.time || { offsetX: 0, offsetY: 0 };
  const locationAdj = fieldPosAdj?.location || { offsetX: 0, offsetY: 0 };

  // Offset adicional si hay subtítulo (para dar más espacio)
  const subtitleExtraOffset = event.subtitle ? Math.round(40 * s) : 0;

  // Fecha (solo si hay valor)
  if (event.date) {
    const dateY = Math.round(detailStartY * s) + Math.round(dateAdj.offsetY * s) + subtitleExtraOffset;
    const dateIconX = Math.round(645 * s) + Math.round(dateAdj.offsetX * s);
    const dateTextX = Math.round(691 * s) + Math.round(dateAdj.offsetX * s);
    drawIcon(ctx, 'calendar', dateIconX, dateY - iconOffsetY, iconSize, COLORS.amber);
    ctx.fillText(event.date, dateTextX, dateY);
  }

  // Hora (solo si hay valor)
  if (event.time) {
    const timeYPos = Math.round((detailStartY + detailSpacing) * s) + Math.round(timeAdj.offsetY * s) + subtitleExtraOffset;
    const timeIconX = Math.round(645 * s) + Math.round(timeAdj.offsetX * s);
    const timeTextX = Math.round(691 * s) + Math.round(timeAdj.offsetX * s);
    drawIcon(ctx, 'clock', timeIconX, timeYPos - iconOffsetY, iconSize, COLORS.amber);
    ctx.fillText(event.time, timeTextX, timeYPos);
  }

  // Ubicación (con wrap) (solo si hay valor)
  if (event.location) {
    const locationYPos = Math.round((detailStartY + detailSpacing * 2) * s) + Math.round(locationAdj.offsetY * s) + subtitleExtraOffset;
    const locationIconX = Math.round(645 * s) + Math.round(locationAdj.offsetX * s);
    const locationTextX = Math.round(691 * s) + Math.round(locationAdj.offsetX * s);
    drawIcon(ctx, 'location', locationIconX, locationYPos - iconOffsetY, iconSize, COLORS.amber);
    const maxTextWidth = Math.round(430 * s);
    const locationLines = wrapText(ctx, event.location, maxTextWidth);
    let locY = locationYPos;
    const locLineHeight = Math.round(38 * s);

    for (const line of locationLines) {
      ctx.fillText(line, locationTextX, locY);
      locY += locLineHeight;
    }
  }

  ctx.textBaseline = 'alphabetic';
}

// ============================================
// API PÚBLICA
// ============================================

/**
 * Genera un gráfico en el formato especificado
 */
export async function generateGraphic(
  format: FormatType,
  event: EventData,
  illustrationBase64: string | null,
  logoBase64: string | null,
  illustrationAdj?: IllustrationAdjustment,
  fieldPosAdj?: FieldPositionAdjustments
): Promise<GeneratedGraphic> {
  const config = FORMATS[format];
  const width = config.width * config.scale;
  const height = config.height * config.scale;

  // Crear canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No se pudo crear contexto de canvas');
  }

  // Usar ajustes default si no se proporcionan
  const fieldPositions = fieldPosAdj || DEFAULT_FIELD_POSITION_ADJUSTMENTS[format];

  // Renderizar según formato
  switch (format) {
    case 'ppt_4_3':
      await createPptLayout(ctx, event, illustrationBase64, logoBase64, width, height, illustrationAdj, fieldPositions);
      break;
    case 'instagram_story':
      await createIgStoryLayout(ctx, event, illustrationBase64, logoBase64, width, height, illustrationAdj, fieldPositions);
      break;
    case 'instagram_post':
      await createIgPostLayout(ctx, event, illustrationBase64, logoBase64, width, height, illustrationAdj, fieldPositions);
      break;
    case 'facebook_post':
      await createFbPostLayout(ctx, event, illustrationBase64, logoBase64, width, height, illustrationAdj, fieldPositions);
      break;
  }

  // Exportar como base64
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');

  return {
    format,
    base64,
    width,
    height,
  };
}

/**
 * Genera todos los formatos a la vez
 */
export async function generateAllFormats(
  event: EventData,
  illustrationBase64: string | null,
  logoBase64: string | null
): Promise<GeneratedGraphic[]> {
  const formats: FormatType[] = ['ppt_4_3', 'instagram_post', 'instagram_story', 'facebook_post'];
  const results: GeneratedGraphic[] = [];

  for (const format of formats) {
    const graphic = await generateGraphic(format, event, illustrationBase64, logoBase64);
    results.push(graphic);
  }

  return results;
}

/**
 * Precarga las fuentes necesarias
 */
export async function preloadFonts(): Promise<void> {
  const fonts = [
    { family: 'Montserrat', weight: '300' },
    { family: 'Montserrat', weight: '400' },
    { family: 'Merriweather', weight: '400' },
  ];

  await Promise.all(
    fonts.map(async ({ family, weight }) => {
      try {
        await document.fonts.load(`${weight} 48px ${family}`);
      } catch (e) {
        console.warn(`No se pudo cargar fuente ${family} ${weight}:`, e);
      }
    })
  );
}

/**
 * Descarga una imagen generada
 */
export function downloadGraphic(graphic: GeneratedGraphic, eventTitle: string): void {
  const link = document.createElement('a');
  const sanitizedTitle = eventTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  link.download = `casa_${sanitizedTitle}_${graphic.format}.png`;
  link.href = `data:image/png;base64,${graphic.base64}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Descarga todas las imágenes generadas
 */
export async function downloadAllGraphics(
  graphics: GeneratedGraphic[],
  eventTitle: string
): Promise<void> {
  for (const graphic of graphics) {
    downloadGraphic(graphic, eventTitle);
    // Pequeño delay para evitar problemas con múltiples descargas
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}
