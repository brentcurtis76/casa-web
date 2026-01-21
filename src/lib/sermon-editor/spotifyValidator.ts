/**
 * Spotify Validation - Validates sermon content for Spotify podcast requirements
 * PROMPT_006: Spotify Integration
 *
 * Spotify Requirements:
 *
 * Audio:
 * - Format: MP3 (already handled by export)
 * - Bitrate: 96-320 kbps (our export uses 128kbps - valid)
 * - Max file size: 200MB
 * - Min duration: 10 seconds
 * - Max duration: 12 hours
 *
 * Cover Art:
 * - Format: JPEG or PNG
 * - Dimensions: 1400x1400 pixels (already handled)
 * - Max file size: 2MB
 * - RGB color mode
 *
 * Metadata:
 * - Title: 1-200 characters
 * - Description: Max 4000 characters
 * - No RSS-breaking characters: <, >, & (escape them)
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];    // Blocking issues
  warnings: string[];  // Non-blocking recommendations
}

/**
 * Validate sermon content for Spotify podcast distribution
 */
export function validateForSpotify(
  audioBlob: Blob | null,
  coverBlob: Blob | null,
  metadata: { title: string; speaker: string; description?: string },
  audioDuration: number
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Audio validation
  if (!audioBlob) {
    errors.push('Exporta el audio primero');
  } else {
    const audioSizeMB = audioBlob.size / (1024 * 1024);
    if (audioSizeMB > 200) {
      errors.push(`Audio demasiado grande: ${audioSizeMB.toFixed(1)}MB (máx 200MB)`);
    }
  }

  if (audioDuration < 10) {
    errors.push('Audio muy corto (mínimo 10 segundos)');
  }
  if (audioDuration > 43200) { // 12 hours
    errors.push('Audio muy largo (máximo 12 horas)');
  }

  // Cover validation
  if (!coverBlob) {
    errors.push('Genera o sube una portada');
  } else {
    const coverSizeMB = coverBlob.size / (1024 * 1024);
    if (coverSizeMB > 2) {
      errors.push(`Portada muy grande: ${coverSizeMB.toFixed(1)}MB (máx 2MB)`);
    }
  }

  // Metadata validation
  if (!metadata.title || metadata.title.trim().length === 0) {
    errors.push('Ingresa un título');
  } else if (metadata.title.length > 200) {
    errors.push(`Título muy largo: ${metadata.title.length} caracteres (máx 200)`);
  }

  if (!metadata.speaker || metadata.speaker.trim().length === 0) {
    errors.push('Ingresa el nombre del predicador');
  }

  if (metadata.description && metadata.description.length > 4000) {
    errors.push(`Descripción muy larga: ${metadata.description.length} caracteres (máx 4000)`);
  }

  // Warnings (non-blocking)
  if (!metadata.description || metadata.description.length < 50) {
    warnings.push('Añade una descripción más detallada para mejor SEO');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
