/**
 * Servicio de exportación de liturgias CASA
 * Renderiza cada slide como imagen para mantener el diseño exacto
 */

import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import { CASA_BRAND } from '@/lib/brand-kit';
import { renderSlideToImage, preloadExternalImages } from './slideRenderer';
import type { LiturgyElement, LiturgyElementType, LiturgyContext, AnnouncementConfig } from '@/types/shared/liturgy';
import type { Slide } from '@/types/shared/slide';

type ExportFormat = 'pptx' | 'google-slides' | 'keynote' | 'pdf-projection' | 'pdf-celebrant';

interface ExportOptions {
  format: ExportFormat;
  elements: Map<LiturgyElementType, LiturgyElement>;
  elementOrder: LiturgyElementType[];
  liturgyContext: LiturgyContext | null;
  onProgress?: (current: number, total: number, message: string) => void;
}

/**
 * Exporta la liturgia al formato especificado
 */
export async function exportLiturgy(options: ExportOptions): Promise<void> {
  const { format, elements, elementOrder, liturgyContext, onProgress } = options;

  switch (format) {
    case 'pptx':
    case 'google-slides':
    case 'keynote':
      await exportToPPTX(elements, elementOrder, liturgyContext, onProgress);
      break;
    case 'pdf-projection':
      await exportToPDFProjection(elements, elementOrder, liturgyContext, onProgress);
      break;
    case 'pdf-celebrant':
      await exportToCelebrantPDF(elements, elementOrder, liturgyContext);
      break;
    default:
      throw new Error(`Formato de exportación no soportado: ${format}`);
  }
}

/**
 * Genera nombre de archivo para la exportación
 */
function generateFileName(liturgyContext: LiturgyContext | null, extension: string): string {
  const title = liturgyContext?.title || 'Liturgia';
  const date = liturgyContext?.date
    ? new Date(liturgyContext.date).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const safeTitle = title.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '').replace(/\s+/g, '_');
  return `Liturgia_${safeTitle}_${date}.${extension}`;
}

/**
 * Recolecta todos los slides de los elementos
 */
function collectAllSlides(
  elements: Map<LiturgyElementType, LiturgyElement>,
  elementOrder: LiturgyElementType[]
): Slide[] {
  const allSlides: Slide[] = [];

  for (const elementType of elementOrder) {
    const element = elements.get(elementType);
    if (!element || element.status === 'skipped') continue;

    const slideGroup = element.editedSlides || element.slides;
    if (slideGroup?.slides) {
      allSlides.push(...slideGroup.slides);
    }
  }

  return allSlides;
}

/**
 * Exporta a PowerPoint (PPTX) - Cada slide como imagen
 */
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
  pptx.subject = 'Liturgia dominical';

  // Recolectar todos los slides
  const allSlides = collectAllSlides(elements, elementOrder);

  if (allSlides.length === 0) {
    throw new Error('No hay slides para exportar');
  }

  // Precargar imágenes externas
  onProgress?.(0, allSlides.length, 'Preparando imágenes...');
  await preloadExternalImages(allSlides);

  // Renderizar cada slide como imagen
  for (let i = 0; i < allSlides.length; i++) {
    onProgress?.(i + 1, allSlides.length, `Renderizando slide ${i + 1}/${allSlides.length}`);

    const slide = allSlides[i];
    const imageData = await renderSlideToImage(slide);

    // Crear slide en PPTX con la imagen
    const pptSlide = pptx.addSlide();
    pptSlide.addImage({
      data: imageData,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });
  }

  // Descargar archivo
  onProgress?.(allSlides.length, allSlides.length, 'Generando archivo...');
  const fileName = generateFileName(liturgyContext, 'pptx');
  await pptx.writeFile({ fileName });
}

/**
 * Exporta a PDF para proyección - Cada slide como imagen
 */
async function exportToPDFProjection(
  elements: Map<LiturgyElementType, LiturgyElement>,
  elementOrder: LiturgyElementType[],
  liturgyContext: LiturgyContext | null,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<void> {
  // PDF landscape 4:3
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: [1024, 768],
  });

  // Recolectar todos los slides
  const allSlides = collectAllSlides(elements, elementOrder);

  if (allSlides.length === 0) {
    throw new Error('No hay slides para exportar');
  }

  // Precargar imágenes externas
  onProgress?.(0, allSlides.length, 'Preparando imágenes...');
  await preloadExternalImages(allSlides);

  // Renderizar cada slide como imagen
  for (let i = 0; i < allSlides.length; i++) {
    onProgress?.(i + 1, allSlides.length, `Renderizando slide ${i + 1}/${allSlides.length}`);

    if (i > 0) {
      pdf.addPage([1024, 768], 'landscape');
    }

    const slide = allSlides[i];
    const imageData = await renderSlideToImage(slide);

    // Agregar imagen al PDF
    pdf.addImage(imageData, 'PNG', 0, 0, 1024, 768);
  }

  // Descargar archivo
  onProgress?.(allSlides.length, allSlides.length, 'Generando archivo...');
  const fileName = generateFileName(liturgyContext, 'pdf');
  pdf.save(fileName);
}

/**
 * Obtiene el label de un elemento de la liturgia
 */
function getElementLabel(type: LiturgyElementType): string {
  const labels: Record<LiturgyElementType, string> = {
    'portada-principal': 'Portada Principal',
    'oracion-invocacion': 'Oración de Invocación',
    'cancion-invocacion': 'Primera Canción - Invocación',
    'oracion-arrepentimiento': 'Oración de Arrepentimiento',
    'cancion-arrepentimiento': 'Segunda Canción - Arrepentimiento',
    'oracion-gratitud': 'Oración de Gratitud',
    'cancion-gratitud': 'Tercera Canción - Gratitud',
    'lectura-biblica': 'Lectura Bíblica',
    'cuentacuentos': 'Cuentacuentos',
    'portada-reflexion': 'Portada de Reflexión',
    'padre-nuestro': 'Padre Nuestro',
    'paz': 'La Paz',
    'santa-cena': 'Santa Cena',
    'accion-gracias': 'Acción de Gracias',
    'cancion-santa-cena': 'Cuarta Canción - Santa Cena',
    'ofrenda': 'Ofrenda',
    'anuncios': 'Anuncios',
    'bendicion': 'Bendición Final',
  };
  return labels[type] || type;
}

/**
 * Determina la categoría de un elemento de liturgia
 */
function getElementCategory(type: LiturgyElementType): string {
  const categories: Record<LiturgyElementType, string> = {
    'portada-principal': 'portada',
    'portada-reflexion': 'portada',
    'oracion-invocacion': 'oracion',
    'oracion-arrepentimiento': 'oracion',
    'oracion-gratitud': 'oracion',
    'cancion-invocacion': 'cancion',
    'cancion-arrepentimiento': 'cancion',
    'cancion-gratitud': 'cancion',
    'cancion-santa-cena': 'cancion',
    'lectura-biblica': 'lectura',
    'cuentacuentos': 'otro',
    'padre-nuestro': 'fijo',
    'paz': 'fijo',
    'santa-cena': 'fijo',
    'accion-gracias': 'fijo',
    'ofrenda': 'fijo',
    'anuncios': 'otro',
    'bendicion': 'fijo',
  };
  return categories[type] || 'otro';
}

/**
 * Exporta a PDF Guía del Celebrante (documento de texto, no slides)
 * Tamaño carta (letter), diseño elegante con Brand Kit
 */
async function exportToCelebrantPDF(
  elements: Map<LiturgyElementType, LiturgyElement>,
  elementOrder: LiturgyElementType[],
  liturgyContext: LiturgyContext | null
): Promise<void> {
  // Tamaño carta (letter): 215.9mm x 279.4mm
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = 215.9;
  const pageHeight = 279.4;
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);
  let currentY = margin;

  const checkNewPage = (neededSpace: number) => {
    if (currentY + neededSpace > pageHeight - margin) {
      pdf.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  // PORTADA
  await renderCelebrantCoverPage(pdf, liturgyContext, pageWidth, pageHeight);
  pdf.addPage();
  currentY = margin;

  // CONTENIDO
  let elementNumber = 1;

  for (const elementType of elementOrder) {
    const element = elements.get(elementType);
    if (!element) continue;
    if (element.status === 'skipped') continue;

    const slideGroup = element.editedSlides || element.slides;
    const slideCount = slideGroup?.slides?.length || 0;

    // Encabezado del elemento
    checkNewPage(25);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(CASA_BRAND.colors.primary.amber);
    pdf.text(`${elementNumber}.`, margin, currentY);

    pdf.setTextColor(CASA_BRAND.colors.primary.black);
    const elementLabel = getElementLabel(elementType);
    const elementTitle = slideGroup?.title || element.title || elementLabel;
    pdf.text(elementTitle.toUpperCase(), margin + 8, currentY);

    currentY += 8;

    pdf.setDrawColor(CASA_BRAND.colors.secondary.grayLight);
    pdf.setLineWidth(0.5);
    pdf.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;

    const category = getElementCategory(elementType);

    if (category === 'cancion') {
      checkNewPage(15);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(CASA_BRAND.colors.secondary.grayDark);
      pdf.text(`[${slideCount} slides de proyección]`, margin, currentY);
      currentY += 12;
    } else if (category === 'oracion' || category === 'fijo') {
      if (slideGroup?.slides) {
        let lastSpeaker: 'celebrante' | 'congregacion' | null = null;

        for (const slide of slideGroup.slides) {
          // Saltar slides vacíos
          if (!slide.content.primary && !slide.content.secondary) continue;

          // Saltar slides de título - ya tenemos el título en el encabezado de sección
          if (slide.type === 'title') continue;

          checkNewPage(30);

          // Determinar quién habla basándose en el color del texto
          // Ámbar = Congregación, Negro/otros = Celebrante
          const primaryIsAmber = slide.style.primaryColor === CASA_BRAND.colors.primary.amber;

          if (slide.content.primary) {
            const speaker = primaryIsAmber ? 'congregacion' : 'celebrante';

            // Mostrar etiqueta solo cuando cambia el hablante
            if (speaker !== lastSpeaker) {
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(9);
              if (speaker === 'congregacion') {
                pdf.setTextColor(CASA_BRAND.colors.primary.amber);
                pdf.text('CONGREGACIÓN:', margin, currentY);
              } else {
                pdf.setTextColor(CASA_BRAND.colors.secondary.grayMedium);
                pdf.text('CELEBRANTE:', margin, currentY);
              }
              currentY += 5;
              lastSpeaker = speaker;
            }

            // Texto del contenido
            if (speaker === 'congregacion') {
              pdf.setFont('helvetica', 'bold');
            } else {
              pdf.setFont('helvetica', 'normal');
            }
            pdf.setFontSize(11);
            pdf.setTextColor(CASA_BRAND.colors.primary.black);
            const lines = pdf.splitTextToSize(slide.content.primary, contentWidth);
            pdf.text(lines, margin, currentY);
            currentY += lines.length * 5 + 4;
          }

          // Para slides tipo antiphonal que tienen primary (celebrante) y secondary (congregación)
          if (slide.content.secondary) {
            checkNewPage(20);

            // Secondary siempre es congregación
            if (lastSpeaker !== 'congregacion') {
              pdf.setFont('helvetica', 'bold');
              pdf.setFontSize(9);
              pdf.setTextColor(CASA_BRAND.colors.primary.amber);
              pdf.text('CONGREGACIÓN:', margin, currentY);
              currentY += 5;
              lastSpeaker = 'congregacion';
            }

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(CASA_BRAND.colors.primary.black);
            const lines = pdf.splitTextToSize(slide.content.secondary, contentWidth);
            pdf.text(lines, margin, currentY);
            currentY += lines.length * 5 + 4;
          }
        }
      }
      currentY += 4;
    } else if (elementType === 'lectura-biblica') {
      if (liturgyContext?.readings && liturgyContext.readings.length > 0) {
        for (const reading of liturgyContext.readings) {
          checkNewPage(30);

          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(10);
          pdf.setTextColor(CASA_BRAND.colors.secondary.grayMedium);
          pdf.text(`${reading.reference} (${reading.version})`, margin, currentY);
          currentY += 6;

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(CASA_BRAND.colors.primary.black);
          const lines = pdf.splitTextToSize(reading.text, contentWidth);

          for (const line of lines) {
            checkNewPage(6);
            pdf.text(line, margin, currentY);
            currentY += 5;
          }
          currentY += 6;
        }
      }
    } else if (elementType === 'cuentacuentos') {
      checkNewPage(25);
      const storyData = (element.config as { storyData?: { title?: string; spiritualConnection?: string } })?.storyData;

      if (storyData?.title) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(11);
        pdf.setTextColor(CASA_BRAND.colors.secondary.grayDark);
        pdf.text('Cuento para niños: ', margin, currentY);
        const labelWidth = pdf.getTextWidth('Cuento para niños: ');
        pdf.setFont('helvetica', 'italic');
        pdf.text(`"${storyData.title}"`, margin + labelWidth, currentY);
        currentY += 6;
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(CASA_BRAND.colors.secondary.grayMedium);
      pdf.text(`[${slideCount} slides - ver pantalla]`, margin, currentY);
      currentY += 8;

      if (storyData?.spiritualConnection) {
        checkNewPage(20);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setTextColor(CASA_BRAND.colors.primary.amber);
        pdf.text('Conexión espiritual:', margin, currentY);
        currentY += 5;

        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(10);
        pdf.setTextColor(CASA_BRAND.colors.primary.black);
        const lines = pdf.splitTextToSize(storyData.spiritualConnection, contentWidth);
        pdf.text(lines, margin, currentY);
        currentY += lines.length * 4.5 + 4;
      }
      currentY += 4;
    } else if (elementType === 'anuncios') {
      const announcementConfigs = (element.config as { announcementConfigs?: AnnouncementConfig[] })?.announcementConfigs;

      if (announcementConfigs && announcementConfigs.length > 0) {
        for (const announcement of announcementConfigs) {
          checkNewPage(45);

          // Título del anuncio con presenter si existe
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
          pdf.setTextColor(CASA_BRAND.colors.primary.black);

          let titleText = `• ${announcement.title}`;
          if (announcement.presenter) {
            titleText += ` (${announcement.presenter})`;
          }

          const titleLines = pdf.splitTextToSize(titleText, contentWidth);
          pdf.text(titleLines, margin, currentY);
          currentY += titleLines.length * 5 + 3;

          if (announcement.content) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(CASA_BRAND.colors.secondary.grayDark);
            const contentLines = pdf.splitTextToSize(announcement.content, contentWidth - 5);
            pdf.text(contentLines, margin + 3, currentY);
            currentY += contentLines.length * 5 + 3;
          }

          if (announcement.date || announcement.location) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(CASA_BRAND.colors.secondary.grayMedium);

            if (announcement.location) {
              pdf.text(`Lugar: ${announcement.location}`, margin + 3, currentY);
              currentY += 5;
            }
            if (announcement.date) {
              pdf.text(`Fecha: ${announcement.date}`, margin + 3, currentY);
              currentY += 5;
            }
          }
          currentY += 8;
        }
      } else {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(CASA_BRAND.colors.secondary.grayMedium);
        pdf.text('[Sin anuncios configurados]', margin, currentY);
        currentY += 8;
      }
    } else if (category === 'portada') {
      checkNewPage(15);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(CASA_BRAND.colors.secondary.grayMedium);
      pdf.text('[Slide de portada - ver proyección]', margin, currentY);
      currentY += 12;
    }

    currentY += 8;
    elementNumber++;
  }

  const fileName = generateFileName(liturgyContext, 'pdf').replace('.pdf', '_Celebrante.pdf');
  pdf.save(fileName);
}

/**
 * Renderiza la portada del PDF del celebrante
 * Diseño elegante con Brand Kit CASA
 */
async function renderCelebrantCoverPage(
  pdf: jsPDF,
  liturgyContext: LiturgyContext | null,
  pageWidth: number,
  pageHeight: number
): Promise<void> {
  const centerX = pageWidth / 2;
  const margin = 20;

  // Fondo blanco
  pdf.setFillColor(CASA_BRAND.colors.primary.white);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // Barra superior ámbar
  pdf.setFillColor(CASA_BRAND.colors.primary.amber);
  pdf.rect(0, 0, pageWidth, 8, 'F');

  // Marco decorativo
  pdf.setDrawColor(CASA_BRAND.colors.secondary.grayLight);
  pdf.setLineWidth(0.3);
  pdf.rect(margin - 5, margin + 10, pageWidth - (margin * 2) + 10, pageHeight - (margin * 2) - 15);

  // Línea decorativa interior
  pdf.setDrawColor(CASA_BRAND.colors.primary.amber);
  pdf.setLineWidth(0.5);
  pdf.rect(margin, margin + 15, pageWidth - (margin * 2), pageHeight - (margin * 2) - 25);

  // Logo CASA (cargar como imagen)
  try {
    const logoUrl = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';
    const logoResponse = await fetch(logoUrl);
    if (logoResponse.ok) {
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      // Logo centrado en la parte superior
      pdf.addImage(logoBase64, 'PNG', centerX - 15, 45, 30, 30);
    }
  } catch {
    // Si no se puede cargar el logo, continuar sin él
  }

  // Título principal
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(28);
  pdf.setTextColor(CASA_BRAND.colors.primary.black);
  pdf.text('GUÍA LITÚRGICA', centerX, 95, { align: 'center' });

  // Separador decorativo con punto ámbar
  const separatorY = 105;
  pdf.setDrawColor(CASA_BRAND.colors.secondary.grayLight);
  pdf.setLineWidth(0.5);
  pdf.line(centerX - 50, separatorY, centerX - 8, separatorY);
  pdf.line(centerX + 8, separatorY, centerX + 50, separatorY);

  // Punto ámbar central
  pdf.setFillColor(CASA_BRAND.colors.primary.amber);
  pdf.circle(centerX, separatorY, 3, 'F');

  // Subtítulo (título de la liturgia)
  if (liturgyContext?.title) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(14);
    pdf.setTextColor(CASA_BRAND.colors.secondary.grayDark);
    pdf.text(liturgyContext.title, centerX, 125, { align: 'center' });
  }

  // Fecha
  if (liturgyContext?.date) {
    const dateStr = new Date(liturgyContext.date).toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    // Capitalizar primera letra
    const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(CASA_BRAND.colors.primary.black);
    pdf.text(formattedDate, centerX, 140, { align: 'center' });
  }

  // Información del celebrante y predicador en un recuadro
  const infoBoxY = 160;
  const infoBoxHeight = 40;

  pdf.setFillColor('#FAFAFA');
  pdf.roundedRect(margin + 30, infoBoxY, pageWidth - (margin * 2) - 60, infoBoxHeight, 3, 3, 'F');

  let infoY = infoBoxY + 15;

  if (liturgyContext?.celebrant) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(CASA_BRAND.colors.primary.amber);
    pdf.text('Celebrante:', centerX - 5, infoY, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(CASA_BRAND.colors.primary.black);
    pdf.text(liturgyContext.celebrant, centerX + 5, infoY);
    infoY += 12;
  }

  if (liturgyContext?.preacher) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(CASA_BRAND.colors.primary.amber);
    pdf.text('Predicador:', centerX - 5, infoY, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(CASA_BRAND.colors.primary.black);
    pdf.text(liturgyContext.preacher, centerX + 5, infoY);
  }

  // Barra inferior ámbar
  pdf.setFillColor(CASA_BRAND.colors.primary.amber);
  pdf.rect(0, pageHeight - 8, pageWidth, 8, 'F');
}
