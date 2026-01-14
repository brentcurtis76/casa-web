/**
 * OutputView - Vista de salida para proyector
 * Recibe comandos del Presenter y muestra slides en pantalla completa
 *
 * SISTEMA SIMPLIFICADO (v2):
 * - Usa shouldShowLogo() para determinar si mostrar logo
 * - Usa getVisibleTextOverlays() para obtener textos visibles
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { UniversalSlide } from '@/components/liturgia-builder/UniversalSlide';
import { LowerThirdDisplay } from './LowerThirdDisplay';
import { LogoOverlay } from './LogoOverlay';
import { TextOverlayDisplay } from './TextOverlayDisplay';
import { usePresentationSync } from '@/hooks/presentation/usePresentationSync';
import { useKeyboardShortcuts } from '@/hooks/presentation/useKeyboardShortcuts';
import { useFullscreen } from '@/hooks/presentation/useFullscreen';
import { useOutputNavigationWarning } from '@/hooks/presentation/useNavigationWarning';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { PresentationState, SyncMessage } from '@/lib/presentation/types';
import { INITIAL_PRESENTATION_STATE, shouldShowLogo, applyTempEdits, getVisibleTextOverlays, DEFAULT_LOGO_STATE } from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';

export const OutputView: React.FC = () => {
  const [state, setState] = useState<PresentationState>(INITIAL_PRESENTATION_STATE);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  // Warn before leaving when output is live and connected
  useOutputNavigationWarning(state.isLive && !!state.data);

  // Calculate scale to fit slide in viewport
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const slideWidth = CASA_BRAND.slide.width;
      const slideHeight = CASA_BRAND.slide.height;

      const scaleX = viewportWidth / slideWidth;
      const scaleY = viewportHeight / slideHeight;
      setScale(Math.min(scaleX, scaleY));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Handle incoming sync messages
  const handleMessage = useCallback((message: SyncMessage) => {
    switch (message.type) {
      case 'SLIDE_CHANGE':
        setState((prev) => ({
          ...prev,
          currentSlideIndex: message.slideIndex,
        }));
        break;

      case 'GO_LIVE':
        setState((prev) => ({
          ...prev,
          isLive: true,
          isBlack: false,
        }));
        break;

      case 'GO_OFFLINE':
        setState((prev) => ({
          ...prev,
          isLive: false,
        }));
        break;

      case 'GO_BLACK':
        setState((prev) => ({
          ...prev,
          isBlack: message.black,
        }));
        break;

      case 'SHOW_LOWER_THIRD':
        setState((prev) => ({
          ...prev,
          lowerThird: {
            visible: true,
            message: message.message,
            duration: message.duration,
            template: message.template,
          },
        }));
        break;

      case 'HIDE_LOWER_THIRD':
        setState((prev) => ({
          ...prev,
          lowerThird: {
            ...prev.lowerThird,
            visible: false,
          },
        }));
        break;

      case 'LITURGY_LOADED':
        setState((prev) => ({
          ...prev,
          data: message.data,
          currentSlideIndex: 0,
          currentElementIndex: 0,
        }));
        break;

      case 'STATE_SYNC':
        setState(message.state);
        break;

      case 'FULLSCREEN_TOGGLE':
        toggleFullscreen();
        break;

      case 'LOGO_UPDATE':
        setState((prev) => ({
          ...prev,
          logoState: message.logoState,
        }));
        break;

      case 'SLIDES_UPDATE':
        setState((prev) => ({
          ...prev,
          data: prev.data ? { ...prev.data, slides: message.slides } : null,
          tempEdits: message.tempEdits,
        }));
        break;

      case 'TEXT_OVERLAYS_UPDATE':
        setState((prev) => ({
          ...prev,
          textOverlayState: message.textOverlayState,
        }));
        break;

      case 'PREVIEW_OVERLAYS':
        setState((prev) => ({
          ...prev,
          previewOverlays: message.enabled,
        }));
        break;
    }
  }, [toggleFullscreen]);

  // Setup sync channel
  const { send } = usePresentationSync({
    role: 'output',
    onMessage: handleMessage,
  });

  // Dismiss lower-third
  const handleDismissLowerThird = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lowerThird: {
        ...prev.lowerThird,
        visible: false,
      },
    }));
    send({ type: 'HIDE_LOWER_THIRD' });
  }, [send]);

  // Keyboard shortcuts (minimal for output - just fullscreen)
  useKeyboardShortcuts({
    enabled: true,
    onNext: () => {},
    onPrev: () => {},
    onFirst: () => {},
    onLast: () => {},
    onBlack: () => {},
    onFullscreen: toggleFullscreen,
  });

  // Get current slide with temp edits applied
  const rawSlide: Slide | null = state.data?.slides[state.currentSlideIndex] || null;
  const currentSlide: Slide | null = rawSlide ? applyTempEdits(rawSlide, state.tempEdits) : null;

  // Get elements for scope resolution
  const elements = state.data?.elements || [];

  // Determine if logo should show on current slide (with fallback for stale/missing state)
  const logoState = state.logoState ?? DEFAULT_LOGO_STATE;
  const showLogo = shouldShowLogo(logoState, state.currentSlideIndex, elements);

  // Get visible text overlays for current slide (with fallback for stale/missing state)
  const textOverlayState = state.textOverlayState ?? { overlays: [] };
  const textOverlays = getVisibleTextOverlays(textOverlayState, state.currentSlideIndex, elements);

  // Check if we should show content (live OR preview mode with data)
  const isPreviewMode = state.previewOverlays === true;
  const shouldShowContent = state.data && (state.isLive || isPreviewMode);

  // Waiting screen when no data or not live/preview
  if (!shouldShowContent) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 flex items-center justify-center"
        style={{
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      >
        <div className="text-center">
          <img
            src="/lovable-uploads/47301834-0831-465c-ae5e-47a978038312.png"
            alt="CASA"
            className="mx-auto mb-8 opacity-30"
            style={{ width: 120, height: 120 }}
          />
          <p
            style={{
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '18px',
              color: CASA_BRAND.colors.secondary.grayMedium,
            }}
          >
            Esperando conexión del presentador...
          </p>
          <button
            onClick={toggleFullscreen}
            className="mt-8 px-6 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: CASA_BRAND.colors.secondary.carbon,
              color: CASA_BRAND.colors.primary.white,
              fontFamily: CASA_BRAND.fonts.body,
              fontSize: '14px',
            }}
          >
            {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (F)'}
          </button>
        </div>
      </div>
    );
  }

  // Black screen
  if (state.isBlack) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0"
        style={{
          backgroundColor: CASA_BRAND.colors.primary.black,
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: CASA_BRAND.colors.primary.black,
      }}
    >
      {/* Preview mode indicator */}
      {isPreviewMode && !state.isLive && (
        <div
          className="absolute top-4 left-4 z-50 px-3 py-1.5 rounded-md"
          style={{
            backgroundColor: `${CASA_BRAND.colors.primary.amber}30`,
            color: CASA_BRAND.colors.primary.amber,
            fontFamily: CASA_BRAND.fonts.body,
            fontSize: '14px',
            fontWeight: 600,
            border: `1px solid ${CASA_BRAND.colors.primary.amber}50`,
          }}
        >
          VISTA PREVIA
        </div>
      )}

      {/* Slide container */}
      <div className="relative">
        {currentSlide && (
          <UniversalSlide
            slide={currentSlide}
            scale={scale}
            showIndicator={false}
          />
        )}

        {/* Logo overlay - only show if shouldShowLogo returns true */}
        {showLogo && (
          <LogoOverlay
            settings={logoState.settings}
            slideWidth={CASA_BRAND.slide.width * scale}
            slideHeight={CASA_BRAND.slide.height * scale}
          />
        )}

        {/* Text overlays */}
        {textOverlays.map((overlay) => (
          <TextOverlayDisplay
            key={overlay.id}
            overlay={overlay}
            slideWidth={CASA_BRAND.slide.width * scale}
            slideHeight={CASA_BRAND.slide.height * scale}
          />
        ))}

        {/* Lower-third overlay */}
        <LowerThirdDisplay
          state={state.lowerThird}
          onDismiss={handleDismissLowerThird}
        />
      </div>
    </div>
  );
};

export default OutputView;
