/**
 * Constantes y configuración para el sistema de Oraciones Antifonales CASA
 * Basado en el Brand Kit de CASA
 */

// ============================================
// Colores del Brand Kit
// ============================================

export const COLORS = {
  // Colores primarios
  primary: {
    black: '#1A1A1A',       // Negro principal - texto líder
    amber: '#D4A853',       // Ámbar acento - texto congregación
    white: '#F7F7F7',       // Blanco cálido - fondo
  },

  // Colores secundarios
  secondary: {
    carbon: '#333333',
    darkGray: '#555555',
    mediumGray: '#8A8A8A',
    lightGray: '#E5E5E5',
  },

  // Variaciones del ámbar
  amberVariations: {
    light: '#E8C97A',
    main: '#D4A853',
    dark: '#B8923D',
  },
} as const;

// ============================================
// Tipografía
// ============================================

export const TYPOGRAPHY = {
  // Fuente para títulos
  title: {
    family: 'Merriweather, Georgia, serif',
    weight: 300,  // Light
    letterSpacing: '0.02em',
  },

  // Fuente para cuerpo de texto
  body: {
    family: 'Montserrat, Arial, sans-serif',
    weight: 400,  // Regular
    letterSpacing: '0.01em',
  },

  // Fuente para respuestas de congregación
  congregation: {
    family: 'Montserrat, Arial, sans-serif',
    weight: 600,  // SemiBold
    letterSpacing: '0.01em',
  },
} as const;

// ============================================
// Configuración de Slides
// ============================================

export const SLIDE_CONFIG = {
  // Dimensiones 4:3
  width: 1024,
  height: 768,

  // Padding interno
  padding: {
    horizontal: 64,  // px
    vertical: 48,    // px
  },

  // Tamaños de fuente (aumentados para adultos mayores)
  fontSize: {
    title: 48,           // Título de la oración (slide de título)
    titleSlide: 72,      // Título grande en slide de sección
    lider: 32,           // Texto del líder (aumentado de 22)
    congregacion: 36,    // Respuesta de la congregación (aumentado de 24)
    indicator: 20,       // Indicador de tiempo [1/4]
  },

  // Espaciado
  spacing: {
    afterTitle: 24,
    afterSeparator: 28,
    afterLider: 32,
    beforeIndicator: 20,
  },

  // Separador decorativo
  separator: {
    lineWidth: 80,       // px de cada línea
    lineHeight: 1,       // px de grosor
    dotRadius: 4,        // px de radio del punto central
    gap: 12,             // px entre línea y punto
    color: COLORS.secondary.lightGray,
    dotColor: COLORS.primary.amber,
  },
} as const;

// ============================================
// Configuración de texto
// ============================================

export const TEXT_CONFIG = {
  // Máximo de caracteres antes de reducir fuente
  maxCharsBeforeResize: {
    lider: 300,
    congregacion: 80,
  },

  // Factor de reducción cuando el texto es largo
  fontSizeReductionFactor: 0.85,

  // Line height
  lineHeight: {
    title: 1.3,
    lider: 1.5,
    congregacion: 1.4,
  },
} as const;

// ============================================
// Labels y textos de UI
// ============================================

export const LABELS = {
  oraciones: {
    invocacion: 'Invocación',
    arrepentimiento: 'Arrepentimiento',
    gratitud: 'Gratitud',
  },

  roles: {
    lider: 'Líder',
    congregacion: 'Congregación',
  },

  buttons: {
    generate: 'Generar Oraciones',
    regenerate: 'Regenerar',
    approve: 'Aprobar',
    edit: 'Editar',
    save: 'Guardar',
    cancel: 'Cancelar',
    exportSlides: 'Exportar Slides',
    downloadAll: 'Descargar Todo',
    addLectura: 'Agregar Lectura',
    removeLectura: 'Quitar',
    fetchLectura: 'Buscar Texto',
  },

  placeholders: {
    titulo: 'Ej: El amor que transforma',
    resumen: 'Describe brevemente el enfoque temático de la liturgia...',
    cita: 'Ej: Juan 3:16-21',
  },

  status: {
    loading: 'Cargando...',
    generating: 'Generando oraciones...',
    fetching: 'Buscando texto bíblico...',
    saving: 'Guardando...',
    approved: 'Aprobada',
    pending: 'Pendiente de aprobación',
  },

  errors: {
    fetchFailed: 'Error al obtener el texto bíblico',
    generateFailed: 'Error al generar las oraciones',
    saveFailed: 'Error al guardar',
    invalidReference: 'Referencia bíblica no válida',
    noApiKey: 'API key no configurada',
  },
} as const;

// ============================================
// Configuración de exportación
// ============================================

export const EXPORT_CONFIG = {
  // Formato por defecto
  defaultFormat: 'png' as const,

  // Calidad JPEG (0-1)
  jpegQuality: 0.92,

  // Nombre de archivo base
  fileNamePattern: 'oracion_{tipo}_{tiempo}.png',

  // Nombre del ZIP
  zipFileName: 'oraciones_antifonales_{fecha}.zip',
} as const;

// ============================================
// URLs de fuentes
// ============================================

export const FONT_URLS = {
  merriweather: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300&display=swap',
  montserrat: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&display=swap',
} as const;
