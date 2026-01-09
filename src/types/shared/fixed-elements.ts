/**
 * Tipos para el módulo de Elementos Fijos de la Liturgia CASA
 * Elementos que NO cambian cada domingo: La Paz, Padre Nuestro, Santa Cena, etc.
 */

/**
 * Tipos de slides para elementos fijos
 */
export type FixedSlideType =
  | 'title'                  // Título de sección
  | 'liturgy-leader'         // Texto que lee el líder
  | 'liturgy-response'       // Respuesta de la congregación (sola)
  | 'liturgy-antiphonal'     // Líder + respuesta en mismo slide
  | 'prayer-congregational'  // Oración que dice toda la congregación
  | 'scripture'              // Cita bíblica
  | 'info'                   // Información (datos bancarios, etc.)
  | 'instruction'            // Instrucción (momento de la paz, etc.)
  | 'closing';               // Cierre (Aleluya, Amén final)

/**
 * Tipo de elemento fijo
 */
export type FixedElementType =
  | 'paz'
  | 'oracion-comunitaria'
  | 'comunion'
  | 'eucaristia'
  | 'ofrenda'
  | 'bendicion';

/**
 * Slide de elemento fijo
 */
export interface FixedSlide {
  type: FixedSlideType;
  content?: string;          // Texto principal
  leader?: string;           // Texto del líder (para antiphonal)
  response?: string;         // Respuesta congregación (para antiphonal)
  reference?: string;        // Referencia bíblica (para scripture)
  note?: string;             // Nota adicional
}

/**
 * Elemento fijo completo
 */
export interface FixedElement {
  id: string;
  title: string;
  type: FixedElementType;
  slides: FixedSlide[];
  metadata?: {
    editable?: boolean;      // Si el usuario puede editar el texto
    variations?: string[];   // IDs de variaciones alternativas
  };
}

/**
 * Colección de elementos fijos
 */
export interface FixedElementsCollection {
  version: string;
  lastUpdated: string;
  elements: FixedElement[];
}

/**
 * Entrada del índice de elementos fijos (versión resumida)
 */
export interface FixedElementIndexEntry {
  id: string;
  title: string;
  type: FixedElementType;
  slideCount: number;
}

/**
 * Índice de elementos fijos
 */
export interface FixedElementsIndex {
  total: number;
  generatedAt: string;
  elements: FixedElementIndexEntry[];
}
