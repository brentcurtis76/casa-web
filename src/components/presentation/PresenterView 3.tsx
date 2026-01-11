/**
 * PresenterView - Vista principal del presentador
 * Controla la presentacion y sincroniza con la vista de salida
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ServiceNavigator } from './ServiceNavigator';
import { SlideStrip } from './SlideStrip';
import { SlidePreview } from './SlidePreview';
import { PresenterControls } from './PresenterControls';
import { LiturgySelectorModal } from './LiturgySelectorModal';
import { LowerThirdManager } from './LowerThirdManager';
import { LogoControls } from './LogoControls';
import { TextOverlayControls } from './TextOverlayControls';
import { SlideEditor } from './SlideEditor';
import { TimerClock } from './TimerClock';
import { PresenterNotes } from './PresenterNotes';
import { CollapsiblePanel } from './CollapsiblePanel';
import { RecoveryModal } from './RecoveryModal';
import { ExitWarningModal } from './ExitWarningModal';
import { usePresentationSync } from '@/hooks/presentation/usePresentationSync';
import { usePresentationState } from '@/hooks/presentation/usePresentationState';
import { useKeyboardShortcuts } from '@/hooks/presentation/useKeyboardShortcuts';
import { useAutoSave, getSavedPresentationState, clearSavedPresentationState, type SavedPresentationState } from '@/hooks/presentation/useAutoSave';
import { useNavigationWarning } from '@/hooks/presentation/useNavigationWarning';
import { loadLiturgyForPresentation } from '@/lib/presentation/presentationService';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { SyncMessage, LowerThirdTemplate, LogoSettings, TempSlideEdit, TextOverlay, TextOverlayStyle } from '@/lib/presentation/types';
import { getEffectiveLogoSettings } from '@/lib/presentation/types';
import { FolderOpen, Loader2, FileText, MessageSquare, Image as ImageIcon, Type } from 'lucide-react';

export const PresenterView: React.FC = () => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveStartTime, setLiveStartTime] = useState<Date | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [recoveryState, setRecoveryState] = useState<SavedPresentationState | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const outputWindowRef = useRef<Window | null>(null);
  const syncStateRef = useRef<((state: import('@/lib/presentation/types').PresentationState) => void) | null>(null);
  const recoveryCheckedRef = useRef(false);

  // Presentation state
  const {
    state,
    loadLiturgy,
    goToSlide,
    nextSlide,
    prevSlide,
    firstSlide,
    lastSlide,
    goToElement,
    goLive,
    toggleBlack,
    setBlack,
    showLowerThird,
    hideLowerThird,
    updateLogoGlobal,
    setLogoOverride,
    removeLogoOverride,
    applyLogoToAll,
    editSlideContent,
    clearSlideEdit,
    duplicateSlide,
    deleteSlide,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    setTextOverlayOverride,
    removeTextOverlayOverride,
    clearTextOverlayOverrides,
    currentSlide,
    currentElement,
    totalSlides,
    setLogoState,
    setTextOverlayState,
  } = usePresentationState();

  // Auto-save presentation state to localStorage
  useAutoSave(state);

  // Warn before leaving when liturgy is loaded (handles both browser close AND back button)
  const navigationWarning = useNavigationWarning({
    enabled: !!state.data,
    message: '¿Salir de la presentación? Tu progreso se guardará automáticamente.',
  });

  // Check for recoverable session on mount
  useEffect(() => {
    if (recoveryCheckedRef.current) return;
    recoveryCheckedRef.current = true;

    const saved = getSavedPresentationState();
    if (saved) {
      setRecoveryState(saved);
      setShowRecoveryModal(true);
    }
  }, []);

  // Handle incoming sync messages from output
  const handleMessage = useCallback((message: SyncMessage) => {
    switch (message.type) {
      case 'REQUEST_STATE':
        // Output is requesting current state
        syncStateRef.current?.(state);
        break;
    }
  }, [state]);

  // Setup sync channel
  const { send, syncState } = usePresentationSync({
    role: 'presenter',
    onMessage: handleMessage,
  });

  // Store syncState in ref to avoid circular dependency
  useEffect(() => {
    syncStateRef.current = syncState;
  }, [syncState]);

  // Load a liturgy
  const handleSelectLiturgy = async (liturgyId: string) => {
    setLoading(true);
    try {
      const data = await loadLiturgyForPresentation(liturgyId);
      if (data) {
        loadLiturgy(data);
        send({ type: 'LITURGY_LOADED', data });
      }
    } catch (err) {
      console.error('Error loading liturgy:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle recovery from saved state
  const handleRecover = useCallback(async () => {
    if (!recoveryState) return;

    setLoading(true);
    setShowRecoveryModal(false);

    try {
      // Load the liturgy by ID
      const data = await loadLiturgyForPresentation(recoveryState.liturgyId);
      if (data) {
        loadLiturgy(data);

        // Restore saved state after a short delay to let liturgy load
        setTimeout(() => {
          // Jump to saved slide
          goToSlide(recoveryState.currentSlideIndex);

          // Restore logo state
          setLogoState(recoveryState.logoState);

          // Restore text overlay state
          setTextOverlayState(recoveryState.textOverlayState);

          // Restore live/black states
          if (recoveryState.isLive) {
            goLive();
            setLiveStartTime(new Date());
            send({ type: 'GO_LIVE' });
          }
          if (recoveryState.isBlack) {
            setBlack(true);
            send({ type: 'GO_BLACK', black: true });
          }

          // Sync full state to output
          send({ type: 'LITURGY_LOADED', data });
          send({ type: 'SLIDE_CHANGE', slideIndex: recoveryState.currentSlideIndex });
          send({ type: 'LOGO_UPDATE', logoState: recoveryState.logoState });
          send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: recoveryState.textOverlayState });
        }, 100);
      }
    } catch (err) {
      console.error('Error recovering session:', err);
    } finally {
      setLoading(false);
      setRecoveryState(null);
    }
  }, [recoveryState, loadLiturgy, goToSlide, setLogoState, setTextOverlayState, goLive, setBlack, send]);

  // Handle starting fresh (clear saved state)
  const handleStartFresh = useCallback(() => {
    clearSavedPresentationState();
    setShowRecoveryModal(false);
    setRecoveryState(null);
  }, []);

  // Navigation with sync
  const handleGoToSlide = useCallback((index: number) => {
    goToSlide(index);
    send({ type: 'SLIDE_CHANGE', slideIndex: index });
  }, [goToSlide, send]);

  const handleNext = useCallback(() => {
    if (state.data && state.currentSlideIndex < state.data.slides.length - 1) {
      const newIndex = state.currentSlideIndex + 1;
      goToSlide(newIndex);
      send({ type: 'SLIDE_CHANGE', slideIndex: newIndex });
    }
  }, [state.data, state.currentSlideIndex, goToSlide, send]);

  const handlePrev = useCallback(() => {
    if (state.currentSlideIndex > 0) {
      const newIndex = state.currentSlideIndex - 1;
      goToSlide(newIndex);
      send({ type: 'SLIDE_CHANGE', slideIndex: newIndex });
    }
  }, [state.currentSlideIndex, goToSlide, send]);

  const handleFirst = useCallback(() => {
    goToSlide(0);
    send({ type: 'SLIDE_CHANGE', slideIndex: 0 });
  }, [goToSlide, send]);

  const handleLast = useCallback(() => {
    if (state.data) {
      const lastIndex = state.data.slides.length - 1;
      goToSlide(lastIndex);
      send({ type: 'SLIDE_CHANGE', slideIndex: lastIndex });
    }
  }, [state.data, goToSlide, send]);

  const handleGoToElement = useCallback((elementIndex: number) => {
    if (state.data?.elements[elementIndex]) {
      const startIndex = state.data.elements[elementIndex].startSlideIndex;
      goToElement(elementIndex);
      send({ type: 'SLIDE_CHANGE', slideIndex: startIndex });
    }
  }, [state.data, goToElement, send]);

  // Go Live with sync (toggle)
  const handleGoLive = useCallback(() => {
    const newLiveState = !state.isLive;
    goLive();
    if (newLiveState) {
      setLiveStartTime(new Date());
      send({ type: 'GO_LIVE' });
    } else {
      setLiveStartTime(null);
      send({ type: 'GO_OFFLINE' });
    }
    syncState({ ...state, isLive: newLiveState, isBlack: newLiveState ? false : state.isBlack });
  }, [goLive, send, syncState, state]);

  // Toggle Black with sync
  const handleToggleBlack = useCallback(() => {
    const newBlack = !state.isBlack;
    setBlack(newBlack);
    send({ type: 'GO_BLACK', black: newBlack });
  }, [state.isBlack, setBlack, send]);

  // Open output window
  const handleOpenOutput = useCallback(() => {
    // Close existing window if open
    if (outputWindowRef.current && !outputWindowRef.current.closed) {
      outputWindowRef.current.focus();
      return;
    }

    // Open new window
    const outputUrl = `${window.location.origin}/output`;
    outputWindowRef.current = window.open(
      outputUrl,
      'casa-output',
      'width=1024,height=768'
    );

    // Send current state after a delay to let the window load
    setTimeout(() => {
      if (state.data) {
        send({ type: 'LITURGY_LOADED', data: state.data });
        send({ type: 'SLIDE_CHANGE', slideIndex: state.currentSlideIndex });
        send({ type: 'LOGO_UPDATE', logoState: state.logoState });
        send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: state.textOverlayState });
        if (state.isLive) {
          send({ type: 'GO_LIVE' });
        }
        if (state.isBlack) {
          send({ type: 'GO_BLACK', black: true });
        }
      }
    }, 1000);
  }, [state, send]);

  // Lower-third controls
  const handleSendLowerThird = useCallback((
    message: string,
    duration?: number,
    template?: LowerThirdTemplate
  ) => {
    showLowerThird(message, duration, template);
    send({ type: 'SHOW_LOWER_THIRD', message, duration, template });
  }, [showLowerThird, send]);

  const handleHideLowerThird = useCallback(() => {
    hideLowerThird();
    send({ type: 'HIDE_LOWER_THIRD' });
  }, [hideLowerThird, send]);

  // Logo controls with sync
  const handleUpdateLogoGlobal = useCallback((settings: Partial<LogoSettings>) => {
    updateLogoGlobal(settings);
    // Sync after update - we need to send the new state
    setTimeout(() => {
      const newState = {
        ...state.logoState,
        global: { ...state.logoState.global, ...settings },
      };
      send({ type: 'LOGO_UPDATE', logoState: newState });
    }, 0);
  }, [updateLogoGlobal, send, state.logoState]);

  const handleSetLogoOverride = useCallback((slideIndex: number, settings: Partial<LogoSettings>) => {
    setLogoOverride(slideIndex, settings);
    setTimeout(() => {
      const newState = {
        ...state.logoState,
        overrides: {
          ...state.logoState.overrides,
          [slideIndex]: { ...state.logoState.overrides[slideIndex], ...settings },
        },
      };
      send({ type: 'LOGO_UPDATE', logoState: newState });
    }, 0);
  }, [setLogoOverride, send, state.logoState]);

  const handleRemoveLogoOverride = useCallback((slideIndex: number) => {
    removeLogoOverride(slideIndex);
    setTimeout(() => {
      const newOverrides = { ...state.logoState.overrides };
      delete newOverrides[slideIndex];
      send({ type: 'LOGO_UPDATE', logoState: { ...state.logoState, overrides: newOverrides } });
    }, 0);
  }, [removeLogoOverride, send, state.logoState]);

  const handleApplyLogoToAll = useCallback((settings: LogoSettings) => {
    applyLogoToAll(settings);
    send({ type: 'LOGO_UPDATE', logoState: { global: settings, overrides: {} } });
  }, [applyLogoToAll, send]);

  // Slide editing handlers
  const handleEditSlide = useCallback((index: number) => {
    setEditingSlideIndex(index);
    setEditorOpen(true);
  }, []);

  const handleSaveSlideEdit = useCallback((content: TempSlideEdit['content']) => {
    if (editingSlideIndex === null || !state.data) return;
    const slide = state.data.slides[editingSlideIndex];
    if (!slide) return;

    editSlideContent(slide.id, content);

    // Sync to output
    setTimeout(() => {
      if (state.data) {
        send({ type: 'SLIDES_UPDATE', slides: state.data.slides, tempEdits: state.tempEdits });
      }
    }, 0);
  }, [editingSlideIndex, state.data, state.tempEdits, editSlideContent, send]);

  const handleClearSlideEdit = useCallback(() => {
    if (editingSlideIndex === null || !state.data) return;
    const slide = state.data.slides[editingSlideIndex];
    if (!slide) return;

    clearSlideEdit(slide.id);

    // Sync to output
    setTimeout(() => {
      if (state.data) {
        send({ type: 'SLIDES_UPDATE', slides: state.data.slides, tempEdits: state.tempEdits });
      }
    }, 0);
  }, [editingSlideIndex, state.data, state.tempEdits, clearSlideEdit, send]);

  const handleDuplicateSlide = useCallback((index: number) => {
    duplicateSlide(index);

    // Sync to output after state update
    setTimeout(() => {
      if (state.data) {
        send({ type: 'SLIDES_UPDATE', slides: state.data.slides, tempEdits: state.tempEdits });
      }
    }, 50);
  }, [duplicateSlide, state.data, state.tempEdits, send]);

  const handleDeleteSlide = useCallback((index: number) => {
    deleteSlide(index);

    // Sync to output after state update
    setTimeout(() => {
      if (state.data) {
        send({ type: 'SLIDES_UPDATE', slides: state.data.slides, tempEdits: state.tempEdits });
        send({ type: 'SLIDE_CHANGE', slideIndex: state.currentSlideIndex });
      }
    }, 50);
  }, [deleteSlide, state.data, state.tempEdits, state.currentSlideIndex, send]);

  // Text overlay handlers with sync
  const handleAddTextOverlay = useCallback((
    content: string,
    position?: { x: number; y: number },
    style?: Partial<TextOverlayStyle>
  ) => {
    addTextOverlay(content, position, style);
    // Sync after state update
    setTimeout(() => {
      send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: state.textOverlayState });
    }, 50);
  }, [addTextOverlay, state.textOverlayState, send]);

  const handleUpdateTextOverlay = useCallback((id: string, updates: Partial<TextOverlay>) => {
    updateTextOverlay(id, updates);
    setTimeout(() => {
      send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: state.textOverlayState });
    }, 50);
  }, [updateTextOverlay, state.textOverlayState, send]);

  const handleRemoveTextOverlay = useCallback((id: string) => {
    removeTextOverlay(id);
    setTimeout(() => {
      send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: state.textOverlayState });
    }, 50);
  }, [removeTextOverlay, state.textOverlayState, send]);

  const handleSetTextOverlayOverride = useCallback((
    slideIndex: number,
    overlayId: string,
    override: Partial<TextOverlay>
  ) => {
    setTextOverlayOverride(slideIndex, overlayId, override);
    setTimeout(() => {
      send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: state.textOverlayState });
    }, 50);
  }, [setTextOverlayOverride, state.textOverlayState, send]);

  const handleRemoveTextOverlayOverride = useCallback((slideIndex: number, overlayId: string) => {
    removeTextOverlayOverride(slideIndex, overlayId);
    setTimeout(() => {
      send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: state.textOverlayState });
    }, 50);
  }, [removeTextOverlayOverride, state.textOverlayState, send]);

  const handleClearTextOverlayOverrides = useCallback((slideIndex: number) => {
    clearTextOverlayOverrides(slideIndex);
    setTimeout(() => {
      send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: state.textOverlayState });
    }, 50);
  }, [clearTextOverlayOverrides, state.textOverlayState, send]);

  // Get the slide being edited
  const editingSlide = editingSlideIndex !== null && state.data
    ? state.data.slides[editingSlideIndex]
    : null;

  // Keyboard shortcuts
  useKeyboardShortcuts({
    enabled: true,
    onNext: handleNext,
    onPrev: handlePrev,
    onFirst: handleFirst,
    onLast: handleLast,
    onBlack: handleToggleBlack,
    onFullscreen: () => send({ type: 'FULLSCREEN_TOGGLE' }),
  });

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        backgroundColor: CASA_BRAND.colors.primary.black,
      }}
    >
      {/* Top bar with controls */}
      <PresenterControls
        isLive={state.isLive}
        isBlack={state.isBlack}
        hasData={!!state.data}
        currentIndex={state.currentSlideIndex}
        totalSlides={totalSlides}
        onGoLive={handleGoLive}
        onToggleBlack={handleToggleBlack}
        onOpenOutput={handleOpenOutput}
        onNext={handleNext}
        onPrev={handlePrev}
        onFirst={handleFirst}
        onLast={handleLast}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Service Navigator */}
        <div className="w-64 flex-shrink-0">
          <ServiceNavigator
            elements={state.data?.elements || []}
            currentElementIndex={state.currentElementIndex}
            onElementClick={handleGoToElement}
          />
        </div>

        {/* Center - Main preview area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header with liturgy info and timer */}
          <div
            className="flex items-center justify-between px-6 py-3 flex-shrink-0"
            style={{
              backgroundColor: CASA_BRAND.colors.secondary.carbon,
              borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
            }}
          >
            <div className="flex items-center gap-4">
              <Button
                onClick={() => setSelectorOpen(true)}
                variant="outline"
                className="gap-2"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <FolderOpen size={16} />
                )}
                {state.data ? 'Cambiar Liturgia' : 'Seleccionar Liturgia'}
              </Button>

              {state.data && (
                <div>
                  <h1
                    style={{
                      fontFamily: CASA_BRAND.fonts.heading,
                      fontSize: '16px',
                      fontWeight: 600,
                      color: CASA_BRAND.colors.primary.white,
                    }}
                  >
                    {state.data.liturgyTitle}
                  </h1>
                  <p
                    style={{
                      fontFamily: CASA_BRAND.fonts.body,
                      fontSize: '12px',
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {state.data.liturgyDate.toLocaleDateString('es-CL', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            <TimerClock isLive={state.isLive} liveStartTime={liveStartTime} />
          </div>

          {/* Slide preview - constrained and centered */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
            <SlidePreview
              slide={currentSlide}
              currentIndex={state.currentSlideIndex}
              totalSlides={totalSlides}
              isLive={state.isLive}
              isBlack={state.isBlack}
              logoSettings={getEffectiveLogoSettings(state.logoState, state.currentSlideIndex)}
            />
          </div>

          {/* Slide strip - fixed at bottom */}
          <div className="h-32 flex-shrink-0">
            <SlideStrip
              slides={state.data?.slides || []}
              currentIndex={state.currentSlideIndex}
              onSlideClick={handleGoToSlide}
              logoOverrides={state.logoState.overrides}
              textOverlayOverrides={state.textOverlayState.overrides}
              tempEdits={state.tempEdits}
              onEdit={handleEditSlide}
              onDuplicate={handleDuplicateSlide}
              onDelete={handleDeleteSlide}
            />
          </div>
        </div>

        {/* Right sidebar - Collapsible panels */}
        <div
          className="w-80 flex-shrink-0 flex flex-col overflow-hidden"
          style={{
            backgroundColor: CASA_BRAND.colors.secondary.carbon,
            borderLeft: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
          }}
        >
          <div className="flex-1 overflow-y-auto">
            {/* Presenter Notes - expanded by default */}
            <CollapsiblePanel
              title="Notas del Presentador"
              icon={<FileText size={16} />}
              defaultOpen={true}
            >
              <PresenterNotes currentElement={currentElement} compact />
            </CollapsiblePanel>

            {/* Lower-Third - expanded by default */}
            <CollapsiblePanel
              title="Lower-Third"
              icon={<MessageSquare size={16} />}
              defaultOpen={true}
              badge={
                state.lowerThird.visible ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs animate-pulse"
                    style={{
                      backgroundColor: '#22c55e30',
                      color: '#22c55e',
                    }}
                  >
                    LIVE
                  </span>
                ) : null
              }
            >
              <LowerThirdManager
                onSend={handleSendLowerThird}
                onDismiss={handleHideLowerThird}
                isVisible={state.lowerThird.visible}
                compact
              />
            </CollapsiblePanel>

            {/* Logo Controls - collapsed by default */}
            <CollapsiblePanel
              title="Logo CASA"
              icon={<ImageIcon size={16} />}
              defaultOpen={false}
              badge={
                state.currentSlideIndex in state.logoState.overrides ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                      color: CASA_BRAND.colors.primary.amber,
                    }}
                  >
                    Override
                  </span>
                ) : null
              }
            >
              <LogoControls
                logoState={state.logoState}
                currentSlideIndex={state.currentSlideIndex}
                currentSlide={currentSlide}
                onUpdateGlobal={handleUpdateLogoGlobal}
                onSetOverride={handleSetLogoOverride}
                onRemoveOverride={handleRemoveLogoOverride}
                onApplyToAll={handleApplyLogoToAll}
                compact
              />
            </CollapsiblePanel>

            {/* Text Overlay Controls - collapsed by default */}
            <CollapsiblePanel
              title="Textos"
              icon={<Type size={16} />}
              defaultOpen={false}
              badge={
                <>
                  {state.textOverlayState.global.length > 0 && (
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                        color: CASA_BRAND.colors.secondary.grayMedium,
                      }}
                    >
                      {state.textOverlayState.global.length}
                    </span>
                  )}
                  {state.currentSlideIndex in state.textOverlayState.overrides && (
                    <span
                      className="px-2 py-0.5 rounded text-xs ml-1"
                      style={{
                        backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                        color: CASA_BRAND.colors.primary.amber,
                      }}
                    >
                      Override
                    </span>
                  )}
                </>
              }
            >
              <TextOverlayControls
                textOverlayState={state.textOverlayState}
                currentSlideIndex={state.currentSlideIndex}
                onAdd={handleAddTextOverlay}
                onUpdate={handleUpdateTextOverlay}
                onRemove={handleRemoveTextOverlay}
                onSetOverride={handleSetTextOverlayOverride}
                onRemoveOverride={handleRemoveTextOverlayOverride}
                onClearOverrides={handleClearTextOverlayOverrides}
                compact
              />
            </CollapsiblePanel>
          </div>
        </div>
      </div>

      {/* Liturgy selector modal */}
      <LiturgySelectorModal
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleSelectLiturgy}
        currentLiturgyId={state.data?.liturgyId}
      />

      {/* Slide editor modal */}
      <SlideEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingSlideIndex(null);
        }}
        slide={editingSlide}
        tempEdit={editingSlide ? state.tempEdits[editingSlide.id] : undefined}
        onSave={handleSaveSlideEdit}
        onClear={handleClearSlideEdit}
      />

      {/* Recovery modal */}
      {recoveryState && (
        <RecoveryModal
          open={showRecoveryModal}
          savedState={recoveryState}
          onRecover={handleRecover}
          onStartFresh={handleStartFresh}
        />
      )}

      {/* Exit warning modal (shown when user tries to navigate away) */}
      <ExitWarningModal
        open={navigationWarning.isBlocked}
        onConfirm={navigationWarning.proceed}
        onCancel={navigationWarning.cancel}
      />
    </div>
  );
};

export default PresenterView;
