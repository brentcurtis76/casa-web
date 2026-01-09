/**
 * Tipos para el sistema de canciones CASA
 */

/**
 * Tipo de verso/sección de una canción
 */
export type VerseType = 'verse' | 'chorus' | 'bridge' | 'outro' | 'intro';

/**
 * Verso individual de una canción
 */
export interface Verse {
  number: number;
  type: VerseType;
  content: string;
}

/**
 * Tempo/velocidad de la canción
 */
export type SongTempo = 'lenta' | 'intermedia' | 'rápida';

/**
 * Momentos sugeridos para usar la canción en la liturgia
 */
export type LiturgicalMoment =
  | 'himno-entrada'
  | 'himno-gloria'
  | 'cancion-meditacion'
  | 'himno-salida'
  | 'comunion'
  | 'ofrenda'
  | 'adoracion'
  | 'reflexion';

/**
 * Temas espirituales de la canción
 */
export type SongTheme =
  | 'alabanza'
  | 'adoracion'
  | 'arrepentimiento'
  | 'esperanza'
  | 'fe'
  | 'amor'
  | 'gracia'
  | 'paz'
  | 'gozo'
  | 'comunidad'
  | 'servicio'
  | 'navidad'
  | 'semana-santa'
  | 'pascua'
  | 'pentecostes'
  | 'adviento'
  | 'cuaresma';

/**
 * Registro de uso de la canción
 */
export interface SongUsageRecord {
  date: string;          // ISO date string
  liturgyId?: string;    // ID de la liturgia donde se usó
  moment: LiturgicalMoment;
}

/**
 * Sistema de tags extendido para canciones
 */
export interface SongTags {
  tempo?: SongTempo;
  themes: SongTheme[];
  suggestedMoments: LiturgicalMoment[];
  usageHistory: SongUsageRecord[];
  lastUsed?: string;     // ISO date string
  usageCount: number;
}

/**
 * Metadata de una canción
 */
export interface SongMetadata {
  verseCount: number;
  hasChorus?: boolean;
  estimatedDuration?: string;
  tags?: string[];       // Deprecated: usar SongTags.themes
  isCustom?: boolean;
  addedAt?: string;
  addedBy?: string;
  source?: 'pdf' | 'manual';
  extractedAt?: string;
}

/**
 * Canción completa
 */
export interface Song {
  id: string;
  number: number;
  title: string;
  artist?: string;
  slug: string;
  startPage?: number;
  endPage?: number;
  verses: Verse[];
  metadata: SongMetadata;
  songTags?: SongTags;      // Sistema de tags extendido
}

/**
 * Entrada del índice de canciones (versión resumida)
 */
export interface SongIndexEntry {
  id: string;
  number: number;
  title: string;
  slug: string;
  verseCount: number;
  artist?: string;
}

/**
 * Índice completo de canciones
 */
export interface SongIndex {
  total: number;
  generatedAt: string;
  source: string;
  songs: SongIndexEntry[];
}

/**
 * Contenido de un slide generado
 */
export interface SlideContent {
  slideNumber: number;
  type: 'title' | 'lyrics';
  content: string;
  lines: string[];
}

/**
 * Presentación de una canción (slides generados)
 */
export interface SongPresentation {
  songId: string;
  title: string;
  slides: SlideContent[];
  totalSlides: number;
}

/**
 * Input para crear una nueva canción
 */
export interface NewSongInput {
  title: string;
  artist?: string;
  lyrics: string;
  linesPerSlide: number;
  tags?: string[];
}

/**
 * Acción de edición de slide
 */
export interface SlideEditAction {
  type: 'edit' | 'split' | 'merge' | 'delete' | 'reorder' | 'add';
  slideIndex: number;
  payload?: unknown;
}

/**
 * Resultado de validación
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Filtros para búsqueda de canciones
 */
export interface SongFilters {
  query?: string;
  tags?: string[];
  source?: 'pdf' | 'manual' | 'all';
  hasChorus?: boolean;
}
