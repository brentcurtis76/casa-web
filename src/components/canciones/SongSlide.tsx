/**
 * SongSlide - Slide individual para proyección
 * Formato 4:3 (1024x768) según Brand Kit CASA
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { Slide } from '@/types/shared/slide';

// Path to CASA logo
const CASA_LOGO_PATH = '/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png';

interface SongSlideProps {
  slide: Slide;
  showIndicator?: boolean;
  scale?: number;
}

export const SongSlide: React.FC<SongSlideProps> = ({
  slide,
  showIndicator = true,
  scale = 1
}) => {
  const isTitle = slide.type === 'song-title';

  // Valores del separador idénticos a constants.ts
  const separator = {
    lineWidth: 80,
    lineHeight: 1,
    dotRadius: 4,
    gap: 12,
    color: CASA_BRAND.colors.secondary.grayLight,
    dotColor: CASA_BRAND.colors.primary.amber,
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: CASA_BRAND.slide.width * scale,
        height: CASA_BRAND.slide.height * scale,
        backgroundColor: slide.style.backgroundColor,
        borderRadius: CASA_BRAND.ui.borderRadius.md,
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
      }}
    >
      {/* Logo CASA en esquina superior derecha - solo en slides de contenido */}
      {!isTitle && (
        <img
          src={CASA_LOGO_PATH}
          alt="CASA"
          style={{
            position: 'absolute',
            top: CASA_BRAND.slide.padding * scale,
            right: CASA_BRAND.slide.padding * scale,
            width: 32 * scale,
            height: 32 * scale,
            opacity: 0.8,
          }}
        />
      )}

      {/* Contenido del slide */}
      <div
        className="flex h-full w-full flex-col items-center justify-center"
        style={{
          padding: CASA_BRAND.slide.padding * scale
        }}
      >
        {isTitle ? (
          /* Slide de título */
          <div className="text-center">
            {/* Separador superior - valores idénticos a SlidePreview */}
            <div className="mb-6 flex items-center justify-center" style={{ gap: `${separator.gap * scale}px` }}>
              <div
                style={{
                  width: `${separator.lineWidth * 1.5 * scale}px`,
                  height: `${separator.lineHeight}px`,
                  backgroundColor: separator.color,
                }}
              />
              <div
                style={{
                  width: `${separator.dotRadius * 3 * scale}px`,
                  height: `${separator.dotRadius * 3 * scale}px`,
                  borderRadius: '50%',
                  backgroundColor: separator.dotColor,
                }}
              />
              <div
                style={{
                  width: `${separator.lineWidth * 1.5 * scale}px`,
                  height: `${separator.lineHeight}px`,
                  backgroundColor: separator.color,
                }}
              />
            </div>

            {/* Título */}
            <h1
              className="uppercase tracking-wider"
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontWeight: 300,
                fontSize: `${56 * scale}px`,
                color: slide.style.primaryColor,
                letterSpacing: '0.05em'
              }}
            >
              {slide.content.primary}
            </h1>

            {/* Subtítulo (artista) */}
            {slide.content.subtitle && (
              <p
                className="mt-4"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontWeight: 400,
                  fontSize: `${24 * scale}px`,
                  color: CASA_BRAND.colors.secondary.grayMedium
                }}
              >
                {slide.content.subtitle}
              </p>
            )}

            {/* Separador inferior - valores idénticos a SlidePreview */}
            <div className="mt-6 flex items-center justify-center" style={{ gap: `${separator.gap * scale}px` }}>
              <div
                style={{
                  width: `${separator.lineWidth * 1.5 * scale}px`,
                  height: `${separator.lineHeight}px`,
                  backgroundColor: separator.color,
                }}
              />
              <div
                style={{
                  width: `${separator.dotRadius * 3 * scale}px`,
                  height: `${separator.dotRadius * 3 * scale}px`,
                  borderRadius: '50%',
                  backgroundColor: separator.dotColor,
                }}
              />
              <div
                style={{
                  width: `${separator.lineWidth * 1.5 * scale}px`,
                  height: `${separator.lineHeight}px`,
                  backgroundColor: separator.color,
                }}
              />
            </div>
          </div>
        ) : (
          /* Slide de letra */
          <div
            className="text-center whitespace-pre-line"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: `${36 * scale}px`,
              lineHeight: 1.7,
              color: slide.style.primaryColor
            }}
          >
            {slide.content.primary}
          </div>
        )}
      </div>

      {/* Indicador de slide */}
      {showIndicator && (
        <div
          className="absolute bottom-4 right-4"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: `${18 * scale}px`,
            color: CASA_BRAND.colors.secondary.grayMedium
          }}
        >
          {slide.metadata.order}/{slide.metadata.groupTotal}
        </div>
      )}
    </div>
  );
};

export default SongSlide;
