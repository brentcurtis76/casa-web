/**
 * Tipos para el módulo Cuentacuentos de CASA
 * Sistema de generación de cuentos ilustrados para niños
 */

/**
 * Rol del personaje en el cuento
 */
export type CharacterRole = 'protagonist' | 'secondary';

/**
 * Personaje del cuento
 */
export interface StoryCharacter {
  id: string;
  name: string;
  role: CharacterRole;
  description: string;          // Descripción narrativa
  visualDescription: string;    // Descripción visual detallada para prompts
  characterSheetOptions?: string[];  // URLs de las opciones de character sheet
  characterSheetUrl?: string;   // URL de la imagen aprobada
}

/**
 * Escena del cuento
 */
export interface StoryScene {
  number: number;
  text: string;                 // Texto que se lee en voz alta
  visualDescription: string;    // Descripción para generar la imagen
  imageOptions?: string[];      // URLs de las 3-4 imágenes generadas
  selectedImageUrl?: string;    // URL de la imagen seleccionada
}

/**
 * Información del lugar investigado
 */
export interface LocationInfo {
  name: string;
  region?: string;
  type: 'costa' | 'montaña' | 'desierto' | 'bosque' | 'urbano' | 'altiplano' | 'lago' | 'valle';
  description: string;          // Descripción visual para prompts
  visualElements: string[];     // Elementos característicos
  colors: string[];             // Colores predominantes
  lighting: string;             // Descripción de la luz típica
}

/**
 * Estilo de ilustración disponible
 */
export interface IllustrationStyle {
  id: string;
  name: string;
  prompt: string;               // Prompt base para el estilo
  description: string;          // Descripción en español para el usuario
}

/**
 * Estado del cuento en el proceso de generación
 */
export type StoryStatus =
  | 'draft'              // Borrador inicial
  | 'story-generated'    // Cuento escrito por Claude
  | 'characters-pending' // Esperando aprobación de personajes
  | 'characters-approved'// Personajes aprobados
  | 'scenes-pending'     // Esperando selección de escenas
  | 'ready'              // Cuento completo
  | 'error';             // Error en el proceso

/**
 * Cuento completo
 */
export interface Story {
  id: string;
  title: string;
  summary: string;
  liturgyId?: string;           // ID de la liturgia asociada
  liturgyTitle?: string;
  liturgyReadings?: string[];
  liturgySummary?: string;
  location: LocationInfo;
  illustrationStyle: string;    // ID del estilo seleccionado
  characters: StoryCharacter[];
  scenes: StoryScene[];
  coverImageOptions?: string[];
  coverImageUrl?: string;
  endImageOptions?: string[];
  endImageUrl?: string;
  spiritualConnection: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    status: StoryStatus;
    generationProgress?: number; // 0-100
  };
}

/**
 * Input del formulario para crear un cuento
 */
export interface StoryConfigInput {
  liturgyId?: string;
  liturgyTitle?: string;
  liturgyReadings?: string;
  liturgySummary?: string;
  locationName: string;
  characters: {
    description: string;
    name?: string;
  }[];
  illustrationStyleId: string;
}

/**
 * Respuesta de Claude al generar el cuento
 */
export interface GeneratedStoryContent {
  title: string;
  summary: string;
  characters: {
    name: string;
    role: CharacterRole;
    description: string;
  }[];
  scenes: {
    number: number;
    text: string;
    visualDescription: string;
  }[];
  spiritualConnection: string;
}

/**
 * Contenido del PDF del narrador
 */
export interface StoryPDFContent {
  coverPage: {
    title: string;
    imageUrl: string;
    liturgyDate?: string;
    liturgyTitle?: string;
  };
  scenes: {
    number: number;
    imageUrl: string;
    text: string;
  }[];
  endPage: {
    imageUrl: string;
  };
  metadata: {
    generatedAt: string;
    location: string;
    style: string;
  };
}

/**
 * Índice de cuentos guardados
 */
export interface StoryIndexEntry {
  id: string;
  title: string;
  liturgyTitle?: string;
  location: string;
  style: string;
  sceneCount: number;
  status: StoryStatus;
  createdAt: string;
}

export interface StoriesIndex {
  total: number;
  stories: StoryIndexEntry[];
}
