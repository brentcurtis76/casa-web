/**
 * SlidePreview - Vista previa de slides generados
 * Muestra miniaturas de todos los slides de una canción
 */

import React from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { SlideGroup } from '@/types/shared/slide';
import { SongSlide } from './SongSlide';

interface SlidePreviewProps {
  slideGroup: SlideGroup;
  selectedIndex?: number;
  onSlideSelect?: (index: number) => void;
}

export const SlidePreview: React.FC<SlidePreviewProps> = ({
  slideGroup,
  selectedIndex,
  onSlideSelect
}) => {
  const thumbnailScale = 0.25; // 25% del tamaño original

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="font-semibold"
          style={{
            fontFamily: CASA_BRAND.fonts.body,
            color: CASA_BRAND.colors.primary.black
          }}
        >
          Vista previa ({slideGroup.slides.length} slides)
        </h3>
      </div>

      {/* Grid de miniaturas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {slideGroup.slides.map((slide, index) => (
          <div
            key={slide.id}
            onClick={() => onSlideSelect?.(index)}
            className={`
              cursor-pointer rounded-lg p-2 transition-all duration-200
              ${selectedIndex === index
                ? 'bg-amber-100 ring-2 ring-amber-500'
                : 'bg-gray-50 hover:bg-gray-100'
              }
            `}
          >
            <div className="overflow-hidden rounded">
              <SongSlide
                slide={slide}
                scale={thumbnailScale}
                showIndicator={false}
              />
            </div>
            <p
              className="mt-2 text-center text-xs"
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                color: CASA_BRAND.colors.secondary.grayMedium
              }}
            >
              {index + 1} / {slideGroup.slides.length}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SlidePreview;
