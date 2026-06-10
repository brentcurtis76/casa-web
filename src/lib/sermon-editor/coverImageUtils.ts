/**
 * Cover image utilities for podcast publishing.
 *
 * Spotify (and most podcast directories) require square JPEG covers between
 * 1400×1400 and 3000×3000, under 2 MB. Gemini's 1:1 output is ~1024×1024, so
 * we upscale to 1400×1400 and step quality down until the JPEG fits.
 */

const QUALITY_STEPS = [0.92, 0.85, 0.78, 0.7];

/**
 * Decode a base64 PNG, center-crop cover-fit it onto a `size`×`size` square
 * canvas, then JPEG-encode it stepping quality down through QUALITY_STEPS
 * until the output fits in `maxBytes`. Throws if even the lowest quality
 * step is still too large.
 */
export async function base64ToSpotifyCover(
  base64Png: string,
  size = 1400,
  maxBytes = 2 * 1024 * 1024,
): Promise<Blob> {
  const img = await loadImage(base64Png);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo crear el contexto del canvas para la portada');
  }

  // Center-crop "cover" fit: scale so the shorter side matches `size`,
  // then offset the longer side so the image is centered.
  const scale = Math.max(size / img.width, size / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;

  // White backdrop in case the source has transparency.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, dx, dy, drawW, drawH);

  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= maxBytes) {
      return blob;
    }
  }

  throw new Error(
    `La portada generada supera ${Math.round(maxBytes / 1024)} KB incluso al mínimo de calidad.`,
  );
}

function loadImage(base64Png: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('No se pudo decodificar la imagen base64.'));
    const src = base64Png.startsWith('data:')
      ? base64Png
      : `data:image/png;base64,${base64Png}`;
    img.src = src;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas.toBlob produjo un valor nulo'));
      },
      'image/jpeg',
      quality,
    );
  });
}
