/**
 * StoryPreview - Vista previa del cuento con sus escenas e imágenes
 */

import React, { useState } from 'react';
import { CASA_BRAND } from '@/lib/brand-kit';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Download,
  Eye,
} from 'lucide-react';
import type { Story } from '@/types/shared/story';

interface StoryPreviewProps {
  story: Story;
  onExportPDF?: () => void;
}

const StoryPreview: React.FC<StoryPreviewProps> = ({ story, onExportPDF }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Construir lista de slides: portada + escenas + fin
  const slides = [
    // Portada
    {
      type: 'cover' as const,
      title: story.title,
      imageUrl: story.coverImageUrl,
      text: null,
    },
    // Escenas
    ...story.scenes.map((scene) => ({
      type: 'scene' as const,
      title: `Escena ${scene.number}`,
      imageUrl: scene.selectedImageUrl,
      text: scene.text,
    })),
    // Fin
    {
      type: 'end' as const,
      title: 'Fin',
      imageUrl: story.endImageUrl,
      text: null,
    },
  ];

  const currentSlideData = slides[currentSlide];
  const totalSlides = slides.length;

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
          >
            <Eye size={20} color={CASA_BRAND.colors.primary.white} />
          </div>
          <div>
            <h3
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: '20px',
                fontWeight: 400,
                color: CASA_BRAND.colors.primary.black,
              }}
            >
              Vista Previa
            </h3>
            <p
              style={{
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '13px',
                color: CASA_BRAND.colors.secondary.grayMedium,
              }}
            >
              {story.title}
            </p>
          </div>
        </div>

        {onExportPDF && (
          <button
            type="button"
            onClick={onExportPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-colors hover:bg-amber-50"
            style={{
              border: `1px solid ${CASA_BRAND.colors.primary.amber}`,
              color: CASA_BRAND.colors.primary.amber,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            <Download size={18} />
            Exportar PDF
          </button>
        )}
      </div>

      {/* Slide actual */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{
          aspectRatio: '4/3',
          backgroundColor: CASA_BRAND.colors.secondary.grayLight,
        }}
      >
        {currentSlideData.imageUrl ? (
          <img
            src={currentSlideData.imageUrl}
            alt={currentSlideData.title}
            className="w-full h-full object-contain"
            style={{ backgroundColor: CASA_BRAND.colors.primary.white }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <BookOpen
                size={48}
                style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
              />
              <p
                className="mt-2"
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                Sin imagen
              </p>
            </div>
          </div>
        )}

        {/* Overlay para portada y fin */}
        {(currentSlideData.type === 'cover' || currentSlideData.type === 'end') && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
            }}
          >
            <h2
              style={{
                fontFamily: CASA_BRAND.fonts.heading,
                fontSize: currentSlideData.type === 'cover' ? '36px' : '48px',
                fontWeight: 300,
                color: CASA_BRAND.colors.primary.white,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {currentSlideData.type === 'cover' ? story.title : 'Fin'}
            </h2>
          </div>
        )}

        {/* Navegación */}
        <button
          onClick={goToPrevious}
          disabled={currentSlide === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
          style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <button
          onClick={goToNext}
          disabled={currentSlide === totalSlides - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
          style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            color: CASA_BRAND.colors.primary.black,
          }}
        >
          <ChevronRight size={24} />
        </button>

        {/* Indicador de slide */}
        <div
          className="absolute bottom-4 right-4 px-3 py-1 rounded-full"
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            color: 'white',
          }}
        >
          {currentSlide + 1} / {totalSlides}
        </div>
      </div>

      {/* Texto del narrador (para escenas) */}
      {currentSlideData.type === 'scene' && currentSlideData.text && (
        <div
          className="p-4 rounded-lg"
          style={{
            backgroundColor: `${CASA_BRAND.colors.amber.light}20`,
            borderLeft: `4px solid ${CASA_BRAND.colors.primary.amber}`,
          }}
        >
          <p
            className="text-sm font-medium mb-1"
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              color: CASA_BRAND.colors.primary.amber,
            }}
          >
            Texto del narrador:
          </p>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '16px',
              lineHeight: 1.6,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {currentSlideData.text}
          </p>
        </div>
      )}

      {/* Miniaturas */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {slides.map((slide, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`flex-shrink-0 w-20 h-15 rounded-lg overflow-hidden border-2 transition-all ${
              index === currentSlide ? 'ring-2 ring-offset-1' : ''
            }`}
            style={{
              borderColor:
                index === currentSlide
                  ? CASA_BRAND.colors.primary.amber
                  : 'transparent',
              ringColor: CASA_BRAND.colors.primary.amber,
              aspectRatio: '4/3',
            }}
          >
            {slide.imageUrl ? (
              <img
                src={slide.imageUrl}
                alt={slide.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: CASA_BRAND.colors.secondary.grayLight }}
              >
                <span
                  className="text-xs"
                  style={{ color: CASA_BRAND.colors.secondary.grayMedium }}
                >
                  {index + 1}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StoryPreview;
