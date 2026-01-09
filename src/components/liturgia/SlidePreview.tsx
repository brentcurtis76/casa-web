/**
 * SlidePreview - Vista previa de un slide de oración
 * Soporta slides de título y slides de contenido
 */

import { COLORS, SLIDE_CONFIG, TEXT_CONFIG } from './constants';
import type { SlideData, TipoOracion } from './types';

// Path to CASA logo
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

// Tipo para slide de título de sección
interface TitleSlideData {
  tipo: TipoOracion;
  titulo: string;
  isTitle: true;
}

// Tipo unión para todos los slides
type AnySlideData = SlideData | TitleSlideData;

interface SlidePreviewProps {
  slide: AnySlideData;
  scale?: number;  // Escala para vista previa (0-1)
}

// Helper para verificar si es slide de título
function isTitleSlide(slide: AnySlideData): slide is TitleSlideData {
  return 'isTitle' in slide && slide.isTitle === true;
}

// Componente para slide de título (minimalista y elegante)
const TitleSlidePreview = ({ slide, scale = 0.5 }: { slide: TitleSlideData; scale: number }) => {
  const { width, height, padding, fontSize, separator } = SLIDE_CONFIG;

  return (
    <div
      className="relative bg-white shadow-lg rounded overflow-hidden"
      style={{
        width: width * scale,
        height: height * scale,
        backgroundColor: COLORS.primary.white,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: width,
          height: height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Logo CASA en esquina superior derecha */}
        <img
          src={CASA_LOGO_PATH}
          alt="CASA"
          style={{
            position: 'absolute',
            top: `${padding.vertical}px`,
            right: `${padding.horizontal}px`,
            width: '32px',
            height: '32px',
            opacity: 0.8,
          }}
        />
        {/* Título grande centrado */}
        <h1
          style={{
            fontFamily: 'Merriweather, Georgia, serif',
            fontWeight: 300,
            fontSize: `${fontSize.titleSlide}px`,
            color: COLORS.primary.black,
            letterSpacing: '0.02em',
            textAlign: 'center',
            marginBottom: '40px',
          }}
        >
          {slide.titulo}
        </h1>

        {/* Separador decorativo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: `${separator.lineWidth * 1.5}px`,
              height: `${separator.lineHeight}px`,
              backgroundColor: separator.color,
            }}
          />
          <div
            style={{
              width: `${separator.dotRadius * 3}px`,
              height: `${separator.dotRadius * 3}px`,
              borderRadius: '50%',
              backgroundColor: separator.dotColor,
              margin: `0 ${separator.gap}px`,
            }}
          />
          <div
            style={{
              width: `${separator.lineWidth * 1.5}px`,
              height: `${separator.lineHeight}px`,
              backgroundColor: separator.color,
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Componente para slide de contenido (sin título repetido, texto más grande, sin comillas)
const ContentSlidePreview = ({ slide, scale = 0.5 }: { slide: SlideData; scale: number }) => {
  const { width, height, padding, fontSize, spacing, separator } = SLIDE_CONFIG;

  // Calcular si el texto es largo para ajustar tamaño
  const isLiderLong = slide.lider.length > TEXT_CONFIG.maxCharsBeforeResize.lider;
  const isCongregacionLong = slide.congregacion.length > TEXT_CONFIG.maxCharsBeforeResize.congregacion;

  const actualFontSizeLider = isLiderLong
    ? fontSize.lider * TEXT_CONFIG.fontSizeReductionFactor
    : fontSize.lider;

  const actualFontSizeCongregacion = isCongregacionLong
    ? fontSize.congregacion * TEXT_CONFIG.fontSizeReductionFactor
    : fontSize.congregacion;

  return (
    <div
      className="relative bg-white shadow-lg rounded overflow-hidden"
      style={{
        width: width * scale,
        height: height * scale,
        backgroundColor: COLORS.primary.white,
      }}
    >
      {/* Contenido escalado */}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: width,
          height: height,
          padding: `${padding.vertical}px ${padding.horizontal}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Logo CASA en esquina superior derecha */}
        <img
          src={CASA_LOGO_PATH}
          alt="CASA"
          style={{
            position: 'absolute',
            top: `${padding.vertical}px`,
            right: `${padding.horizontal}px`,
            width: '32px',
            height: '32px',
            opacity: 0.8,
          }}
        />
        {/* Texto del líder (sin comillas) */}
        <p
          style={{
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontWeight: 400,
            fontSize: `${actualFontSizeLider}px`,
            color: COLORS.primary.black,
            lineHeight: TEXT_CONFIG.lineHeight.lider,
            textAlign: 'center',
            maxWidth: '85%',
            marginBottom: `${spacing.afterLider}px`,
          }}
        >
          {slide.lider}
        </p>

        {/* Separador */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: `${spacing.afterSeparator}px`,
          }}
        >
          <div
            style={{
              width: `${separator.lineWidth}px`,
              height: `${separator.lineHeight}px`,
              backgroundColor: separator.color,
            }}
          />
          <div
            style={{
              width: `${separator.dotRadius * 2}px`,
              height: `${separator.dotRadius * 2}px`,
              borderRadius: '50%',
              backgroundColor: separator.dotColor,
              margin: `0 ${separator.gap}px`,
            }}
          />
          <div
            style={{
              width: `${separator.lineWidth}px`,
              height: `${separator.lineHeight}px`,
              backgroundColor: separator.color,
            }}
          />
        </div>

        {/* Texto de la congregación */}
        <p
          style={{
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontWeight: 600,
            fontSize: `${actualFontSizeCongregacion}px`,
            color: COLORS.primary.amber,
            lineHeight: TEXT_CONFIG.lineHeight.congregacion,
            textAlign: 'center',
            maxWidth: '85%',
          }}
        >
          {slide.congregacion}
        </p>

        {/* Indicador de tiempo */}
        <div
          style={{
            position: 'absolute',
            bottom: `${padding.vertical}px`,
            right: `${padding.horizontal}px`,
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontWeight: 400,
            fontSize: `${fontSize.indicator}px`,
            color: COLORS.secondary.mediumGray,
          }}
        >
          [{slide.tiempoNumero}/{slide.totalTiempos}]
        </div>
      </div>
    </div>
  );
};

export const SlidePreview = ({ slide, scale = 0.5 }: SlidePreviewProps) => {
  if (isTitleSlide(slide)) {
    return <TitleSlidePreview slide={slide} scale={scale} />;
  }
  return <ContentSlidePreview slide={slide} scale={scale} />;
};

export default SlidePreview;
