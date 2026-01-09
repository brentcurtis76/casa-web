/**
 * FixedElementSlide - Slide individual para elementos fijos
 * Renderiza un slide según su tipo con el diseño del Brand Kit CASA
 */

import React from 'react';
import { FixedSlide } from '@/types/shared/fixed-elements';
import { CASA_BRAND } from '@/lib/brand-kit';

interface FixedElementSlideProps {
  slide: FixedSlide;
  slideNumber: number;
  totalSlides: number;
  aspectRatio?: '4:3' | '16:9';
  /** Scale factor for thumbnail view (0-1). When set, renders at fixed dimensions scaled down */
  scale?: number;
}

const FixedElementSlide: React.FC<FixedElementSlideProps> = ({
  slide,
  slideNumber,
  totalSlides,
  aspectRatio = '4:3',
  scale,
}) => {
  // Base dimensions for 4:3 slide (matching CASA_BRAND.slide)
  const baseWidth = 1024;
  const baseHeight = aspectRatio === '4:3' ? 768 : 576;

  // If scale is provided, use fixed dimensions; otherwise use responsive padding
  const useFixedDimensions = scale !== undefined && scale < 1;

  // Separador decorativo con punto ámbar
  const Separator = () => (
    <div className="flex items-center justify-center gap-3 my-4">
      <div className="w-12 h-px" style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }} />
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
      />
      <div className="w-12 h-px" style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }} />
    </div>
  );

  // Renderizar contenido según tipo de slide
  const renderContent = () => {
    switch (slide.type) {
      case 'title':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <Separator />
            <h1
              className="whitespace-pre-line"
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontWeight: 300,
                fontSize: '48px',
                letterSpacing: '0.05em',
                color: CASA_BRAND.colors.primary.black,
                lineHeight: 1.2,
              }}
            >
              {slide.content}
            </h1>
            <Separator />
          </div>
        );

      case 'liturgy-leader':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <p
              className="whitespace-pre-line"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 400,
                fontSize: '36px',
                lineHeight: 1.7,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              {slide.content}
            </p>
          </div>
        );

      case 'liturgy-response':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <p
              className="whitespace-pre-line"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 600,
                fontSize: '36px',
                lineHeight: 1.7,
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              {slide.content}
            </p>
          </div>
        );

      case 'liturgy-antiphonal':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <p
              className="whitespace-pre-line mb-4"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 400,
                fontSize: '32px',
                lineHeight: 1.6,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              {slide.leader}
            </p>
            <Separator />
            <p
              className="whitespace-pre-line mt-4"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 600,
                fontSize: '36px',
                lineHeight: 1.6,
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              {slide.response}
            </p>
          </div>
        );

      case 'prayer-congregational':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <p
              className="whitespace-pre-line"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 400,
                fontSize: '36px',
                lineHeight: 1.7,
                color: CASA_BRAND.colors.secondary.carbon,
              }}
            >
              {slide.content}
            </p>
          </div>
        );

      case 'scripture':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <p
              className="whitespace-pre-line italic"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 400,
                fontSize: '34px',
                lineHeight: 1.7,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              {slide.content}
            </p>
            {slide.reference && (
              <p
                className="mt-6"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontWeight: 500,
                  fontSize: '24px',
                  color: CASA_BRAND.colors.primary.amber,
                }}
              >
                — {slide.reference}
              </p>
            )}
          </div>
        );

      case 'info':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <p
              className="whitespace-pre-line"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontWeight: 400,
                fontSize: '28px',
                lineHeight: 1.7,
                color: CASA_BRAND.colors.secondary.grayDark,
              }}
            >
              {slide.content}
            </p>
          </div>
        );

      case 'instruction':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <Separator />
            <h2
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontWeight: 300,
                fontSize: '42px',
                letterSpacing: '0.05em',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {slide.content}
            </h2>
            {slide.note && (
              <p
                className="mt-4 italic"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '24px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                {slide.note}
              </p>
            )}
            <Separator />
          </div>
        );

      case 'closing':
        return (
          <div className="flex flex-col items-center justify-center h-full text-center px-12">
            <Separator />
            <h1
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontWeight: 300,
                fontSize: '48px',
                letterSpacing: '0.05em',
                color: CASA_BRAND.colors.primary.amber,
              }}
            >
              {slide.content}
            </h1>
            <Separator />
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: CASA_BRAND.colors.secondary.grayMedium }}>
              {slide.content || 'Sin contenido'}
            </p>
          </div>
        );
    }
  };

  // For thumbnail mode: render at full size then scale down with CSS transform
  if (useFixedDimensions) {
    const scaledWidth = baseWidth * scale!;
    const scaledHeight = baseHeight * scale!;

    return (
      <div
        className="relative overflow-hidden rounded-lg shadow-md"
        style={{
          width: scaledWidth,
          height: scaledHeight,
        }}
      >
        <div
          style={{
            width: baseWidth,
            height: baseHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            backgroundColor: CASA_BRAND.colors.primary.white,
          }}
        >
          {renderContent()}

          {/* Indicador de slide */}
          <div
            className="absolute bottom-4 right-4"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {slideNumber}/{totalSlides}
          </div>
        </div>
      </div>
    );
  }

  // Normal responsive mode
  const paddingTop = aspectRatio === '4:3' ? '75%' : '56.25%';

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden shadow-md"
      style={{
        paddingTop,
        backgroundColor: CASA_BRAND.colors.primary.white,
      }}
    >
      <div className="absolute inset-0">
        {renderContent()}

        {/* Indicador de slide */}
        <div
          className="absolute bottom-4 right-4"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          {slideNumber}/{totalSlides}
        </div>
      </div>
    </div>
  );
};

export default FixedElementSlide;
