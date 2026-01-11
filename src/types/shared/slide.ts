/**
 * Tipos compartidos para el sistema de slides de liturgias CASA
 * Todos los componentes deben usar estas interfaces para garantizar compatibilidad
 */

/**
 * Tipo de contenido del slide
 */
export type SlideType =
  | 'song-title'           // Título de canción
  | 'song-lyrics'          // Letra de canción
  | 'prayer-leader'        // Oración - parte del líder
  | 'prayer-response'      // Oración - respuesta congregación
  | 'prayer-full'          // Oración completa (líder + respuesta)
  | 'reading'              // Lectura bíblica
  | 'creed'                // Credo
  | 'announcement'         // Anuncio (texto)
  | 'announcement-image'   // Anuncio (imagen del generador de gráficos)
  | 'blessing'             // Bendición
  | 'title'                // Título de sección
  | 'blank';               // Slide en blanco / transición

/**
 * Slide individual - INTERFAZ COMÚN PARA TODOS LOS COMPONENTES
 */
export interface Slide {
  id: string;                    // UUID único
  type: SlideType;               // Tipo de contenido
  content: {
    primary: string;             // Texto principal
    secondary?: string;          // Texto secundario (ej: respuesta congregación)
    subtitle?: string;           // Subtítulo opcional
    imageUrl?: string;           // URL de imagen (para slides de tipo imagen)
  };
  style: {
    primaryColor?: string;       // Color del texto principal
    secondaryColor?: string;     // Color del texto secundario
    backgroundColor: string;     // Color de fondo
    primaryFont?: string;        // Fuente del texto principal
    secondaryFont?: string;      // Fuente del texto secundario
  };
  metadata: {
    sourceComponent: string;     // Componente que generó el slide
    sourceId: string;            // ID del elemento fuente (canción, oración, etc.)
    order: number;               // Orden dentro del grupo
    groupTotal: number;          // Total de slides en el grupo
    batchId?: string;            // ID del batch de gráficos (para anuncios)
  };
  notes?: string;                // Notas del presentador para este slide
}

/**
 * Tipo de grupo de slides
 */
export type SlideGroupType = 'song' | 'prayer' | 'reading' | 'creed' | 'announcement' | 'blessing';

/**
 * Grupo de slides (ej: una canción completa, una oración completa)
 */
export interface SlideGroup {
  id: string;
  type: SlideGroupType;
  title: string;
  slides: Slide[];
  metadata: {
    sourceComponent: string;
    createdAt: string;
  };
}

/**
 * Opciones de exportación de presentación
 */
export interface ExportOptions {
  format: 'pptx' | 'pdf' | 'google-slides' | 'images';
  slideSize: '4:3' | '16:9';
  includeNotes?: boolean;
  includeTiming?: boolean;
  separateBySection?: boolean;
}
