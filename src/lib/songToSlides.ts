/**
 * Convierte una canción al formato SlideGroup de la arquitectura de liturgias
 */

import { v4 as uuidv4 } from 'uuid';
import type { Song } from '@/types/shared/song';
import type { Slide, SlideGroup } from '@/types/shared/slide';
import { getThemedSlideStyles, PresentationTheme, DEFAULT_THEME } from '@/lib/presentation/themes';

/**
 * Genera un ID único
 */
function generateId(): string {
  return uuidv4();
}

/**
 * Options for song slide generation
 */
export interface SongToSlidesOptions {
  theme?: PresentationTheme;
}

/**
 * Convierte una canción completa a un SlideGroup
 * @param song - La canción a convertir
 * @param options - Opciones de generación (incluye tema)
 * @returns SlideGroup con todos los slides de la canción
 */
export function songToSlides(song: Song, options?: SongToSlidesOptions): SlideGroup {
  const theme = options?.theme || DEFAULT_THEME;
  const themedStyles = getThemedSlideStyles(theme);

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
      primaryColor: themedStyles.songTitle.primaryColor,
      backgroundColor: themedStyles.songTitle.backgroundColor,
      primaryFont: themedStyles.songTitle.primaryFont
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
        primaryColor: themedStyles.songLyrics.primaryColor,
        backgroundColor: themedStyles.songLyrics.backgroundColor,
        primaryFont: themedStyles.songLyrics.primaryFont
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
 * Options for creating slides from lyrics
 */
export interface CreateSlidesFromLyricsOptions {
  linesPerSlide?: number;
  artist?: string;
  theme?: PresentationTheme;
}

/**
 * Crea slides a partir de letra ingresada manualmente
 * @param title - Título de la canción
 * @param lyrics - Letra completa
 * @param options - Opciones de generación (líneas por slide, artista, tema)
 * @returns SlideGroup con todos los slides
 */
export function createSlidesFromLyrics(
  title: string,
  lyrics: string,
  options?: CreateSlidesFromLyricsOptions
): SlideGroup {
  const linesPerSlide = options?.linesPerSlide ?? 4;
  const artist = options?.artist;
  const theme = options?.theme || DEFAULT_THEME;
  const themedStyles = getThemedSlideStyles(theme);

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
      primaryColor: themedStyles.songTitle.primaryColor,
      backgroundColor: themedStyles.songTitle.backgroundColor,
      primaryFont: themedStyles.songTitle.primaryFont
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
        primaryColor: themedStyles.songLyrics.primaryColor,
        backgroundColor: themedStyles.songLyrics.backgroundColor,
        primaryFont: themedStyles.songLyrics.primaryFont
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
