/**
 * Scene Service - Look resolution, placeholder resolution, and template management
 */

import type { LiturgyElementType } from '@/types/shared/liturgy';
import type {
  Look,
  SceneTemplate,
  PlaceholderContext,
  PlaceholderKey,
  Prop,
  PropConfig,
  TextOverlayPropConfig,
  LowerThirdPropConfig,
} from './sceneTypes';
import { getDefaultTemplate, hasDefaultTemplate } from './defaultTemplates';
import type { FlattenedElement } from './types';

// =============================================================================
// PLACEHOLDER RESOLUTION
// =============================================================================

/**
 * Resolve all {{placeholders}} in a string using the provided context
 */
export function resolvePlaceholders(
  template: string,
  context: PlaceholderContext
): string {
  const placeholderResolvers: Record<PlaceholderKey, () => string> = {
    songTitle: () => context.songTitle || '',
    songArtist: () => context.songArtist || '',
    scriptureReference: () => context.scriptureReference || '',
    elementTitle: () => context.elementTitle || '',
    date: () =>
      context.date
        ? context.date.toLocaleDateString('es-CL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : '',
    celebrant: () => context.celebrant || '',
    preacher: () => context.preacher || '',
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const resolver = placeholderResolvers[key as PlaceholderKey];
    return resolver ? resolver() : match;
  });
}

/**
 * Resolve placeholders in a prop config
 */
export function resolvePropPlaceholders(
  config: PropConfig,
  context: PlaceholderContext
): PropConfig {
  if (config.type === 'text-overlay') {
    return {
      ...config,
      content: resolvePlaceholders(config.content, context),
    } as TextOverlayPropConfig;
  }

  if (config.type === 'lower-third') {
    return {
      ...config,
      message: resolvePlaceholders(config.message, context),
    } as LowerThirdPropConfig;
  }

  // Logo variations don't have placeholder content
  return config;
}

/**
 * Resolve all placeholders in a prop
 */
export function resolveFullProp(prop: Prop, context: PlaceholderContext): Prop {
  return {
    ...prop,
    config: resolvePropPlaceholders(prop.config, context),
  };
}

/**
 * Resolve all placeholders in a Look's props
 */
export function resolveLookPlaceholders(
  look: Look,
  context: PlaceholderContext
): Look {
  return {
    ...look,
    props: look.props.map((prop) => resolveFullProp(prop, context)),
  };
}

// =============================================================================
// CONTEXT BUILDING
// =============================================================================

/**
 * Build placeholder context from current element and liturgy data
 */
export function buildPlaceholderContext(
  element: FlattenedElement,
  liturgyDate: Date,
  metadata?: {
    songTitle?: string;
    songArtist?: string;
    scriptureReference?: string;
    celebrant?: string;
    preacher?: string;
  }
): PlaceholderContext {
  return {
    elementTitle: element.title,
    elementType: element.type,
    date: liturgyDate,
    songTitle: metadata?.songTitle,
    songArtist: metadata?.songArtist,
    scriptureReference: metadata?.scriptureReference,
    celebrant: metadata?.celebrant,
    preacher: metadata?.preacher,
  };
}

// =============================================================================
// LOOK RESOLUTION
// =============================================================================

/**
 * Resolve the Look for an element
 * Resolution order: override > template > global default > empty
 *
 * @param elementType - The element type (e.g., 'ofrenda', 'cancion-invocacion')
 * @param override - Optional per-element override
 * @returns The resolved Look
 */
export function resolveLookForElement(
  elementType: LiturgyElementType,
  override?: Partial<Look> | null
): Look | null {
  // First check for element-specific override
  if (override) {
    const defaultLook = getDefaultTemplate(elementType)?.look;
    if (defaultLook) {
      return {
        ...defaultLook,
        ...override,
        props: override.props ?? defaultLook.props,
      };
    }
    // If no default template but we have an override, use it as-is
    if (override.id && override.name && override.props) {
      return override as Look;
    }
  }

  // Fall back to default template for element type
  const template = getDefaultTemplate(elementType);
  if (template) {
    return template.look;
  }

  // No Look for this element type
  return null;
}

/**
 * Check if an element type has any scene configuration
 */
export function hasSceneConfig(elementType: LiturgyElementType): boolean {
  return hasDefaultTemplate(elementType);
}

// =============================================================================
// TEMPLATE STORAGE (localStorage for now)
// =============================================================================

const TEMPLATES_STORAGE_KEY = 'casa-presentation-scene-templates';

/**
 * Get custom templates from localStorage
 */
export function getCustomTemplates(): SceneTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as SceneTemplate[];
  } catch (error) {
    console.error('Error loading custom templates:', error);
    return [];
  }
}

/**
 * Save custom templates to localStorage
 */
export function saveCustomTemplates(templates: SceneTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Error saving custom templates:', error);
  }
}

/**
 * Add or update a custom template
 */
export function saveCustomTemplate(template: SceneTemplate): void {
  const templates = getCustomTemplates();
  const existingIndex = templates.findIndex((t) => t.id === template.id);

  if (existingIndex >= 0) {
    templates[existingIndex] = {
      ...template,
      updatedAt: new Date().toISOString(),
    };
  } else {
    templates.push({
      ...template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  saveCustomTemplates(templates);
}

/**
 * Delete a custom template
 */
export function deleteCustomTemplate(templateId: string): void {
  const templates = getCustomTemplates().filter((t) => t.id !== templateId);
  saveCustomTemplates(templates);
}

/**
 * Get all templates for an element type (default + custom)
 */
export function getTemplatesForElementType(
  elementType: LiturgyElementType
): SceneTemplate[] {
  const templates: SceneTemplate[] = [];

  // Add default template if exists
  const defaultTemplate = getDefaultTemplate(elementType);
  if (defaultTemplate) {
    templates.push(defaultTemplate);
  }

  // Add custom templates for this element type
  const customTemplates = getCustomTemplates().filter(
    (t) => t.elementType === elementType
  );
  templates.push(...customTemplates);

  return templates;
}
