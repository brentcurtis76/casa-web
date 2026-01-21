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
import { VideoBackgroundLayer } from './VideoBackgroundLayer';
import { SlideStyleWrapper } from './SlideStyleWrapper';
import { VideoSlideRenderer, VideoSlideRendererRef } from './VideoSlideRenderer';
import { usePresentationSync } from '@/hooks/presentation/usePresentationSync';
import { useKeyboardShortcuts } from '@/hooks/presentation/useKeyboardShortcuts';
import { useFullscreen } from '@/hooks/presentation/useFullscreen';
import { useOutputNavigationWarning } from '@/hooks/presentation/useNavigationWarning';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { PresentationState, SyncMessage } from '@/lib/presentation/types';
import { INITIAL_PRESENTATION_STATE, shouldShowLogo, applyTempEdits, getVisibleTextOverlays, getVisibleImageOverlays, getActiveVideoBackground, DEFAULT_LOGO_STATE, DEFAULT_IMAGE_OVERLAY_STATE, DEFAULT_VIDEO_BACKGROUND_STATE, getResolvedStyles, DEFAULT_STYLE_STATE } from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';

export const OutputView: React.FC = () => {
  const [state, setState] = useState<PresentationState>(INITIAL_PRESENTATION_STATE);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<VideoSlideRendererRef>(null);
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
  // SISTEMA PREVIEW/PUBLISH:
  // - SLIDE_CHANGE is now preview-only, ignored by output
  // - PUBLISH is the primary method to update output
  const handleMessage = useCallback((message: SyncMessage) => {
    switch (message.type) {
      case 'SLIDE_CHANGE':
        // IGNORED - SLIDE_CHANGE is now preview-only
        // Output only responds to PUBLISH messages
        break;

      case 'PUBLISH':
        // PRIMARY UPDATE METHOD - staged publish from presenter
        setState((prev) => {
          // Find element index, with fallback for -1 (not found)
          const elementIndex = prev.data?.elements
            ? prev.data.elements.findIndex(el =>
                message.payload.slideIndex >= el.startSlideIndex &&
                message.payload.slideIndex <= el.endSlideIndex
              )
            : 0;

          return {
            ...prev,
            // Update live state from publish payload
            liveSlideIndex: message.payload.slideIndex,
            liveElementIndex: Math.max(0, elementIndex), // Ensure non-negative
            // Also update preview to match (for backwards compatibility)
            previewSlideIndex: message.payload.slideIndex,
            // Update live overlay states
            liveLogoState: message.payload.logoState,
            liveTextOverlayState: { overlays: message.payload.overlays },
            liveImageOverlayState: { overlays: message.payload.imageOverlays || [] },
            liveTempEdits: message.payload.tempEdits,
            liveStyleState: message.payload.styleState || prev.liveStyleState,
            // Also update current states (for rendering)
            logoState: message.payload.logoState,
            textOverlayState: { overlays: message.payload.overlays },
            imageOverlayState: { overlays: message.payload.imageOverlays || [] },
            videoBackgroundState: message.payload.videoBackgroundState || prev.videoBackgroundState,
            liveVideoBackgroundState: message.payload.videoBackgroundState || prev.liveVideoBackgroundState,
            tempEdits: message.payload.tempEdits,
            styleState: message.payload.styleState || prev.styleState,
            hasUnpublishedChanges: false,
          };
        });
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
          previewSlideIndex: 0,
          previewElementIndex: 0,
          liveSlideIndex: 0,
          liveElementIndex: 0,
        }));
        break;

      case 'STATE_SYNC':
        setState(message.state);
        break;

      case 'FULLSCREEN_TOGGLE':
        toggleFullscreen();
        break;

      case 'LOGO_UPDATE':
        // Direct logo updates (for backwards compatibility)
        setState((prev) => ({
          ...prev,
          logoState: message.logoState,
          liveLogoState: message.logoState,
        }));
        break;

      case 'SLIDES_UPDATE':
        setState((prev) => ({
          ...prev,
          data: prev.data ? { ...prev.data, slides: message.slides } : null,
          tempEdits: message.tempEdits,
          liveTempEdits: message.tempEdits,
        }));
        break;

      case 'TEXT_OVERLAYS_UPDATE':
        // Direct overlay updates (for backwards compatibility)
        setState((prev) => ({
          ...prev,
          textOverlayState: message.textOverlayState,
          liveTextOverlayState: message.textOverlayState,
        }));
        break;

      case 'IMAGE_OVERLAYS_UPDATE':
        // Direct image overlay updates
        setState((prev) => ({
          ...prev,
          imageOverlayState: message.imageOverlayState,
          liveImageOverlayState: message.imageOverlayState,
        }));
        break;

      case 'VIDEO_BACKGROUND_UPDATE':
        // Direct video background updates
        setState((prev) => ({
          ...prev,
          videoBackgroundState: message.videoBackgroundState,
          liveVideoBackgroundState: message.videoBackgroundState,
        }));
        break;

      case 'STYLES_UPDATE':
        // Direct style updates
        setState((prev) => ({
          ...prev,
          styleState: message.styleState,
          liveStyleState: message.styleState,
        }));
        break;

      case 'PREVIEW_OVERLAYS':
        setState((prev) => ({
          ...prev,
          previewOverlays: message.enabled,
        }));
        break;

      // Video control messages - validate slideId matches current slide
      case 'VIDEO_PLAY':
        setState((prev) => {
          const currentSlideId = prev.data?.slides[prev.liveSlideIndex]?.id;
          if (videoRef.current && message.slideId === currentSlideId) {
            videoRef.current.play();
          }
          return prev;
        });
        break;

      case 'VIDEO_PAUSE':
        setState((prev) => {
          const currentSlideId = prev.data?.slides[prev.liveSlideIndex]?.id;
          if (videoRef.current && message.slideId === currentSlideId) {
            videoRef.current.pause();
          }
          return prev;
        });
        break;

      case 'VIDEO_SEEK':
        setState((prev) => {
          const currentSlideId = prev.data?.slides[prev.liveSlideIndex]?.id;
          if (videoRef.current && message.slideId === currentSlideId) {
            videoRef.current.seek(message.time);
          }
          return prev;
        });
        break;

      case 'VIDEO_MUTE':
        setState((prev) => {
          const currentSlideId = prev.data?.slides[prev.liveSlideIndex]?.id;
          if (videoRef.current && message.slideId === currentSlideId) {
            videoRef.current.setMuted(message.muted);
          }
          return prev;
        });
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

  // Get LIVE slide (what's published to output) with temp edits applied
  const rawSlide: Slide | null = state.data?.slides[state.liveSlideIndex] || null;
  const currentSlide: Slide | null = rawSlide ? applyTempEdits(rawSlide, state.liveTempEdits ?? state.tempEdits) : null;

  // Get elements for scope resolution
  const elements = state.data?.elements || [];

  // Determine if logo should show on LIVE slide (with fallback for stale/missing state)
  const logoState = state.liveLogoState ?? state.logoState ?? DEFAULT_LOGO_STATE;
  const showLogo = shouldShowLogo(logoState, state.liveSlideIndex, elements);

  // Get visible text overlays for LIVE slide (with fallback for stale/missing state)
  const textOverlayState = state.liveTextOverlayState ?? state.textOverlayState ?? { overlays: [] };
  const textOverlays = getVisibleTextOverlays(textOverlayState, state.liveSlideIndex, elements);

  // Get visible image overlays for LIVE slide (with fallback for stale/missing state)
  const imageOverlayState = state.liveImageOverlayState ?? state.imageOverlayState ?? DEFAULT_IMAGE_OVERLAY_STATE;
  const imageOverlays = getVisibleImageOverlays(imageOverlayState, state.liveSlideIndex, elements);

  // Get active video background for LIVE slide (with fallback for stale/missing state)
  const videoBackgroundState = state.liveVideoBackgroundState ?? state.videoBackgroundState ?? DEFAULT_VIDEO_BACKGROUND_STATE;
  const videoBackground = getActiveVideoBackground(videoBackgroundState, state.liveSlideIndex, elements);

  // Calculate current element ID for style resolution
  const currentElement = elements.find(el =>
    state.liveSlideIndex >= el.startSlideIndex &&
    state.liveSlideIndex <= el.endSlideIndex
  );
  const currentElementId = currentElement?.id || null;

  // Get resolved styles for LIVE slide (with fallback for stale/missing state)
  const liveStyleState = state.liveStyleState ?? state.styleState ?? DEFAULT_STYLE_STATE;
  const resolvedStyles = currentSlide
    ? getResolvedStyles(liveStyleState, currentSlide.id, currentElementId)
    : null;

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
        {/* Video background layer - behind everything */}
        {videoBackground && videoBackground.visible && (
          <VideoBackgroundLayer
            settings={videoBackground.settings}
            playing={!state.isBlack}
          />
        )}

        {currentSlide && currentSlide.type === 'video' ? (
          /* Video slides use VideoSlideRenderer for full playback */
          <VideoSlideRenderer
            ref={videoRef}
            slide={currentSlide}
            scale={scale}
            isLive={state.isLive}
            isPreview={isPreviewMode}
            showControls={false}
          />
        ) : currentSlide && (
          <SlideStyleWrapper styles={resolvedStyles} scale={scale}>
            <UniversalSlide
              slide={currentSlide}
              scale={scale}
              showIndicator={false}
            />
          </SlideStyleWrapper>
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

        {/* Image overlays */}
        {imageOverlays.map((overlay) => (
          <div
            key={overlay.id}
            className="absolute"
            style={{
              left: `${overlay.position.x}%`,
              top: `${overlay.position.y}%`,
              transform: `translate(-50%, -50%) rotate(${overlay.style.rotation || 0}deg)`,
              width: `${overlay.style.size}%`,
              opacity: overlay.style.opacity,
              pointerEvents: 'none',
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
          </div>
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
