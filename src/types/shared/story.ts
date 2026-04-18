/**
 * Tipos para el módulo Cuentacuentos de CASA
 * Sistema de generación de cuentos ilustrados para niños
 */

/**
 * Rol del personaje en el cuento
 */
export type CharacterRole = 'protagonist' | 'secondary';

/**
 * Rol del landmark en el cuento
 */
export type LandmarkRole = 'primary' | 'secondary';

/**
 * Tipo de prop: un lugar/escenario o un objeto físico
 */
export type PropKind = 'location' | 'prop';

/**
 * Prominencia del prop en el cuento
 */
export type PropRole = 'primary' | 'secondary';

/**
 * Prop del cuento: puede ser un lugar (playa, iglesia, parque) o un objeto
 * (sombrero, tesoro, libro) que aparece de forma consistente en las escenas.
 * Mantiene consistencia visual mediante fotos de referencia subidas por el usuario.
 */
export interface StoryProp {
  id: string;
  kind: PropKind;
  name: string;
  narrativeRole: string;
  visualDescription: string;        // Descripción visual generada tras analizar las fotos
  referenceImages: string[];        // URLs/base64 de fotos subidas por el usuario
  selectedReferenceUrl?: string;    // URL de la imagen de referencia procesada
  role: PropRole;
  sceneNumbers?: number[];          // Escenas en las que aparece el prop
}

/**
 * Landmark o edificio que actúa como "personaje" visual en el cuento
 * Permite subir fotos de referencia para que el landmark se represente fielmente
 */
export interface StoryLandmark {
  id: string;
  name: string;                    // Nombre del landmark (ej: "Iglesia de San Marcos")
  narrativeRole: string;           // Rol narrativo (ej: "Es el corazón de la comunidad")
  visualDescription: string;       // Descripción visual generada por Gemini tras analizar las fotos
  referenceImages: string[];       // URLs/base64 de fotos subidas por el usuario (múltiples ángulos)
  selectedReferenceUrl?: string;   // URL de la imagen de referencia procesada/seleccionada
  role: LandmarkRole;              // Qué tan prominente es en el cuento
}

/**
 * Personaje del cuento
 */
export interface StoryCharacter {
  id: string;
  name: string;
  role: CharacterRole;
  description: string;          // Descripción narrativa
  visualDescription: string;    // Descripción visual detallada para prompts
  editedVisualDescription?: string;  // User-edited prompt override
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
  landmarkVisible?: boolean;    // Si el landmark debe aparecer en esta escena
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
 * Posición del texto superpuesto sobre la imagen
 */
export type OverlayPosition = 'top' | 'center' | 'bottom';

/**
 * Color del texto superpuesto
 */
export type OverlayColor = 'white' | 'black' | 'amber';

/**
 * Tamaño del texto superpuesto
 */
export type OverlaySize = 'S' | 'M' | 'L';

/**
 * Configuración del texto superpuesto sobre portada o imagen final
 */
export interface TextOverlay {
  text: string;
  position: OverlayPosition;
  color: OverlayColor;
  size: OverlaySize;
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
  landmarks?: StoryLandmark[];  // Landmarks que actúan como "personajes" visuales
  props?: StoryProp[];          // Lugares y objetos de referencia visual
  scenes: StoryScene[];
  coverImageOptions?: string[];
  coverImageUrl?: string;
  coverTextOverlay?: TextOverlay;
  endImageOptions?: string[];
  endImageUrl?: string;
  endTextOverlay?: TextOverlay;
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
  landmarks: {
    name: string;
    narrativeRole: string;
    referenceImages: string[];   // base64 data URLs from uploaded photos
    role: LandmarkRole;
  }[];
  props?: Omit<StoryProp, 'id' | 'visualDescription' | 'selectedReferenceUrl'>[];
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
    landmarkVisible?: boolean;    // Si el landmark debe aparecer en esta escena
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
