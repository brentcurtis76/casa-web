/**
 * Story PDF Exporter - Genera un PDF de libro de cuentos para familias
 * Formato revista: cada página es un spread completo (imagen izquierda + texto derecha)
 */

import jsPDF from 'jspdf';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { Story, StoryScene } from '@/types/shared/story';

// Constantes de diseño - Formato más ancho para spreads
const PAGE_WIDTH = 1056; // 11" x 1.33 para spread más ancho (14.67")
const PAGE_HEIGHT = 612; // 8.5" en pt
const HALF_WIDTH = PAGE_WIDTH / 2; // Mitad para cada lado del spread
const MARGIN = 50; // Márgenes más generosos
const INNER_MARGIN = 30; // Margen interior (donde se une el libro)
const CREAM_BG = { r: 253, g: 248, b: 243 }; // #FDF8F3
const AMBER = { r: 245, g: 158, b: 11 }; // #F59E0B
const BLACK = { r: 26, g: 26, b: 26 }; // #1A1A1A
const GRAY = { r: 156, g: 163, b: 175 }; // #9CA3AF
const SHADOW = { r: 200, g: 200, b: 200 };

/**
 * Exporta un cuento a PDF con diseño de revista/libro ilustrado
 * Cada página es un spread completo: imagen izquierda + texto derecha
 * @param story - El cuento a exportar
 * @param onProgress - Callback opcional para reportar progreso
 * @returns Blob del PDF generado
 */
export async function exportStoryToPDF(
  story: Story,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [PAGE_WIDTH, PAGE_HEIGHT], // Formato personalizado más ancho
  });

  const totalSteps = 1 + story.scenes.length + 1; // portada + escenas + final
  let currentStep = 0;

  // 1. PORTADA (spread: imagen izquierda, título derecha)
  onProgress?.(0, 'Generando portada...');
  await renderCoverSpread(pdf, story);
  currentStep++;

  // 2. SPREADS DE ESCENAS (imagen izquierda + texto derecha en misma página)
  for (let i = 0; i < story.scenes.length; i++) {
    const scene = story.scenes[i];
    const progress = Math.round((currentStep / totalSteps) * 100);
    onProgress?.(progress, `Escena ${i + 1} de ${story.scenes.length}...`);

    pdf.addPage();
    await renderSceneSpread(pdf, scene, i + 1, story.scenes.length);

    currentStep++;
  }

  // 3. PÁGINA FINAL (spread: imagen "Fin" izquierda + reflexión derecha)
  onProgress?.(90, 'Generando página final...');
  pdf.addPage();
  await renderEndSpread(pdf, story);

  onProgress?.(100, '¡PDF listo!');
  return pdf.output('blob');
}

/**
 * Carga una imagen y devuelve sus dimensiones reales junto con los datos base64
 */
async function loadImageWithDimensions(url: string): Promise<{
  data: string;
  width: number;
  height: number;
} | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch image:', url, response.status);
      return null;
    }

    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Crear imagen para obtener dimensiones reales
    const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 1, height: 1 }); // Fallback
      img.src = base64;
    });

    return {
      data: base64,
      width: dimensions.width,
      height: dimensions.height,
    };
  } catch (err) {
    console.error('Error loading image:', url, err);
    return null;
  }
}

/**
 * Calcula las dimensiones para que una imagen quepa en un espacio sin estirarse
 * @param imgWidth - Ancho real de la imagen
 * @param imgHeight - Alto real de la imagen
 * @param maxWidth - Ancho máximo disponible
 * @param maxHeight - Alto máximo disponible
 * @returns Dimensiones que caben en el espacio manteniendo proporción original
 */
function fitImageToSpace(
  imgWidth: number,
  imgHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const imgRatio = imgWidth / imgHeight;
  const spaceRatio = maxWidth / maxHeight;

  if (imgRatio > spaceRatio) {
    // Imagen más ancha que el espacio: ajustar por ancho
    return {
      width: maxWidth,
      height: maxWidth / imgRatio,
    };
  } else {
    // Imagen más alta que el espacio: ajustar por alto
    return {
      width: maxHeight * imgRatio,
      height: maxHeight,
    };
  }
}

/**
 * SPREAD: Portada - imagen izquierda + título derecha
 */
async function renderCoverSpread(pdf: jsPDF, story: Story): Promise<void> {
  // === LADO IZQUIERDO: Imagen de portada ===
  if (story.coverImageUrl) {
    const imgInfo = await loadImageWithDimensions(story.coverImageUrl);
    if (imgInfo) {
      const imgMargin = 25;
      const maxImgWidth = HALF_WIDTH - imgMargin - INNER_MARGIN;
      const maxImgHeight = PAGE_HEIGHT - imgMargin * 2;

      // Usar dimensiones REALES de la imagen para mantener proporción exacta
      const { width: imgWidth, height: imgHeight } = fitImageToSpace(
        imgInfo.width,
        imgInfo.height,
        maxImgWidth,
        maxImgHeight
      );

      // Centrar la imagen en el lado izquierdo
      const x = imgMargin + (maxImgWidth - imgWidth) / 2;
      const y = imgMargin + (maxImgHeight - imgHeight) / 2;

      // Sombra sutil
      pdf.setFillColor(SHADOW.r, SHADOW.g, SHADOW.b);
      pdf.roundedRect(x + 6, y + 6, imgWidth, imgHeight, 10, 10, 'F');

      // Imagen
      pdf.addImage(imgInfo.data, 'PNG', x, y, imgWidth, imgHeight);

      // Borde sutil
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(1);
      pdf.roundedRect(x, y, imgWidth, imgHeight, 10, 10, 'S');
    }
  }

  // === LADO DERECHO: Título y metadata ===
  // Fondo crema en lado derecho
  pdf.setFillColor(CREAM_BG.r, CREAM_BG.g, CREAM_BG.b);
  pdf.rect(HALF_WIDTH, 0, HALF_WIDTH, PAGE_HEIGHT, 'F');

  // Borde decorativo en lado derecho
  const borderMargin = 30;
  pdf.setDrawColor(AMBER.r, AMBER.g, AMBER.b);
  pdf.setLineWidth(1.5);
  pdf.roundedRect(
    HALF_WIDTH + borderMargin,
    borderMargin,
    HALF_WIDTH - borderMargin * 2,
    PAGE_HEIGHT - borderMargin * 2,
    12,
    12,
    'S'
  );

  // Título del cuento (centrado verticalmente en lado derecho)
  const rightCenterX = HALF_WIDTH + HALF_WIDTH / 2;
  const titleY = PAGE_HEIGHT / 2 - 40;

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(28);
  pdf.setTextColor(BLACK.r, BLACK.g, BLACK.b);

  // Dividir título en líneas si es muy largo
  const titleWidth = HALF_WIDTH - borderMargin * 2 - 40;
  const titleLines = pdf.splitTextToSize(story.title, titleWidth);
  titleLines.forEach((line: string, i: number) => {
    pdf.text(line, rightCenterX, titleY + i * 36, { align: 'center' });
  });

  // Subtítulo
  const subtitleY = titleY + titleLines.length * 36 + 30;
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(14);
  pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  pdf.text('Un cuento para la familia', rightCenterX, subtitleY, { align: 'center' });

  // Línea decorativa
  pdf.setDrawColor(AMBER.r, AMBER.g, AMBER.b);
  pdf.setLineWidth(2);
  const lineWidth = 60;
  pdf.line(
    rightCenterX - lineWidth / 2,
    subtitleY + 25,
    rightCenterX + lineWidth / 2,
    subtitleY + 25
  );

  // Logo CASA al pie
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  pdf.text('CASA', rightCenterX, PAGE_HEIGHT - borderMargin - 20, { align: 'center' });
}

/**
 * SPREAD: Escena - imagen izquierda + texto derecha (en misma página)
 */
async function renderSceneSpread(
  pdf: jsPDF,
  scene: StoryScene,
  sceneNum: number,
  totalScenes: number
): Promise<void> {
  // === LADO IZQUIERDO: Imagen de la escena ===
  if (scene.selectedImageUrl) {
    const imgInfo = await loadImageWithDimensions(scene.selectedImageUrl);
    if (imgInfo) {
      const imgMargin = 20;
      const maxImgWidth = HALF_WIDTH - imgMargin - INNER_MARGIN;
      const maxImgHeight = PAGE_HEIGHT - imgMargin * 2;

      // Usar dimensiones REALES de la imagen para mantener proporción exacta
      const { width: imgWidth, height: imgHeight } = fitImageToSpace(
        imgInfo.width,
        imgInfo.height,
        maxImgWidth,
        maxImgHeight
      );

      // Centrar la imagen en el lado izquierdo
      const x = imgMargin + (maxImgWidth - imgWidth) / 2;
      const y = imgMargin + (maxImgHeight - imgHeight) / 2;

      // Sombra sutil
      pdf.setFillColor(SHADOW.r, SHADOW.g, SHADOW.b);
      pdf.roundedRect(x + 4, y + 4, imgWidth, imgHeight, 8, 8, 'F');

      // Imagen
      pdf.addImage(imgInfo.data, 'PNG', x, y, imgWidth, imgHeight);

      // Borde muy sutil
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(x, y, imgWidth, imgHeight, 8, 8, 'S');
    }
  }

  // === LADO DERECHO: Texto del narrador ===
  // Fondo crema en lado derecho
  pdf.setFillColor(CREAM_BG.r, CREAM_BG.g, CREAM_BG.b);
  pdf.rect(HALF_WIDTH, 0, HALF_WIDTH, PAGE_HEIGHT, 'F');

  // Borde decorativo en lado derecho
  const borderMargin = 25;
  pdf.setDrawColor(AMBER.r, AMBER.g, AMBER.b);
  pdf.setLineWidth(1.5);
  pdf.roundedRect(
    HALF_WIDTH + borderMargin,
    borderMargin,
    HALF_WIDTH - borderMargin * 2,
    PAGE_HEIGHT - borderMargin * 2,
    10,
    10,
    'S'
  );

  // Esquinas decorativas
  const cornerSize = 5;
  const rightBorderLeft = HALF_WIDTH + borderMargin;
  const rightBorderRight = PAGE_WIDTH - borderMargin;
  const corners = [
    { x: rightBorderLeft - cornerSize / 2, y: borderMargin - cornerSize / 2 },
    { x: rightBorderRight - cornerSize / 2, y: borderMargin - cornerSize / 2 },
    { x: rightBorderLeft - cornerSize / 2, y: PAGE_HEIGHT - borderMargin - cornerSize / 2 },
    { x: rightBorderRight - cornerSize / 2, y: PAGE_HEIGHT - borderMargin - cornerSize / 2 },
  ];
  pdf.setFillColor(AMBER.r, AMBER.g, AMBER.b);
  corners.forEach((corner) => {
    pdf.roundedRect(corner.x, corner.y, cornerSize, cornerSize, 1, 1, 'F');
  });

  // Centro del lado derecho
  const rightCenterX = HALF_WIDTH + HALF_WIDTH / 2;

  // Número de escena con estilo elegante
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(AMBER.r, AMBER.g, AMBER.b);
  const sceneLabel = `~ ${sceneNum} ~`;
  pdf.text(sceneLabel, rightCenterX, borderMargin + 35, { align: 'center' });

  // Línea decorativa bajo el número
  pdf.setLineWidth(0.5);
  const decorLineWidth = 35;
  pdf.line(
    rightCenterX - decorLineWidth / 2,
    borderMargin + 45,
    rightCenterX + decorLineWidth / 2,
    borderMargin + 45
  );

  // Texto del narrador (centrado verticalmente)
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(15);
  pdf.setTextColor(BLACK.r, BLACK.g, BLACK.b);

  const textPadding = 35;
  const textWidth = HALF_WIDTH - borderMargin * 2 - textPadding;
  const lines = pdf.splitTextToSize(scene.text, textWidth);
  const lineHeight = 24;
  const textBlockHeight = lines.length * lineHeight;

  // Calcular posición vertical centrada (entre header y footer)
  const headerHeight = 60;
  const footerHeight = 35;
  const availableHeight = PAGE_HEIGHT - borderMargin * 2 - headerHeight - footerHeight;
  const startY = borderMargin + headerHeight + (availableHeight - textBlockHeight) / 2;

  lines.forEach((line: string, i: number) => {
    pdf.text(line, rightCenterX, startY + i * lineHeight, { align: 'center' });
  });

  // Numeración discreta en esquina inferior derecha
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  pdf.text(
    `${sceneNum} de ${totalScenes}`,
    PAGE_WIDTH - borderMargin - 15,
    PAGE_HEIGHT - borderMargin + 8,
    { align: 'right' }
  );
}

/**
 * SPREAD: Final - imagen "Fin" izquierda + reflexión derecha
 */
async function renderEndSpread(pdf: jsPDF, story: Story): Promise<void> {
  // === LADO IZQUIERDO: Imagen "Fin" ===
  if (story.endImageUrl) {
    const imgInfo = await loadImageWithDimensions(story.endImageUrl);
    if (imgInfo) {
      const imgMargin = 20;
      const maxImgWidth = HALF_WIDTH - imgMargin - INNER_MARGIN;
      const maxImgHeight = PAGE_HEIGHT - imgMargin * 2;

      // Usar dimensiones REALES de la imagen para mantener proporción exacta
      const { width: imgWidth, height: imgHeight } = fitImageToSpace(
        imgInfo.width,
        imgInfo.height,
        maxImgWidth,
        maxImgHeight
      );

      // Centrar la imagen en el lado izquierdo
      const x = imgMargin + (maxImgWidth - imgWidth) / 2;
      const y = imgMargin + (maxImgHeight - imgHeight) / 2;

      // Sombra sutil
      pdf.setFillColor(SHADOW.r, SHADOW.g, SHADOW.b);
      pdf.roundedRect(x + 4, y + 4, imgWidth, imgHeight, 8, 8, 'F');

      // Imagen
      pdf.addImage(imgInfo.data, 'PNG', x, y, imgWidth, imgHeight);

      // Borde sutil
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.5);
      pdf.roundedRect(x, y, imgWidth, imgHeight, 8, 8, 'S');
    }
  }

  // === LADO DERECHO: Reflexión espiritual ===
  // Fondo crema en lado derecho
  pdf.setFillColor(CREAM_BG.r, CREAM_BG.g, CREAM_BG.b);
  pdf.rect(HALF_WIDTH, 0, HALF_WIDTH, PAGE_HEIGHT, 'F');

  // Borde decorativo en lado derecho
  const borderMargin = 25;
  pdf.setDrawColor(AMBER.r, AMBER.g, AMBER.b);
  pdf.setLineWidth(1.5);
  pdf.roundedRect(
    HALF_WIDTH + borderMargin,
    borderMargin,
    HALF_WIDTH - borderMargin * 2,
    PAGE_HEIGHT - borderMargin * 2,
    10,
    10,
    'S'
  );

  // Esquinas decorativas
  const cornerSize = 5;
  const rightBorderLeft = HALF_WIDTH + borderMargin;
  const rightBorderRight = PAGE_WIDTH - borderMargin;
  const corners = [
    { x: rightBorderLeft - cornerSize / 2, y: borderMargin - cornerSize / 2 },
    { x: rightBorderRight - cornerSize / 2, y: borderMargin - cornerSize / 2 },
    { x: rightBorderLeft - cornerSize / 2, y: PAGE_HEIGHT - borderMargin - cornerSize / 2 },
    { x: rightBorderRight - cornerSize / 2, y: PAGE_HEIGHT - borderMargin - cornerSize / 2 },
  ];
  pdf.setFillColor(AMBER.r, AMBER.g, AMBER.b);
  corners.forEach((corner) => {
    pdf.roundedRect(corner.x, corner.y, cornerSize, cornerSize, 1, 1, 'F');
  });

  // Centro del lado derecho
  const rightCenterX = HALF_WIDTH + HALF_WIDTH / 2;

  // Título "Para reflexionar en familia"
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(17);
  pdf.setTextColor(AMBER.r, AMBER.g, AMBER.b);
  pdf.text('Para reflexionar en familia', rightCenterX, borderMargin + 50, { align: 'center' });

  // Línea decorativa
  pdf.setLineWidth(0.5);
  const decorLineWidth = 50;
  pdf.line(
    rightCenterX - decorLineWidth / 2,
    borderMargin + 65,
    rightCenterX + decorLineWidth / 2,
    borderMargin + 65
  );

  // Conexión espiritual
  if (story.spiritualConnection) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(14);
    pdf.setTextColor(BLACK.r, BLACK.g, BLACK.b);

    const textPadding = 30;
    const textWidth = HALF_WIDTH - borderMargin * 2 - textPadding;
    const lines = pdf.splitTextToSize(story.spiritualConnection, textWidth);
    const lineHeight = 22;
    const textBlockHeight = lines.length * lineHeight;

    // Calcular posición vertical centrada (entre header y footer)
    const headerHeight = 80;
    const footerHeight = 50;
    const availableHeight = PAGE_HEIGHT - borderMargin * 2 - headerHeight - footerHeight;
    const startY = borderMargin + headerHeight + (availableHeight - textBlockHeight) / 2;

    lines.forEach((line: string, i: number) => {
      pdf.text(line, rightCenterX, startY + i * lineHeight, { align: 'center' });
    });
  }

  // Separador antes del logo
  pdf.setDrawColor(AMBER.r, AMBER.g, AMBER.b);
  pdf.setLineWidth(1);
  const sepWidth = 25;
  pdf.line(
    rightCenterX - sepWidth / 2,
    PAGE_HEIGHT - borderMargin - 45,
    rightCenterX + sepWidth / 2,
    PAGE_HEIGHT - borderMargin - 45
  );

  // Logo CASA al pie
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  pdf.text('CASA', rightCenterX, PAGE_HEIGHT - borderMargin - 20, { align: 'center' });
}

