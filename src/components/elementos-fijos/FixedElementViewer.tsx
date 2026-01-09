/**
 * FixedElementViewer - Visualizador completo de un elemento fijo
 * Muestra todos los slides con navegación y vista previa
 */

import React, { useState } from 'react';
import { FixedElement } from '@/types/shared/fixed-elements';
import { CASA_BRAND } from '@/lib/brand-kit';
import FixedElementSlide from './FixedElementSlide';
import { ChevronLeft, ChevronRight, Play, Grid } from 'lucide-react';

interface FixedElementViewerProps {
  element: FixedElement;
  onSelect?: (element: FixedElement) => void;
  onClose?: () => void;
}

const FixedElementViewer: React.FC<FixedElementViewerProps> = ({
  element,
  onSelect,
  onClose,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');

  const totalSlides = element.slides.length;

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : totalSlides - 1));
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev < totalSlides - 1 ? prev + 1 : 0));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'Escape' && onClose) onClose();
  };

  return (
    <div
      className="flex flex-col h-full"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
      >
        <div>
          <h2
            style={{
              fontFamily: CASA_BRAND.fonts.heading,
              fontSize: '24px',
              fontWeight: 300,
              color: CASA_BRAND.colors.primary.black,
            }}
          >
            {element.title}
          </h2>
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            {totalSlides} slides
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle vista */}
          <button
            onClick={() => setViewMode(viewMode === 'single' ? 'grid' : 'single')}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            style={{ color: CASA_BRAND.colors.secondary.grayDark }}
          >
            <Grid size={20} />
          </button>

          {/* Botón agregar a liturgia */}
          {onSelect && (
            <button
              onClick={() => onSelect(element)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-white transition-colors hover:opacity-90"
              style={{ backgroundColor: CASA_BRAND.colors.primary.amber }}
            >
              <Play size={16} />
              <span
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Agregar a Liturgia
              </span>
            </button>
          )}

          {/* Botón cerrar */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              style={{ color: CASA_BRAND.colors.secondary.grayDark }}
            >
              &times;
            </button>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'single' ? (
          /* Vista de slide único */
          <div className="max-w-4xl mx-auto">
            <FixedElementSlide
              slide={element.slides[currentSlide]}
              slideNumber={currentSlide + 1}
              totalSlides={totalSlides}
            />

            {/* Navegación */}
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={goToPrevious}
                className="p-3 rounded-full hover:bg-gray-100 transition-colors"
                style={{ color: CASA_BRAND.colors.secondary.grayDark }}
              >
                <ChevronLeft size={24} />
              </button>

              <span
                style={{
                  fontFamily: CASA_BRAND.fonts.body,
                  fontSize: '16px',
                  color: CASA_BRAND.colors.secondary.grayMedium,
                }}
              >
                {currentSlide + 1} / {totalSlides}
              </span>

              <button
                onClick={goToNext}
                className="p-3 rounded-full hover:bg-gray-100 transition-colors"
                style={{ color: CASA_BRAND.colors.secondary.grayDark }}
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>
        ) : (
          /* Vista de grilla - miniaturas escaladas */
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {element.slides.map((slide, index) => (
              <div
                key={index}
                className={`cursor-pointer transition-all hover:opacity-90 ${
                  index === currentSlide ? 'ring-2 ring-amber-500' : ''
                }`}
                style={{
                  borderRadius: CASA_BRAND.ui.borderRadius.md,
                }}
                onClick={() => {
                  setCurrentSlide(index);
                  setViewMode('single');
                }}
              >
                <FixedElementSlide
                  slide={slide}
                  slideNumber={index + 1}
                  totalSlides={totalSlides}
                  scale={0.2}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Miniaturas en vista single */}
      {viewMode === 'single' && (
        <div
          className="flex gap-3 p-4 overflow-x-auto border-t"
          style={{ borderColor: CASA_BRAND.colors.secondary.grayLight }}
        >
          {element.slides.map((slide, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`flex-shrink-0 transition-all ${
                index === currentSlide
                  ? 'ring-2 ring-amber-500'
                  : 'opacity-60 hover:opacity-100'
              }`}
              style={{
                borderRadius: '4px',
              }}
            >
              <FixedElementSlide
                slide={slide}
                slideNumber={index + 1}
                totalSlides={totalSlides}
                scale={0.1}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FixedElementViewer;
