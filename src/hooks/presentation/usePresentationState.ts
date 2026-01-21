/**
 * Hook para manejar el estado de la presentacion
 * Centraliza la logica de navegacion y control
 *
 * SISTEMA SIMPLIFICADO (v2):
 * - Logo: updateLogo(), setLogoScope()
 * - TextOverlay: addTextOverlay(), updateTextOverlay(), removeTextOverlay()
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  PresentationState,
  PresentationData,
  FlattenedElement,
  LowerThirdTemplate,
  LogoState,
  LogoSettings,
  TempSlideEdit,
  TextOverlay,
  TextOverlayState,
  TextOverlayStyle,
  ImageOverlay,
  ImageOverlayState,
  VideoBackground,
  VideoBackgroundState,
  OverlayScope,
  PublishPayload,
  StyleState,
  SlideStyles,
  StyleScope,
} from '@/lib/presentation/types';
import type { LiturgyElementType } from '@/types/shared/liturgy';
import { INITIAL_PRESENTATION_STATE, DEFAULT_LOGO_STATE, DEFAULT_TEXT_OVERLAY_STATE, DEFAULT_TEXT_OVERLAY_STYLE, DEFAULT_IMAGE_OVERLAY_STATE, DEFAULT_VIDEO_BACKGROUND_STATE, DEFAULT_STYLE_STATE } from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';
import { findElementForSlide } from '@/lib/presentation/presentationService';

interface UsePresentationStateReturn {
  state: PresentationState;

  // Carga de datos
  loadLiturgy: (data: PresentationData) => void;

  // Navegacion (PREVIEW ONLY - does NOT affect output)
  goToSlide: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  firstSlide: () => void;
  lastSlide: () => void;
  goToElement: (elementIndex: number) => void;

  // PUBLISH - Sync preview state to live/output
  publish: () => PublishPayload;

  // Control de presentacion
  goLive: () => void;
  toggleBlack: () => void;
  setBlack: (black: boolean) => void;
  togglePreviewOverlays: () => void;
  setPreviewOverlays: (enabled: boolean) => void;
  toggleFollowMode: () => void;

  // Lower-thirds
  showLowerThird: (message: string, duration?: number, template?: LowerThirdTemplate) => void;
  hideLowerThird: () => void;

  // Logo (SIMPLIFICADO)
  updateLogo: (settings: Partial<LogoSettings>) => void;
  setLogoScope: (scope: OverlayScope) => void;
  setLogoState: (logoState: LogoState) => void;

  // Edición temporal de slides
  editSlideContent: (slideId: string, content: TempSlideEdit['content']) => void;
  clearSlideEdit: (slideId: string) => void;
  duplicateSlide: (index: number) => void;
  deleteSlide: (index: number) => void;
  setTempEdits: (tempEdits: Record<string, TempSlideEdit>) => void;
  updateSlides: (slides: Slide[]) => void;
  addImageSlides: (imageUrls: string[], insertAfterIndex?: number) => void;
  insertSlide: (slide: Slide, insertAfterIndex: number) => void;
  insertSlides: (slides: Slide[], insertAfterIndex: number, elementInfo?: { type: string; title: string }) => void;

  // Text overlays (SIMPLIFICADO)
  addTextOverlay: (overlay: TextOverlay) => void;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  removeTextOverlay: (id: string) => void;
  setTextOverlayState: (state: TextOverlayState) => void;

  // Image overlays
  addImageOverlay: (overlay: ImageOverlay) => void;
  updateImageOverlay: (id: string, updates: Partial<ImageOverlay>) => void;
  removeImageOverlay: (id: string) => void;
  setImageOverlayState: (state: ImageOverlayState) => void;

  // Video backgrounds
  addVideoBackground: (background: VideoBackground) => void;
  updateVideoBackground: (id: string, updates: Partial<VideoBackground>) => void;
  removeVideoBackground: (id: string) => void;
  setVideoBackgroundState: (state: VideoBackgroundState) => void;

  // Live style controls
  applyStyles: (styles: SlideStyles, scope: StyleScope, slideId?: string, elementId?: string) => void;
  resetStyles: (scope: StyleScope, slideId?: string, elementId?: string) => void;
  setStyleState: (styleState: StyleState) => void;

  // Utilidades (PREVIEW state - what operator is viewing)
  currentSlide: PresentationData['slides'][0] | null;
  currentElement: PresentationData['elements'][0] | null;
  // Live state utilities
  liveSlide: PresentationData['slides'][0] | null;
  liveElement: PresentationData['elements'][0] | null;
  totalSlides: number;
}

const LOGO_STATE_KEY = 'casa-presentation-logo-state';
const TEXT_OVERLAYS_KEY = 'casa-presentation-text-overlays';
const IMAGE_OVERLAYS_KEY = 'casa-presentation-image-overlays';
const VIDEO_BACKGROUND_KEY = 'casa-presentation-video-background';
const STYLE_STATE_KEY = 'casa-presentation-style-state';

/**
 * Cargar estado de logo desde localStorage
 * Migra formato antiguo (global/overrides/scopes) al nuevo (settings/scope)
 */
function loadLogoStateFromStorage(): LogoState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(LOGO_STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      // Check if this is the OLD format (has 'global' instead of 'settings')
      if (parsed.global && !parsed.settings) {
        // Migrate to new format
        return {
          settings: parsed.global,
          scope: { type: 'all' },
        };
      }

      // Validate new format has required fields
      if (!parsed.settings || !parsed.scope) {
        return null;
      }

      return parsed;
    }
  } catch {
    // Silent fail - return null to use default
  }
  return null;
}

/**
 * Guardar estado de logo en localStorage
 */
function saveLogoStateToStorage(state: LogoState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOGO_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Error saving logo state to localStorage:', e);
  }
}

/**
 * Cargar text overlays desde localStorage
 */
function loadTextOverlaysFromStorage(): TextOverlay[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(TEXT_OVERLAYS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error loading text overlays from localStorage:', e);
  }
  return null;
}

/**
 * Guardar text overlays en localStorage
 */
function saveTextOverlaysToStorage(overlays: TextOverlay[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TEXT_OVERLAYS_KEY, JSON.stringify(overlays));
  } catch (e) {
    console.warn('Error saving text overlays to localStorage:', e);
  }
}

/**
 * Cargar image overlays desde localStorage
 */
function loadImageOverlaysFromStorage(): ImageOverlay[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(IMAGE_OVERLAYS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error loading image overlays from localStorage:', e);
  }
  return null;
}

/**
 * Guardar image overlays en localStorage
 */
function saveImageOverlaysToStorage(overlays: ImageOverlay[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(IMAGE_OVERLAYS_KEY, JSON.stringify(overlays));
  } catch (e) {
    console.warn('Error saving image overlays to localStorage:', e);
  }
}

/**
 * Cargar video backgrounds desde localStorage
 */
function loadVideoBackgroundsFromStorage(): VideoBackground[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(VIDEO_BACKGROUND_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error loading video backgrounds from localStorage:', e);
  }
  return null;
}

/**
 * Guardar video backgrounds en localStorage
 */
function saveVideoBackgroundsToStorage(backgrounds: VideoBackground[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VIDEO_BACKGROUND_KEY, JSON.stringify(backgrounds));
  } catch (e) {
    console.warn('Error saving video backgrounds to localStorage:', e);
  }
}

/**
 * Validate that an object has the expected StyleState structure
 */
function isValidStyleState(obj: unknown): obj is StyleState {
  if (!obj || typeof obj !== 'object') return false;
  const state = obj as Record<string, unknown>;

  // Check required properties exist (they can be null/empty)
  if (!('globalStyles' in state)) return false;
  if (!('elementStyles' in state) || typeof state.elementStyles !== 'object') return false;
  if (!('slideStyles' in state) || typeof state.slideStyles !== 'object') return false;

  return true;
}

/**
 * Cargar style state desde localStorage with validation
 */
function loadStyleStateFromStorage(): StyleState | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(STYLE_STATE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      // Validate structure before returning
      if (isValidStyleState(parsed)) {
        return parsed;
      } else {
        console.warn('Invalid style state structure in localStorage, ignoring');
        localStorage.removeItem(STYLE_STATE_KEY);
        return null;
      }
    }
  } catch (e) {
    console.warn('Error loading style state from localStorage:', e);
  }
  return null;
}

/**
 * Guardar style state en localStorage
 */
function saveStyleStateToStorage(styleState: StyleState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STYLE_STATE_KEY, JSON.stringify(styleState));
  } catch (e) {
    console.warn('Error saving style state to localStorage:', e);
  }
}

/**
 * Helper: Calculate if there are unpublished CONTENT changes
 * NOTE: This does NOT check slide index - navigation auto-syncs when live
 * Only content changes (edits, overlays, styles, logo) trigger Publicar
 */
function calculateHasUnpublishedChanges(
  logoState: LogoState,
  liveLogoState: LogoState,
  textOverlayState: TextOverlayState,
  liveTextOverlayState: TextOverlayState,
  imageOverlayState: ImageOverlayState,
  liveImageOverlayState: ImageOverlayState,
  tempEdits: Record<string, TempSlideEdit>,
  liveTempEdits: Record<string, TempSlideEdit>,
  styleState?: StyleState,
  liveStyleState?: StyleState
): boolean {
  // Check logo state difference
  if (JSON.stringify(logoState) !== JSON.stringify(liveLogoState)) return true;

  // Check text overlay difference
  if (JSON.stringify(textOverlayState) !== JSON.stringify(liveTextOverlayState)) return true;

  // Check image overlay difference
  if (JSON.stringify(imageOverlayState) !== JSON.stringify(liveImageOverlayState)) return true;

  // Check temp edits difference
  if (JSON.stringify(tempEdits) !== JSON.stringify(liveTempEdits)) return true;

  // Check style state difference
  if (styleState && liveStyleState && JSON.stringify(styleState) !== JSON.stringify(liveStyleState)) return true;

  return false;
}

/**
 * Hook para manejar el estado de la presentacion
 * SISTEMA PREVIEW/PUBLISH:
 * - Navigation updates preview state only
 * - publish() syncs preview → live
 */
export function usePresentationState(): UsePresentationStateReturn {
  const [state, setState] = useState<PresentationState>(() => {
    // Intentar cargar configuraciones guardadas
    const savedLogoState = loadLogoStateFromStorage();
    const savedTextOverlays = loadTextOverlaysFromStorage();
    const savedImageOverlays = loadImageOverlaysFromStorage();
    const savedVideoBackgrounds = loadVideoBackgroundsFromStorage();
    const savedStyleState = loadStyleStateFromStorage();

    // Start with a deep copy to avoid mutation issues
    let initialState: PresentationState = {
      ...INITIAL_PRESENTATION_STATE,
      logoState: { ...DEFAULT_LOGO_STATE },
      textOverlayState: { ...DEFAULT_TEXT_OVERLAY_STATE },
      imageOverlayState: { ...DEFAULT_IMAGE_OVERLAY_STATE },
      videoBackgroundState: { ...DEFAULT_VIDEO_BACKGROUND_STATE },
      styleState: { ...DEFAULT_STYLE_STATE },
      liveLogoState: { ...DEFAULT_LOGO_STATE },
      liveTextOverlayState: { ...DEFAULT_TEXT_OVERLAY_STATE },
      liveImageOverlayState: { ...DEFAULT_IMAGE_OVERLAY_STATE },
      liveVideoBackgroundState: { ...DEFAULT_VIDEO_BACKGROUND_STATE },
      liveStyleState: { ...DEFAULT_STYLE_STATE },
    };

    if (savedLogoState?.settings && savedLogoState?.scope) {
      initialState = {
        ...initialState,
        logoState: savedLogoState,
        liveLogoState: savedLogoState, // Start synced
      };
    }

    if (savedTextOverlays && Array.isArray(savedTextOverlays)) {
      initialState = {
        ...initialState,
        textOverlayState: {
          overlays: savedTextOverlays,
        },
        liveTextOverlayState: {
          overlays: savedTextOverlays, // Start synced
        },
      };
    }

    if (savedImageOverlays && Array.isArray(savedImageOverlays)) {
      initialState = {
        ...initialState,
        imageOverlayState: {
          overlays: savedImageOverlays,
        },
        liveImageOverlayState: {
          overlays: savedImageOverlays, // Start synced
        },
      };
    }

    if (savedVideoBackgrounds && Array.isArray(savedVideoBackgrounds)) {
      initialState = {
        ...initialState,
        videoBackgroundState: {
          backgrounds: savedVideoBackgrounds,
        },
        liveVideoBackgroundState: {
          backgrounds: savedVideoBackgrounds, // Start synced
        },
      };
    }

    if (savedStyleState) {
      initialState = {
        ...initialState,
        styleState: savedStyleState,
        liveStyleState: savedStyleState, // Start synced
      };
    }

    return initialState;
  });

  // Ref to track latest state for synchronous access in publish()
  const latestStateRef = useRef<PresentationState | null>(null);

  // Update ref whenever state changes
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  // Guardar estado de logo cuando cambie (con check defensivo)
  useEffect(() => {
    if (state.logoState?.settings && state.logoState?.scope) {
      saveLogoStateToStorage(state.logoState);
    }
  }, [state.logoState]);

  // Guardar text overlays cuando cambien (con check defensivo)
  useEffect(() => {
    if (state.textOverlayState?.overlays && Array.isArray(state.textOverlayState.overlays)) {
      saveTextOverlaysToStorage(state.textOverlayState.overlays);
    }
  }, [state.textOverlayState?.overlays]);

  // Guardar image overlays cuando cambien (con check defensivo)
  useEffect(() => {
    if (state.imageOverlayState?.overlays && Array.isArray(state.imageOverlayState.overlays)) {
      saveImageOverlaysToStorage(state.imageOverlayState.overlays);
    }
  }, [state.imageOverlayState?.overlays]);

  // Guardar video backgrounds cuando cambien (con check defensivo)
  useEffect(() => {
    if (state.videoBackgroundState?.backgrounds && Array.isArray(state.videoBackgroundState.backgrounds)) {
      saveVideoBackgroundsToStorage(state.videoBackgroundState.backgrounds);
    }
  }, [state.videoBackgroundState?.backgrounds]);

  // Guardar style state cuando cambie
  useEffect(() => {
    if (state.styleState) {
      saveStyleStateToStorage(state.styleState);
    }
  }, [state.styleState]);

  // Cargar liturgia - both preview and live start at 0
  const loadLiturgy = useCallback((data: PresentationData) => {
    setState((prev) => ({
      ...prev,
      data,
      previewSlideIndex: 0,
      previewElementIndex: 0,
      liveSlideIndex: 0,
      liveElementIndex: 0,
      isLive: false,
      isBlack: false,
      hasUnpublishedChanges: false,
    }));
  }, []);

  // Ir a slide especifico - auto-syncs to live when isLive && followMode
  const goToSlide = useCallback((index: number) => {
    setState((prev) => {
      if (!prev.data) return prev;
      const maxIndex = prev.data.slides.length - 1;
      const newIndex = Math.max(0, Math.min(index, maxIndex));
      const elementIndex = findElementForSlide(prev.data.elements, newIndex);

      // When live AND followMode, update both preview and live
      if (prev.isLive && prev.followMode) {
        return {
          ...prev,
          previewSlideIndex: newIndex,
          previewElementIndex: elementIndex,
          liveSlideIndex: newIndex,
          liveElementIndex: elementIndex,
        };
      }

      // Otherwise only update preview
      return {
        ...prev,
        previewSlideIndex: newIndex,
        previewElementIndex: elementIndex,
      };
    });
  }, []);

  // Siguiente slide - auto-syncs to live when isLive && followMode
  const nextSlide = useCallback(() => {
    setState((prev) => {
      if (!prev.data) return prev;
      const maxIndex = prev.data.slides.length - 1;
      if (prev.previewSlideIndex >= maxIndex) return prev;
      const newIndex = prev.previewSlideIndex + 1;
      const elementIndex = findElementForSlide(prev.data.elements, newIndex);

      // When live AND followMode, update both preview and live
      if (prev.isLive && prev.followMode) {
        return {
          ...prev,
          previewSlideIndex: newIndex,
          previewElementIndex: elementIndex,
          liveSlideIndex: newIndex,
          liveElementIndex: elementIndex,
        };
      }

      // Otherwise only update preview
      return {
        ...prev,
        previewSlideIndex: newIndex,
        previewElementIndex: elementIndex,
      };
    });
  }, []);

  // Slide anterior - auto-syncs to live when isLive && followMode
  const prevSlide = useCallback(() => {
    setState((prev) => {
      if (!prev.data) return prev;
      if (prev.previewSlideIndex <= 0) return prev;
      const newIndex = prev.previewSlideIndex - 1;
      const elementIndex = findElementForSlide(prev.data.elements, newIndex);

      // When live AND followMode, update both preview and live
      if (prev.isLive && prev.followMode) {
        return {
          ...prev,
          previewSlideIndex: newIndex,
          previewElementIndex: elementIndex,
          liveSlideIndex: newIndex,
          liveElementIndex: elementIndex,
        };
      }

      // Otherwise only update preview
      return {
        ...prev,
        previewSlideIndex: newIndex,
        previewElementIndex: elementIndex,
      };
    });
  }, []);

  // Primer slide (PREVIEW ONLY)
  const firstSlide = useCallback(() => {
    goToSlide(0);
  }, [goToSlide]);

  // Ultimo slide - auto-syncs to live when isLive && followMode
  const lastSlide = useCallback(() => {
    setState((prev) => {
      if (!prev.data) return prev;
      const maxIndex = prev.data.slides.length - 1;
      const elementIndex = findElementForSlide(prev.data.elements, maxIndex);

      // When live AND followMode, update both preview and live
      if (prev.isLive && prev.followMode) {
        return {
          ...prev,
          previewSlideIndex: maxIndex,
          previewElementIndex: elementIndex,
          liveSlideIndex: maxIndex,
          liveElementIndex: elementIndex,
        };
      }

      // Otherwise only update preview
      return {
        ...prev,
        previewSlideIndex: maxIndex,
        previewElementIndex: elementIndex,
      };
    });
  }, []);

  // Ir a elemento (primer slide del elemento) - auto-syncs to live when isLive && followMode
  const goToElement = useCallback((elementIndex: number) => {
    setState((prev) => {
      if (!prev.data || !prev.data.elements[elementIndex]) return prev;
      const element = prev.data.elements[elementIndex];

      // When live AND followMode, update both preview and live
      if (prev.isLive && prev.followMode) {
        return {
          ...prev,
          previewSlideIndex: element.startSlideIndex,
          previewElementIndex: elementIndex,
          liveSlideIndex: element.startSlideIndex,
          liveElementIndex: elementIndex,
        };
      }

      // Otherwise only update preview
      return {
        ...prev,
        previewSlideIndex: element.startSlideIndex,
        previewElementIndex: elementIndex,
      };
    });
  }, []);

  // PUBLISH - Copy preview state to live state
  // Uses ref to get current state synchronously, avoiding stale closure issues
  const publish = useCallback((): PublishPayload => {
    // Read from ref to get current state reliably
    const currentState = latestStateRef.current;

    if (!currentState) {
      return {
        slideIndex: 0,
        overlays: [],
        imageOverlays: [],
        logoState: DEFAULT_LOGO_STATE,
        tempEdits: {},
        styleState: DEFAULT_STYLE_STATE,
        videoBackgroundState: DEFAULT_VIDEO_BACKGROUND_STATE,
      };
    }

    // Build payload from current state (not closure state)
    const payload: PublishPayload = {
      slideIndex: currentState.previewSlideIndex,
      overlays: currentState.textOverlayState?.overlays || [],
      imageOverlays: currentState.imageOverlayState?.overlays || [],
      logoState: currentState.logoState || DEFAULT_LOGO_STATE,
      tempEdits: currentState.tempEdits,
      styleState: currentState.styleState || DEFAULT_STYLE_STATE,
      videoBackgroundState: currentState.videoBackgroundState || DEFAULT_VIDEO_BACKGROUND_STATE,
    };

    // Update live state to match preview
    setState((prev) => {
      const elementIndex = findElementForSlide(prev.data?.elements || [], prev.previewSlideIndex);
      return {
        ...prev,
        liveSlideIndex: prev.previewSlideIndex,
        liveElementIndex: elementIndex,
        liveLogoState: prev.logoState,
        liveTextOverlayState: prev.textOverlayState,
        liveImageOverlayState: prev.imageOverlayState,
        liveVideoBackgroundState: prev.videoBackgroundState,
        liveTempEdits: prev.tempEdits,
        liveStyleState: prev.styleState,
        hasUnpublishedChanges: false,
      };
    });

    return payload;
  }, []);

  // Alternar presentacion en vivo
  const goLive = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isLive: !prev.isLive,
      isBlack: prev.isLive ? prev.isBlack : false, // Solo quita negro al activar
      previewOverlays: prev.isLive ? prev.previewOverlays : false, // Desactivar preview al ir en vivo
    }));
  }, []);

  // Alternar pantalla negra
  const toggleBlack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isBlack: !prev.isBlack,
    }));
  }, []);

  // Establecer pantalla negra
  const setBlack = useCallback((black: boolean) => {
    setState((prev) => ({
      ...prev,
      isBlack: black,
    }));
  }, []);

  // Alternar vista previa de overlays
  const togglePreviewOverlays = useCallback(() => {
    setState((prev) => ({
      ...prev,
      previewOverlays: !prev.previewOverlays,
    }));
  }, []);

  // Establecer vista previa de overlays
  const setPreviewOverlays = useCallback((enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      previewOverlays: enabled,
    }));
  }, []);

  // Toggle Follow Mode - when ON, navigation auto-syncs to output when live
  const toggleFollowMode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      followMode: !prev.followMode,
    }));
  }, []);

  // Mostrar lower-third
  const showLowerThird = useCallback((
    message: string,
    duration: number = 10000,
    template: LowerThirdTemplate = 'custom'
  ) => {
    setState((prev) => ({
      ...prev,
      lowerThird: {
        visible: true,
        message,
        duration,
        template,
      },
    }));
  }, []);

  // Ocultar lower-third
  const hideLowerThird = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lowerThird: {
        ...prev.lowerThird,
        visible: false,
      },
    }));
  }, []);

  // ============ LOGO ACTIONS (SIMPLIFICADO) ============

  // Actualizar configuración del logo
  const updateLogo = useCallback((settings: Partial<LogoSettings>) => {
    setState((prev) => {
      const currentSettings = prev.logoState?.settings ?? DEFAULT_LOGO_STATE.settings;
      const currentScope = prev.logoState?.scope ?? DEFAULT_LOGO_STATE.scope;
      return {
        ...prev,
        logoState: {
          settings: {
            ...currentSettings,
            ...settings,
          },
          scope: currentScope,
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Establecer el scope del logo
  const setLogoScope = useCallback((scope: OverlayScope) => {
    setState((prev) => {
      const currentSettings = prev.logoState?.settings ?? DEFAULT_LOGO_STATE.settings;
      return {
        ...prev,
        logoState: {
          settings: currentSettings,
          scope,
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Establecer estado completo del logo (para sincronización)
  const setLogoState = useCallback((logoState: LogoState) => {
    setState((prev) => ({
      ...prev,
      logoState,
      hasUnpublishedChanges: true,
    }));
  }, []);

  // ============ SLIDE EDITING ============

  // Editar contenido de slide temporalmente
  const editSlideContent = useCallback((slideId: string, content: TempSlideEdit['content']) => {
    setState((prev) => ({
      ...prev,
      tempEdits: {
        ...prev.tempEdits,
        [slideId]: {
          ...prev.tempEdits[slideId],
          content: {
            ...prev.tempEdits[slideId]?.content,
            ...content,
          },
        },
      },
      hasUnpublishedChanges: true,
    }));
  }, []);

  // Limpiar edición de un slide
  const clearSlideEdit = useCallback((slideId: string) => {
    setState((prev) => {
      const newEdits = { ...prev.tempEdits };
      delete newEdits[slideId];
      return {
        ...prev,
        tempEdits: newEdits,
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Duplicar slide
  const duplicateSlide = useCallback((index: number) => {
    setState((prev) => {
      if (!prev.data) return prev;
      const slides = [...prev.data.slides];
      const slideToClone = slides[index];
      if (!slideToClone) return prev;

      // Crear copia con nuevo ID
      const newSlide: Slide = {
        ...slideToClone,
        id: `${slideToClone.id}-copy-${Date.now()}`,
        metadata: {
          ...slideToClone.metadata,
          order: slideToClone.metadata.order + 1,
        },
      };

      // Insertar después del slide actual
      slides.splice(index + 1, 0, newSlide);

      // Actualizar elementos (recalcular rangos)
      const elements = prev.data.elements.map((el) => {
        if (el.startSlideIndex > index) {
          return {
            ...el,
            startSlideIndex: el.startSlideIndex + 1,
            endSlideIndex: el.endSlideIndex + 1,
          };
        }
        if (el.endSlideIndex >= index && el.startSlideIndex <= index) {
          return {
            ...el,
            endSlideIndex: el.endSlideIndex + 1,
            slideCount: el.slideCount + 1,
          };
        }
        return el;
      });

      return {
        ...prev,
        data: {
          ...prev.data,
          slides,
          elements,
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Eliminar slide
  const deleteSlide = useCallback((index: number) => {
    setState((prev) => {
      if (!prev.data || prev.data.slides.length <= 1) return prev;
      const slides = prev.data.slides.filter((_, i) => i !== index);

      // Actualizar elementos (recalcular rangos)
      const elements = prev.data.elements
        .map((el) => {
          if (el.startSlideIndex > index) {
            return {
              ...el,
              startSlideIndex: el.startSlideIndex - 1,
              endSlideIndex: el.endSlideIndex - 1,
            };
          }
          if (el.endSlideIndex >= index && el.startSlideIndex <= index) {
            const newCount = el.slideCount - 1;
            if (newCount <= 0) return null; // Eliminar elemento vacío
            return {
              ...el,
              endSlideIndex: el.endSlideIndex - 1,
              slideCount: newCount,
            };
          }
          return el;
        })
        .filter((el): el is NonNullable<typeof el> => el !== null);

      // Ajustar índice de preview si es necesario
      const newPreviewIndex = Math.min(prev.previewSlideIndex, slides.length - 1);
      const previewElementIndex = findElementForSlide(elements, newPreviewIndex);
      // Also adjust live index if necessary
      const newLiveIndex = Math.min(prev.liveSlideIndex, slides.length - 1);
      const liveElementIndex = findElementForSlide(elements, newLiveIndex);

      return {
        ...prev,
        data: {
          ...prev.data,
          slides,
          elements,
        },
        previewSlideIndex: newPreviewIndex,
        previewElementIndex: previewElementIndex,
        liveSlideIndex: newLiveIndex,
        liveElementIndex: liveElementIndex,
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Establecer ediciones temporales (para sincronización)
  const setTempEdits = useCallback((tempEdits: Record<string, TempSlideEdit>) => {
    setState((prev) => ({
      ...prev,
      tempEdits,
    }));
  }, []);

  // Actualizar slides (para sincronización)
  const updateSlides = useCallback((slides: Slide[]) => {
    setState((prev) => {
      if (!prev.data) return prev;
      return {
        ...prev,
        data: {
          ...prev.data,
          slides,
        },
      };
    });
  }, []);

  // Insertar un slide en una posición específica (para creación al vuelo)
  const insertSlide = useCallback((slide: Slide, insertAfterIndex: number) => {
    setState((prev) => {
      if (!prev.data) return prev;

      const slidesLength = prev.data.slides.length;

      // Validate and clamp insertAfterIndex to valid bounds
      // -1 means insert at beginning, slidesLength-1 means insert at end
      const validatedIndex = Math.max(-1, Math.min(insertAfterIndex, slidesLength - 1));
      const insertIdx = validatedIndex + 1;

      const updatedSlides = [
        ...prev.data.slides.slice(0, insertIdx),
        slide,
        ...prev.data.slides.slice(insertIdx),
      ];

      // Update element indices if needed
      const elements = prev.data.elements.map((el) => {
        if (el.startSlideIndex >= insertIdx) {
          return {
            ...el,
            startSlideIndex: el.startSlideIndex + 1,
            endSlideIndex: el.endSlideIndex + 1,
          };
        }
        if (el.endSlideIndex >= insertIdx && el.startSlideIndex < insertIdx) {
          return {
            ...el,
            endSlideIndex: el.endSlideIndex + 1,
            slideCount: el.slideCount + 1,
          };
        }
        return el;
      });

      // Calculate the new element index for the inserted slide
      const newElementIndex = elements.findIndex(
        (el) => insertIdx >= el.startSlideIndex && insertIdx <= el.endSlideIndex
      );

      return {
        ...prev,
        data: {
          ...prev.data,
          slides: updatedSlides,
          elements,
        },
        // Navigate to the newly inserted slide
        previewSlideIndex: insertIdx,
        previewElementIndex: newElementIndex >= 0 ? newElementIndex : prev.previewElementIndex,
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Insertar múltiples slides en una posición específica (para escenas/elementos completos)
  const insertSlides = useCallback((
    slides: Slide[],
    insertAfterIndex: number,
    elementInfo?: { type: string; title: string }
  ) => {
    setState((prev) => {
      if (!prev.data || slides.length === 0) return prev;

      const slidesLength = prev.data.slides.length;
      const slidesToInsert = slides.length;

      // Validate and clamp insertAfterIndex to valid bounds
      // -1 means insert at beginning, slidesLength-1 means insert at end
      const validatedIndex = Math.max(-1, Math.min(insertAfterIndex, slidesLength - 1));
      const insertIdx = validatedIndex + 1;

      const updatedSlides = [
        ...prev.data.slides.slice(0, insertIdx),
        ...slides,
        ...prev.data.slides.slice(insertIdx),
      ];

      // Update existing element indices for slides after the insert point
      const shiftedElements = prev.data.elements.map((el) => {
        if (el.startSlideIndex >= insertIdx) {
          return {
            ...el,
            startSlideIndex: el.startSlideIndex + slidesToInsert,
            endSlideIndex: el.endSlideIndex + slidesToInsert,
          };
        }
        // Don't extend existing elements anymore - we'll create a new one
        return el;
      });

      // Create a new element for the inserted slides if elementInfo is provided
      let finalElements = shiftedElements;
      let newElementIndex = -1;

      if (elementInfo) {
        const newElement: FlattenedElement = {
          id: `inserted-${Date.now()}`,
          type: elementInfo.type as LiturgyElementType,
          title: elementInfo.title,
          startSlideIndex: insertIdx,
          endSlideIndex: insertIdx + slidesToInsert - 1,
          slideCount: slidesToInsert,
        };

        // Find where to insert the new element (sorted by startSlideIndex)
        const insertElementIdx = shiftedElements.findIndex(
          (el) => el.startSlideIndex > insertIdx
        );

        if (insertElementIdx === -1) {
          // Insert at the end
          finalElements = [...shiftedElements, newElement];
          newElementIndex = finalElements.length - 1;
        } else {
          // Insert at the correct position
          finalElements = [
            ...shiftedElements.slice(0, insertElementIdx),
            newElement,
            ...shiftedElements.slice(insertElementIdx),
          ];
          newElementIndex = insertElementIdx;
        }
      } else {
        // No elementInfo - fall back to old behavior (find containing element)
        newElementIndex = shiftedElements.findIndex(
          (el) => insertIdx >= el.startSlideIndex && insertIdx <= el.endSlideIndex
        );
      }

      return {
        ...prev,
        data: {
          ...prev.data,
          slides: updatedSlides,
          elements: finalElements,
        },
        // Navigate to the first newly inserted slide
        previewSlideIndex: insertIdx,
        previewElementIndex: newElementIndex >= 0 ? newElementIndex : prev.previewElementIndex,
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Agregar slides de imagen (para importar imágenes al vuelo)
  const addImageSlides = useCallback((imageUrls: string[], insertAfterIndex?: number) => {
    setState((prev) => {
      if (!prev.data) return prev;

      const newSlides: Slide[] = imageUrls.map((url, i) => ({
        id: `imported-${Date.now()}-${i}`,
        type: 'announcement-image' as const,
        content: {
          primary: '',
          imageUrl: url,
        },
        style: {
          backgroundColor: '#000000',
        },
        metadata: {
          sourceComponent: 'imported-image',
          sourceId: `import-${Date.now()}`,
          order: i,
          groupTotal: imageUrls.length,
        },
      }));

      const insertIdx = insertAfterIndex !== undefined
        ? insertAfterIndex + 1
        : prev.data.slides.length;

      const updatedSlides = [
        ...prev.data.slides.slice(0, insertIdx),
        ...newSlides,
        ...prev.data.slides.slice(insertIdx),
      ];

      return {
        ...prev,
        data: {
          ...prev.data,
          slides: updatedSlides,
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // ============ TEXT OVERLAY ACTIONS (SIMPLIFICADO) ============

  // Agregar nuevo text overlay (con scope incluido)
  const addTextOverlay = useCallback((overlay: TextOverlay) => {
    setState((prev) => {
      const currentOverlays = prev.textOverlayState?.overlays ?? [];
      // Máximo 10 overlays
      if (currentOverlays.length >= 10) return prev;

      return {
        ...prev,
        textOverlayState: {
          overlays: [...currentOverlays, overlay],
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Actualizar un text overlay existente
  const updateTextOverlay = useCallback((id: string, updates: Partial<TextOverlay>) => {
    setState((prev) => {
      const currentOverlays = prev.textOverlayState?.overlays ?? [];
      return {
        ...prev,
        textOverlayState: {
          overlays: currentOverlays.map((overlay) =>
            overlay.id === id
              ? {
                  ...overlay,
                  ...updates,
                  style: updates.style ? { ...overlay.style, ...updates.style } : overlay.style,
                }
              : overlay
          ),
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Eliminar un text overlay
  const removeTextOverlay = useCallback((id: string) => {
    setState((prev) => {
      const currentOverlays = prev.textOverlayState?.overlays ?? [];
      return {
        ...prev,
        textOverlayState: {
          overlays: currentOverlays.filter((o) => o.id !== id),
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Establecer estado completo de text overlays (para sincronización)
  const setTextOverlayState = useCallback((textOverlayState: TextOverlayState) => {
    setState((prev) => ({
      ...prev,
      textOverlayState,
      hasUnpublishedChanges: true,
    }));
  }, []);

  // ============ IMAGE OVERLAY ACTIONS ============

  // Agregar nuevo image overlay (con scope incluido)
  const addImageOverlay = useCallback((overlay: ImageOverlay) => {
    setState((prev) => {
      const currentOverlays = prev.imageOverlayState?.overlays ?? [];
      // Máximo 10 overlays
      if (currentOverlays.length >= 10) return prev;

      return {
        ...prev,
        imageOverlayState: {
          overlays: [...currentOverlays, overlay],
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Actualizar un image overlay existente
  const updateImageOverlay = useCallback((id: string, updates: Partial<ImageOverlay>) => {
    setState((prev) => {
      const currentOverlays = prev.imageOverlayState?.overlays ?? [];
      return {
        ...prev,
        imageOverlayState: {
          overlays: currentOverlays.map((overlay) =>
            overlay.id === id
              ? {
                  ...overlay,
                  ...updates,
                  style: updates.style ? { ...overlay.style, ...updates.style } : overlay.style,
                }
              : overlay
          ),
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Eliminar un image overlay
  const removeImageOverlay = useCallback((id: string) => {
    setState((prev) => {
      const currentOverlays = prev.imageOverlayState?.overlays ?? [];
      return {
        ...prev,
        imageOverlayState: {
          overlays: currentOverlays.filter((o) => o.id !== id),
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Establecer estado completo de image overlays (para sincronización)
  const setImageOverlayState = useCallback((imageOverlayState: ImageOverlayState) => {
    setState((prev) => ({
      ...prev,
      imageOverlayState,
      hasUnpublishedChanges: true,
    }));
  }, []);

  // ============ VIDEO BACKGROUND ACTIONS ============

  // Agregar nuevo video background
  const addVideoBackground = useCallback((background: VideoBackground) => {
    setState((prev) => {
      const currentBackgrounds = prev.videoBackgroundState?.backgrounds ?? [];
      // Only allow one background at a time for simplicity
      // Replace existing if there is one
      return {
        ...prev,
        videoBackgroundState: {
          backgrounds: [background],
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Actualizar un video background existente
  const updateVideoBackground = useCallback((id: string, updates: Partial<VideoBackground>) => {
    setState((prev) => {
      const currentBackgrounds = prev.videoBackgroundState?.backgrounds ?? [];
      return {
        ...prev,
        videoBackgroundState: {
          backgrounds: currentBackgrounds.map((bg) =>
            bg.id === id
              ? {
                  ...bg,
                  ...updates,
                  settings: updates.settings ? { ...bg.settings, ...updates.settings } : bg.settings,
                }
              : bg
          ),
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Eliminar un video background
  const removeVideoBackground = useCallback((id: string) => {
    setState((prev) => {
      const currentBackgrounds = prev.videoBackgroundState?.backgrounds ?? [];
      return {
        ...prev,
        videoBackgroundState: {
          backgrounds: currentBackgrounds.filter((bg) => bg.id !== id),
        },
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Establecer estado completo de video backgrounds (para sincronización)
  const setVideoBackgroundState = useCallback((videoBackgroundState: VideoBackgroundState) => {
    setState((prev) => ({
      ...prev,
      videoBackgroundState,
      hasUnpublishedChanges: true,
    }));
  }, []);

  // ============ LIVE STYLE CONTROLS ============

  // Apply styles to a specific scope
  const applyStyles = useCallback((
    styles: SlideStyles,
    scope: StyleScope,
    slideId?: string,
    elementId?: string
  ) => {
    setState((prev) => {
      const newStyleState = { ...prev.styleState };

      switch (scope) {
        case 'all':
          // Apply to global styles
          newStyleState.globalStyles = {
            ...newStyleState.globalStyles,
            ...styles,
            font: styles.font ? { ...newStyleState.globalStyles?.font, ...styles.font } : newStyleState.globalStyles?.font,
            textBackground: styles.textBackground ? { ...newStyleState.globalStyles?.textBackground, ...styles.textBackground } : newStyleState.globalStyles?.textBackground,
            slideBackground: styles.slideBackground ? { ...newStyleState.globalStyles?.slideBackground, ...styles.slideBackground } : newStyleState.globalStyles?.slideBackground,
          };
          break;

        case 'element':
          if (elementId) {
            newStyleState.elementStyles = {
              ...newStyleState.elementStyles,
              [elementId]: {
                ...newStyleState.elementStyles[elementId],
                ...styles,
                font: styles.font ? { ...newStyleState.elementStyles[elementId]?.font, ...styles.font } : newStyleState.elementStyles[elementId]?.font,
                textBackground: styles.textBackground ? { ...newStyleState.elementStyles[elementId]?.textBackground, ...styles.textBackground } : newStyleState.elementStyles[elementId]?.textBackground,
                slideBackground: styles.slideBackground ? { ...newStyleState.elementStyles[elementId]?.slideBackground, ...styles.slideBackground } : newStyleState.elementStyles[elementId]?.slideBackground,
              },
            };
          }
          break;

        case 'slide':
          if (slideId) {
            newStyleState.slideStyles = {
              ...newStyleState.slideStyles,
              [slideId]: {
                ...newStyleState.slideStyles[slideId],
                ...styles,
                font: styles.font ? { ...newStyleState.slideStyles[slideId]?.font, ...styles.font } : newStyleState.slideStyles[slideId]?.font,
                textBackground: styles.textBackground ? { ...newStyleState.slideStyles[slideId]?.textBackground, ...styles.textBackground } : newStyleState.slideStyles[slideId]?.textBackground,
                slideBackground: styles.slideBackground ? { ...newStyleState.slideStyles[slideId]?.slideBackground, ...styles.slideBackground } : newStyleState.slideStyles[slideId]?.slideBackground,
              },
            };
          }
          break;
      }

      return {
        ...prev,
        styleState: newStyleState,
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Reset styles for a specific scope
  const resetStyles = useCallback((
    scope: StyleScope,
    slideId?: string,
    elementId?: string
  ) => {
    setState((prev) => {
      const newStyleState = { ...prev.styleState };

      switch (scope) {
        case 'all':
          newStyleState.globalStyles = null;
          break;

        case 'element':
          if (elementId) {
            const { [elementId]: _, ...rest } = newStyleState.elementStyles;
            newStyleState.elementStyles = rest;
          }
          break;

        case 'slide':
          if (slideId) {
            const { [slideId]: _, ...rest } = newStyleState.slideStyles;
            newStyleState.slideStyles = rest;
          }
          break;
      }

      return {
        ...prev,
        styleState: newStyleState,
        hasUnpublishedChanges: true,
      };
    });
  }, []);

  // Set complete style state (for sync)
  const setStyleState = useCallback((styleState: StyleState) => {
    setState((prev) => ({
      ...prev,
      styleState,
      hasUnpublishedChanges: true,
    }));
  }, []);

  // ============ COMPUTED VALUES ============

  // Preview slide (what operator is viewing, con ediciones temporales aplicadas)
  const currentSlide = useMemo(() => {
    if (!state.data) return null;
    const rawSlide = state.data.slides[state.previewSlideIndex] || null;
    if (!rawSlide) return null;
    // Aplicar ediciones temporales si existen
    const edit = state.tempEdits[rawSlide.id];
    if (!edit?.content) return rawSlide;
    return {
      ...rawSlide,
      content: {
        ...rawSlide.content,
        primary: edit.content.primary ?? rawSlide.content.primary,
        secondary: edit.content.secondary ?? rawSlide.content.secondary,
        subtitle: edit.content.subtitle ?? rawSlide.content.subtitle,
      },
    };
  }, [state.data, state.previewSlideIndex, state.tempEdits]);

  // Preview element
  const currentElement = useMemo(() => {
    if (!state.data) return null;
    return state.data.elements[state.previewElementIndex] || null;
  }, [state.data, state.previewElementIndex]);

  // Live slide (what's on output, con ediciones temporales publicadas)
  const liveSlide = useMemo(() => {
    if (!state.data) return null;
    const rawSlide = state.data.slides[state.liveSlideIndex] || null;
    if (!rawSlide) return null;
    // Aplicar ediciones temporales PUBLICADAS
    const edit = state.liveTempEdits[rawSlide.id];
    if (!edit?.content) return rawSlide;
    return {
      ...rawSlide,
      content: {
        ...rawSlide.content,
        primary: edit.content.primary ?? rawSlide.content.primary,
        secondary: edit.content.secondary ?? rawSlide.content.secondary,
        subtitle: edit.content.subtitle ?? rawSlide.content.subtitle,
      },
    };
  }, [state.data, state.liveSlideIndex, state.liveTempEdits]);

  // Live element
  const liveElement = useMemo(() => {
    if (!state.data) return null;
    return state.data.elements[state.liveElementIndex] || null;
  }, [state.data, state.liveElementIndex]);

  // Total de slides
  const totalSlides = useMemo(() => {
    return state.data?.slides.length || 0;
  }, [state.data]);

  return {
    state,
    loadLiturgy,
    goToSlide,
    nextSlide,
    prevSlide,
    firstSlide,
    lastSlide,
    goToElement,
    // PUBLISH
    publish,
    goLive,
    toggleBlack,
    setBlack,
    togglePreviewOverlays,
    setPreviewOverlays,
    toggleFollowMode,
    showLowerThird,
    hideLowerThird,
    // Logo (simplificado)
    updateLogo,
    setLogoScope,
    setLogoState,
    // Slide editing
    editSlideContent,
    clearSlideEdit,
    duplicateSlide,
    deleteSlide,
    setTempEdits,
    updateSlides,
    addImageSlides,
    insertSlide,
    insertSlides,
    // Text overlays (simplificado)
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    setTextOverlayState,
    // Image overlays
    addImageOverlay,
    updateImageOverlay,
    removeImageOverlay,
    setImageOverlayState,
    // Video backgrounds
    addVideoBackground,
    updateVideoBackground,
    removeVideoBackground,
    setVideoBackgroundState,
    // Live style controls
    applyStyles,
    resetStyles,
    setStyleState,
    // Preview utilities
    currentSlide,
    currentElement,
    // Live utilities
    liveSlide,
    liveElement,
    totalSlides,
  };
}
