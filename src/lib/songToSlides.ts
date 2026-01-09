/**
 * Convierte una canción al formato SlideGroup de la arquitectura de liturgias
 */

import { v4 as uuidv4 } from 'uuid';
import type { Song } from '@/types/shared/song';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import { CASA_BRAND, SLIDE_STYLES } from './brand-kit';

/**
 * Genera un ID único
 */
function generateId(): string {
  return uuidv4();
}

/**
 * Convierte una canción completa a un SlideGroup
 * @param song - La canción a convertir
 * @returns SlideGroup con todos los slides de la canción
 */
export function songToSlides(song: Song): SlideGroup {
  const slides: Slide[] = [];
  const totalSlides = song.verses.length + 1; // +1 por el título

  // Slide de título
  slides.push({
    id: generateId(),
    type: 'song-title',
    content: {
      primary: song.title,
      subtitle: song.artist
    },
    style: {
      primaryColor: SLIDE_STYLES.songTitle.primaryColor,
      backgroundColor: SLIDE_STYLES.songTitle.backgroundColor,
      primaryFont: SLIDE_STYLES.songTitle.primaryFont
    },
    metadata: {
      sourceComponent: 'canciones',
      sourceId: song.id,
      order: 1,
      groupTotal: totalSlides
    }
  });

  // Slides de letra (cada verso es un slide)
  song.verses.forEach((verse, index) => {
    slides.push({
      id: generateId(),
      type: 'song-lyrics',
      content: {
        primary: verse.content
      },
      style: {
        primaryColor: SLIDE_STYLES.songLyrics.primaryColor,
        backgroundColor: SLIDE_STYLES.songLyrics.backgroundColor,
        primaryFont: SLIDE_STYLES.songLyrics.primaryFont
      },
      metadata: {
        sourceComponent: 'canciones',
        sourceId: song.id,
        order: index + 2, // +2 porque el título es 1
        groupTotal: totalSlides
      }
    });
  });

  return {
    id: generateId(),
    type: 'song',
    title: song.title,
    slides,
    metadata: {
      sourceComponent: 'canciones',
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Divide letra en slides basado en líneas por slide
 * @param lyrics - Texto completo de la letra
 * @param linesPerSlide - Número de líneas por slide (default: 4)
 * @returns Array de strings, cada uno representa el contenido de un slide
 */
export function splitLyricsIntoSlides(
  lyrics: string,
  linesPerSlide: number = 4
): string[] {
  const slides: string[] = [];

  // Dividir por párrafos (líneas vacías)
  const paragraphs = lyrics.split(/\n\s*\n/).filter(p => p.trim());

  for (const paragraph of paragraphs) {
    const lines = paragraph.split('\n').filter(l => l.trim());

    if (lines.length <= linesPerSlide) {
      // El párrafo cabe en un slide
      slides.push(lines.join('\n'));
    } else {
      // Dividir párrafo largo en múltiples slides
      for (let i = 0; i < lines.length; i += linesPerSlide) {
        const chunk = lines.slice(i, i + linesPerSlide);
        slides.push(chunk.join('\n'));
      }
    }
  }

  return slides;
}

/**
 * Crea slides a partir de letra ingresada manualmente
 * @param title - Título de la canción
 * @param lyrics - Letra completa
 * @param linesPerSlide - Líneas por slide
 * @param artist - Artista (opcional)
 * @returns SlideGroup con todos los slides
 */
export function createSlidesFromLyrics(
  title: string,
  lyrics: string,
  linesPerSlide: number = 4,
  artist?: string
): SlideGroup {
  const lyricSlides = splitLyricsIntoSlides(lyrics, linesPerSlide);
  const totalSlides = lyricSlides.length + 1;
  const songId = `custom-${Date.now()}`;

  const slides: Slide[] = [];

  // Slide de título
  slides.push({
    id: generateId(),
    type: 'song-title',
    content: {
      primary: title,
      subtitle: artist
    },
    style: {
      primaryColor: SLIDE_STYLES.songTitle.primaryColor,
      backgroundColor: SLIDE_STYLES.songTitle.backgroundColor,
      primaryFont: SLIDE_STYLES.songTitle.primaryFont
    },
    metadata: {
      sourceComponent: 'canciones',
      sourceId: songId,
      order: 1,
      groupTotal: totalSlides
    }
  });

  // Slides de letra
  lyricSlides.forEach((content, index) => {
    slides.push({
      id: generateId(),
      type: 'song-lyrics',
      content: {
        primary: content
      },
      style: {
        primaryColor: SLIDE_STYLES.songLyrics.primaryColor,
        backgroundColor: SLIDE_STYLES.songLyrics.backgroundColor,
        primaryFont: SLIDE_STYLES.songLyrics.primaryFont
      },
      metadata: {
        sourceComponent: 'canciones',
        sourceId: songId,
        order: index + 2,
        groupTotal: totalSlides
      }
    });
  });

  return {
    id: generateId(),
    type: 'song',
    title,
    slides,
    metadata: {
      sourceComponent: 'canciones',
      createdAt: new Date().toISOString()
    }
  };
}
