/**
 * Tipos para el sistema de presentación CASA
 * Define estructuras para sincronización entre Presenter y Output views
 */

import type { Slide } from '@/types/shared/slide';
import type { LiturgyElementType } from '@/types/shared/liturgy';
import type { SceneState, Look, PlaceholderContext } from './sceneTypes';
import { INITIAL_SCENE_STATE } from './sceneTypes';

// Re-export scene types for convenience
export type { SceneState, Look, PlaceholderContext } from './sceneTypes';

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
 * Estado completo del logo con overrides por slide
 */
export interface LogoState {
  global: LogoSettings;
  overrides: Record<number, Partial<LogoSettings>>; // slideIndex -> override
}

/**
 * Valores por defecto del logo
 */
export const DEFAULT_LOGO_STATE: LogoState = {
  global: {
    visible: true,
    position: { x: 85, y: 90 }, // esquina inferior derecha
    size: 12, // 12% del ancho
  },
  overrides: {},
};

/**
 * Calcula los settings efectivos del logo para un slide
 */
export function getEffectiveLogoSettings(state: LogoState, slideIndex: number): LogoSettings {
  const override = state.overrides[slideIndex];
  if (!override) return state.global;
  return {
    visible: override.visible ?? state.global.visible,
    position: override.position ?? state.global.position,
    size: override.size ?? state.global.size,
  };
}

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
 * Un texto overlay individual
 */
export interface TextOverlay {
  id: string;
  content: string;
  position: { x: number; y: number }; // percentage 0-100
  style: TextOverlayStyle;
  visible: boolean;
}

/**
 * Estado completo de text overlays con overrides por slide
 */
export interface TextOverlayState {
  global: TextOverlay[]; // max 10 overlays
  overrides: Record<number, Partial<TextOverlay>[]>; // slideIndex -> overlay overrides (matched by id)
}

/**
 * Valores por defecto para text overlays
 */
export const DEFAULT_TEXT_OVERLAY_STATE: TextOverlayState = {
  global: [],
  overrides: {},
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
 * Calcula los text overlays efectivos para un slide
 */
export function getEffectiveTextOverlays(state: TextOverlayState, slideIndex: number): TextOverlay[] {
  const overrides = state.overrides[slideIndex] || [];
  return state.global.map(overlay => {
    const override = overrides.find(o => o.id === overlay.id);
    if (!override) return overlay;
    return {
      ...overlay,
      ...override,
      position: override.position ?? overlay.position,
      style: override.style ? { ...overlay.style, ...override.style } : overlay.style,
    };
  });
}

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

/**
 * Estado completo de la presentación
 */
export interface PresentationState {
  data: PresentationData | null;
  currentSlideIndex: number;
  currentElementIndex: number;
  isLive: boolean;
  isBlack: boolean;
  lowerThird: LowerThirdState;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  tempEdits: Record<string, TempSlideEdit>; // slideId -> edits temporales
  sceneState: SceneState; // Scene/Props system state
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
  // Scene/Props sync messages
  | { type: 'SCENE_CHANGE'; elementId: string; look: Look; context: PlaceholderContext }
  | { type: 'PROP_SHOW'; propId: string }
  | { type: 'PROP_HIDE'; propId: string }
  | { type: 'PROPS_UPDATE'; activeProps: string[]; armedProps: string[] };

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
  lowerThird: {
    visible: false,
    message: '',
    duration: 10000, // 10 segundos por defecto
  },
  logoState: DEFAULT_LOGO_STATE,
  textOverlayState: DEFAULT_TEXT_OVERLAY_STATE,
  tempEdits: {},
  sceneState: INITIAL_SCENE_STATE,
};
