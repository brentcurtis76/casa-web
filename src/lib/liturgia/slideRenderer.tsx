/**
 * slideRenderer - Renderiza slides como imágenes PNG
 * Usa html2canvas para capturar el diseño exacto de UniversalSlide
 */

import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import React from 'react';
import type { Slide } from '@/types/shared/slide';
import UniversalSlide from '@/components/liturgia-builder/UniversalSlide';

// Dimensiones del slide (4:3)
const SLIDE_WIDTH = 1024;
const SLIDE_HEIGHT = 768;

/**
 * Renderiza un slide a imagen PNG (base64)
 */
export async function renderSlideToImage(slide: Slide): Promise<string> {
  return new Promise((resolve, reject) => {
    // Crear contenedor temporal fuera del viewport
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = `${SLIDE_WIDTH}px`;
    container.style.height = `${SLIDE_HEIGHT}px`;
    container.style.overflow = 'hidden';
    container.style.backgroundColor = '#FFFFFF';
    document.body.appendChild(container);

    // Renderizar el componente React
    const root = createRoot(container);

    root.render(
      <UniversalSlide
        slide={slide}
        scale={1}
        showIndicator={false}
      />
    );

    // Esperar a que React renderice y las imágenes carguen
    setTimeout(async () => {
      try {
        // Esperar a que todas las imágenes dentro del contenedor carguen
        const images = container.querySelectorAll('img');
        await Promise.all(
          Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise((res, rej) => {
              img.onload = res;
              img.onerror = res; // No fallar si una imagen no carga
            });
          })
        );

        // Capturar con html2canvas
        const canvas = await html2canvas(container, {
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          scale: 1,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#FFFFFF',
          logging: false,
        });

        // Convertir a base64
        const dataUrl = canvas.toDataURL('image/png', 1.0);

        // Limpiar
        root.unmount();
        document.body.removeChild(container);

        resolve(dataUrl);
      } catch (error) {
        root.unmount();
        document.body.removeChild(container);
        reject(error);
      }
    }, 100); // Pequeño delay para asegurar renderizado completo
  });
}

/**
 * Renderiza múltiples slides a imágenes
 * Muestra progreso via callback
 */
export async function renderSlidesToImages(
  slides: Slide[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const images: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const image = await renderSlideToImage(slides[i]);
    images.push(image);
  }

  return images;
}

/**
 * Precarga imágenes externas para evitar problemas de CORS
 */
export async function preloadExternalImages(slides: Slide[]): Promise<void> {
  const imageUrls = slides
    .filter(s => s.content.imageUrl)
    .map(s => s.content.imageUrl!);

  await Promise.all(
    imageUrls.map(url => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve();
        img.onerror = () => resolve(); // No fallar
        img.src = url;
      });
    })
  );
}
