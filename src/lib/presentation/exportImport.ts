/**
 * Export/Import utilities for CASA Presenter
 * Allows backup, transfer, and sharing of presentations
 */

import DOMPurify from 'dompurify';
import type { Slide } from '@/types/shared/slide';
import type {
  PresentationExport,
  ImportValidationResult,
  PresentationData,
  StyleState,
  LogoState,
  TextOverlayState,
  ImageOverlayState,
  TempSlideEdit,
  TextOverlay,
  ImageOverlay,
} from './types';
import { EXPORT_VERSION, isVersionCompatible } from './types';

// ============================================
// XSS SANITIZATION
// ============================================

/**
 * Sanitizes a string by stripping all HTML tags
 */
function sanitizeString(str: string | undefined): string | undefined {
  if (!str) return str;
  return DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });
}

/**
 * Sanitizes a slide's text content to prevent XSS
 */
function sanitizeSlide(slide: Slide): Slide {
  return {
    ...slide,
    content: {
      ...slide.content,
      primary: sanitizeString(slide.content.primary) || '',
      secondary: sanitizeString(slide.content.secondary),
      subtitle: sanitizeString(slide.content.subtitle),
      imageUrl: slide.content.imageUrl, // Keep as-is (validated separately)
    },
  };
}

/**
 * Sanitizes a text overlay's content to prevent XSS
 */
function sanitizeTextOverlay(overlay: TextOverlay): TextOverlay {
  return {
    ...overlay,
    content: sanitizeString(overlay.content) || '',
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validates that an object has the basic structure of a Slide
 */
function isValidSlide(slide: unknown): slide is Slide {
  if (!slide || typeof slide !== 'object') return false;
  const s = slide as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.type === 'string' &&
    (!s.content || typeof s.content === 'object')
  );
}

/**
 * Maximum allowed file size for imports (50MB)
 */
const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024;

// ============================================
// BLOB URL CONVERSION
// ============================================

/**
 * Converts a blob URL to a data URL (base64)
 * This is necessary because blob URLs don't persist after export
 */
export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    // Return original if conversion fails - caller should handle gracefully
    return blobUrl;
  }
}

/**
 * Converts all blob URLs in slides to data URLs
 */
async function convertSlidesImagesToDataUrls(slides: Slide[]): Promise<Slide[]> {
  return Promise.all(
    slides.map(async (slide) => {
      // Check if slide has an image URL that's a blob
      if (slide.content?.imageUrl?.startsWith('blob:')) {
        try {
          const dataUrl = await blobUrlToDataUrl(slide.content.imageUrl);
          return {
            ...slide,
            content: { ...slide.content, imageUrl: dataUrl },
          };
        } catch {
          // Keep original if conversion fails
          return slide;
        }
      }
      return slide;
    })
  );
}

// ============================================
// FILENAME HELPERS
// ============================================

/**
 * Formats date for filename
 */
function formatDateForFilename(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Sanitizes string for use in filename
 */
function sanitizeFilename(str: string): string {
  const sanitized = str
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50);
  return sanitized || 'presentacion'; // Fallback if empty
}

// ============================================
// EXPORT FUNCTIONALITY
// ============================================

/**
 * Export options
 */
export interface ExportPresentationOptions {
  includeFullSlides?: boolean;
  filename?: string;
  userName?: string;
}

/**
 * Exports the presentation to a JSON file
 */
export async function exportPresentation(
  data: PresentationData,
  tempEdits: Record<string, TempSlideEdit>,
  styleState: StyleState,
  logoState: LogoState,
  textOverlayState: TextOverlayState,
  imageOverlayState: ImageOverlayState,
  options?: ExportPresentationOptions
): Promise<PresentationExport> {
  // Get temp slides (those with IDs starting with 'temp-')
  const tempSlides = data.slides.filter((s) => s.id.startsWith('temp-'));

  // Convert blob URLs to data URLs for temp slides
  const processedTempSlides = await convertSlidesImagesToDataUrls(tempSlides);

  // Convert blob URLs in image overlays to data URLs
  const processedImageOverlays = await Promise.all(
    (imageOverlayState.overlays || []).map(async (overlay) => {
      if (overlay.imageUrl?.startsWith('blob:')) {
        try {
          const dataUrl = await blobUrlToDataUrl(overlay.imageUrl);
          return { ...overlay, imageUrl: dataUrl };
        } catch {
          return overlay;
        }
      }
      return overlay;
    })
  );

  // Build export data
  const exportData: PresentationExport = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: options?.userName,
    liturgy: {
      id: data.liturgyId,
      title: data.liturgyTitle,
      date: data.liturgyDate?.toISOString(),
    },
    state: {
      tempSlides: processedTempSlides,
      styleState,
      logoState,
      textOverlayState,
      imageOverlayState: { overlays: processedImageOverlays },
      tempEdits,
    },
  };

  // Optionally include full slides
  if (options?.includeFullSlides) {
    exportData.includeFullSlides = true;
    const processedFullSlides = await convertSlidesImagesToDataUrls(data.slides);
    exportData.fullSlides = processedFullSlides;
  }

  // Generate filename
  const filename =
    options?.filename ||
    `presentacion_${sanitizeFilename(data.liturgyTitle)}_${formatDateForFilename(new Date())}.json`;

  // Create and download file
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return exportData;
}

// ============================================
// IMPORT FUNCTIONALITY
// ============================================

/**
 * Validates and parses an import file
 */
export async function validateImportFile(
  file: File,
  currentLiturgyId?: string
): Promise<ImportValidationResult> {
  // Check file size
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new Error(`El archivo es demasiado grande. Máximo: ${MAX_IMPORT_FILE_SIZE / (1024 * 1024)}MB`);
  }

  // Read file
  const text = await file.text();
  let importData: PresentationExport;

  try {
    importData = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido');
  }

  // Validate format
  if (!importData.version || !importData.state) {
    throw new Error('Formato de archivo no reconocido');
  }

  // Check version compatibility
  if (!isVersionCompatible(importData.version)) {
    throw new Error(`Versión ${importData.version} no compatible con esta aplicación`);
  }

  // Validate required state properties
  if (!importData.state.tempSlides || !Array.isArray(importData.state.tempSlides)) {
    throw new Error('El archivo no contiene datos de diapositivas válidos');
  }

  // Validate slide structure
  const validSlides = importData.state.tempSlides.every(isValidSlide);
  if (!validSlides) {
    throw new Error('El archivo contiene diapositivas con formato inválido');
  }

  // Safe check for liturgy match (with null checks)
  const liturgyMatches = !!(
    currentLiturgyId &&
    importData.liturgy?.id &&
    currentLiturgyId === importData.liturgy.id
  );

  return {
    importData,
    liturgyMatches,
    liturgyTitle: importData.liturgy?.title || 'Desconocido',
  };
}

/**
 * Generates new IDs for imported temp slides to avoid conflicts
 * Returns both the slides with new IDs and a mapping from old to new IDs
 */
function generateNewSlideIds(slides: Slide[]): { slides: Slide[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const timestamp = Date.now();

  const newSlides = slides.map((slide, index) => {
    // Include index to guarantee uniqueness even within same millisecond
    const newId = `temp-imported-${timestamp}-${index}-${Math.random().toString(36).substring(2, 9)}`;
    idMap.set(slide.id, newId);
    return {
      ...slide,
      id: newId,
    };
  });
  return { slides: newSlides, idMap };
}

/**
 * Result of applying an import
 */
export interface ApplyImportResult {
  slides: Slide[];
  tempEdits: Record<string, TempSlideEdit>;
  styleState: StyleState;
  logoState: LogoState;
  textOverlayState: TextOverlayState;
  imageOverlayState: ImageOverlayState;
}

/**
 * Applies imported data to existing presentation state
 * Merges temp slides and overwrites style/overlay settings
 * IMPORTANT: Sanitizes all imported content to prevent XSS
 */
export function applyImport(
  importData: PresentationExport,
  existingSlides: Slide[],
  existingTempEdits: Record<string, TempSlideEdit>
): ApplyImportResult {
  // Generate new IDs for imported temp slides to avoid conflicts
  const { slides: importedSlides, idMap } = generateNewSlideIds(importData.state.tempSlides);

  // Sanitize imported slides to prevent XSS
  const sanitizedImportedSlides = importedSlides.map(sanitizeSlide);

  // Merge slides: original slides + existing temp slides + imported temp slides
  const originalSlides = existingSlides.filter((s) => !s.id.startsWith('temp-'));
  const existingTempSlides = existingSlides.filter((s) => s.id.startsWith('temp-'));

  const mergedSlides = [
    ...originalSlides,
    ...existingTempSlides,
    ...sanitizedImportedSlides,
  ];

  // Remap temp edits to use new IDs (with null check)
  const remappedImportedTempEdits: Record<string, TempSlideEdit> = {};
  const tempEdits = importData.state.tempEdits || {};
  for (const [oldId, edit] of Object.entries(tempEdits)) {
    const newId = idMap.get(oldId);
    if (newId) {
      remappedImportedTempEdits[newId] = edit;
    }
  }

  // Merge temp edits
  const mergedTempEdits = {
    ...existingTempEdits,
    ...remappedImportedTempEdits,
  };

  // Sanitize text overlays to prevent XSS
  const sanitizedTextOverlays = (importData.state.textOverlayState?.overlays || []).map(sanitizeTextOverlay);

  // Image overlays don't have text content to sanitize, but we validate the structure
  const importedImageOverlays: ImageOverlay[] = (importData.state.imageOverlayState?.overlays || []).filter(
    (overlay): overlay is ImageOverlay =>
      overlay &&
      typeof overlay.id === 'string' &&
      typeof overlay.imageUrl === 'string' &&
      typeof overlay.position === 'object'
  );

  return {
    slides: mergedSlides,
    tempEdits: mergedTempEdits,
    styleState: importData.state.styleState,
    logoState: importData.state.logoState,
    textOverlayState: {
      ...importData.state.textOverlayState,
      overlays: sanitizedTextOverlays,
    },
    imageOverlayState: {
      overlays: importedImageOverlays,
    },
  };
}

/**
 * Format date for display
 */
export function formatExportDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}
