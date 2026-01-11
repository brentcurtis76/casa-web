/**
 * Hook para manejar el estado de la presentacion
 * Centraliza la logica de navegacion y control
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
  SceneState,
  PlaceholderContext,
} from '@/lib/presentation/types';
import { INITIAL_PRESENTATION_STATE, DEFAULT_LOGO_STATE, DEFAULT_TEXT_OVERLAY_STATE, DEFAULT_TEXT_OVERLAY_STYLE } from '@/lib/presentation/types';
import { INITIAL_SCENE_STATE } from '@/lib/presentation/sceneTypes';
import type { Look, Prop } from '@/lib/presentation/sceneTypes';
import { resolveLookForElement, buildPlaceholderContext, resolveLookPlaceholders } from '@/lib/presentation/sceneService';
import { getAutoProps, getArmedProps } from '@/lib/presentation/sceneTypes';
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

  // Lower-thirds
  showLowerThird: (message: string, duration?: number, template?: LowerThirdTemplate) => void;
  hideLowerThird: () => void;

  // Logo
  updateLogoGlobal: (settings: Partial<LogoSettings>) => void;
  setLogoOverride: (slideIndex: number, settings: Partial<LogoSettings>) => void;
  removeLogoOverride: (slideIndex: number) => void;
  applyLogoToAll: (settings: LogoSettings) => void;
  setLogoState: (logoState: LogoState) => void;

  // Edición temporal de slides
  editSlideContent: (slideId: string, content: TempSlideEdit['content']) => void;
  clearSlideEdit: (slideId: string) => void;
  duplicateSlide: (index: number) => void;
  deleteSlide: (index: number) => void;
  setTempEdits: (tempEdits: Record<string, TempSlideEdit>) => void;
  updateSlides: (slides: Slide[]) => void;

  // Text overlays
  addTextOverlay: (content: string, position?: { x: number; y: number }, style?: Partial<TextOverlayStyle>) => void;
  updateTextOverlay: (id: string, updates: Partial<TextOverlay>) => void;
  removeTextOverlay: (id: string) => void;
  setTextOverlayOverride: (slideIndex: number, overlayId: string, override: Partial<TextOverlay>) => void;
  removeTextOverlayOverride: (slideIndex: number, overlayId: string) => void;
  clearTextOverlayOverrides: (slideIndex: number) => void;
  setTextOverlayState: (state: TextOverlayState) => void;
  reorderTextOverlays: (fromIndex: number, toIndex: number) => void;

  // Scene/Props system
  setSceneState: (sceneState: SceneState) => void;
  updateSceneForElement: (elementIndex: number) => void;
  showProp: (propId: string) => void;
  hideProp: (propId: string) => void;
  hideAllProps: () => void;
  getResolvedProp: (propId: string) => Prop | null;

  // Utilidades
  currentSlide: PresentationData['slides'][0] | null;
  currentElement: PresentationData['elements'][0] | null;
  currentLook: Look | null;
  armedProps: Prop[];
  activeProps: Prop[];
  totalSlides: number;
}

const LOGO_SETTINGS_KEY = 'casa-presentation-logo-settings';
const TEXT_OVERLAYS_KEY = 'casa-presentation-text-overlays';

/**
 * Cargar configuración de logo desde localStorage
 */
function loadLogoSettingsFromStorage(): LogoSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(LOGO_SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Error loading logo settings from localStorage:', e);
  }
  return null;
}

/**
 * Guardar configuración de logo en localStorage
 */
function saveLogoSettingsToStorage(settings: LogoSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOGO_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Error saving logo settings to localStorage:', e);
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
    const savedLogoSettings = loadLogoSettingsFromStorage();
    const savedTextOverlays = loadTextOverlaysFromStorage();

    let initialState = INITIAL_PRESENTATION_STATE;

    if (savedLogoSettings) {
      initialState = {
        ...initialState,
        logoState: {
          global: savedLogoSettings,
          overrides: {},
        },
      };
    }

    if (savedTextOverlays) {
      initialState = {
        ...initialState,
        textOverlayState: {
          global: savedTextOverlays,
          overrides: {},
        },
      };
    }

    return initialState;
  });

  // Guardar configuración de logo cuando cambie
  useEffect(() => {
    saveLogoSettingsToStorage(state.logoState.global);
  }, [state.logoState.global]);

  // Guardar text overlays cuando cambien
  useEffect(() => {
    saveTextOverlaysToStorage(state.textOverlayState.global);
  }, [state.textOverlayState.global]);

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

  // Actualizar configuración global del logo
  const updateLogoGlobal = useCallback((settings: Partial<LogoSettings>) => {
    setState((prev) => ({
      ...prev,
      logoState: {
        ...prev.logoState,
        global: {
          ...prev.logoState.global,
          ...settings,
        },
      },
    }));
  }, []);

  // Establecer override de logo para un slide específico
  const setLogoOverride = useCallback((slideIndex: number, settings: Partial<LogoSettings>) => {
    setState((prev) => ({
      ...prev,
      logoState: {
        ...prev.logoState,
        overrides: {
          ...prev.logoState.overrides,
          [slideIndex]: {
            ...prev.logoState.overrides[slideIndex],
            ...settings,
          },
        },
      },
    }));
  }, []);

  // Remover override de logo de un slide
  const removeLogoOverride = useCallback((slideIndex: number) => {
    setState((prev) => {
      const newOverrides = { ...prev.logoState.overrides };
      delete newOverrides[slideIndex];
      return {
        ...prev,
        logoState: {
          ...prev.logoState,
          overrides: newOverrides,
        },
      };
    });
  }, []);

  // Aplicar configuración de logo a todos los slides (como nuevo global)
  const applyLogoToAll = useCallback((settings: LogoSettings) => {
    setState((prev) => ({
      ...prev,
      logoState: {
        global: settings,
        overrides: {}, // Limpiar todos los overrides
      },
    }));
  }, []);

  // Establecer estado completo del logo (para sincronización)
  const setLogoState = useCallback((logoState: LogoState) => {
    setState((prev) => ({
      ...prev,
      logoState,
    }));
  }, []);

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

  // ============ TEXT OVERLAY ACTIONS ============

  // Agregar nuevo text overlay
  const addTextOverlay = useCallback((
    content: string,
    position: { x: number; y: number } = { x: 50, y: 50 },
    style: Partial<TextOverlayStyle> = {}
  ) => {
    setState((prev) => {
      // Máximo 10 overlays
      if (prev.textOverlayState.global.length >= 10) return prev;

      const newOverlay: TextOverlay = {
        id: `text-overlay-${Date.now()}`,
        content,
        position,
        style: { ...DEFAULT_TEXT_OVERLAY_STYLE, ...style },
        visible: true,
      };

      return {
        ...prev,
        textOverlayState: {
          ...prev.textOverlayState,
          global: [...prev.textOverlayState.global, newOverlay],
        },
      };
    });
  }, []);

  // Actualizar un text overlay existente
  const updateTextOverlay = useCallback((id: string, updates: Partial<TextOverlay>) => {
    setState((prev) => ({
      ...prev,
      textOverlayState: {
        ...prev.textOverlayState,
        global: prev.textOverlayState.global.map((overlay) =>
          overlay.id === id
            ? {
                ...overlay,
                ...updates,
                style: updates.style ? { ...overlay.style, ...updates.style } : overlay.style,
              }
            : overlay
        ),
      },
    }));
  }, []);

  // Eliminar un text overlay
  const removeTextOverlay = useCallback((id: string) => {
    setState((prev) => {
      // También eliminar todos los overrides de este overlay
      const newOverrides: Record<number, Partial<TextOverlay>[]> = {};
      Object.entries(prev.textOverlayState.overrides).forEach(([slideIndex, overrides]) => {
        const filtered = overrides.filter((o) => o.id !== id);
        if (filtered.length > 0) {
          newOverrides[Number(slideIndex)] = filtered;
        }
      });

      return {
        ...prev,
        textOverlayState: {
          global: prev.textOverlayState.global.filter((o) => o.id !== id),
          overrides: newOverrides,
        },
      };
    });
  }, []);

  // Establecer override de text overlay para un slide específico
  const setTextOverlayOverride = useCallback((
    slideIndex: number,
    overlayId: string,
    override: Partial<TextOverlay>
  ) => {
    setState((prev) => {
      const currentOverrides = prev.textOverlayState.overrides[slideIndex] || [];
      const existingIndex = currentOverrides.findIndex((o) => o.id === overlayId);

      let newOverrides: Partial<TextOverlay>[];
      if (existingIndex >= 0) {
        // Actualizar override existente
        newOverrides = currentOverrides.map((o, i) =>
          i === existingIndex ? { ...o, ...override, id: overlayId } : o
        );
      } else {
        // Agregar nuevo override
        newOverrides = [...currentOverrides, { ...override, id: overlayId }];
      }

      return {
        ...prev,
        textOverlayState: {
          ...prev.textOverlayState,
          overrides: {
            ...prev.textOverlayState.overrides,
            [slideIndex]: newOverrides,
          },
        },
      };
    });
  }, []);

  // Eliminar override de text overlay de un slide
  const removeTextOverlayOverride = useCallback((slideIndex: number, overlayId: string) => {
    setState((prev) => {
      const currentOverrides = prev.textOverlayState.overrides[slideIndex] || [];
      const filtered = currentOverrides.filter((o) => o.id !== overlayId);

      const newOverrides = { ...prev.textOverlayState.overrides };
      if (filtered.length > 0) {
        newOverrides[slideIndex] = filtered;
      } else {
        delete newOverrides[slideIndex];
      }

      return {
        ...prev,
        textOverlayState: {
          ...prev.textOverlayState,
          overrides: newOverrides,
        },
      };
    });
  }, []);

  // Limpiar todos los overrides de text overlays de un slide
  const clearTextOverlayOverrides = useCallback((slideIndex: number) => {
    setState((prev) => {
      const newOverrides = { ...prev.textOverlayState.overrides };
      delete newOverrides[slideIndex];

      return {
        ...prev,
        textOverlayState: {
          ...prev.textOverlayState,
          overrides: newOverrides,
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

  // Reordenar text overlays
  const reorderTextOverlays = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const overlays = [...prev.textOverlayState.global];
      const [moved] = overlays.splice(fromIndex, 1);
      overlays.splice(toIndex, 0, moved);

      return {
        ...prev,
        textOverlayState: {
          ...prev.textOverlayState,
          global: overlays,
        },
      };
    });
  }, []);

  // ============ END TEXT OVERLAY ACTIONS ============

  // ============ SCENE/PROPS ACTIONS ============

  // Set scene state (for sync)
  const setSceneState = useCallback((sceneState: SceneState) => {
    setState((prev) => ({
      ...prev,
      sceneState,
    }));
  }, []);

  // Update scene when navigating to a new element
  const updateSceneForElement = useCallback((elementIndex: number) => {
    setState((prev) => {
      if (!prev.data || !prev.data.elements[elementIndex]) {
        return {
          ...prev,
          sceneState: INITIAL_SCENE_STATE,
        };
      }

      const element = prev.data.elements[elementIndex];
      const look = resolveLookForElement(element.type, null);

      if (!look) {
        return {
          ...prev,
          sceneState: {
            currentElementId: element.id,
            currentLook: null,
            activeProps: [],
            armedProps: [],
            placeholderContext: buildPlaceholderContext(element, prev.data.liturgyDate),
          },
        };
      }

      // Build placeholder context
      const placeholderContext = buildPlaceholderContext(element, prev.data.liturgyDate);

      // Resolve placeholders in the look
      const resolvedLook = resolveLookPlaceholders(look, placeholderContext);

      // Get auto and armed props
      const autoProps = getAutoProps(resolvedLook);
      const armedPropsList = getArmedProps(resolvedLook);

      return {
        ...prev,
        sceneState: {
          currentElementId: element.id,
          currentLook: resolvedLook,
          activeProps: autoProps.map((p) => p.id), // Auto-show these
          armedProps: armedPropsList.map((p) => p.id),
          placeholderContext,
        },
      };
    });
  }, []);

  // Show a prop (move from armed to active)
  const showProp = useCallback((propId: string) => {
    setState((prev) => {
      const newArmed = prev.sceneState.armedProps.filter((id) => id !== propId);
      const newActive = prev.sceneState.activeProps.includes(propId)
        ? prev.sceneState.activeProps
        : [...prev.sceneState.activeProps, propId];

      return {
        ...prev,
        sceneState: {
          ...prev.sceneState,
          armedProps: newArmed,
          activeProps: newActive,
        },
      };
    });
  }, []);

  // Hide a prop (remove from active)
  const hideProp = useCallback((propId: string) => {
    setState((prev) => ({
      ...prev,
      sceneState: {
        ...prev.sceneState,
        activeProps: prev.sceneState.activeProps.filter((id) => id !== propId),
      },
    }));
  }, []);

  // Hide all props
  const hideAllProps = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sceneState: {
        ...prev.sceneState,
        activeProps: [],
      },
    }));
  }, []);

  // Get a resolved prop by ID
  const getResolvedProp = useCallback((propId: string): Prop | null => {
    const look = state.sceneState.currentLook;
    if (!look) return null;
    return look.props.find((p) => p.id === propId) ?? null;
  }, [state.sceneState.currentLook]);

  // ============ END SCENE/PROPS ACTIONS ============

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

  // Current look from scene state
  const currentLook = useMemo(() => {
    return state.sceneState.currentLook;
  }, [state.sceneState.currentLook]);

  // Armed props (resolved from current look)
  const armedProps = useMemo((): Prop[] => {
    const look = state.sceneState.currentLook;
    if (!look) return [];
    return state.sceneState.armedProps
      .map((id) => look.props.find((p) => p.id === id))
      .filter((p): p is Prop => p !== undefined);
  }, [state.sceneState.currentLook, state.sceneState.armedProps]);

  // Active props (resolved from current look)
  const activeProps = useMemo((): Prop[] => {
    const look = state.sceneState.currentLook;
    if (!look) return [];
    return state.sceneState.activeProps
      .map((id) => look.props.find((p) => p.id === id))
      .filter((p): p is Prop => p !== undefined);
  }, [state.sceneState.currentLook, state.sceneState.activeProps]);

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
    showLowerThird,
    hideLowerThird,
    updateLogoGlobal,
    setLogoOverride,
    removeLogoOverride,
    applyLogoToAll,
    setLogoState,
    editSlideContent,
    clearSlideEdit,
    duplicateSlide,
    deleteSlide,
    setTempEdits,
    updateSlides,
    addTextOverlay,
    updateTextOverlay,
    removeTextOverlay,
    setTextOverlayOverride,
    removeTextOverlayOverride,
    clearTextOverlayOverrides,
    setTextOverlayState,
    reorderTextOverlays,
    // Scene/Props
    setSceneState,
    updateSceneForElement,
    showProp,
    hideProp,
    hideAllProps,
    getResolvedProp,
    // Utilities
    currentSlide,
    currentElement,
    currentLook,
    armedProps,
    activeProps,
    totalSlides,
  };
}
