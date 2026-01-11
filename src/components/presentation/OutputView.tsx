/**
 * OutputView - Vista de salida para proyector
 * Recibe comandos del Presenter y muestra slides en pantalla completa
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
import type { PresentationState, SyncMessage, PresentationData, TextOverlay } from '@/lib/presentation/types';
import { INITIAL_PRESENTATION_STATE, getEffectiveLogoSettings, applyTempEdits, getEffectiveTextOverlays, DEFAULT_TEXT_OVERLAY_STYLE } from '@/lib/presentation/types';
import { INITIAL_SCENE_STATE } from '@/lib/presentation/sceneTypes';
import type { Prop, PropConfig, TextOverlayPropConfig, LowerThirdPropConfig, LogoVariationPropConfig } from '@/lib/presentation/sceneTypes';
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
        // Ensure sceneState exists (backward compatibility with old saved states)
        setState({
          ...message.state,
          sceneState: message.state.sceneState || INITIAL_SCENE_STATE,
        });
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

      // Scene/Props messages
      case 'SCENE_CHANGE':
        setState((prev) => ({
          ...prev,
          sceneState: {
            ...(prev.sceneState || INITIAL_SCENE_STATE),
            currentElementId: message.elementId,
            currentLook: message.look,
            placeholderContext: message.context,
            // Auto props are immediately active
            activeProps: message.look?.props
              ?.filter((p) => p.trigger === 'auto')
              .map((p) => p.id) || [],
            armedProps: message.look?.props
              ?.filter((p) => p.trigger === 'armed')
              .map((p) => p.id) || [],
          },
        }));
        break;

      case 'PROP_SHOW':
        setState((prev) => {
          const sceneState = prev.sceneState || INITIAL_SCENE_STATE;
          return {
            ...prev,
            sceneState: {
              ...sceneState,
              activeProps: sceneState.activeProps.includes(message.propId)
                ? sceneState.activeProps
                : [...sceneState.activeProps, message.propId],
              armedProps: sceneState.armedProps.filter((id) => id !== message.propId),
            },
          };
        });
        break;

      case 'PROP_HIDE':
        setState((prev) => {
          const sceneState = prev.sceneState || INITIAL_SCENE_STATE;
          // Find the prop to check if it should go back to armed
          const prop = sceneState.currentLook?.props.find((p) => p.id === message.propId);
          const wasArmed = prop?.trigger === 'armed';
          return {
            ...prev,
            sceneState: {
              ...sceneState,
              activeProps: sceneState.activeProps.filter((id) => id !== message.propId),
              // Re-arm if the prop was originally armed
              armedProps: wasArmed && !sceneState.armedProps.includes(message.propId)
                ? [...sceneState.armedProps, message.propId]
                : sceneState.armedProps,
            },
          };
        });
        break;

      case 'PROPS_UPDATE':
        setState((prev) => ({
          ...prev,
          sceneState: {
            ...(prev.sceneState || INITIAL_SCENE_STATE),
            activeProps: message.activeProps,
            armedProps: message.armedProps,
          },
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

  // Get active scene props and convert to display format
  const getActiveSceneTextOverlays = useCallback((): TextOverlay[] => {
    const sceneState = state.sceneState || INITIAL_SCENE_STATE;
    if (!sceneState.currentLook) return [];

    return sceneState.currentLook.props
      .filter((prop) =>
        prop.type === 'text-overlay' &&
        sceneState.activeProps.includes(prop.id)
      )
      .map((prop) => {
        const config = prop.config as TextOverlayPropConfig;
        return {
          id: `scene-${prop.id}`,
          content: config.content,
          position: config.position,
          style: config.style || DEFAULT_TEXT_OVERLAY_STYLE,
          visible: true,
        };
      });
  }, [state.sceneState]);

  // Check if there's an active lower-third from scene props
  const getActiveSceneLowerThird = useCallback(() => {
    const sceneState = state.sceneState || INITIAL_SCENE_STATE;
    if (!sceneState.currentLook) return null;

    const lowerThirdProp = sceneState.currentLook.props.find(
      (prop) =>
        prop.type === 'lower-third' &&
        sceneState.activeProps.includes(prop.id)
    );

    if (!lowerThirdProp) return null;

    const config = lowerThirdProp.config as LowerThirdPropConfig;
    return {
      visible: true,
      message: config.message,
      duration: config.duration,
      template: config.template,
    };
  }, [state.sceneState]);

  // Combine global lower-third state with scene lower-third
  const effectiveLowerThird = state.lowerThird.visible
    ? state.lowerThird
    : (getActiveSceneLowerThird() || state.lowerThird);

  // Combine global text overlays with scene text overlays
  const allTextOverlays = [
    ...getEffectiveTextOverlays(state.textOverlayState, state.currentSlideIndex),
    ...getActiveSceneTextOverlays(),
  ];

  // Waiting screen when not live or no data
  if (!state.isLive || !state.data) {
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
            Esperando conexion del presentador...
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
      {/* Slide container */}
      <div className="relative">
        {currentSlide && (
          <UniversalSlide
            slide={currentSlide}
            scale={scale}
            showIndicator={false}
          />
        )}

        {/* Logo overlay */}
        <LogoOverlay
          settings={getEffectiveLogoSettings(state.logoState, state.currentSlideIndex)}
          slideWidth={CASA_BRAND.slide.width * scale}
          slideHeight={CASA_BRAND.slide.height * scale}
        />

        {/* Text overlays (global + scene props) */}
        {allTextOverlays.map((overlay) => (
          <TextOverlayDisplay
            key={overlay.id}
            overlay={overlay}
            slideWidth={CASA_BRAND.slide.width * scale}
            slideHeight={CASA_BRAND.slide.height * scale}
          />
        ))}

        {/* Lower-third overlay (global or scene prop) */}
        <LowerThirdDisplay
          state={effectiveLowerThird}
          onDismiss={handleDismissLowerThird}
        />
      </div>
    </div>
  );
};

export default OutputView;
