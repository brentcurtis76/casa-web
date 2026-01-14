/**
 * Tipos para el sistema de presentación CASA
 * Define estructuras para sincronización entre Presenter y Output views
 *
 * SISTEMA SIMPLIFICADO (v2):
 * - Logo: settings + scope (sin overrides legacy)
 * - TextOverlay: cada overlay tiene su propio scope
 * - Solo 2 tipos de scope: 'all' o 'elements'
 */

import type { Slide } from '@/types/shared/slide';
import type { LiturgyElementType } from '@/types/shared/liturgy';

/**
 * Elemento aplanado de la liturgia para navegación
 */
export interface FlattenedElement {
  id: string;
  type: LiturgyElementType;
  title: string;
  startSlideIndex: number;
  endSlideIndex: number;
  slideCount: number;
  notes?: string;
}

/**
 * Datos de la presentación cargada
 */
export interface PresentationData {
  liturgyId: string;
  liturgyTitle: string;
  liturgyDate: Date;
  slides: Slide[];
  elements: FlattenedElement[];
}

/**
 * Estado del lower-third
 */
export interface LowerThirdState {
  visible: boolean;
  message: string;
  duration?: number;
  template?: LowerThirdTemplate;
}

/**
 * Plantillas predefinidas de lower-third
 */
export type LowerThirdTemplate =
  | 'custom'
  | 'mover-auto'       // "Mover auto patente ___"
  | 'llamada-urgente'; // "Llamada urgente para ___"

// ============================================
// SISTEMA DE OVERLAYS SIMPLIFICADO
// ============================================

/**
 * Alcance de aplicación de un overlay
 * 4 opciones disponibles:
 * - all: Toda la presentación
 * - slide: Diapositiva específica
 * - element: Elemento actual (un solo elemento)
 * - elements: Elementos específicos seleccionados (múltiples)
 */
export type OverlayScope =
  | { type: 'all' }
  | { type: 'slide'; slideIndex: number }
  | { type: 'element'; elementId: string }
  | { type: 'elements'; elementIds: string[] };

/**
 * Posición del logo (porcentaje 0-100)
 */
export interface LogoPosition {
  x: number;
  y: number;
}

/**
 * Configuración del logo
 */
export interface LogoSettings {
  visible: boolean;
  position: LogoPosition;
  size: number; // porcentaje del ancho del slide (ej: 12 = 12%)
}

/**
 * Estado completo del logo (SIMPLIFICADO)
 * - settings: configuración visual
 * - scope: dónde se aplica
 */
export interface LogoState {
  settings: LogoSettings;
  scope: OverlayScope;
}

/**
 * Valores por defecto del logo
 */
export const DEFAULT_LOGO_STATE: LogoState = {
  settings: {
    visible: false,
    position: { x: 85, y: 90 }, // esquina inferior derecha
    size: 12, // 12% del ancho
  },
  scope: { type: 'all' },
};

/**
 * Helper: Determina si un scope aplica a un slide específico
 */
export function isSlideInScope(
  scope: OverlayScope,
  slideIndex: number,
  elements: FlattenedElement[]
): boolean {
  if (!scope) return true; // Default to showing if scope is missing

  switch (scope.type) {
    case 'all':
      return true;
    case 'slide':
      return scope.slideIndex === slideIndex;
    case 'element': {
      const element = elements.find((e) => e.id === scope.elementId);
      return element
        ? slideIndex >= element.startSlideIndex && slideIndex <= element.endSlideIndex
        : false;
    }
    case 'elements': {
      const currentElement = elements.find(
        (e) => slideIndex >= e.startSlideIndex && slideIndex <= e.endSlideIndex
      );
      return currentElement ? scope.elementIds?.includes(currentElement.id) ?? false : false;
    }
    default:
      return true;
  }
}

/**
 * Determina si el logo debe mostrarse en un slide específico
 */
export function shouldShowLogo(
  logoState: LogoState,
  slideIndex: number,
  elements: FlattenedElement[]
): boolean {
  // Defensive check for undefined/malformed state (e.g., stale localStorage)
  if (!logoState?.settings?.visible) return false;
  return isSlideInScope(logoState.scope, slideIndex, elements);
}

// ============================================
// TEXT OVERLAYS
// ============================================

/**
 * Colores disponibles para text overlays (del brand-kit)
 */
export type TextOverlayColor =
  | 'primary-black'
  | 'primary-amber'
  | 'primary-white'
  | 'secondary-carbon'
  | 'secondary-gray';

/**
 * Tamaños de texto para overlays
 */
export type TextOverlaySize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Mapeo de tamaños a valores CSS
 */
export const TEXT_OVERLAY_SIZES: Record<TextOverlaySize, string> = {
  sm: '1rem',    // 16px - captions, small labels
  md: '1.5rem',  // 24px - body text
  lg: '2.5rem',  // 40px - titles
  xl: '4rem',    // 64px - big statements
};

/**
 * Estilo de un text overlay
 */
export interface TextOverlayStyle {
  font: 'heading' | 'body'; // Merriweather or Montserrat
  size: TextOverlaySize;
  color: TextOverlayColor;
  backgroundColor?: TextOverlayColor | 'none';
  backgroundOpacity?: number; // 0-1
  align: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
}

/**
 * Un texto overlay individual (SIMPLIFICADO)
 * Cada overlay tiene su propio scope
 */
export interface TextOverlay {
  id: string;
  content: string;
  position: { x: number; y: number }; // percentage 0-100
  style: TextOverlayStyle;
  visible: boolean;
  scope: OverlayScope; // cada overlay define dónde se muestra
}

/**
 * Estado de text overlays (SIMPLIFICADO)
 * Solo un array de overlays, cada uno con su scope
 */
export interface TextOverlayState {
  overlays: TextOverlay[];
}

/**
 * Valores por defecto para text overlays
 */
export const DEFAULT_TEXT_OVERLAY_STATE: TextOverlayState = {
  overlays: [],
};

/**
 * Estilo por defecto para nuevos text overlays
 */
export const DEFAULT_TEXT_OVERLAY_STYLE: TextOverlayStyle = {
  font: 'body',
  size: 'md',
  color: 'primary-white',
  backgroundColor: 'none',
  backgroundOpacity: 0.7,
  align: 'center',
  bold: false,
  italic: false,
};

/**
 * Obtiene los text overlays visibles para un slide específico
 * (Solo los que tienen visible: true)
 */
export function getVisibleTextOverlays(
  state: TextOverlayState,
  slideIndex: number,
  elements: FlattenedElement[]
): TextOverlay[] {
  // Defensive check for undefined/malformed state
  if (!state?.overlays || !Array.isArray(state.overlays)) return [];

  return state.overlays.filter((overlay) => {
    if (!overlay?.visible) return false;
    return isSlideInScope(overlay.scope, slideIndex, elements);
  });
}

/**
 * Obtiene TODOS los text overlays que aplican a un slide específico
 * (Incluye los que tienen visible: false, para preview en presenter)
 */
export function getAllOverlaysForSlide(
  state: TextOverlayState,
  slideIndex: number,
  elements: FlattenedElement[]
): TextOverlay[] {
  // Defensive check for undefined/malformed state
  if (!state?.overlays || !Array.isArray(state.overlays)) return [];

  return state.overlays.filter((overlay) => {
    if (!overlay) return false;
    return isSlideInScope(overlay.scope, slideIndex, elements);
  });
}

/**
 * Helper para obtener label descriptivo del scope
 */
export function getScopeLabel(
  scope: OverlayScope,
  elements: FlattenedElement[],
  slideIndex?: number
): string {
  if (!scope) return 'Toda la presentación';

  switch (scope.type) {
    case 'all':
      return 'Toda la presentación';
    case 'slide':
      return `Diapositiva ${scope.slideIndex + 1}`;
    case 'element': {
      const element = elements.find((e) => e.id === scope.elementId);
      return element ? element.title : 'Elemento';
    }
    case 'elements': {
      const count = scope.elementIds.length;
      if (count === 0) {
        return 'Ningún elemento';
      }
      if (count === 1) {
        const element = elements.find((e) => e.id === scope.elementIds[0]);
        return element ? element.title : '1 elemento';
      }
      return `${count} elementos`;
    }
    default:
      return 'Toda la presentación';
  }
}

// ============================================
// EDICIONES TEMPORALES
// ============================================

/**
 * Edición temporal de un slide (solo sesión, no se guarda en DB)
 */
export interface TempSlideEdit {
  content?: {
    primary?: string;
    secondary?: string;
    subtitle?: string;
  };
}

/**
 * Aplica ediciones temporales a un slide
 */
export function applyTempEdits(slide: Slide, tempEdits: Record<string, TempSlideEdit>): Slide {
  const edit = tempEdits[slide.id];
  if (!edit?.content) return slide;
  return {
    ...slide,
    content: {
      ...slide.content,
      primary: edit.content.primary ?? slide.content.primary,
      secondary: edit.content.secondary ?? slide.content.secondary,
      subtitle: edit.content.subtitle ?? slide.content.subtitle,
    },
  };
}

// ============================================
// ESTADO DE PRESENTACIÓN
// ============================================

/**
 * Estado completo de la presentación
 */
export interface PresentationState {
  data: PresentationData | null;
  currentSlideIndex: number;
  currentElementIndex: number;
  isLive: boolean;
  isBlack: boolean;
  previewOverlays: boolean; // muestra overlays en OutputView sin estar live
  lowerThird: LowerThirdState;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  tempEdits: Record<string, TempSlideEdit>; // slideId -> edits temporales
}

/**
 * Mensajes de sincronización entre ventanas
 */
export type SyncMessage =
  | { type: 'SLIDE_CHANGE'; slideIndex: number }
  | { type: 'GO_LIVE' }
  | { type: 'GO_OFFLINE' }
  | { type: 'GO_BLACK'; black: boolean }
  | { type: 'SHOW_LOWER_THIRD'; message: string; duration?: number; template?: LowerThirdTemplate }
  | { type: 'HIDE_LOWER_THIRD' }
  | { type: 'LITURGY_LOADED'; data: PresentationData }
  | { type: 'REQUEST_STATE' }
  | { type: 'STATE_SYNC'; state: PresentationState }
  | { type: 'FULLSCREEN_TOGGLE' }
  | { type: 'LOGO_UPDATE'; logoState: LogoState }
  | { type: 'SLIDES_UPDATE'; slides: Slide[]; tempEdits: Record<string, TempSlideEdit> }
  | { type: 'TEXT_OVERLAYS_UPDATE'; textOverlayState: TextOverlayState }
  | { type: 'PREVIEW_OVERLAYS'; enabled: boolean };

/**
 * Rol del participante en la sincronización
 */
export type SyncRole = 'presenter' | 'output';

/**
 * Plantillas de lower-third con textos predefinidos
 */
export const LOWER_THIRD_TEMPLATES: Record<LowerThirdTemplate, { prefix: string; suffix: string; placeholder: string }> = {
  'custom': { prefix: '', suffix: '', placeholder: 'Escribe tu mensaje...' },
  'mover-auto': { prefix: 'Mover auto patente ', suffix: '', placeholder: 'ABC-123' },
  'llamada-urgente': { prefix: 'Llamada urgente para ', suffix: '', placeholder: 'nombre' },
};

/**
 * Configuración inicial del estado de presentación
 */
export const INITIAL_PRESENTATION_STATE: PresentationState = {
  data: null,
  currentSlideIndex: 0,
  currentElementIndex: 0,
  isLive: false,
  isBlack: false,
  previewOverlays: false,
  lowerThird: {
    visible: false,
    message: '',
    duration: 10000, // 10 segundos por defecto
  },
  logoState: DEFAULT_LOGO_STATE,
  textOverlayState: DEFAULT_TEXT_OVERLAY_STATE,
  tempEdits: {},
};
