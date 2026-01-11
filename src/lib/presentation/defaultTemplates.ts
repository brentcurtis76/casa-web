/**
 * Default Scene Templates for CASA Presentation System
 * Provides baseline Look configurations per element type
 */

import type { LiturgyElementType } from '@/types/shared/liturgy';
import type { SceneTemplate, Look, Prop } from './sceneTypes';
import type { TextOverlayStyle } from './types';

// =============================================================================
// COMMON PROP STYLES
// =============================================================================

const SONG_TITLE_STYLE: TextOverlayStyle = {
  font: 'heading',
  size: 'lg',
  color: 'primary-white',
  backgroundColor: 'primary-black',
  backgroundOpacity: 0.6,
  align: 'center',
  bold: false,
  italic: false,
};

const SONG_ARTIST_STYLE: TextOverlayStyle = {
  font: 'body',
  size: 'md',
  color: 'secondary-gray',
  backgroundColor: 'none',
  align: 'center',
  bold: false,
  italic: true,
};

const SCRIPTURE_REF_STYLE: TextOverlayStyle = {
  font: 'body',
  size: 'md',
  color: 'primary-amber',
  backgroundColor: 'primary-black',
  backgroundOpacity: 0.7,
  align: 'center',
  bold: true,
  italic: false,
};

const BANK_INFO_STYLE: TextOverlayStyle = {
  font: 'body',
  size: 'sm',
  color: 'primary-white',
  backgroundColor: 'secondary-carbon',
  backgroundOpacity: 0.9,
  align: 'left',
  bold: false,
  italic: false,
};

// =============================================================================
// DEFAULT TEMPLATES
// =============================================================================

/**
 * Ofrenda Template - Shows bank info automatically
 */
const ofrendaTemplate: SceneTemplate = {
  id: 'default-ofrenda',
  name: 'Ofrenda (Default)',
  elementType: 'ofrenda',
  look: {
    id: 'look-ofrenda-default',
    name: 'Datos Bancarios',
    props: [
      {
        id: 'prop-bank-info',
        type: 'lower-third',
        trigger: 'auto',
        name: 'Datos Bancarios',
        config: {
          type: 'lower-third',
          message: 'Banco Estado | Cta Cte: 123456789 | RUT: 65.XXX.XXX-X | CASA San Andres',
          duration: 0, // No auto-hide
          template: 'custom',
        },
      },
    ],
  },
  isDefault: true,
};

/**
 * Song Templates - Show song title (armed, presenter decides when)
 */
const createSongTemplate = (
  elementType: LiturgyElementType,
  displayName: string
): SceneTemplate => ({
  id: `default-${elementType}`,
  name: `${displayName} (Default)`,
  elementType,
  look: {
    id: `look-${elementType}-default`,
    name: displayName,
    props: [
      {
        id: `prop-song-title-${elementType}`,
        type: 'text-overlay',
        trigger: 'armed',
        name: 'Titulo de Cancion',
        config: {
          type: 'text-overlay',
          content: '{{songTitle}}',
          position: { x: 50, y: 85 },
          style: SONG_TITLE_STYLE,
        },
      },
      {
        id: `prop-song-artist-${elementType}`,
        type: 'text-overlay',
        trigger: 'armed',
        name: 'Artista',
        config: {
          type: 'text-overlay',
          content: '{{songArtist}}',
          position: { x: 50, y: 92 },
          style: SONG_ARTIST_STYLE,
        },
      },
    ],
  },
  isDefault: true,
});

const cancionInvocacionTemplate = createSongTemplate('cancion-invocacion', 'Cancion de Invocacion');
const cancionArrepentimientoTemplate = createSongTemplate('cancion-arrepentimiento', 'Cancion de Arrepentimiento');
const cancionGratitudTemplate = createSongTemplate('cancion-gratitud', 'Cancion de Gratitud');
const cancionSantaCenaTemplate = createSongTemplate('cancion-santa-cena', 'Cancion de Santa Cena');

/**
 * Lectura Biblica Template - Shows scripture reference
 */
const lecturaBiblicaTemplate: SceneTemplate = {
  id: 'default-lectura-biblica',
  name: 'Lectura Biblica (Default)',
  elementType: 'lectura-biblica',
  look: {
    id: 'look-lectura-default',
    name: 'Referencia Biblica',
    props: [
      {
        id: 'prop-scripture-ref',
        type: 'text-overlay',
        trigger: 'auto',
        name: 'Cita Biblica',
        config: {
          type: 'text-overlay',
          content: '{{scriptureReference}}',
          position: { x: 50, y: 10 },
          style: SCRIPTURE_REF_STYLE,
        },
      },
    ],
  },
  isDefault: true,
};

/**
 * Portada Principal Template - Clean, just logo
 */
const portadaPrincipalTemplate: SceneTemplate = {
  id: 'default-portada-principal',
  name: 'Portada Principal (Default)',
  elementType: 'portada-principal',
  look: {
    id: 'look-portada-default',
    name: 'Portada Limpia',
    props: [
      {
        id: 'prop-logo-visible',
        type: 'logo-variation',
        trigger: 'auto',
        name: 'Logo Visible',
        config: {
          type: 'logo-variation',
          settings: {
            visible: true,
            size: 15,
            position: { x: 85, y: 85 },
          },
        },
      },
    ],
  },
  isDefault: true,
};

/**
 * Bendicion Template - Element title shown
 */
const bendicionTemplate: SceneTemplate = {
  id: 'default-bendicion',
  name: 'Bendicion (Default)',
  elementType: 'bendicion',
  look: {
    id: 'look-bendicion-default',
    name: 'Bendicion Final',
    props: [
      {
        id: 'prop-bendicion-title',
        type: 'text-overlay',
        trigger: 'armed',
        name: 'Titulo',
        config: {
          type: 'text-overlay',
          content: '{{elementTitle}}',
          position: { x: 50, y: 10 },
          style: {
            font: 'heading',
            size: 'lg',
            color: 'primary-amber',
            backgroundColor: 'none',
            align: 'center',
            bold: false,
            italic: false,
          },
        },
      },
    ],
  },
  isDefault: true,
};

/**
 * Anuncios Template - No auto props, presenter controls manually
 */
const anunciosTemplate: SceneTemplate = {
  id: 'default-anuncios',
  name: 'Anuncios (Default)',
  elementType: 'anuncios',
  look: {
    id: 'look-anuncios-default',
    name: 'Anuncios',
    props: [], // No auto props for announcements
  },
  isDefault: true,
};

// =============================================================================
// TEMPLATE REGISTRY
// =============================================================================

/**
 * Map of element types to their default templates
 */
const DEFAULT_TEMPLATES: Partial<Record<LiturgyElementType, SceneTemplate>> = {
  'ofrenda': ofrendaTemplate,
  'cancion-invocacion': cancionInvocacionTemplate,
  'cancion-arrepentimiento': cancionArrepentimientoTemplate,
  'cancion-gratitud': cancionGratitudTemplate,
  'cancion-santa-cena': cancionSantaCenaTemplate,
  'lectura-biblica': lecturaBiblicaTemplate,
  'portada-principal': portadaPrincipalTemplate,
  'bendicion': bendicionTemplate,
  'anuncios': anunciosTemplate,
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get the default template for an element type
 */
export function getDefaultTemplate(elementType: LiturgyElementType): SceneTemplate | null {
  return DEFAULT_TEMPLATES[elementType] ?? null;
}

/**
 * Check if an element type has a default template
 */
export function hasDefaultTemplate(elementType: LiturgyElementType): boolean {
  return elementType in DEFAULT_TEMPLATES;
}

/**
 * Get all default templates
 */
export function getAllDefaultTemplates(): SceneTemplate[] {
  return Object.values(DEFAULT_TEMPLATES).filter((t): t is SceneTemplate => t !== undefined);
}

/**
 * Get the default Look for an element type
 */
export function getDefaultLook(elementType: LiturgyElementType): Look | null {
  const template = getDefaultTemplate(elementType);
  return template?.look ?? null;
}

/**
 * Get element types that have default templates
 */
export function getElementTypesWithTemplates(): LiturgyElementType[] {
  return Object.keys(DEFAULT_TEMPLATES) as LiturgyElementType[];
}
