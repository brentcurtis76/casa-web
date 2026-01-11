/**
 * SlidePreview - Vista previa grande del slide actual
 */

import React from 'react';
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';
import { LogoOverlay } from './LogoOverlay';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { Slide } from '@/types/shared/slide';
import type { LogoSettings } from '@/lib/presentation/types';

interface SlidePreviewProps {
  slide: Slide | null;
  currentIndex: number;
  totalSlides: number;
  isLive: boolean;
  isBlack: boolean;
  logoSettings?: LogoSettings;
}

const PREVIEW_SCALE = 0.65;

export const SlidePreview: React.FC<SlidePreviewProps> = ({
  slide,
  currentIndex,
  totalSlides,
  isLive,
  isBlack,
  logoSettings,
}) => {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Status bar */}
      <div className="flex items-center gap-4">
        <span
          className="px-3 py-1 rounded-full text-sm"
          style={{
            backgroundColor: isLive
              ? 'rgba(34, 197, 94, 0.2)'
              : 'rgba(107, 114, 128, 0.2)',
            color: isLive ? '#22c55e' : CASA_BRAND.colors.secondary.grayMedium,
            fontFamily: CASA_BRAND.fonts.body,
            fontWeight: 600,
          }}
        >
          {isLive ? 'EN VIVO' : 'STANDBY'}
        </span>

        {isBlack && (
          <span
            className="px-3 py-1 rounded-full text-sm"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              color: '#ef4444',
              fontFamily: CASA_BRAND.fonts.body,
              fontWeight: 600,
            }}
          >
            NEGRO
          </span>
        )}

        <span
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: CASA_BRAND.colors.secondary.grayMedium,
          }}
        >
          Slide {currentIndex + 1} de {totalSlides}
        </span>
      </div>

      {/* Slide preview */}
      <div
        className="relative rounded-lg overflow-hidden shadow-2xl"
        style={{
          outline: isBlack
            ? '4px solid rgba(239, 68, 68, 0.5)'
            : isLive
            ? '4px solid rgba(34, 197, 94, 0.5)'
            : '4px solid transparent',
        }}
      >
        {slide ? (
          <>
            <UniversalSlide
              slide={slide}
              scale={PREVIEW_SCALE}
              showIndicator={true}
            />

            {/* Logo overlay */}
            {logoSettings && (
              <LogoOverlay
                settings={logoSettings}
                slideWidth={CASA_BRAND.slide.width * PREVIEW_SCALE}
                slideHeight={CASA_BRAND.slide.height * PREVIEW_SCALE}
              />
            )}

            {/* Black overlay when in black mode */}
            {isBlack && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                }}
              >
                <span
                  style={{
                    fontFamily: CASA_BRAND.fonts.body,
                    fontSize: '24px',
                    fontWeight: 600,
                    color: CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  Pantalla Negra
                </span>
              </div>
            )}
          </>
        ) : (
          <div
            className="flex items-center justify-center"
            style={{
              width: CASA_BRAND.slide.width * PREVIEW_SCALE,
              height: CASA_BRAND.slide.height * PREVIEW_SCALE,
              backgroundColor: CASA_BRAND.colors.primary.black,
            }}
          >
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              Selecciona una liturgia para comenzar
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlidePreview;
