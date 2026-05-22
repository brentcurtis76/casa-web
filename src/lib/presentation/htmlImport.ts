/**
 * Helpers para importación de archivos HTML como fondos / contenido de slides.
 */

export const MAX_HTML_SIZE = 5 * 1024 * 1024;

export function validateHtmlFile(file: File): { valid: true } | { valid: false; error: string } {
  const nameOk = file.name.toLowerCase().endsWith('.html');
  const typeOk = file.type === 'text/html';

  if (!nameOk && !typeOk) {
    return { valid: false, error: 'Tipo de archivo no soportado. Use .html' };
  }

  if (file.size > MAX_HTML_SIZE) {
    return { valid: false, error: 'Archivo HTML demasiado grande. Máximo 5MB.' };
  }

  return { valid: true };
}

export function readHtmlFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Error al leer el archivo HTML'));
    };
    reader.readAsText(file);
  });
}
