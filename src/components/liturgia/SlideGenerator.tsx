/**
 * SlideGenerator - Generador de slides en formato 4:3 usando Canvas
 * Incluye exportación a PDF individual y completo
 */

import { useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, FileDown, FileText } from 'lucide-react';
import { SlidePreview } from './SlidePreview';
import { COLORS, SLIDE_CONFIG, LABELS, TEXT_CONFIG } from './constants';
import type { OracionesAntifonales, SlideData, TipoOracion } from './types';

// Tipo para slide de título de sección
interface TitleSlideData {
  tipo: TipoOracion;
  titulo: string;
  isTitle: true;
}

// Tipo unión para todos los slides
type AnySlideData = SlideData | TitleSlideData;

interface SlideGeneratorProps {
  oraciones: OracionesAntifonales;
  fecha: Date;
  titulo: string;
}

// Precargar fuentes
async function loadFonts(): Promise<void> {
  const fonts = [
    new FontFace('Merriweather', 'url(https://fonts.gstatic.com/s/merriweather/v30/u-440qyriQwlOrhSvowK_l5-fCZM.woff2)', { weight: '300' }),
    new FontFace('Montserrat', 'url(https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.woff2)', { weight: '400' }),
    new FontFace('Montserrat', 'url(https://fonts.gstatic.com/s/montserrat/v26/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aXo.woff2)', { weight: '600' }),
  ];

  await Promise.all(fonts.map(async (font) => {
    const loaded = await font.load();
    document.fonts.add(loaded);
  }));
}

// Función para envolver texto en múltiples líneas
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

// Generar slide de título de sección (minimalista y elegante)
async function generateTitleSlideCanvas(slide: TitleSlideData): Promise<HTMLCanvasElement> {
  await loadFonts();

  const canvas = document.createElement('canvas');
  canvas.width = SLIDE_CONFIG.width;
  canvas.height = SLIDE_CONFIG.height;
  const ctx = canvas.getContext('2d')!;

  const { width, height, fontSize, separator } = SLIDE_CONFIG;

  // Fondo
  ctx.fillStyle = COLORS.primary.white;
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;

  // Título grande centrado
  ctx.font = `300 ${fontSize.titleSlide}px Merriweather`;
  ctx.fillStyle = COLORS.primary.black;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(slide.titulo, centerX, centerY - 20);

  // Separador decorativo debajo del título
  const separatorY = centerY + 50;
  const halfLineWidth = separator.lineWidth * 1.5;
  const gapWithDot = separator.gap + separator.dotRadius;

  ctx.strokeStyle = separator.color;
  ctx.lineWidth = separator.lineHeight;

  // Línea izquierda
  ctx.beginPath();
  ctx.moveTo(centerX - gapWithDot - halfLineWidth, separatorY);
  ctx.lineTo(centerX - gapWithDot, separatorY);
  ctx.stroke();

  // Punto central
  ctx.fillStyle = separator.dotColor;
  ctx.beginPath();
  ctx.arc(centerX, separatorY, separator.dotRadius * 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Línea derecha
  ctx.strokeStyle = separator.color;
  ctx.beginPath();
  ctx.moveTo(centerX + gapWithDot, separatorY);
  ctx.lineTo(centerX + gapWithDot + halfLineWidth, separatorY);
  ctx.stroke();

  return canvas;
}

// Generar un slide de contenido como canvas (sin título)
async function generateSlideCanvas(slide: SlideData): Promise<HTMLCanvasElement> {
  await loadFonts();

  const canvas = document.createElement('canvas');
  canvas.width = SLIDE_CONFIG.width;
  canvas.height = SLIDE_CONFIG.height;
  const ctx = canvas.getContext('2d')!;

  const { width, height, padding, fontSize, spacing, separator } = SLIDE_CONFIG;

  // Fondo
  ctx.fillStyle = COLORS.primary.white;
  ctx.fillRect(0, 0, width, height);

  // Calcular tamaños de fuente dinámicos
  const isLiderLong = slide.lider.length > TEXT_CONFIG.maxCharsBeforeResize.lider;
  const isCongregacionLong = slide.congregacion.length > TEXT_CONFIG.maxCharsBeforeResize.congregacion;

  const actualFontSizeLider = isLiderLong
    ? fontSize.lider * TEXT_CONFIG.fontSizeReductionFactor
    : fontSize.lider;

  const actualFontSizeCongregacion = isCongregacionLong
    ? fontSize.congregacion * TEXT_CONFIG.fontSizeReductionFactor
    : fontSize.congregacion;

  // Área útil
  const contentWidth = width - padding.horizontal * 2;
  const centerX = width / 2;

  // Calcular altura total del contenido para centrar verticalmente
  ctx.font = `400 ${actualFontSizeLider}px Montserrat`;
  const liderText = slide.lider;  // Sin comillas
  const liderLines = wrapText(ctx, liderText, contentWidth * 0.85);
  const liderLineHeight = actualFontSizeLider * TEXT_CONFIG.lineHeight.lider;
  const liderHeight = liderLines.length * liderLineHeight;

  ctx.font = `600 ${actualFontSizeCongregacion}px Montserrat`;
  const congregacionLines = wrapText(ctx, slide.congregacion, contentWidth * 0.85);
  const congregacionLineHeight = actualFontSizeCongregacion * TEXT_CONFIG.lineHeight.congregacion;
  const congregacionHeight = congregacionLines.length * congregacionLineHeight;

  const separatorHeight = separator.dotRadius * 2 + spacing.afterSeparator;
  const totalContentHeight = liderHeight + spacing.afterLider + separatorHeight + congregacionHeight;

  // Empezar desde el centro vertical
  let currentY = (height - totalContentHeight) / 2;

  // Texto del líder (con comillas)
  ctx.font = `400 ${actualFontSizeLider}px Montserrat`;
  ctx.fillStyle = COLORS.primary.black;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (const line of liderLines) {
    ctx.fillText(line, centerX, currentY);
    currentY += liderLineHeight;
  }

  currentY += spacing.afterLider - liderLineHeight;

  // Separador
  const separatorY = currentY + separator.dotRadius;
  const halfLineWidth = separator.lineWidth;
  const gapWithDot = separator.gap + separator.dotRadius;

  ctx.strokeStyle = separator.color;
  ctx.lineWidth = separator.lineHeight;

  ctx.beginPath();
  ctx.moveTo(centerX - gapWithDot - halfLineWidth, separatorY);
  ctx.lineTo(centerX - gapWithDot, separatorY);
  ctx.stroke();

  ctx.fillStyle = separator.dotColor;
  ctx.beginPath();
  ctx.arc(centerX, separatorY, separator.dotRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = separator.color;
  ctx.beginPath();
  ctx.moveTo(centerX + gapWithDot, separatorY);
  ctx.lineTo(centerX + gapWithDot + halfLineWidth, separatorY);
  ctx.stroke();

  currentY += separator.dotRadius * 2 + spacing.afterSeparator;

  // Texto de la congregación
  ctx.font = `600 ${actualFontSizeCongregacion}px Montserrat`;
  ctx.fillStyle = COLORS.primary.amber;

  for (const line of congregacionLines) {
    ctx.fillText(line, centerX, currentY);
    currentY += congregacionLineHeight;
  }

  // Indicador de tiempo
  ctx.font = `400 ${fontSize.indicator}px Montserrat`;
  ctx.fillStyle = COLORS.secondary.mediumGray;
  ctx.textAlign = 'right';
  ctx.fillText(
    `[${slide.tiempoNumero}/${slide.totalTiempos}]`,
    width - padding.horizontal,
    height - padding.vertical
  );

  return canvas;
}

// Helper para verificar si es slide de título
function isTitleSlide(slide: AnySlideData): slide is TitleSlideData {
  return 'isTitle' in slide && slide.isTitle === true;
}

// Descargar canvas como imagen
function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Generar PDF con múltiples slides (formato landscape 4:3)
async function generatePDF(
  slides: AnySlideData[],
  filename: string
): Promise<void> {
  // Crear PDF en formato landscape (4:3 ratio)
  // Usamos dimensiones en mm: 297 x 222.75 (A4 landscape ajustado a 4:3)
  const pdfWidth = 297;
  const pdfHeight = 222.75;

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  });

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];

    // Generar el canvas para este slide
    let canvas: HTMLCanvasElement;
    if (isTitleSlide(slide)) {
      canvas = await generateTitleSlideCanvas(slide);
    } else {
      canvas = await generateSlideCanvas(slide);
    }

    // Convertir canvas a imagen
    const imgData = canvas.toDataURL('image/png');

    // Agregar nueva página si no es la primera
    if (i > 0) {
      pdf.addPage([pdfWidth, pdfHeight], 'landscape');
    }

    // Agregar imagen al PDF (llenar toda la página)
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  }

  // Descargar el PDF
  pdf.save(filename);
}

export const SlideGenerator = ({ oraciones, fecha, titulo }: SlideGeneratorProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSlides, setGeneratedSlides] = useState<SlideData[]>([]);

  // Crear lista de todos los slides (con slides de título)
  const getAllSlides = useCallback((): AnySlideData[] => {
    const tipos: TipoOracion[] = ['invocacion', 'arrepentimiento', 'gratitud'];
    const slides: AnySlideData[] = [];

    for (const tipo of tipos) {
      const oracion = oraciones[tipo];
      const totalTiempos = oracion.tiempos.length;

      // Agregar slide de título de sección
      slides.push({
        tipo,
        titulo: oracion.titulo,
        isTitle: true,
      });

      // Agregar slides de cada tiempo
      for (let i = 0; i < totalTiempos; i++) {
        slides.push({
          tipo,
          titulo: oracion.titulo,
          tiempoNumero: i + 1,
          totalTiempos,
          lider: oracion.tiempos[i].lider,
          congregacion: oracion.tiempos[i].congregacion,
        });
      }
    }

    return slides;
  }, [oraciones]);

  // Generar y descargar todos los slides
  const handleDownloadAll = async () => {
    setIsGenerating(true);

    try {
      const slides = getAllSlides();

      // Generar cada slide
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        let canvas: HTMLCanvasElement;
        let filename: string;

        if (isTitleSlide(slide)) {
          canvas = await generateTitleSlideCanvas(slide);
          const tipoLabel = LABELS.oraciones[slide.tipo].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          filename = `oracion_${tipoLabel}_00_titulo.png`;
        } else {
          canvas = await generateSlideCanvas(slide);
          const tipoLabel = LABELS.oraciones[slide.tipo].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          filename = `oracion_${tipoLabel}_${String(slide.tiempoNumero).padStart(2, '0')}_tiempo.png`;
        }

        downloadCanvas(canvas, filename);

        // Pequeña pausa entre descargas para evitar problemas
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      toast({
        title: 'Slides generados',
        description: `${slides.length} slides descargados exitosamente`,
      });
    } catch (error) {
      console.error('Error generating slides:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron generar los slides',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Descargar un slide individual
  const handleDownloadSlide = async (slide: AnySlideData) => {
    try {
      let canvas: HTMLCanvasElement;
      let filename: string;
      const tipoLabel = LABELS.oraciones[slide.tipo].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (isTitleSlide(slide)) {
        canvas = await generateTitleSlideCanvas(slide);
        filename = `oracion_${tipoLabel}_00_titulo.png`;
      } else {
        canvas = await generateSlideCanvas(slide);
        filename = `oracion_${tipoLabel}_${String(slide.tiempoNumero).padStart(2, '0')}_tiempo.png`;
      }

      downloadCanvas(canvas, filename);

      toast({
        title: 'Slide descargado',
        description: filename,
      });
    } catch (error) {
      console.error('Error downloading slide:', error);
      toast({
        title: 'Error',
        description: 'No se pudo descargar el slide',
        variant: 'destructive',
      });
    }
  };

  // Descargar PDF de una oración específica (5 slides: título + 4 tiempos)
  const handleDownloadOracionPDF = async (tipo: TipoOracion) => {
    setIsGenerating(true);
    try {
      const oracionSlides = getAllSlides().filter(s => s.tipo === tipo);
      const tipoLabel = LABELS.oraciones[tipo].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const filename = `oracion_${tipoLabel}.pdf`;

      await generatePDF(oracionSlides, filename);

      toast({
        title: 'PDF generado',
        description: `${LABELS.oraciones[tipo]} descargado`,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Descargar PDF con las 3 oraciones completas (15 slides)
  const handleDownloadAllPDF = async () => {
    setIsGenerating(true);
    try {
      const allSlides = getAllSlides();
      const filename = 'oraciones_antifonales_completas.pdf';

      await generatePDF(allSlides, filename);

      toast({
        title: 'PDF generado',
        description: 'Todas las oraciones descargadas',
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar el PDF',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const slides = getAllSlides();

  // Agrupar slides por tipo de oración
  const slidesByTipo = {
    invocacion: slides.filter(s => s.tipo === 'invocacion'),
    arrepentimiento: slides.filter(s => s.tipo === 'arrepentimiento'),
    gratitud: slides.filter(s => s.tipo === 'gratitud'),
  };

  // Componente para renderizar un slide individual
  const SlideItem = ({ slide, index }: { slide: AnySlideData; index: number }) => (
    <div key={index} className="group relative">
      <SlidePreview slide={slide} scale={0.35} />

      {/* Overlay con botón de descarga */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleDownloadSlide(slide)}
          className="bg-white hover:bg-gray-100"
        >
          <Download className="h-4 w-4 mr-1" />
          Descargar
        </Button>
      </div>

      {/* Label */}
      <div className="mt-2 text-center">
        <p className="text-xs text-gray-600">
          {isTitleSlide(slide)
            ? 'Título'
            : `Tiempo ${slide.tiempoNumero}`
          }
        </p>
      </div>
    </div>
  );

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-light text-gray-900">
                Slides para Presentación
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                {slides.length} slides en formato 4:3 (1024x768 px)
              </p>
            </div>
          </div>

          {/* Botones de descarga */}
          <div className="flex flex-wrap gap-2">
            {/* Descargar imágenes individuales */}
            <Button
              onClick={handleDownloadAll}
              disabled={isGenerating}
              variant="outline"
              size="sm"
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              Imágenes PNG
            </Button>

            {/* Descargar PDF completo */}
            <Button
              onClick={handleDownloadAllPDF}
              disabled={isGenerating}
              className="bg-amber-600 hover:bg-amber-700"
              size="sm"
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              PDF Completo
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Sección Invocación */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-amber-200">
            <h3 className="text-lg font-medium text-gray-800">
              {LABELS.oraciones.invocacion}
            </h3>
            <Button
              onClick={() => handleDownloadOracionPDF('invocacion')}
              disabled={isGenerating}
              variant="ghost"
              size="sm"
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
            >
              <FileText className="mr-1 h-4 w-4" />
              PDF
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {slidesByTipo.invocacion.map((slide, index) => (
              <SlideItem key={`inv-${index}`} slide={slide} index={index} />
            ))}
          </div>
        </div>

        {/* Sección Arrepentimiento */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-amber-200">
            <h3 className="text-lg font-medium text-gray-800">
              {LABELS.oraciones.arrepentimiento}
            </h3>
            <Button
              onClick={() => handleDownloadOracionPDF('arrepentimiento')}
              disabled={isGenerating}
              variant="ghost"
              size="sm"
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
            >
              <FileText className="mr-1 h-4 w-4" />
              PDF
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {slidesByTipo.arrepentimiento.map((slide, index) => (
              <SlideItem key={`arr-${index}`} slide={slide} index={index} />
            ))}
          </div>
        </div>

        {/* Sección Gratitud */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-amber-200">
            <h3 className="text-lg font-medium text-gray-800">
              {LABELS.oraciones.gratitud}
            </h3>
            <Button
              onClick={() => handleDownloadOracionPDF('gratitud')}
              disabled={isGenerating}
              variant="ghost"
              size="sm"
              className="text-amber-700 hover:text-amber-800 hover:bg-amber-50"
            >
              <FileText className="mr-1 h-4 w-4" />
              PDF
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {slidesByTipo.gratitud.map((slide, index) => (
              <SlideItem key={`gra-${index}`} slide={slide} index={index} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SlideGenerator;
