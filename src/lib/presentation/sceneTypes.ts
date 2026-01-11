/**
 * Scene/Look/Prop types for the CASA presentation system
 * Enables element-specific visual configurations with auto/armed triggers
 */

import type { LiturgyElementType } from '@/types/shared/liturgy';
import type { TextOverlayStyle, LogoSettings, LowerThirdTemplate } from './types';

// =============================================================================
// PROP TYPES
// =============================================================================

/**
 * Prop trigger behavior
 * - 'auto': Shows immediately when entering scene
 * - 'armed': Added to armed list, presenter clicks to show
 */
export type PropTrigger = 'auto' | 'armed';

/**
 * Prop visual types - correspond to existing overlay systems
 */
export type PropType = 'text-overlay' | 'lower-third' | 'logo-variation';

/**
 * Text overlay prop configuration
 * Content may contain {{placeholders}} for dynamic resolution
 */
export interface TextOverlayPropConfig {
  type: 'text-overlay';
  content: string;
  position: { x: number; y: number };
  style: TextOverlayStyle;
}

/**
 * Lower-third prop configuration
 * Message may contain {{placeholders}} for dynamic resolution
 */
export interface LowerThirdPropConfig {
  type: 'lower-third';
  message: string;
  duration?: number;
  template?: LowerThirdTemplate;
}

/**
 * Logo variation prop configuration
 * Partial settings merge with global logo state
 */
export interface LogoVariationConfig {
  type: 'logo-variation';
  settings: Partial<LogoSettings>;
}

/**
 * Union type for prop configurations
 */
export type PropConfig = TextOverlayPropConfig | LowerThirdPropConfig | LogoVariationConfig;

/**
 * A Prop is a visual element within a Look
 * Wraps existing overlay types with trigger behavior and naming
 */
export interface Prop {
  id: string;
  type: PropType;
  trigger: PropTrigger;
  name: string; // Display name in props panel (e.g., "Datos Bancarios")
  config: PropConfig;
}

// =============================================================================
// LOOK TYPES
// =============================================================================

/**
 * A Look defines the visual configuration for a scene (element)
 * Contains a collection of props that appear when entering the scene
 */
export interface Look {
  id: string;
  name: string;
  props: Prop[];
}

/**
 * Scene Template - reusable Look per element type
 * Default templates provide baseline configurations
 */
export interface SceneTemplate {
  id: string;
  name: string;
  elementType: LiturgyElementType;
  look: Look;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Per-element Look override stored with liturgy
 * Allows customizing the Look for a specific element instance
 */
export interface ElementLookOverride {
  elementId: string;
  lookOverride: Partial<Look>;
}

// =============================================================================
// PLACEHOLDER TYPES
// =============================================================================

/**
 * Available placeholder keys for dynamic content
 */
export type PlaceholderKey =
  | 'songTitle'
  | 'songArtist'
  | 'scriptureReference'
  | 'elementTitle'
  | 'date'
  | 'celebrant'
  | 'preacher';

/**
 * Context for resolving placeholders
 * Built from current element and liturgy context
 */
export interface PlaceholderContext {
  // From current element
  elementTitle?: string;
  elementType?: LiturgyElementType;

  // From song (if element is a song type)
  songTitle?: string;
  songArtist?: string;

  // From reading (if element is a reading type)
  scriptureReference?: string;

  // From liturgy context
  date?: Date;
  celebrant?: string;
  preacher?: string;
}

// =============================================================================
// SCENE STATE TYPES
// =============================================================================

/**
 * Runtime state for active and armed props
 */
export interface PropRuntimeState {
  activeProps: string[];  // Currently visible prop IDs
  armedProps: string[];   // Armed and ready to show
}

/**
 * Complete scene state for presentation
 */
export interface SceneState {
  currentElementId: string | null;
  currentLook: Look | null;
  activeProps: string[];
  armedProps: string[];
  placeholderContext: PlaceholderContext;
}

/**
 * Initial/empty scene state
 */
export const INITIAL_SCENE_STATE: SceneState = {
  currentElementId: null,
  currentLook: null,
  activeProps: [],
  armedProps: [],
  placeholderContext: {},
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a prop type is text-overlay
 */
export function isTextOverlayProp(config: PropConfig): config is TextOverlayPropConfig {
  return config.type === 'text-overlay';
}

/**
 * Check if a prop type is lower-third
 */
export function isLowerThirdProp(config: PropConfig): config is LowerThirdPropConfig {
  return config.type === 'lower-third';
}

/**
 * Check if a prop type is logo-variation
 */
export function isLogoVariationProp(config: PropConfig): config is LogoVariationConfig {
  return config.type === 'logo-variation';
}

/**
 * Get props by trigger type
 */
export function getPropsByTrigger(look: Look, trigger: PropTrigger): Prop[] {
  return look.props.filter(prop => prop.trigger === trigger);
}

/**
 * Get auto-trigger props from a Look
 */
export function getAutoProps(look: Look): Prop[] {
  return getPropsByTrigger(look, 'auto');
}

/**
 * Get armed props from a Look
 */
export function getArmedProps(look: Look): Prop[] {
  return getPropsByTrigger(look, 'armed');
}
