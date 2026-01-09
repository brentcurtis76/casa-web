/**
 * AntiphonalSlide - Slide especial para texto líder + respuesta congregación
 * Muestra ambos textos con el diseño distintivo del Brand Kit CASA
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';

interface AntiphonalSlideProps {
  leader: string;
  response: string;
  slideNumber?: number;
  totalSlides?: number;
  aspectRatio?: '4:3' | '16:9';
  showIndicator?: boolean;
}

const AntiphonalSlide: React.FC<AntiphonalSlideProps> = ({
  leader,
  response,
  slideNumber,
  totalSlides,
  aspectRatio = '4:3',
  showIndicator = true,
}) => {
  const paddingTop = aspectRatio === '4:3' ? '75%' : '56.25%';

  // Separador decorativo con punto ámbar
  const Separator = () => (
    <div className="flex items-center justify-center gap-3 my-6">
      <div
        className="w-16 h-px"
        style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
      />
      <div
        className="w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
      />
      <div
        className="w-16 h-px"
        style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
      />
    </div>
  );

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden shadow-md"
      style={{
        paddingTop,
        backgroundColor: CASA_BRAND.colors.primary.white,
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center px-12 py-8">
        {/* Texto del líder */}
        <div className="text-center">
          <p
            className="whitespace-pre-line"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontWeight: 400,
              fontSize: '32px',
              lineHeight: 1.6,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {leader}
          </p>
        </div>

        {/* Separador */}
        <Separator />

        {/* Respuesta de la congregación */}
        <div className="text-center">
          <p
            className="whitespace-pre-line"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontWeight: 600,
              fontSize: '36px',
              lineHeight: 1.6,
              color: CASA_BRAND.colors.primary.amber,
            }}
          >
            {response}
          </p>
        </div>

        {/* Indicador de slide */}
        {showIndicator && slideNumber && totalSlides && (
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
        )}
      </div>
    </div>
  );
};

export default AntiphonalSlide;
