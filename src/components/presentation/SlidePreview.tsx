/**
 * SlidePreview - Vista previa grande del slide actual
 * Se adapta automáticamente al espacio disponible del contenedor
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';
import { LogoOverlay } from './LogoOverlay';
import { TextOverlayDisplay } from './TextOverlayDisplay';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { Slide } from '@/types/shared/slide';
import type { LogoSettings, TextOverlay } from '@/lib/presentation/types';

interface SlidePreviewProps {
  slide: Slide | null;
  currentIndex: number;
  totalSlides: number;
  isLive: boolean;
  isBlack: boolean;
  logoSettings?: LogoSettings;
  /** Text overlays to display */
  textOverlays?: TextOverlay[];
  /** Callback when a text overlay position changes */
  onTextOverlayPositionChange?: (id: string, position: { x: number; y: number }) => void;
  /** Escala máxima permitida (por defecto 0.8 para dejar espacio) */
  maxScale?: number;
  /** Escala mínima permitida (por defecto 0.3 para que sea legible) */
  minScale?: number;
}

// Escala por defecto cuando no hay contenedor para medir
const DEFAULT_SCALE = 0.65;
// Margen para el contenedor (status bar + padding)
const CONTAINER_MARGIN = 80;

export const SlidePreview: React.FC<SlidePreviewProps> = ({
  slide,
  currentIndex,
  totalSlides,
  isLive,
  isBlack,
  logoSettings,
  textOverlays,
  onTextOverlayPositionChange,
  maxScale = 0.8,
  minScale = 0.3,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);

  // Calcula la escala óptima basada en el espacio disponible
  const calculateScale = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight - CONTAINER_MARGIN; // Restar espacio para status bar

    if (containerWidth <= 0 || containerHeight <= 0) return;

    const slideWidth = CASA_BRAND.slide.width;
    const slideHeight = CASA_BRAND.slide.height;

    // Calcular escala que hace que el slide quepa en el contenedor
    const scaleX = containerWidth / slideWidth;
    const scaleY = containerHeight / slideHeight;
    const optimalScale = Math.min(scaleX, scaleY);

    // Aplicar límites
    const clampedScale = Math.max(minScale, Math.min(maxScale, optimalScale));
    setScale(clampedScale);
  }, [maxScale, minScale]);

  // Recalcular cuando cambia el tamaño del contenedor
  useEffect(() => {
    calculateScale();

    // Usar ResizeObserver para detectar cambios en el contenedor
    const resizeObserver = new ResizeObserver(() => {
      calculateScale();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // También escuchar cambios de ventana (por si conectan/desconectan monitor)
    window.addEventListener('resize', calculateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateScale);
    };
  }, [calculateScale]);

  // Handle text overlay drag
  const handleTextOverlayMouseDown = useCallback((overlayId: string, e: React.MouseEvent) => {
    if (!slideRef.current || !onTextOverlayPositionChange) return;
    e.preventDefault();
    e.stopPropagation();

    setDraggingOverlayId(overlayId);

    const updatePosition = (clientX: number, clientY: number) => {
      if (!slideRef.current) return;
      const rect = slideRef.current.getBoundingClientRect();

      // Calculate position as percentage
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

      onTextOverlayPositionChange(overlayId, {
        x: Math.round(x),
        y: Math.round(y),
      });
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePosition(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      setDraggingOverlayId(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onTextOverlayPositionChange]);

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-3 w-full h-full">
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
        ref={slideRef}
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
              scale={scale}
              showIndicator={true}
            />

            {/* Logo overlay */}
            {logoSettings && (
              <LogoOverlay
                settings={logoSettings}
                slideWidth={CASA_BRAND.slide.width * scale}
                slideHeight={CASA_BRAND.slide.height * scale}
              />
            )}

            {/* Text overlays */}
            {textOverlays && textOverlays.map((overlay) => (
              <div
                key={overlay.id}
                onMouseDown={onTextOverlayPositionChange ? (e) => handleTextOverlayMouseDown(overlay.id, e) : undefined}
                style={{
                  cursor: onTextOverlayPositionChange ? 'move' : 'default',
                }}
              >
                <TextOverlayDisplay
                  overlay={overlay}
                  slideWidth={CASA_BRAND.slide.width * scale}
                  slideHeight={CASA_BRAND.slide.height * scale}
                  isDragging={draggingOverlayId === overlay.id}
                  showHidden={true}
                />
              </div>
            ))}

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
              width: CASA_BRAND.slide.width * scale,
              height: CASA_BRAND.slide.height * scale,
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
