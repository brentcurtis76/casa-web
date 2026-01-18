/**
 * Hook para manejar el estado de la presentacion
 * Centraliza la logica de navegacion y control
 *
 * SISTEMA SIMPLIFICADO (v2):
 * - Logo: updateLogo(), setLogoScope()
 * - TextOverlay: addTextOverlay(), updateTextOverlay(), removeTextOverlay()
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  PresentationState,
  PresentationData,
  LowerThirdTemplate,
  LogoState,
  LogoSettings,
  TempSlideEdit,
  TextOverlay,
  TextOverlayState,
  TextOverlayStyle,
  OverlayScope,
} from '@/lib/presentation/types';
import { INITIAL_PRESENTATION_STATE, DEFAULT_LOGO_STATE, DEFAULT_TEXT_OVERLAY_STATE, DEFAULT_TEXT_OVERLAY_STYLE } from '@/lib/presentation/types';
import type { Slide } from '@/types/shared/slide';
import { findElementForSlide } from '@/lib/presentation/presentationService';

interface UsePresentationStateReturn {
  state: PresentationState;

  // Carga de datos
  loadLiturgy: (data: PresentationData) => void;

  // Navegacion
  goToSlide: (index: number) => void;
  nextSlide: () => void;
  prevSlide: () => void;
  firstSlide: () => void;
  lastSlide: () => void;
  goToElement: (elementIndex: number) => void;

  // Control de presentacion
  goLive: () => void;
  toggleBlack: () => void;
  setBlack: (black: boolean) => void;
  togglePreviewOverlays: () => void;
  setPreviewOverlays: (enabled: boolean) => void;

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

  // Text overlays (SIMPLIFICADO)
  addTextOverlay: (overlay: TextOverlay) => void;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  removeTextOverlay: (id: string) => void;
  setTextOverlayState: (state: TextOverlayState) => void;

  // Utilidades
  currentSlide: PresentationData['slides'][0] | null;
  currentElement: PresentationData['elements'][0] | null;
  totalSlides: number;
}

const LOGO_STATE_KEY = 'casa-presentation-logo-state';
const TEXT_OVERLAYS_KEY = 'casa-presentation-text-overlays';

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
        console.log('Migrating old logo state format to new format');
        // Migrate to new format
        return {
          settings: parsed.global,
          scope: { type: 'all' },
        };
      }

      // Validate new format has required fields
      if (!parsed.settings || !parsed.scope) {
        console.warn('Invalid logo state in localStorage, using default');
        return null;
      }

      return parsed;
    }
  } catch (e) {
    console.warn('Error loading logo state from localStorage:', e);
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
 * Hook para manejar el estado de la presentacion
 */
export function usePresentationState(): UsePresentationStateReturn {
  const [state, setState] = useState<PresentationState>(() => {
    // Intentar cargar configuraciones guardadas
    const savedLogoState = loadLogoStateFromStorage();
    const savedTextOverlays = loadTextOverlaysFromStorage();

    // Start with a deep copy to avoid mutation issues
    let initialState: PresentationState = {
      ...INITIAL_PRESENTATION_STATE,
      logoState: { ...DEFAULT_LOGO_STATE },
      textOverlayState: { ...DEFAULT_TEXT_OVERLAY_STATE },
    };

    if (savedLogoState?.settings && savedLogoState?.scope) {
      initialState = {
        ...initialState,
        logoState: savedLogoState,
      };
    }

    if (savedTextOverlays && Array.isArray(savedTextOverlays)) {
      initialState = {
        ...initialState,
        textOverlayState: {
          overlays: savedTextOverlays,
        },
      };
    }

    return initialState;
  });

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

  // Cargar liturgia
  const loadLiturgy = useCallback((data: PresentationData) => {
    setState((prev) => ({
      ...prev,
      data,
      currentSlideIndex: 0,
      currentElementIndex: 0,
      isLive: false,
      isBlack: false,
    }));
  }, []);

  // Ir a slide especifico
  const goToSlide = useCallback((index: number) => {
    setState((prev) => {
      if (!prev.data) return prev;
      const maxIndex = prev.data.slides.length - 1;
      const newIndex = Math.max(0, Math.min(index, maxIndex));
      const elementIndex = findElementForSlide(prev.data.elements, newIndex);
      return {
        ...prev,
        currentSlideIndex: newIndex,
        currentElementIndex: elementIndex,
      };
    });
  }, []);

  // Siguiente slide
  const nextSlide = useCallback(() => {
    setState((prev) => {
      if (!prev.data) return prev;
      const maxIndex = prev.data.slides.length - 1;
      if (prev.currentSlideIndex >= maxIndex) return prev;
      const newIndex = prev.currentSlideIndex + 1;
      const elementIndex = findElementForSlide(prev.data.elements, newIndex);
      return {
        ...prev,
        currentSlideIndex: newIndex,
        currentElementIndex: elementIndex,
      };
    });
  }, []);

  // Slide anterior
  const prevSlide = useCallback(() => {
    setState((prev) => {
      if (!prev.data) return prev;
      if (prev.currentSlideIndex <= 0) return prev;
      const newIndex = prev.currentSlideIndex - 1;
      const elementIndex = findElementForSlide(prev.data.elements, newIndex);
      return {
        ...prev,
        currentSlideIndex: newIndex,
        currentElementIndex: elementIndex,
      };
    });
  }, []);

  // Primer slide
  const firstSlide = useCallback(() => {
    goToSlide(0);
  }, [goToSlide]);

  // Ultimo slide
  const lastSlide = useCallback(() => {
    setState((prev) => {
      if (!prev.data) return prev;
      const maxIndex = prev.data.slides.length - 1;
      const elementIndex = findElementForSlide(prev.data.elements, maxIndex);
      return {
        ...prev,
        currentSlideIndex: maxIndex,
        currentElementIndex: elementIndex,
      };
    });
  }, []);

  // Ir a elemento (primer slide del elemento)
  const goToElement = useCallback((elementIndex: number) => {
    setState((prev) => {
      if (!prev.data || !prev.data.elements[elementIndex]) return prev;
      const element = prev.data.elements[elementIndex];
      return {
        ...prev,
        currentSlideIndex: element.startSlideIndex,
        currentElementIndex: elementIndex,
      };
    });
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
      };
    });
  }, []);

  // Establecer estado completo del logo (para sincronización)
  const setLogoState = useCallback((logoState: LogoState) => {
    setState((prev) => ({
      ...prev,
      logoState,
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

      // Ajustar índice actual si es necesario
      const newIndex = Math.min(prev.currentSlideIndex, slides.length - 1);
      const elementIndex = findElementForSlide(elements, newIndex);

      return {
        ...prev,
        data: {
          ...prev.data,
          slides,
          elements,
        },
        currentSlideIndex: newIndex,
        currentElementIndex: elementIndex,
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
      };
    });
  }, []);

  // Establecer estado completo de text overlays (para sincronización)
  const setTextOverlayState = useCallback((textOverlayState: TextOverlayState) => {
    setState((prev) => ({
      ...prev,
      textOverlayState,
    }));
  }, []);

  // ============ COMPUTED VALUES ============

  // Slide actual (con ediciones temporales aplicadas)
  const currentSlide = useMemo(() => {
    if (!state.data) return null;
    const rawSlide = state.data.slides[state.currentSlideIndex] || null;
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
  }, [state.data, state.currentSlideIndex, state.tempEdits]);

  // Elemento actual
  const currentElement = useMemo(() => {
    if (!state.data) return null;
    return state.data.elements[state.currentElementIndex] || null;
  }, [state.data, state.currentElementIndex]);

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
    goLive,
    toggleBlack,
    setBlack,
    togglePreviewOverlays,
    setPreviewOverlays,
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
    // Text overlays (simplificado)
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    setTextOverlayState,
    // Utilities
    currentSlide,
    currentElement,
    totalSlides,
  };
}
