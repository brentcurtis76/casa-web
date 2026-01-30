/**
 * Tipos compartidos para el sistema de liturgias CASA
 * Define la estructura del Contexto Transversal y la Liturgia completa
 */

import type { SlideGroup } from './slide';
import type { PresentationTheme } from '@/lib/presentation/themes';

/**
 * Contexto Transversal - Información compartida por todos los componentes de la liturgia
 */
export interface LiturgyContext {
  id: string;
  date: Date;
  title: string;                    // Título de la reflexión (ej: "El amor que transforma")
  readings: LiturgyReading[];       // Lecturas bíblicas
  summary: string;                  // Resumen/enfoque temático
  celebrant?: string;               // Nombre del celebrante (opcional)
  preacher?: string;                // Nombre del predicador (opcional)
  reflexionText?: string;           // Texto completo extraído del PDF de reflexión
  createdAt: string;
  updatedAt: string;
}

/**
 * Lectura bíblica para el contexto
 */
export interface LiturgyReading {
  reference: string;                // Ej: "Juan 3:16-21"
  text: string;                     // Texto completo de la lectura
  version: string;                  // Versión de la Biblia (NVI, RV1960, etc.)
  versionCode: string;              // Código corto de la versión
}

/**
 * Tipos de elementos que pueden aparecer en una liturgia
 */
export type LiturgyElementType =
  | 'portada-principal'        // 1. Portada principal
  | 'oracion-invocacion'       // 2. Oración de invocación
  | 'cancion-invocacion'       // 3. Primera canción - Invocación (tempo: rápida)
  | 'oracion-arrepentimiento'  // 4. Oración de arrepentimiento
  | 'cancion-arrepentimiento'  // 5. Segunda canción - Arrepentimiento (tempo: intermedia)
  | 'oracion-gratitud'         // 6. Oración de gratitud
  | 'cancion-gratitud'         // 7. Tercera canción - Gratitud (tempo: lenta)
  | 'lectura-biblica'          // 8. Lectura bíblica
  | 'cuentacuentos'            // 9. Cuentacuentos (opcional)
  | 'portada-reflexion'        // 10. Portada de reflexión
  | 'padre-nuestro'            // 11. Padre Nuestro (fijo)
  | 'paz'                      // 12. La paz (fijo)
  | 'santa-cena'               // 13. Santa Cena (fijo)
  | 'accion-gracias'           // 14. Acción de Gracias (fijo)
  | 'cancion-santa-cena'       // 15. Cuarta canción - Santa Cena (tempo: lenta)
  | 'ofrenda'                  // 16. Ofrenda (fijo)
  | 'anuncios'                 // 17. Anuncios (opcional)
  | 'bendicion'                // 18. Bendición final (fijo)

/**
 * Un elemento individual dentro de la liturgia
 */
export interface LiturgyElement {
  id: string;
  type: LiturgyElementType;
  order: number;                    // Posición en el orden de la liturgia
  title: string;                    // Título del elemento
  status: LiturgyElementStatus;     // Estado de completitud
  slides?: SlideGroup;              // Slides generados para este elemento
  config?: Record<string, unknown>; // Configuración específica del elemento
  sourceId?: string;                // ID de la canción/oración/etc. seleccionada
  customContent?: string;           // Contenido personalizado (para oraciones manuales)
  editedSlides?: SlideGroup;        // Slides editados para esta liturgia específica (elementos fijos)
}

/**
 * Liturgia completa con todos sus elementos
 */
export interface Liturgy {
  id: string;
  context: LiturgyContext;
  elements: LiturgyElement[];
  status: LiturgyStatus;
  templateId?: string;                // Which template was used (defaults to 'domingo')
  theme?: PresentationTheme;          // Theme for this liturgy (defaults to 'light')
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    lastEditedBy?: string;
  };
}

/**
 * Estados posibles de una liturgia
 */
export type LiturgyStatus = 'draft' | 'in-progress' | 'ready' | 'archived';

/**
 * Configuración de ilustración para portadas
 */
export interface IllustrationConfig {
  opacity: number;      // 0-100
  scale: number;        // 50-200 (percentage)
  positionX: number;    // -50 to 50 (percentage offset from center)
  positionY: number;    // -50 to 50 (percentage offset from center)
}

/**
 * Alineación de elementos
 */
export type LayoutAlignment = 'left' | 'right';

/**
 * Configuración completa de portadas
 */
export interface PortadasConfig {
  illustrationConfig: IllustrationConfig;
  logoAlignment: LayoutAlignment;
  textAlignment: LayoutAlignment;
  titleBreakAfterWord: number | null;
}

/**
 * Configuración de portada (legacy)
 */
export interface CoverConfig {
  type: 'main' | 'reflection';
  showDate: boolean;
  showTitle: boolean;
  illustrationStyle?: string;       // ID del estilo de ilustración
  customIllustrationUrl?: string;   // URL de ilustración personalizada
}

/**
 * Configuración de anuncio
 */
export interface AnnouncementConfig {
  title: string;
  content: string;
  date?: string;                    // Fecha del evento anunciado
  location?: string;                // Lugar del evento
  presenter?: string;               // Quién da el anuncio
  link?: string;                    // Link opcional
  imageUrl?: string;                // Imagen opcional
  priority: 'low' | 'medium' | 'high';
}

/**
 * Input para crear un nuevo contexto de liturgia
 */
export interface LiturgyContextInput {
  date: Date;
  title: string;
  summary: string;
  readings: Array<{
    reference: string;
    text?: string;
    version?: string;
  }>;
  celebrant?: string;
  preacher?: string;
  reflexionText?: string;           // Texto completo extraído del PDF de reflexión
  originalPdfFile?: File;           // Archivo PDF original para publicación
  publishReflexion?: boolean;       // Si se debe publicar la reflexión en home
}

/**
 * Estado de completitud de un elemento en la liturgia
 */
export type LiturgyElementStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

/**
 * Categoría de elemento litúrgico
 */
export type LiturgyElementCategory = 'portada' | 'oracion' | 'cancion' | 'lectura' | 'fijo' | 'otro';

/**
 * Definición extendida de elemento del orden litúrgico
 */
export interface LiturgyOrderElement {
  type: LiturgyElementType;
  label: string;
  required: boolean;
  category: LiturgyElementCategory;
  defaultTempo?: 'lenta' | 'intermedia' | 'rápida';  // Para canciones
  fixedElementFile?: string;  // Para elementos fijos: nombre del archivo JSON
}

/**
 * Orden estándar de la liturgia CASA (18 elementos)
 * Actualizado según nueva estructura aprobada
 */
export const LITURGY_ORDER: LiturgyOrderElement[] = [
  // 1. Portada Principal
  { type: 'portada-principal', label: 'Portada Principal', required: true, category: 'portada' },

  // 2. Oración de Invocación (generada con IA o manual)
  { type: 'oracion-invocacion', label: 'Oración de Invocación', required: true, category: 'oracion' },

  // 3. Primera canción - Invocación (tempo: rápida)
  { type: 'cancion-invocacion', label: 'Primera canción - Invocación', required: true, category: 'cancion', defaultTempo: 'rápida' },

  // 4. Oración de Arrepentimiento (generada con IA o manual)
  { type: 'oracion-arrepentimiento', label: 'Oración de Arrepentimiento', required: true, category: 'oracion' },

  // 5. Segunda canción - Arrepentimiento (tempo: intermedia)
  { type: 'cancion-arrepentimiento', label: 'Segunda canción - Arrepentimiento', required: true, category: 'cancion', defaultTempo: 'intermedia' },

  // 6. Oración de Gratitud (generada con IA o manual)
  { type: 'oracion-gratitud', label: 'Oración de Gratitud', required: true, category: 'oracion' },

  // 7. Tercera canción - Gratitud (tempo: lenta)
  { type: 'cancion-gratitud', label: 'Tercera canción - Gratitud', required: true, category: 'cancion', defaultTempo: 'lenta' },

  // 8. Lectura Bíblica (desde contexto)
  { type: 'lectura-biblica', label: 'Lectura Bíblica', required: true, category: 'lectura' },

  // 9. Cuentacuento (opcional)
  { type: 'cuentacuentos', label: 'Cuentacuento', required: false, category: 'otro' },

  // 10. Portada de Reflexión
  { type: 'portada-reflexion', label: 'Portada de Reflexión', required: true, category: 'portada' },

  // 11. Padre Nuestro (fijo, editable por liturgia)
  { type: 'padre-nuestro', label: 'Padre Nuestro', required: true, category: 'fijo', fixedElementFile: 'padre-nuestro.json' },

  // 12. La Paz (fijo, editable por liturgia)
  { type: 'paz', label: 'La Paz', required: true, category: 'fijo', fixedElementFile: 'la-paz.json' },

  // 13. Santa Cena (fijo, editable por liturgia)
  { type: 'santa-cena', label: 'Santa Cena', required: true, category: 'fijo', fixedElementFile: 'santa-cena.json' },

  // 14. Acción de Gracias (fijo, editable por liturgia)
  { type: 'accion-gracias', label: 'Acción de Gracias', required: true, category: 'fijo', fixedElementFile: 'accion-de-gracias.json' },

  // 15. Cuarta canción - Santa Cena (tempo: lenta)
  { type: 'cancion-santa-cena', label: 'Cuarta canción - Santa Cena', required: true, category: 'cancion', defaultTempo: 'lenta' },

  // 16. Ofrenda (fijo, editable por liturgia)
  { type: 'ofrenda', label: 'Ofrenda', required: true, category: 'fijo', fixedElementFile: 'ofrenda.json' },

  // 17. Anuncios (opcional)
  { type: 'anuncios', label: 'Anuncios', required: false, category: 'otro' },

  // 18. Bendición Final (fijo, editable por liturgia)
  { type: 'bendicion', label: 'Bendición Final', required: true, category: 'fijo', fixedElementFile: 'bendicion-final.json' },
];

// ============================================
// LITURGY TEMPLATES
// ============================================

/**
 * Song tempo type for consistency
 */
export type SongTempo = 'lenta' | 'intermedia' | 'rápida';

/**
 * Template element definition - defines structure for different service types
 */
export interface LiturgyTemplateElement {
  type: LiturgyElementType;
  label: string;
  required: boolean;
  category: LiturgyElementCategory;
  defaultTempo?: SongTempo;
  fixedElementFile?: string;
  order: number;
}

/**
 * Liturgy Template - defines structure for different service types
 */
export interface LiturgyTemplate {
  id: string;
  name: string;
  description: string;
  defaultTheme: PresentationTheme;
  elements: LiturgyTemplateElement[];
  createdAt?: string;
  isSystem?: boolean;  // System templates can't be deleted
}

/**
 * System templates for different service types
 */
export const SYSTEM_TEMPLATES: LiturgyTemplate[] = [
  {
    id: 'domingo',
    name: 'Domingo (Servicio Completo)',
    description: 'Liturgia completa para el culto dominical con 18 elementos',
    defaultTheme: 'light',
    isSystem: true,
    elements: LITURGY_ORDER.map((el, i) => ({ ...el, order: i })),
  },
  {
    id: 'adoracion',
    name: 'Servicio de Adoración',
    description: 'Enfocado en canciones y lecturas bíblicas',
    defaultTheme: 'dark',
    isSystem: true,
    elements: [
      { type: 'portada-principal', label: 'Portada', required: true, category: 'portada', order: 0 },
      { type: 'cancion-invocacion', label: 'Canción 1', required: true, category: 'cancion', defaultTempo: 'rápida', order: 1 },
      { type: 'cancion-arrepentimiento', label: 'Canción 2', required: true, category: 'cancion', defaultTempo: 'intermedia', order: 2 },
      { type: 'lectura-biblica', label: 'Lectura Bíblica', required: true, category: 'lectura', order: 3 },
      { type: 'cancion-gratitud', label: 'Canción 3', required: true, category: 'cancion', defaultTempo: 'lenta', order: 4 },
      { type: 'cancion-santa-cena', label: 'Canción 4', required: false, category: 'cancion', defaultTempo: 'lenta', order: 5 },
      { type: 'bendicion', label: 'Bendición', required: true, category: 'fijo', fixedElementFile: 'bendicion-final.json', order: 6 },
    ],
  },
  {
    id: 'bautismo',
    name: 'Bautismo',
    description: 'Ceremonia de bautismo',
    defaultTheme: 'light',
    isSystem: true,
    elements: [
      { type: 'portada-principal', label: 'Portada', required: true, category: 'portada', order: 0 },
      { type: 'lectura-biblica', label: 'Lectura Bíblica', required: true, category: 'lectura', order: 1 },
      { type: 'oracion-invocacion', label: 'Oración', required: true, category: 'oracion', order: 2 },
      { type: 'cancion-gratitud', label: 'Canción', required: false, category: 'cancion', defaultTempo: 'lenta', order: 3 },
      { type: 'bendicion', label: 'Bendición', required: true, category: 'fijo', fixedElementFile: 'bendicion-final.json', order: 4 },
    ],
  },
  {
    id: 'ceniza',
    name: 'Miércoles de Ceniza',
    description: 'Liturgia para Miércoles de Ceniza',
    defaultTheme: 'dark',
    isSystem: true,
    elements: [
      { type: 'portada-principal', label: 'Portada', required: true, category: 'portada', order: 0 },
      { type: 'lectura-biblica', label: 'Lectura Bíblica', required: true, category: 'lectura', order: 1 },
      { type: 'oracion-arrepentimiento', label: 'Oración de Arrepentimiento', required: true, category: 'oracion', order: 2 },
      { type: 'cancion-arrepentimiento', label: 'Canción', required: true, category: 'cancion', defaultTempo: 'lenta', order: 3 },
      { type: 'santa-cena', label: 'Santa Cena', required: false, category: 'fijo', fixedElementFile: 'santa-cena.json', order: 4 },
      { type: 'bendicion', label: 'Bendición', required: true, category: 'fijo', fixedElementFile: 'bendicion-final.json', order: 5 },
    ],
  },
];

/**
 * Get a template by ID
 */
export function getTemplate(templateId: string): LiturgyTemplate | undefined {
  return SYSTEM_TEMPLATES.find((t) => t.id === templateId);
}

/**
 * Get the default template (Domingo)
 */
export function getDefaultTemplate(): LiturgyTemplate {
  return SYSTEM_TEMPLATES[0];
}
