/**
 * SlidePreview - Vista previa grande del slide actual
 * Se adapta automáticamente al espacio disponible del contenedor
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';
import { LogoOverlay } from './LogoOverlay';
import { TextOverlayDisplay } from './TextOverlayDisplay';
import { VideoBackgroundLayer } from './VideoBackgroundLayer';
import { SlideStyleWrapper } from './SlideStyleWrapper';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { Slide } from '@/types/shared/slide';
import type { LogoSettings, TextOverlay, ImageOverlay, VideoBackground, SlideStyles } from '@/lib/presentation/types';

interface SlidePreviewProps {
  slide: Slide | null;
  currentIndex: number;
  totalSlides: number;
  isLive: boolean;
  isBlack: boolean;
  logoSettings?: LogoSettings;
  /** Text overlays to display */
  textOverlays?: TextOverlay[];
  /** Image overlays to display */
  imageOverlays?: ImageOverlay[];
  /** Active video background for this slide */
  videoBackground?: VideoBackground | null;
  /** Callback when a text overlay position changes */
  onTextOverlayPositionChange?: (id: string, position: { x: number; y: number }) => void;
  /** Callback when an image overlay position changes */
  onImageOverlayPositionChange?: (id: string, position: { x: number; y: number }) => void;
  /** Escala máxima permitida (por defecto 0.8 para dejar espacio) */
  maxScale?: number;
  /** Escala mínima permitida (por defecto 0.3 para que sea legible) */
  minScale?: number;
  /** Style overrides to apply to the slide */
  styles?: SlideStyles | null;
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
  imageOverlays,
  videoBackground,
  onTextOverlayPositionChange,
  onImageOverlayPositionChange,
  maxScale = 0.8,
  minScale = 0.3,
  styles,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Track drag listeners for cleanup on unmount
  const dragListenersRef = useRef<{
    move: ((e: MouseEvent) => void) | null;
    up: (() => void) | null;
  }>({ move: null, up: null });

  // Cleanup drag listeners on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Clean up any active drag listeners on unmount
      if (dragListenersRef.current.move) {
        window.removeEventListener('mousemove', dragListenersRef.current.move);
      }
      if (dragListenersRef.current.up) {
        window.removeEventListener('mouseup', dragListenersRef.current.up);
      }
    };
  }, []);

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
      // Only update if still mounted
      if (isMountedRef.current) {
        calculateScale();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // También escuchar cambios de ventana (por si conectan/desconectan monitor)
    const handleResize = () => {
      if (isMountedRef.current) {
        calculateScale();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateScale]);

  // Handle text overlay drag
  const handleTextOverlayMouseDown = useCallback((overlayId: string, e: React.MouseEvent) => {
    if (!slideRef.current || !onTextOverlayPositionChange) return;
    e.preventDefault();
    e.stopPropagation();

    setDraggingOverlayId(overlayId);

    const updatePosition = (clientX: number, clientY: number) => {
      if (!slideRef.current || !isMountedRef.current) return;
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
      if (isMountedRef.current) {
        setDraggingOverlayId(null);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      // Clear refs
      dragListenersRef.current.move = null;
      dragListenersRef.current.up = null;
    };

    // Store in ref for cleanup on unmount
    dragListenersRef.current.move = handleMouseMove;
    dragListenersRef.current.up = handleMouseUp;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onTextOverlayPositionChange]);

  // Handle image overlay drag
  const handleImageOverlayMouseDown = useCallback((overlayId: string, e: React.MouseEvent) => {
    if (!slideRef.current || !onImageOverlayPositionChange) return;
    e.preventDefault();
    e.stopPropagation();

    setDraggingOverlayId(overlayId);

    const updatePosition = (clientX: number, clientY: number) => {
      if (!slideRef.current || !isMountedRef.current) return;
      const rect = slideRef.current.getBoundingClientRect();

      // Calculate position as percentage
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));

      onImageOverlayPositionChange(overlayId, {
        x: Math.round(x),
        y: Math.round(y),
      });
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePosition(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      if (isMountedRef.current) {
        setDraggingOverlayId(null);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      // Clear refs
      dragListenersRef.current.move = null;
      dragListenersRef.current.up = null;
    };

    // Store in ref for cleanup on unmount
    dragListenersRef.current.move = handleMouseMove;
    dragListenersRef.current.up = handleMouseUp;

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onImageOverlayPositionChange]);

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
            {/* Video background layer - behind everything */}
            {videoBackground && videoBackground.visible && (
              <VideoBackgroundLayer
                settings={videoBackground.settings}
                playing={!isBlack}
              />
            )}

            <SlideStyleWrapper styles={styles ?? null} scale={scale}>
              <UniversalSlide
                slide={slide}
                scale={scale}
                showIndicator={true}
              />
            </SlideStyleWrapper>

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

            {/* Image overlays */}
            {imageOverlays && imageOverlays.map((overlay) => (
              <div
                key={overlay.id}
                onMouseDown={onImageOverlayPositionChange ? (e) => handleImageOverlayMouseDown(overlay.id, e) : undefined}
                className="absolute"
                style={{
                  left: `${overlay.position.x}%`,
                  top: `${overlay.position.y}%`,
                  transform: `translate(-50%, -50%) rotate(${overlay.style.rotation || 0}deg)`,
                  width: `${overlay.style.size}%`,
                  opacity: overlay.visible ? overlay.style.opacity : 0.3,
                  cursor: onImageOverlayPositionChange ? 'move' : 'default',
                  pointerEvents: onImageOverlayPositionChange ? 'auto' : 'none',
                  outline: draggingOverlayId === overlay.id ? '2px dashed rgba(212, 168, 83, 0.8)' : 'none',
                  transition: draggingOverlayId === overlay.id ? 'none' : 'opacity 0.2s',
                }}
              >
                <img
                  src={overlay.imageUrl}
                  alt=""
                  className="w-full h-auto"
                  style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                  draggable={false}
                />
                {!overlay.visible && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded"
                  >
                    <span className="text-xs text-gray-400">Oculto</span>
                  </div>
                )}
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
