/**
 * Distribution Package - ZIP package creation for Spotify upload
 * PROMPT_006: Spotify Integration
 *
 * Creates a complete distribution package containing:
 * - MP3 audio file
 * - Cover image (JPG)
 * - Metadata text file with instructions
 */
import JSZip from 'jszip';
import type { SermonMetadata } from '@/components/sermon-editor/MetadataForm';

export interface DistributionPackage {
  audioFile: Blob;
  audioFileName: string;
  coverImage: Blob;
  coverFileName: string;
  metadata: SermonMetadata;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '_')     // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '')         // Trim underscores
    .substring(0, 50);               // Limit length
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Create a ZIP package for manual Spotify upload
 */
export async function createDistributionZip(
  pkg: DistributionPackage
): Promise<Blob> {
  const zip = new JSZip();
  const baseName = sanitizeFilename(pkg.metadata.title);
  const dateStr = formatDate(pkg.metadata.date);

  // Add audio file
  zip.file(`${baseName}_${dateStr}.mp3`, pkg.audioFile);

  // Add cover image
  zip.file(`portada_${baseName}.jpg`, pkg.coverImage);

  // Add metadata text file (for easy copy/paste)
  const metadataText = `
METADATOS DEL SERMON - SPOTIFY FOR PODCASTERS
==============================================

Titulo: ${pkg.metadata.title}

Predicador: ${pkg.metadata.speaker}

Fecha: ${formatDate(pkg.metadata.date)}

${pkg.metadata.series ? `Serie: ${pkg.metadata.series}\n` : ''}Descripcion:
${pkg.metadata.description || '(Sin descripcion)'}

---

INSTRUCCIONES:
1. Abre https://podcasters.spotify.com
2. Inicia sesion
3. Click "New Episode"
4. Sube el archivo MP3
5. Sube la portada JPG
6. Copia y pega los metadatos de arriba
7. Revisa y publica

---
Generado por CASA Sermon Editor
${new Date().toLocaleString('es-ES')}
`.trim();

  zip.file('METADATOS.txt', metadataText);

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}
