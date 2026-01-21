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
import type { PresentationTheme } from '@/lib/presentation/themes';

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
  theme: PresentationTheme;  // Theme for this presentation
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

// ============================================
// IMAGE OVERLAYS
// ============================================

/**
 * Style options for image overlays
 */
export interface ImageOverlayStyle {
  opacity: number;        // 0-1
  size: number;           // percentage of slide width (e.g., 20 = 20%)
  rotation?: number;      // degrees (optional)
}

/**
 * An individual image overlay
 */
export interface ImageOverlay {
  id: string;
  imageUrl: string;       // URL or data URI
  position: { x: number; y: number }; // percentage 0-100
  style: ImageOverlayStyle;
  visible: boolean;
  scope: OverlayScope;
}

/**
 * State for image overlays
 */
export interface ImageOverlayState {
  overlays: ImageOverlay[];
}

/**
 * Default image overlay state
 */
export const DEFAULT_IMAGE_OVERLAY_STATE: ImageOverlayState = {
  overlays: [],
};

/**
 * Default style for new image overlays
 */
export const DEFAULT_IMAGE_OVERLAY_STYLE: ImageOverlayStyle = {
  opacity: 1,
  size: 20,      // 20% of slide width
  rotation: 0,
};

/**
 * Get visible image overlays for a specific slide
 */
export function getVisibleImageOverlays(
  state: ImageOverlayState,
  slideIndex: number,
  elements: FlattenedElement[]
): ImageOverlay[] {
  if (!state?.overlays || !Array.isArray(state.overlays)) return [];

  return state.overlays.filter((overlay) => {
    if (!overlay?.visible) return false;
    return isSlideInScope(overlay.scope, slideIndex, elements);
  });
}

/**
 * Get ALL image overlays for a specific slide (including hidden, for preview)
 */
export function getAllImageOverlaysForSlide(
  state: ImageOverlayState,
  slideIndex: number,
  elements: FlattenedElement[]
): ImageOverlay[] {
  if (!state?.overlays || !Array.isArray(state.overlays)) return [];

  return state.overlays.filter((overlay) => {
    if (!overlay) return false;
    return isSlideInScope(overlay.scope, slideIndex, elements);
  });
}

// ============================================
// VIDEO BACKGROUND
// ============================================

/**
 * Video background settings
 * Controls how the video plays and appears
 */
export interface VideoBackgroundSettings {
  videoUrl: string;
  loop: boolean;          // Default: true
  muted: boolean;         // Default: true
  opacity: number;        // 0-1, default: 0.5
  blur?: number;          // Optional blur in pixels
  fitMode: 'cover' | 'contain';  // Default: 'cover'
}

/**
 * Video background instance
 * Represents a configured video background with scope
 */
export interface VideoBackground {
  id: string;
  settings: VideoBackgroundSettings;
  scope: OverlayScope;    // Reuse existing scope system
  visible: boolean;
}

/**
 * Video background state container
 */
export interface VideoBackgroundState {
  backgrounds: VideoBackground[];
}

/**
 * Default video background state
 */
export const DEFAULT_VIDEO_BACKGROUND_STATE: VideoBackgroundState = {
  backgrounds: [],
};

/**
 * Default settings for a new video background
 */
export const DEFAULT_VIDEO_BACKGROUND_SETTINGS: VideoBackgroundSettings = {
  videoUrl: '',
  loop: true,
  muted: true,
  opacity: 0.5,
  fitMode: 'cover',
};

/**
 * Get the active video background for a specific slide
 * Returns the first matching background based on scope
 */
export function getActiveVideoBackground(
  state: VideoBackgroundState,
  slideIndex: number,
  elements: FlattenedElement[]
): VideoBackground | null {
  if (!state?.backgrounds || !Array.isArray(state.backgrounds)) return null;

  return state.backgrounds.find((bg) => {
    if (!bg?.visible) return false;
    return isSlideInScope(bg.scope, slideIndex, elements);
  }) || null;
}

/**
 * Get ALL video backgrounds for a specific slide (including hidden, for preview)
 */
export function getAllVideoBackgroundsForSlide(
  state: VideoBackgroundState,
  slideIndex: number,
  elements: FlattenedElement[]
): VideoBackground[] {
  if (!state?.backgrounds || !Array.isArray(state.backgrounds)) return [];

  return state.backgrounds.filter((bg) => {
    if (!bg) return false;
    return isSlideInScope(bg.scope, slideIndex, elements);
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
// LIVE STYLE CONTROLS
// ============================================

/**
 * Estilos para fuente de texto
 */
export interface FontStyles {
  family?: string;      // e.g., 'Montserrat', 'Merriweather'
  size?: number;        // in pt (24-72)
  color?: string;       // hex color
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

/**
 * Estilos de fondo de texto
 */
export interface TextBackgroundStyles {
  style: 'none' | 'solid' | 'semi-transparent' | 'gradient';
  color?: string;       // hex color
  opacity?: number;     // 0-100
  padding?: number;     // 8-32 px
}

/**
 * Estilos de fondo de diapositiva
 */
export interface SlideBackgroundStyles {
  overlayOpacity?: number;  // 0-60%
  color?: string;           // hex color for solid background
  gradient?: { from: string; to: string };
}

/**
 * Estilos combinados para una diapositiva
 */
export interface SlideStyles {
  font?: FontStyles;
  textBackground?: TextBackgroundStyles;
  slideBackground?: SlideBackgroundStyles;
}

/**
 * Scope para aplicación de estilos
 */
export type StyleScope = 'slide' | 'element' | 'all';

/**
 * Estado de estilos de la presentación
 * Los estilos se aplican en cascada: global -> element -> slide
 */
export interface StyleState {
  globalStyles: SlideStyles | null;           // Toda la presentación
  elementStyles: Record<string, SlideStyles>; // Por ID de elemento
  slideStyles: Record<string, SlideStyles>;   // Por ID de slide
}

/**
 * Valores por defecto para estilos
 */
export const DEFAULT_SLIDE_STYLES: SlideStyles = {
  font: {
    family: 'Montserrat',
    size: 40,
    color: '#FFFFFF',
    bold: false,
    italic: false,
    align: 'center',
  },
  textBackground: {
    style: 'none',
    color: '#000000',
    opacity: 70,
    padding: 16,
  },
  slideBackground: {
    overlayOpacity: 0,
  },
};

/**
 * Valores por defecto para estado de estilos
 */
export const DEFAULT_STYLE_STATE: StyleState = {
  globalStyles: null,
  elementStyles: {},
  slideStyles: {},
};

/**
 * Colores predefinidos para estilos
 */
export const STYLE_COLORS = {
  // Text colors
  white: '#FFFFFF',
  cream: '#FDF6E3',
  lightGray: '#E0E0E0',
  darkGray: '#333333',
  black: '#000000',
  // Accent colors (from CASA brand)
  amber: '#D4A853',
  warmBrown: '#8B7355',
  sage: '#87A878',
} as const;

/**
 * Opciones de familia de fuentes
 */
export const FONT_FAMILIES = [
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Open Sans', label: 'Open Sans' },
] as const;

/**
 * Resuelve estilos aplicando cascada: global -> element -> slide
 */
export function getResolvedStyles(
  styleState: StyleState,
  slideId: string,
  elementId: string | null
): SlideStyles {
  // Deep clone to prevent mutation of defaults
  const result: SlideStyles = {
    font: { ...DEFAULT_SLIDE_STYLES.font },
    textBackground: { ...DEFAULT_SLIDE_STYLES.textBackground },
    slideBackground: { ...DEFAULT_SLIDE_STYLES.slideBackground },
  };

  // Apply global styles
  if (styleState.globalStyles) {
    mergeStyles(result, styleState.globalStyles);
  }

  // Apply element styles
  if (elementId && styleState.elementStyles[elementId]) {
    mergeStyles(result, styleState.elementStyles[elementId]);
  }

  // Apply slide styles (highest priority)
  if (styleState.slideStyles[slideId]) {
    mergeStyles(result, styleState.slideStyles[slideId]);
  }

  return result;
}

/**
 * Helper para merge de estilos (modifica target)
 * Handles null/undefined source properties safely
 */
function mergeStyles(target: SlideStyles, source: SlideStyles): void {
  if (source.font) {
    target.font = { ...(target.font || {}), ...source.font };
  }
  if (source.textBackground) {
    target.textBackground = { ...(target.textBackground || {}), ...source.textBackground } as SlideStyles['textBackground'];
  }
  if (source.slideBackground) {
    target.slideBackground = { ...(target.slideBackground || {}), ...source.slideBackground };
  }
}

// ============================================
// ESTADO DE PRESENTACIÓN
// ============================================

/**
 * Payload para el mensaje PUBLISH
 * Contiene todo el estado que debe sincronizarse al output
 */
export interface PublishPayload {
  slideIndex: number;
  overlays: TextOverlay[];
  imageOverlays: ImageOverlay[];
  logoState: LogoState;
  tempEdits: Record<string, TempSlideEdit>;
  styleState?: StyleState;
  videoBackgroundState?: VideoBackgroundState;
}

/**
 * Estado completo de la presentación
 * SISTEMA PREVIEW/PUBLISH:
 * - previewSlideIndex: slide que el operador está viendo/navegando
 * - liveSlideIndex: slide que está en el output
 * - hasUnpublishedChanges: indicador visual cuando preview ≠ live
 */
export interface PresentationState {
  data: PresentationData | null;
  // Preview state (what operator sees/navigates)
  previewSlideIndex: number;
  previewElementIndex: number;
  // Live state (what's on output)
  liveSlideIndex: number;
  liveElementIndex: number;
  // Control flags
  isLive: boolean;
  isBlack: boolean;
  hasUnpublishedChanges: boolean;
  previewOverlays: boolean; // muestra overlays en OutputView sin estar live
  followMode: boolean; // When true, navigation auto-syncs to output when live
  lowerThird: LowerThirdState;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  imageOverlayState: ImageOverlayState;
  videoBackgroundState: VideoBackgroundState;
  tempEdits: Record<string, TempSlideEdit>; // slideId -> edits temporales
  // Live style overrides (cascading: global -> element -> slide)
  styleState: StyleState;
  // Live copies of overlay states (what's actually on output)
  liveTempEdits: Record<string, TempSlideEdit>;
  liveLogoState: LogoState;
  liveTextOverlayState: TextOverlayState;
  liveImageOverlayState: ImageOverlayState;
  liveVideoBackgroundState: VideoBackgroundState;
  liveStyleState: StyleState;
}

/**
 * Mensajes de sincronización entre ventanas
 * SISTEMA PREVIEW/PUBLISH:
 * - SLIDE_CHANGE ya no actualiza el output, solo preview
 * - PUBLISH es el nuevo mensaje para sincronizar cambios al output
 */
export type SyncMessage =
  | { type: 'SLIDE_CHANGE'; slideIndex: number } // Preview only - does NOT update output
  | { type: 'PUBLISH'; payload: PublishPayload } // NEW: Staged publish to output
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
  | { type: 'IMAGE_OVERLAYS_UPDATE'; imageOverlayState: ImageOverlayState }
  | { type: 'VIDEO_BACKGROUND_UPDATE'; videoBackgroundState: VideoBackgroundState }
  | { type: 'STYLES_UPDATE'; styleState: StyleState }
  | { type: 'PREVIEW_OVERLAYS'; enabled: boolean }
  // Video control messages
  | { type: 'VIDEO_PLAY'; slideId: string }
  | { type: 'VIDEO_PAUSE'; slideId: string }
  | { type: 'VIDEO_SEEK'; slideId: string; time: number }
  | { type: 'VIDEO_MUTE'; slideId: string; muted: boolean };

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
 * SISTEMA PREVIEW/PUBLISH:
 * - preview y live empiezan sincronizados
 * - hasUnpublishedChanges empieza en false
 */
export const INITIAL_PRESENTATION_STATE: PresentationState = {
  data: null,
  // Preview state
  previewSlideIndex: 0,
  previewElementIndex: 0,
  // Live state
  liveSlideIndex: 0,
  liveElementIndex: 0,
  // Control flags
  isLive: false,
  isBlack: false,
  hasUnpublishedChanges: false,
  previewOverlays: false,
  followMode: true, // Default ON - navigation auto-syncs when live
  lowerThird: {
    visible: false,
    message: '',
    duration: 10000, // 10 segundos por defecto
  },
  logoState: DEFAULT_LOGO_STATE,
  textOverlayState: DEFAULT_TEXT_OVERLAY_STATE,
  imageOverlayState: DEFAULT_IMAGE_OVERLAY_STATE,
  videoBackgroundState: DEFAULT_VIDEO_BACKGROUND_STATE,
  tempEdits: {},
  styleState: DEFAULT_STYLE_STATE,
  // Live copies
  liveTempEdits: {},
  liveLogoState: DEFAULT_LOGO_STATE,
  liveTextOverlayState: DEFAULT_TEXT_OVERLAY_STATE,
  liveImageOverlayState: DEFAULT_IMAGE_OVERLAY_STATE,
  liveVideoBackgroundState: DEFAULT_VIDEO_BACKGROUND_STATE,
  liveStyleState: DEFAULT_STYLE_STATE,
};

// ============================================
// EXPORT/IMPORT TYPES
// ============================================

/**
 * Formato de exportación de presentación
 * Permite backup, transferencia entre dispositivos, y compartir con otras iglesias
 */
export interface PresentationExport {
  // Metadata
  version: string;         // "1.0" - para compatibilidad futura
  exportedAt: string;      // ISO timestamp
  exportedBy?: string;     // Nombre del usuario (opcional)

  // Información de la liturgia fuente (para referencia, no requerida para importar)
  liturgy: {
    id: string;
    title: string;
    date?: string;
  };

  // Estado de la presentación
  state: {
    tempSlides: Slide[];                        // Slides temporales con imágenes como data URLs
    styleState: StyleState;                     // Configuración de estilos
    logoState: LogoState;                       // Configuración del logo
    textOverlayState: TextOverlayState;         // Superposiciones de texto
    imageOverlayState: ImageOverlayState;       // Superposiciones de imagen
    tempEdits: Record<string, TempSlideEdit>;   // Ediciones temporales
  };

  // Opcional: incluir todos los slides para visualización standalone
  includeFullSlides?: boolean;
  fullSlides?: Slide[];
}

/**
 * Resultado de validar un archivo de importación
 */
export interface ImportValidationResult {
  importData: PresentationExport;
  liturgyMatches: boolean;
  liturgyTitle: string;
}

/**
 * Versión actual del formato de exportación
 */
export const EXPORT_VERSION = '1.0';

/**
 * Verifica compatibilidad de versión
 */
export function isVersionCompatible(version: string): boolean {
  const [major] = version.split('.').map(Number);
  // Acepta versión 1.x
  return major === 1;
}

// ============================================
// PRESENTATION SESSIONS
// ============================================

/**
 * Current version of the session state schema.
 * Increment when making breaking changes to PresentationSessionState.
 */
export const SESSION_STATE_VERSION = '1.0';

/**
 * Estado snapshot de una sesión de presentación
 * Contiene todo el estado necesario para restaurar una presentación
 */
export interface PresentationSessionState {
  version: string;
  tempSlides: Slide[];
  styleState: StyleState;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  imageOverlayState: ImageOverlayState;
  tempEdits: Record<string, TempSlideEdit>;
  previewSlideIndex: number;
  liveSlideIndex: number;
}

/**
 * Sesión de presentación completa (como viene de la DB)
 */
export interface PresentationSession {
  id: string;
  liturgyId: string;
  name: string;
  description?: string;
  state: PresentationSessionState;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  serviceDate?: string;
  isArchived: boolean;
}

/**
 * Resumen de sesión para listados (sin el state completo)
 */
export interface PresentationSessionSummary {
  id: string;
  name: string;
  description?: string;
  liturgyId: string;
  liturgyTitle: string;
  createdByName: string;
  createdAt: string;
  serviceDate?: string;
}

/**
 * Datos para crear una nueva sesión
 */
export interface CreateSessionData {
  liturgyId: string;
  name: string;
  description?: string;
  serviceDate?: string;
  state: PresentationSessionState;
}
