/**
 * PresenterView - Vista principal del presentador
 * Controla la presentacion y sincroniza con la vista de salida
 *
 * UI/UX REDESIGN (PROMPT_018):
 * - Unified header with 4 zones (File, Context, Timer, Controls)
 * - Separate NavigationStrip above slide preview
 * - FAB repositioned to bottom-right corner
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { ServiceNavigator } from './ServiceNavigator';
import { SlideStrip } from './SlideStrip';
import { SlidePreview } from './SlidePreview';
import { PresenterControls } from './PresenterControls';
import { NavigationStrip } from './NavigationStrip';
import { LiturgySelectorModal } from './LiturgySelectorModal';
import { LowerThirdManager } from './LowerThirdManager';
import { LogoControls } from './LogoControls';
import { TextOverlayControls } from './TextOverlayControls';
import { ImageOverlayControls } from './ImageOverlayControls';
import { VideoBackgroundControls } from './VideoBackgroundControls';
import { SlideEditor } from './SlideEditor';
import { PresenterNotes } from './PresenterNotes';
import { CollapsiblePanel } from './CollapsiblePanel';
import { RecoveryModal } from './RecoveryModal';
import { ExitWarningModal } from './ExitWarningModal';
import { QuickAddButton } from './QuickAddButton';
import { SlideCreatorModal } from './SlideCreatorModal';
import { StyleControls } from './StyleControls';
import { ExportDialog } from './ExportDialog';
import { ImportDialog } from './ImportDialog';
import { SaveSessionDialog } from './SaveSessionDialog';
import { LoadSessionDialog } from './LoadSessionDialog';
import { SaveToLiturgyDialog } from './SaveToLiturgyDialog';
import { usePresentationSync } from '@/hooks/presentation/usePresentationSync';
import { usePresentationState } from '@/hooks/presentation/usePresentationState';
import { useKeyboardShortcuts } from '@/hooks/presentation/useKeyboardShortcuts';
import { useAutoSave, getSavedPresentationState, clearSavedPresentationState, type SavedPresentationState } from '@/hooks/presentation/useAutoSave';
import { useNavigationWarning } from '@/hooks/presentation/useNavigationWarning';
import { loadLiturgyForPresentation } from '@/lib/presentation/presentationService';
import { CASA_BRAND } from '@/lib/brand-kit';
import type { SyncMessage, LowerThirdTemplate, LogoSettings, TempSlideEdit, TextOverlay, TextOverlayState, ImageOverlay, ImageOverlayState, VideoBackground, VideoBackgroundState, OverlayScope, LogoState, PublishPayload, SlideStyles, StyleScope, StyleState, VideoPlaybackState } from '@/lib/presentation/types';
import { shouldShowLogo, getAllOverlaysForSlide, getAllImageOverlaysForSlide, getActiveVideoBackground, DEFAULT_LOGO_STATE, DEFAULT_TEXT_OVERLAY_STATE, DEFAULT_IMAGE_OVERLAY_STATE, DEFAULT_VIDEO_BACKGROUND_STATE, getResolvedStyles, DEFAULT_STYLE_STATE } from '@/lib/presentation/types';
import { Palette, FileText, MessageSquare, Image as ImageIcon, Type, Video, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import type { ImportValidationResult } from '@/lib/presentation/types';
import { applyImport } from '@/lib/presentation/exportImport';
import { loadSession, updateSession, createSessionState, mergeTempSlides } from '@/lib/presentation/sessionService';
import { toast } from 'sonner';

/**
 * Helper to check if there are any active style overrides
 */
function hasActiveStyles(styleState: StyleState | undefined): boolean {
  if (!styleState) return false;

  if (styleState.globalStyles && Object.keys(styleState.globalStyles).length > 0) {
    return true;
  }

  if (Object.keys(styleState.elementStyles || {}).length > 0) {
    return true;
  }

  if (Object.keys(styleState.slideStyles || {}).length > 0) {
    return true;
  }

  return false;
}

export const PresenterView: React.FC = () => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveStartTime, setLiveStartTime] = useState<Date | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSlideIndex, setEditingSlideIndex] = useState<number | null>(null);
  const [recoveryState, setRecoveryState] = useState<SavedPresentationState | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [slideCreatorOpen, setSlideCreatorOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [saveSessionDialogOpen, setSaveSessionDialogOpen] = useState(false);
  const [loadSessionDialogOpen, setLoadSessionDialogOpen] = useState(false);
  const [saveToLiturgyDialogOpen, setSaveToLiturgyDialogOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  // null = individual control, 'collapsed' = all closed, 'expanded' = all open
  const [panelMode, setPanelMode] = useState<null | 'collapsed' | 'expanded'>(null);
  const [isUpdatingSession, setIsUpdatingSession] = useState(false);
  const [videoPlaybackState, setVideoPlaybackState] = useState<{ slideId: string; state: VideoPlaybackState } | null>(null);
  const outputWindowRef = useRef<Window | null>(null);
  const syncStateRef = useRef<((state: import('@/lib/presentation/types').PresentationState) => void) | null>(null);
  const recoveryCheckedRef = useRef(false);
  const stateRef = useRef<import('@/lib/presentation/types').PresentationState | null>(null);
  const createSlideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Presentation state (SISTEMA PREVIEW/PUBLISH)
  const {
    state,
    loadLiturgy,
    goToSlide,
    nextSlide,
    prevSlide,
    firstSlide,
    lastSlide,
    goToElement,
    publish,
    goLive,
    setBlack,
    showLowerThird,
    hideLowerThird,
    updateLogo,
    setLogoScope,
    setLogoState,
    editSlideContent,
    clearSlideEdit,
    duplicateSlide,
    deleteSlide,
    addImageSlides,
    insertSlide,
    insertSlides,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    setTextOverlayState,
    addImageOverlay,
    updateImageOverlay,
    removeImageOverlay,
    setImageOverlayState,
    addVideoBackground,
    updateVideoBackground,
    removeVideoBackground,
    setVideoBackgroundState,
    applyStyles,
    resetStyles,
    setStyleState,
    toggleFollowMode,
    currentSlide,
    currentElement,
    totalSlides,
  } = usePresentationState();

  // Auto-save presentation state to localStorage
  useAutoSave(state);

  // Keep stateRef updated for async operations
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (createSlideTimeoutRef.current) {
        clearTimeout(createSlideTimeoutRef.current);
      }
    };
  }, []);

  // Warn before leaving when liturgy is loaded
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
        syncStateRef.current?.(state);
        break;
      case 'VIDEO_PLAYBACK_STATE':
        setVideoPlaybackState({
          slideId: message.slideId,
          state: message.state,
        });
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

  // Auto-publish when Follow Mode is ON and we're live
  // This makes navigation automatically sync to output
  useEffect(() => {
    if (state.followMode && state.isLive && state.previewSlideIndex !== state.liveSlideIndex) {
      const payload = publish();
      send({ type: 'PUBLISH', payload });
    }
  }, [state.followMode, state.isLive, state.previewSlideIndex, state.liveSlideIndex, publish, send]);

  // Load a liturgy
  const handleSelectLiturgy = async (liturgyId: string) => {
    setLoading(true);
    try {
      const data = await loadLiturgyForPresentation(liturgyId);
      if (data) {
        loadLiturgy(data);
        send({ type: 'LITURGY_LOADED', data });
        setCurrentSessionId(null);
      }
    } catch {
      // Error already thrown from loadLiturgyForPresentation
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
      const data = await loadLiturgyForPresentation(recoveryState.liturgyId);
      if (data) {
        loadLiturgy(data);

        setTimeout(() => {
          goToSlide(recoveryState.previewSlideIndex ?? recoveryState.currentSlideIndex ?? 0);
          setLogoState(recoveryState.logoState);
          setTextOverlayState(recoveryState.textOverlayState);

          if (recoveryState.isLive) {
            goLive();
            setLiveStartTime(new Date());
            send({ type: 'GO_LIVE' });
          }
          if (recoveryState.isBlack) {
            setBlack(true);
            send({ type: 'GO_BLACK', black: true });
          }

          send({ type: 'LITURGY_LOADED', data });
          const payload: PublishPayload = {
            slideIndex: recoveryState.liveSlideIndex ?? recoveryState.previewSlideIndex ?? 0,
            overlays: recoveryState.liveTextOverlayState?.overlays ?? recoveryState.textOverlayState?.overlays ?? [],
            logoState: recoveryState.liveLogoState ?? recoveryState.logoState,
            tempEdits: {},
          };
          send({ type: 'PUBLISH', payload });
        }, 100);
      }
    } catch {
      // Error already thrown
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

  // Navigation (PREVIEW ONLY - does NOT sync to output)
  const handleGoToSlide = useCallback((index: number) => {
    goToSlide(index);
  }, [goToSlide]);

  const handleNext = useCallback(() => {
    if (state.data && state.previewSlideIndex < state.data.slides.length - 1) {
      nextSlide();
    }
  }, [state.data, state.previewSlideIndex, nextSlide]);

  const handlePrev = useCallback(() => {
    if (state.previewSlideIndex > 0) {
      prevSlide();
    }
  }, [state.previewSlideIndex, prevSlide]);

  const handleFirst = useCallback(() => {
    firstSlide();
  }, [firstSlide]);

  const handleLast = useCallback(() => {
    if (state.data) {
      lastSlide();
    }
  }, [state.data, lastSlide]);

  const handleGoToElement = useCallback((elementIndex: number) => {
    if (state.data?.elements[elementIndex]) {
      goToElement(elementIndex);
    }
  }, [state.data, goToElement]);

  // PUBLISH - Sync preview state to output
  const handlePublish = useCallback(() => {
    const payload = publish();
    send({ type: 'PUBLISH', payload });
  }, [publish, send]);

  // Go Live with sync (toggle)
  const handleGoLive = useCallback(() => {
    const newLiveState = !state.isLive;
    goLive();
    if (newLiveState) {
      setLiveStartTime(new Date());
      send({ type: 'GO_LIVE' });
      const payload = publish();
      send({ type: 'PUBLISH', payload });
    } else {
      setLiveStartTime(null);
      send({ type: 'GO_OFFLINE' });
    }
  }, [goLive, send, publish, state.isLive]);

  // Toggle Black with sync
  const handleToggleBlack = useCallback(() => {
    const newBlack = !state.isBlack;
    setBlack(newBlack);
    send({ type: 'GO_BLACK', black: newBlack });
  }, [state.isBlack, setBlack, send]);

  // Open output window
  const handleOpenOutput = useCallback(() => {
    if (outputWindowRef.current && !outputWindowRef.current.closed) {
      outputWindowRef.current.focus();
      return;
    }

    const outputUrl = `${window.location.origin}/output`;
    outputWindowRef.current = window.open(
      outputUrl,
      'casa-output',
      'width=1024,height=768'
    );

    setTimeout(() => {
      if (state.data) {
        send({ type: 'LITURGY_LOADED', data: state.data });
        const payload: PublishPayload = {
          slideIndex: state.liveSlideIndex,
          overlays: state.liveTextOverlayState?.overlays ?? [],
          logoState: state.liveLogoState ?? DEFAULT_LOGO_STATE,
          tempEdits: state.liveTempEdits ?? {},
        };
        send({ type: 'PUBLISH', payload });
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

  // ============ LOGO HANDLERS ============

  const handleUpdateLogo = useCallback((settings: Partial<LogoSettings>) => {
    updateLogo(settings);
    const currentSettings = state.logoState?.settings ?? DEFAULT_LOGO_STATE.settings;
    const newLogoState: LogoState = {
      settings: { ...currentSettings, ...settings },
      scope: state.logoState?.scope ?? { type: 'all' },
    };
    send({ type: 'LOGO_UPDATE', logoState: newLogoState });
  }, [updateLogo, send, state.logoState]);

  const handleSetLogoScope = useCallback((scope: OverlayScope) => {
    setLogoScope(scope);
    const newLogoState: LogoState = {
      settings: state.logoState?.settings ?? DEFAULT_LOGO_STATE.settings,
      scope,
    };
    send({ type: 'LOGO_UPDATE', logoState: newLogoState });
  }, [setLogoScope, send, state.logoState]);

  // ============ SLIDE EDITING ============

  const handleEditSlide = useCallback((index: number) => {
    setEditingSlideIndex(index);
    setEditorOpen(true);
  }, []);

  const handleSaveSlideEdit = useCallback((content: TempSlideEdit['content']) => {
    if (editingSlideIndex === null || !state.data) return;
    const slide = state.data.slides[editingSlideIndex];
    if (!slide) return;

    editSlideContent(slide.id, content);

    setTimeout(() => {
      const currentState = stateRef.current;
      if (currentState?.data) {
        send({ type: 'SLIDES_UPDATE', slides: currentState.data.slides, tempEdits: currentState.tempEdits });
      }
    }, 0);
  }, [editingSlideIndex, state.data, editSlideContent, send]);

  const handleClearSlideEdit = useCallback(() => {
    if (editingSlideIndex === null || !state.data) return;
    const slide = state.data.slides[editingSlideIndex];
    if (!slide) return;

    clearSlideEdit(slide.id);

    setTimeout(() => {
      const currentState = stateRef.current;
      if (currentState?.data) {
        send({ type: 'SLIDES_UPDATE', slides: currentState.data.slides, tempEdits: currentState.tempEdits });
      }
    }, 0);
  }, [editingSlideIndex, state.data, clearSlideEdit, send]);

  const handleDuplicateSlide = useCallback((index: number) => {
    duplicateSlide(index);

    setTimeout(() => {
      const currentState = stateRef.current;
      if (currentState?.data) {
        send({ type: 'SLIDES_UPDATE', slides: currentState.data.slides, tempEdits: currentState.tempEdits });
      }
    }, 50);
  }, [duplicateSlide, send]);

  const handleDeleteSlide = useCallback((index: number) => {
    deleteSlide(index);

    setTimeout(() => {
      const currentState = stateRef.current;
      if (currentState?.data) {
        send({ type: 'SLIDES_UPDATE', slides: currentState.data.slides, tempEdits: currentState.tempEdits });
      }
    }, 50);
  }, [deleteSlide, send]);

  // ============ IMAGE IMPORT HANDLER ============

  const handleImportImages = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    const imagePromises = fileArray.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    const insertAfterIndex = stateRef.current?.previewSlideIndex ?? 0;

    Promise.all(imagePromises).then((imageUrls) => {
      addImageSlides(imageUrls, insertAfterIndex);

      setTimeout(() => {
        const currentState = stateRef.current;
        if (currentState?.data) {
          send({ type: 'SLIDES_UPDATE', slides: currentState.data.slides, tempEdits: currentState.tempEdits });
        }
      }, 100);
    });
  }, [addImageSlides, send]);

  // ============ QUICK ADD SLIDE HANDLER ============

  const handleCreateSlide = useCallback((slide: import('@/types/shared/slide').Slide, insertPosition: 'after' | 'end') => {
    const insertAfterIndex = insertPosition === 'after'
      ? (stateRef.current?.previewSlideIndex ?? 0)
      : ((stateRef.current?.data?.slides.length ?? 1) - 1);

    // Determine element info based on slide type for Orden del Servicio
    const getElementInfo = (slide: import('@/types/shared/slide').Slide): { type: string; title: string } => {
      const slideType = slide.type;
      const title = slide.content.secondary || slide.content.primary?.slice(0, 30) || 'Diapositiva';

      switch (slideType) {
        case 'bible-verse':
          return { type: 'lectura', title: slide.content.reference || 'Versículo' };
        case 'announcement':
          return { type: 'anuncio', title: title + (title.length >= 30 ? '...' : '') };
        case 'announcement-image':
          return { type: 'anuncio', title: 'Imagen' };
        case 'video':
          return { type: 'anuncio', title: 'Video' };
        case 'blank':
          return { type: 'anuncio', title: 'Diapositiva en Blanco' };
        default:
          return { type: 'anuncio', title: title + (title.length >= 30 ? '...' : '') };
      }
    };

    // Use insertSlides with elementInfo to create entry in Orden del Servicio
    const elementInfo = getElementInfo(slide);
    insertSlides([slide], insertAfterIndex, elementInfo);

    if (createSlideTimeoutRef.current) {
      clearTimeout(createSlideTimeoutRef.current);
    }

    createSlideTimeoutRef.current = setTimeout(() => {
      const currentState = stateRef.current;
      if (currentState?.data) {
        send({ type: 'SLIDES_UPDATE', slides: currentState.data.slides, tempEdits: currentState.tempEdits });
      }
    }, 100);
  }, [insertSlides, send]);

  // Handler for creating multiple slides at once (scenes)
  const handleCreateSlides = useCallback((
    slides: import('@/types/shared/slide').Slide[],
    insertPosition: 'after' | 'end',
    elementInfo?: { type: string; title: string }
  ) => {
    const insertAfterIndex = insertPosition === 'after'
      ? (stateRef.current?.previewSlideIndex ?? 0)
      : ((stateRef.current?.data?.slides.length ?? 1) - 1);

    insertSlides(slides, insertAfterIndex, elementInfo);

    if (createSlideTimeoutRef.current) {
      clearTimeout(createSlideTimeoutRef.current);
    }

    createSlideTimeoutRef.current = setTimeout(() => {
      const currentState = stateRef.current;
      if (currentState?.data) {
        send({ type: 'SLIDES_UPDATE', slides: currentState.data.slides, tempEdits: currentState.tempEdits });
      }
    }, 100);
  }, [insertSlides, send]);

  // ============ EXPORT/IMPORT HANDLERS ============

  const handleImportPresentation = useCallback((validationResult: ImportValidationResult) => {
    if (!state.data) return;

    const result = applyImport(
      validationResult.importData,
      state.data.slides,
      state.tempEdits
    );

    const updatedData = {
      ...state.data,
      slides: result.slides,
    };

    loadLiturgy(updatedData);

    setTimeout(() => {
      setLogoState(result.logoState);
      setTextOverlayState(result.textOverlayState);
      setImageOverlayState(result.imageOverlayState);
      setStyleState(result.styleState);

      setTimeout(() => {
        const currentState = stateRef.current;
        if (currentState?.data) {
          send({ type: 'SLIDES_UPDATE', slides: currentState.data.slides, tempEdits: currentState.tempEdits });
          send({ type: 'LOGO_UPDATE', logoState: result.logoState });
          send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: result.textOverlayState });
          send({ type: 'IMAGE_OVERLAYS_UPDATE', imageOverlayState: result.imageOverlayState });
          send({ type: 'STYLES_UPDATE', styleState: result.styleState });
        }
      }, 100);
    }, 100);
  }, [state.data, state.tempEdits, loadLiturgy, setLogoState, setTextOverlayState, setImageOverlayState, setStyleState, send]);

  // ============ SESSION HANDLERS ============

  const handleSessionSaved = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    toast.success('Sesión guardada correctamente');
  }, []);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const session = await loadSession(sessionId);
      if (!session) {
        toast.error('No se encontró la sesión');
        return;
      }

      if (!state.data || state.data.liturgyId !== session.liturgyId) {
        const liturgyData = await loadLiturgyForPresentation(session.liturgyId);
        if (!liturgyData) {
          toast.error('No se pudo cargar la liturgia');
          return;
        }
        loadLiturgy(liturgyData);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const sessionState = session.state;

      setTimeout(() => {
        const currentState = stateRef.current;
        if (currentState?.data) {
          const mergedSlides = mergeTempSlides(currentState.data.slides, sessionState.tempSlides);
          const updatedData = {
            ...currentState.data,
            slides: mergedSlides,
          };
          loadLiturgy(updatedData);

          setTimeout(() => {
            setLogoState(sessionState.logoState);
            setTextOverlayState(sessionState.textOverlayState);
            if (sessionState.imageOverlayState) {
              setImageOverlayState(sessionState.imageOverlayState);
            }
            setStyleState(sessionState.styleState);
            goToSlide(sessionState.previewSlideIndex);

            const latestState = stateRef.current;
            if (latestState?.data) {
              send({ type: 'LITURGY_LOADED', data: latestState.data });
              send({ type: 'LOGO_UPDATE', logoState: sessionState.logoState });
              send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: sessionState.textOverlayState });
              if (sessionState.imageOverlayState) {
                send({ type: 'IMAGE_OVERLAYS_UPDATE', imageOverlayState: sessionState.imageOverlayState });
              }
              send({ type: 'STYLES_UPDATE', styleState: sessionState.styleState });
            }
          }, 100);
        }
      }, 100);

      setCurrentSessionId(sessionId);
      toast.success(`Sesión "${session.name}" cargada`);
    } catch {
      toast.error('Error al cargar la sesión');
    } finally {
      setLoading(false);
    }
  }, [state.data, loadLiturgy, setLogoState, setTextOverlayState, setStyleState, goToSlide, send]);

  const handleUpdateCurrentSession = useCallback(async () => {
    if (!currentSessionId || !state.data) {
      toast.error('No hay sesión activa para actualizar');
      return;
    }

    setIsUpdatingSession(true);
    try {
      const sessionState = createSessionState(
        state.data.slides,
        state.styleState,
        state.logoState,
        state.textOverlayState,
        state.imageOverlayState,
        state.tempEdits,
        state.previewSlideIndex,
        state.liveSlideIndex
      );

      await updateSession(currentSessionId, sessionState);
      toast.success('Sesión actualizada');
    } catch {
      toast.error('Error al actualizar la sesión');
    } finally {
      setIsUpdatingSession(false);
    }
  }, [currentSessionId, state]);

  // ============ TEXT OVERLAY HANDLERS ============

  const handleAddTextOverlay = useCallback((overlay: TextOverlay) => {
    addTextOverlay(overlay);
    const currentOverlays = state.textOverlayState?.overlays ?? [];
    const newState: TextOverlayState = {
      overlays: [...currentOverlays, overlay],
    };
    send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: newState });
  }, [addTextOverlay, state.textOverlayState, send]);

  const handleUpdateTextOverlay = useCallback((id: string, updates: Partial<TextOverlay>) => {
    updateTextOverlay(id, updates);
    const currentOverlays = state.textOverlayState?.overlays ?? [];
    const newState: TextOverlayState = {
      overlays: currentOverlays.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    };
    send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: newState });
  }, [updateTextOverlay, state.textOverlayState, send]);

  const handleRemoveTextOverlay = useCallback((id: string) => {
    removeTextOverlay(id);
    const currentOverlays = state.textOverlayState?.overlays ?? [];
    const newState: TextOverlayState = {
      overlays: currentOverlays.filter((o) => o.id !== id),
    };
    send({ type: 'TEXT_OVERLAYS_UPDATE', textOverlayState: newState });
  }, [removeTextOverlay, state.textOverlayState, send]);

  // ============ IMAGE OVERLAY HANDLERS ============

  const handleAddImageOverlay = useCallback((overlay: ImageOverlay) => {
    addImageOverlay(overlay);
    const currentOverlays = state.imageOverlayState?.overlays ?? [];
    const newState: ImageOverlayState = {
      overlays: [...currentOverlays, overlay],
    };
    send({ type: 'IMAGE_OVERLAYS_UPDATE', imageOverlayState: newState });
  }, [addImageOverlay, state.imageOverlayState, send]);

  const handleUpdateImageOverlay = useCallback((id: string, updates: Partial<ImageOverlay>) => {
    updateImageOverlay(id, updates);
    const currentOverlays = state.imageOverlayState?.overlays ?? [];
    const newState: ImageOverlayState = {
      overlays: currentOverlays.map((o) =>
        o.id === id ? { ...o, ...updates } : o
      ),
    };
    send({ type: 'IMAGE_OVERLAYS_UPDATE', imageOverlayState: newState });
  }, [updateImageOverlay, state.imageOverlayState, send]);

  const handleRemoveImageOverlay = useCallback((id: string) => {
    removeImageOverlay(id);
    const currentOverlays = state.imageOverlayState?.overlays ?? [];
    const newState: ImageOverlayState = {
      overlays: currentOverlays.filter((o) => o.id !== id),
    };
    send({ type: 'IMAGE_OVERLAYS_UPDATE', imageOverlayState: newState });
  }, [removeImageOverlay, state.imageOverlayState, send]);

  // ============ VIDEO BACKGROUND HANDLERS ============
  // Note: These handlers only update local state. Changes are sent to projector
  // only when the user publishes (via handlePublish).

  const handleAddVideoBackground = useCallback((background: VideoBackground) => {
    addVideoBackground(background);
  }, [addVideoBackground]);

  const handleUpdateVideoBackground = useCallback((id: string, updates: Partial<VideoBackground>) => {
    updateVideoBackground(id, updates);
  }, [updateVideoBackground]);

  const handleRemoveVideoBackground = useCallback((id: string) => {
    removeVideoBackground(id);
  }, [removeVideoBackground]);

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
    onPublish: handlePublish,
    onFullscreen: () => send({ type: 'FULLSCREEN_TOGGLE' }),
  });

  // Logo visibility for current slide
  const showLogoOnCurrentSlide = shouldShowLogo(
    state.logoState ?? DEFAULT_LOGO_STATE,
    state.previewSlideIndex,
    state.data?.elements || []
  );

  // Text overlays for current slide
  const allOverlaysForSlide = getAllOverlaysForSlide(
    state.textOverlayState ?? DEFAULT_TEXT_OVERLAY_STATE,
    state.previewSlideIndex,
    state.data?.elements || []
  );

  // Image overlays for current slide
  const allImageOverlaysForSlide = getAllImageOverlaysForSlide(
    state.imageOverlayState ?? DEFAULT_IMAGE_OVERLAY_STATE,
    state.previewSlideIndex,
    state.data?.elements || []
  );

  // Active video background for current slide
  const activeVideoBackground = getActiveVideoBackground(
    state.videoBackgroundState ?? DEFAULT_VIDEO_BACKGROUND_STATE,
    state.previewSlideIndex,
    state.data?.elements || []
  );

  // Resolved styles for preview slide
  const previewResolvedStyles = currentSlide
    ? getResolvedStyles(
        state.styleState ?? DEFAULT_STYLE_STATE,
        currentSlide.id,
        currentElement?.id ?? null
      )
    : null;

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        backgroundColor: CASA_BRAND.colors.primary.black,
      }}
    >
      {/* Unified Header with 4 zones */}
      <PresenterControls
        isLive={state.isLive}
        isBlack={state.isBlack}
        hasData={!!state.data}
        liveStartTime={liveStartTime}
        liturgyTitle={state.data?.liturgyTitle}
        liturgyDate={state.data?.liturgyDate}
        currentSessionId={currentSessionId}
        isUpdatingSession={isUpdatingSession}
        loading={loading}
        onGoLive={handleGoLive}
        onToggleBlack={handleToggleBlack}
        onOpenOutput={handleOpenOutput}
        onSelectLiturgy={() => setSelectorOpen(true)}
        onExport={() => setExportDialogOpen(true)}
        onImport={() => setImportDialogOpen(true)}
        onImportImages={handleImportImages}
        onSaveSession={() => setSaveSessionDialogOpen(true)}
        onLoadSession={() => setLoadSessionDialogOpen(true)}
        onUpdateSession={handleUpdateCurrentSession}
        onSaveToLiturgy={() => setSaveToLiturgyDialogOpen(true)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Service Navigator */}
        <div className="w-64 flex-shrink-0">
          <ServiceNavigator
            elements={state.data?.elements || []}
            currentElementIndex={state.previewElementIndex}
            onElementClick={handleGoToElement}
          />
        </div>

        {/* Center - Main preview area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Navigation Strip - above slide preview */}
          <NavigationStrip
            hasData={!!state.data}
            currentIndex={state.previewSlideIndex}
            liveIndex={state.liveSlideIndex}
            totalSlides={totalSlides}
            isLive={state.isLive}
            hasUnpublishedChanges={state.hasUnpublishedChanges}
            followMode={state.followMode}
            onNext={handleNext}
            onPrev={handlePrev}
            onFirst={handleFirst}
            onLast={handleLast}
            onPublish={handlePublish}
            onToggleFollowMode={toggleFollowMode}
          />

          {/* Slide preview - constrained and centered */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
            <SlidePreview
              slide={currentSlide}
              currentIndex={state.previewSlideIndex}
              totalSlides={totalSlides}
              isLive={state.isLive}
              isBlack={state.isBlack}
              logoSettings={showLogoOnCurrentSlide
                ? (state.logoState?.settings ?? DEFAULT_LOGO_STATE.settings)
                : { ...(state.logoState?.settings ?? DEFAULT_LOGO_STATE.settings), visible: false }}
              textOverlays={allOverlaysForSlide}
              imageOverlays={allImageOverlaysForSlide}
              videoBackground={activeVideoBackground}
              onTextOverlayPositionChange={(id, position) => updateTextOverlay(id, { position })}
              onImageOverlayPositionChange={(id, position) => handleUpdateImageOverlay(id, { position })}
              styles={previewResolvedStyles}
              videoPlaybackState={
                videoPlaybackState && currentSlide?.id === videoPlaybackState.slideId
                  ? videoPlaybackState.state
                  : undefined
              }
            />
          </div>

          {/* Slide strip - fixed at bottom */}
          <div className="h-32 flex-shrink-0">
            <SlideStrip
              slides={state.data?.slides || []}
              currentIndex={state.previewSlideIndex}
              liveIndex={state.liveSlideIndex}
              isLive={state.isLive}
              onSlideClick={handleGoToSlide}
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
          {/* Panel header with collapse all button */}
          <div
            className="flex items-center justify-end px-3 py-2 flex-shrink-0"
            style={{
              borderBottom: `1px solid ${CASA_BRAND.colors.secondary.grayDark}`,
            }}
          >
            <button
              onClick={() => setPanelMode(panelMode === 'collapsed' ? 'expanded' : 'collapsed')}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-800/50 transition-colors"
              style={{
                color: CASA_BRAND.colors.secondary.grayMedium,
                fontFamily: CASA_BRAND.fonts.body,
                fontSize: '11px',
              }}
              title={panelMode === 'collapsed' ? 'Expandir todos' : 'Colapsar todos'}
            >
              {panelMode === 'collapsed' ? (
                <>
                  <ChevronsUpDown size={14} />
                  Expandir
                </>
              ) : (
                <>
                  <ChevronsDownUp size={14} />
                  Colapsar
                </>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Presenter Notes - expanded by default */}
            <CollapsiblePanel
              title="Notas del Presentador"
              icon={<FileText size={16} />}
              defaultOpen={true}
              isOpen={panelMode === 'collapsed' ? false : panelMode === 'expanded' ? true : undefined}
              onToggle={panelMode !== null ? () => setPanelMode(null) : undefined}
            >
              <PresenterNotes currentElement={currentElement} currentSlide={currentSlide} compact />
            </CollapsiblePanel>

            {/* Lower-Third - expanded by default */}
            <CollapsiblePanel
              title="Lower-Third"
              icon={<MessageSquare size={16} />}
              defaultOpen={true}
              isOpen={panelMode === 'collapsed' ? false : panelMode === 'expanded' ? true : undefined}
              onToggle={panelMode !== null ? () => setPanelMode(null) : undefined}
              badge={
                state.lowerThird.visible ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs animate-pulse"
                    style={{
                      backgroundColor: `${CASA_BRAND.colors.primary.amber}30`,
                      color: CASA_BRAND.colors.primary.amber,
                    }}
                  >
                    EN VIVO
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
              isOpen={panelMode === 'collapsed' ? false : panelMode === 'expanded' ? true : undefined}
              onToggle={panelMode !== null ? () => setPanelMode(null) : undefined}
              badge={
                <span
                  className="px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: showLogoOnCurrentSlide
                      ? `${CASA_BRAND.colors.primary.amber}30`
                      : `${CASA_BRAND.colors.secondary.grayMedium}30`,
                    color: showLogoOnCurrentSlide
                      ? CASA_BRAND.colors.primary.amber
                      : CASA_BRAND.colors.secondary.grayMedium,
                  }}
                >
                  {showLogoOnCurrentSlide ? 'ON' : 'OFF'}
                </span>
              }
            >
              <LogoControls
                logoState={state.logoState ?? DEFAULT_LOGO_STATE}
                currentSlideIndex={state.previewSlideIndex}
                currentSlide={currentSlide}
                currentElement={currentElement}
                elements={state.data?.elements || []}
                onUpdateLogo={handleUpdateLogo}
                onSetScope={handleSetLogoScope}
                compact
              />
            </CollapsiblePanel>

            {/* Text Overlay Controls - collapsed by default */}
            <CollapsiblePanel
              title="Textos"
              icon={<Type size={16} />}
              defaultOpen={false}
              isOpen={panelMode === 'collapsed' ? false : panelMode === 'expanded' ? true : undefined}
              onToggle={panelMode !== null ? () => setPanelMode(null) : undefined}
              badge={
                (state.textOverlayState?.overlays?.length ?? 0) > 0 ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {state.textOverlayState?.overlays?.length ?? 0}
                  </span>
                ) : null
              }
            >
              <TextOverlayControls
                textOverlayState={state.textOverlayState ?? { overlays: [] }}
                currentSlideIndex={state.previewSlideIndex}
                currentElement={currentElement}
                elements={state.data?.elements || []}
                onAdd={handleAddTextOverlay}
                onUpdate={handleUpdateTextOverlay}
                onRemove={handleRemoveTextOverlay}
                compact
              />
            </CollapsiblePanel>

            {/* Image Overlay Controls - collapsed by default */}
            <CollapsiblePanel
              title="Imágenes"
              icon={<ImageIcon size={16} />}
              defaultOpen={false}
              isOpen={panelMode === 'collapsed' ? false : panelMode === 'expanded' ? true : undefined}
              onToggle={panelMode !== null ? () => setPanelMode(null) : undefined}
              badge={
                (state.imageOverlayState?.overlays?.length ?? 0) > 0 ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: CASA_BRAND.colors.secondary.grayDark,
                      color: CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {state.imageOverlayState?.overlays?.length ?? 0}
                  </span>
                ) : null
              }
            >
              <ImageOverlayControls
                imageOverlayState={state.imageOverlayState ?? { overlays: [] }}
                currentSlideIndex={state.previewSlideIndex}
                currentElement={currentElement}
                elements={state.data?.elements || []}
                onAdd={handleAddImageOverlay}
                onUpdate={handleUpdateImageOverlay}
                onRemove={handleRemoveImageOverlay}
                compact
                slideBackgroundColor={currentSlide?.style?.backgroundColor}
              />
            </CollapsiblePanel>

            {/* Video Background Controls - collapsed by default */}
            <CollapsiblePanel
              title="Video de Fondo"
              icon={<Video size={16} />}
              defaultOpen={false}
              isOpen={panelMode === 'collapsed' ? false : panelMode === 'expanded' ? true : undefined}
              onToggle={panelMode !== null ? () => setPanelMode(null) : undefined}
              badge={
                (state.videoBackgroundState?.backgrounds?.length ?? 0) > 0 ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: activeVideoBackground
                        ? CASA_BRAND.colors.primary.amber + '30'
                        : CASA_BRAND.colors.secondary.grayDark,
                      color: activeVideoBackground
                        ? CASA_BRAND.colors.primary.amber
                        : CASA_BRAND.colors.secondary.grayMedium,
                    }}
                  >
                    {activeVideoBackground ? 'activo' : '1'}
                  </span>
                ) : null
              }
            >
              <VideoBackgroundControls
                videoBackgroundState={state.videoBackgroundState ?? { backgrounds: [] }}
                currentSlideIndex={state.previewSlideIndex}
                currentElement={currentElement}
                elements={state.data?.elements || []}
                onAdd={handleAddVideoBackground}
                onUpdate={handleUpdateVideoBackground}
                onRemove={handleRemoveVideoBackground}
                compact
              />
            </CollapsiblePanel>

            {/* Style Controls - collapsed by default */}
            <CollapsiblePanel
              title="Estilos"
              icon={<Palette size={16} />}
              defaultOpen={false}
              isOpen={panelMode === 'collapsed' ? false : panelMode === 'expanded' ? true : undefined}
              onToggle={panelMode !== null ? () => setPanelMode(null) : undefined}
              badge={
                hasActiveStyles(state.styleState) ? (
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{
                      backgroundColor: CASA_BRAND.colors.primary.amber + '30',
                      color: CASA_BRAND.colors.primary.amber,
                    }}
                  >
                    Activo
                  </span>
                ) : null
              }
            >
              <StyleControls
                styleState={state.styleState}
                currentSlide={currentSlide}
                currentSlideIndex={state.previewSlideIndex}
                currentElement={currentElement}
                onApplyStyles={(styles: SlideStyles, scope: StyleScope) => {
                  // Only update local preview state - projector syncs on publish
                  applyStyles(
                    styles,
                    scope,
                    currentSlide?.id,
                    currentElement?.id
                  );
                }}
                onResetStyles={(scope: StyleScope) => {
                  // Only update local preview state - projector syncs on publish
                  resetStyles(scope, currentSlide?.id, currentElement?.id);
                }}
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

      {/* Exit warning modal */}
      <ExitWarningModal
        open={navigationWarning.isBlocked}
        onConfirm={navigationWarning.proceed}
        onCancel={navigationWarning.cancel}
      />

      {/* Quick add button - FAB repositioned to bottom-right */}
      {state.data && (
        <QuickAddButton
          onClick={() => setSlideCreatorOpen(true)}
          disabled={loading}
        />
      )}

      {/* Slide creator modal */}
      <SlideCreatorModal
        open={slideCreatorOpen}
        onClose={() => setSlideCreatorOpen(false)}
        onCreateSlide={handleCreateSlide}
        onCreateSlides={handleCreateSlides}
        currentSlideIndex={state.previewSlideIndex}
        totalSlides={totalSlides}
        theme={state.data?.theme || 'light'}
      />

      {/* Export dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        data={state.data}
        tempEdits={state.tempEdits}
        styleState={state.styleState}
        logoState={state.logoState}
        textOverlayState={state.textOverlayState}
        imageOverlayState={state.imageOverlayState}
      />

      {/* Import dialog */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        currentLiturgyId={state.data?.liturgyId}
        onImport={handleImportPresentation}
      />

      {/* Save session dialog */}
      <SaveSessionDialog
        open={saveSessionDialogOpen}
        onOpenChange={setSaveSessionDialogOpen}
        data={state.data}
        slides={state.data?.slides || []}
        tempEdits={state.tempEdits}
        styleState={state.styleState}
        logoState={state.logoState}
        textOverlayState={state.textOverlayState}
        imageOverlayState={state.imageOverlayState}
        previewSlideIndex={state.previewSlideIndex}
        liveSlideIndex={state.liveSlideIndex}
        onSaved={handleSessionSaved}
      />

      {/* Load session dialog */}
      <LoadSessionDialog
        open={loadSessionDialogOpen}
        onOpenChange={setLoadSessionDialogOpen}
        currentLiturgyId={state.data?.liturgyId}
        onLoadSession={handleLoadSession}
      />

      {/* Save to liturgy dialog */}
      <SaveToLiturgyDialog
        open={saveToLiturgyDialogOpen}
        onOpenChange={setSaveToLiturgyDialogOpen}
        data={state.data}
        slides={state.data?.slides || []}
        tempEdits={state.tempEdits}
        styleState={state.styleState}
        logoState={state.logoState}
        textOverlayState={state.textOverlayState}
        onSaved={() => {
          toast.success('Cambios guardados en la liturgia');
        }}
      />
    </div>
  );
};

export default PresenterView;
