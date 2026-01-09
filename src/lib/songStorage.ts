/**
 * Funciones de almacenamiento y acceso a canciones
 */

import type { Song, SongIndex, SongIndexEntry, SongFilters } from '@/types/shared/song';

// Importar índice de canciones
import songsIndex from '@/data/canciones/index.json';

/**
 * Obtiene el índice completo de canciones
 */
export function getSongIndex(): SongIndex {
  return songsIndex as SongIndex;
}

/**
 * Obtiene todas las entradas del índice
 */
export function getAllSongEntries(): SongIndexEntry[] {
  return songsIndex.songs as SongIndexEntry[];
}

/**
 * Carga una canción por su ID
 */
export async function getSongById(id: string): Promise<Song | null> {
  try {
    // Intentar cargar desde pdf-extracted
    const module = await import(`@/data/canciones/pdf-extracted/${id}.json`);
    return module.default as Song;
  } catch {
    try {
      // Intentar cargar desde custom
      const module = await import(`@/data/canciones/custom/${id}.json`);
      return module.default as Song;
    } catch {
      console.error(`Canción no encontrada: ${id}`);
      return null;
    }
  }
}

/**
 * Busca canciones por query de texto
 */
export function searchSongs(query: string): SongIndexEntry[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    return getAllSongEntries();
  }

  return getAllSongEntries().filter(song =>
    song.title.toLowerCase().includes(normalizedQuery) ||
    song.slug.includes(normalizedQuery)
  );
}

/**
 * Filtra canciones según criterios
 */
export function filterSongs(filters: SongFilters): SongIndexEntry[] {
  let songs = getAllSongEntries();

  if (filters.query) {
    songs = searchSongs(filters.query);
  }

  // Filtros adicionales se pueden implementar aquí
  // cuando tengamos más metadata en el índice

  return songs;
}

/**
 * Obtiene una canción por su número
 */
export function getSongByNumber(number: number): SongIndexEntry | undefined {
  return getAllSongEntries().find(song => song.number === number);
}

/**
 * Obtiene una canción por su slug
 */
export function getSongBySlug(slug: string): SongIndexEntry | undefined {
  return getAllSongEntries().find(song => song.slug === slug);
}

/**
 * Guarda una nueva canción (almacenamiento local)
 * En una implementación real, esto iría a una base de datos
 */
export function saveCustomSong(song: Song): void {
  // Para persistencia real, esto debería conectar con Supabase o similar
  // Por ahora, guardamos en localStorage como fallback
  const customSongs = getCustomSongsFromStorage();
  customSongs[song.id] = song;
  localStorage.setItem('casa-custom-songs', JSON.stringify(customSongs));
}

/**
 * Obtiene canciones personalizadas del almacenamiento local
 */
export function getCustomSongsFromStorage(): Record<string, Song> {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem('casa-custom-songs');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Lista todas las canciones personalizadas
 */
export function getCustomSongsList(): Song[] {
  const customSongs = getCustomSongsFromStorage();
  return Object.values(customSongs);
}

/**
 * Elimina una canción personalizada
 */
export function deleteCustomSong(id: string): boolean {
  const customSongs = getCustomSongsFromStorage();
  if (customSongs[id]) {
    delete customSongs[id];
    localStorage.setItem('casa-custom-songs', JSON.stringify(customSongs));
    return true;
  }
  return false;
}
