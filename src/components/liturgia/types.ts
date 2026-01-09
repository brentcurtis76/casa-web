/**
 * TypeScript interfaces para el sistema de Oraciones Antifonales CASA
 */

// ============================================
// Interfaces base para oraciones
// ============================================

/** Un tiempo dentro de una oración antifonal */
export interface Tiempo {
  lider: string;
  congregacion: string;
}

/** Una oración antifonal completa con sus 4 tiempos */
export interface Oracion {
  titulo: string;
  tiempos: Tiempo[];
}

/** Las tres oraciones antifonales generadas */
export interface OracionesAntifonales {
  invocacion: Oracion;
  arrepentimiento: Oracion;
  gratitud: Oracion;
}

// ============================================
// Interfaces para input del usuario
// ============================================

/** Input del formulario de liturgia */
export interface LiturgiaInput {
  fecha: Date;
  titulo: string;
  resumen: string;
  lecturas: string[];  // Citas bíblicas: ["Juan 3:16-21", "Salmo 23"]
}

/** Lectura bíblica obtenida de la API */
export interface LecturaFetched {
  cita: string;
  texto: string;
  version: string;
  versionCode: string;
}

// ============================================
// Interfaces para persistencia (Supabase)
// ============================================

/** Registro de liturgia en la base de datos */
export interface LiturgiaRecord {
  id: string;
  fecha: string;  // ISO date string
  titulo: string;
  resumen: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Registro de lectura bíblica en la base de datos */
export interface LecturaRecord {
  id: string;
  liturgia_id: string;
  cita: string;
  texto: string;
  version: string;
  orden: number;
  created_at: string;
}

/** Registro de oración en la base de datos */
export interface OracionRecord {
  id: string;
  liturgia_id: string;
  tipo: 'invocacion' | 'arrepentimiento' | 'gratitud';
  tiempos: Tiempo[];  // JSONB
  aprobada: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Interfaces para generación de slides
// ============================================

/** Datos para generar un slide individual */
export interface SlideData {
  tipo: 'invocacion' | 'arrepentimiento' | 'gratitud';
  titulo: string;
  tiempoNumero: number;
  totalTiempos: number;
  lider: string;
  congregacion: string;
}

/** Configuración de exportación de slides */
export interface SlideExportConfig {
  width: number;
  height: number;
  format: 'png' | 'jpeg';
  quality: number;  // 0-1 para JPEG
}

// ============================================
// Interfaces para estado del componente
// ============================================

/** Fases del flujo de trabajo */
export type WorkflowPhase = 'form' | 'loading' | 'review' | 'slides';

/** Estado de aprobación de las oraciones */
export interface ApprovalState {
  invocacion: boolean;
  arrepentimiento: boolean;
  gratitud: boolean;
}

/** Estado de carga de lecturas bíblicas */
export interface LecturaLoadingState {
  [cita: string]: 'idle' | 'loading' | 'success' | 'error';
}

// ============================================
// Interfaces para respuestas de API
// ============================================

/** Respuesta de la Edge Function fetch-bible-passage */
export interface BiblePassageResponse {
  success: boolean;
  text?: string;
  reference?: string;
  version?: string;
  versionCode?: string;
  error?: string;
}

/** Respuesta de la Edge Function generate-oraciones */
export interface GenerateOracionesResponse {
  success: boolean;
  oraciones?: OracionesAntifonales;
  model?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: string;
}

// ============================================
// Types auxiliares
// ============================================

/** Tipos de oración disponibles */
export type TipoOracion = 'invocacion' | 'arrepentimiento' | 'gratitud';

/** Versiones de la Biblia soportadas (API gratuita Bolls.life) */
export type BibleVersion = 'NVI' | 'RV1960' | 'LBLA' | 'NTV' | 'PDT' | 'RVG' | 'BTX';

/** Información de versión bíblica */
export interface BibleVersionInfo {
  code: BibleVersion;
  name: string;
  description: string;
}

/** Lista de versiones disponibles (GRATUITAS - Bolls.life) */
export const BIBLE_VERSIONS: BibleVersionInfo[] = [
  { code: 'NVI', name: 'Nueva Versión Internacional', description: 'Traducción moderna y precisa' },
  { code: 'RV1960', name: 'Reina-Valera 1960', description: 'Versión clásica tradicional' },
  { code: 'LBLA', name: 'La Biblia de las Américas', description: 'Traducción literal y precisa' },
  { code: 'NTV', name: 'Nueva Traducción Viviente', description: 'Lenguaje contemporáneo claro' },
  { code: 'PDT', name: 'Palabra de Dios para Todos', description: 'Fácil lectura y comprensión' },
  { code: 'RVG', name: 'Reina Valera Gómez', description: 'Versión clásica actualizada' },
  { code: 'BTX', name: 'La Biblia Textual', description: 'Traducción textual rigurosa' },
];
