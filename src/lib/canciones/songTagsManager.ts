/**
 * Song Tags Manager — UI display constants and pure filter/utility functions
 *
 * Mutation operations (createEmptySongTags, recordSongUsage, updateSongTempo,
 * addSongTheme, removeSongTheme, addSuggestedMoment, removeSuggestedMoment)
 * have been moved to songService.ts and songUsageService.ts in
 * src/lib/music-planning/.
 */

import type {
  Song,
  SongTags,
  SongTempo,
  SongTheme,
  LiturgicalMoment,
} from '@/types/shared/song';

/**
 * Labels para mostrar en UI
 */
export const TEMPO_LABELS: Record<SongTempo, string> = {
  'lenta': 'Lenta',
  'intermedia': 'Intermedia',
  'rápida': 'Rápida',
};

export const THEME_LABELS: Record<SongTheme, string> = {
  'alabanza': 'Alabanza',
  'adoracion': 'Adoración',
  'arrepentimiento': 'Arrepentimiento',
  'esperanza': 'Esperanza',
  'fe': 'Fe',
  'amor': 'Amor',
  'gracia': 'Gracia',
  'paz': 'Paz',
  'gozo': 'Gozo',
  'comunidad': 'Comunidad',
  'servicio': 'Servicio',
  'navidad': 'Navidad',
  'semana-santa': 'Semana Santa',
  'pascua': 'Pascua',
  'pentecostes': 'Pentecostés',
  'adviento': 'Adviento',
  'cuaresma': 'Cuaresma',
};

export const MOMENT_LABELS: Record<LiturgicalMoment, string> = {
  'himno-entrada': 'Himno de Entrada',
  'himno-gloria': 'Himno de Gloria',
  'cancion-meditacion': 'Canción de Meditación',
  'himno-salida': 'Himno de Salida',
  'comunion': 'Comunión',
  'ofrenda': 'Ofrenda',
  'adoracion': 'Adoración',
  'reflexion': 'Reflexión',
};

/**
 * Colores para los tags de temas
 */
export const THEME_COLORS: Record<SongTheme, string> = {
  'alabanza': '#D4A853',      // Amber
  'adoracion': '#8B7355',     // Brown
  'arrepentimiento': '#6B7280', // Gray
  'esperanza': '#10B981',     // Green
  'fe': '#3B82F6',            // Blue
  'amor': '#EF4444',          // Red
  'gracia': '#8B5CF6',        // Purple
  'paz': '#06B6D4',           // Cyan
  'gozo': '#F59E0B',          // Yellow
  'comunidad': '#EC4899',     // Pink
  'servicio': '#14B8A6',      // Teal
  'navidad': '#DC2626',       // Christmas Red
  'semana-santa': '#7C3AED',  // Violet
  'pascua': '#FCD34D',        // Gold
  'pentecostes': '#F97316',   // Orange
  'adviento': '#7C3AED',      // Violet
  'cuaresma': '#7C3AED',      // Violet
};

// =====================================================
// Pure utility functions (stateless, no I/O)
// =====================================================

/**
 * Filtra canciones por tempo (operates on in-memory Song[])
 */
export function filterSongsByTempo(
  songs: Song[],
  tempo: SongTempo
): Song[] {
  return songs.filter((song) => song.songTags?.tempo === tempo);
}

/**
 * Filtra canciones por tema (operates on in-memory Song[])
 */
export function filterSongsByTheme(
  songs: Song[],
  theme: SongTheme
): Song[] {
  return songs.filter((song) =>
    song.songTags?.themes?.includes(theme)
  );
}

/**
 * Filtra canciones por momento litúrgico (operates on in-memory Song[])
 */
export function filterSongsByMoment(
  songs: Song[],
  moment: LiturgicalMoment
): Song[] {
  return songs.filter((song) =>
    song.songTags?.suggestedMoments?.includes(moment)
  );
}

/**
 * Calcula estadísticas de uso de una canción (pure, operates on SongTags)
 */
export function getSongUsageStats(tags: SongTags | undefined): {
  totalUsage: number;
  usageByMoment: Record<LiturgicalMoment, number>;
  lastUsedDate: string | null;
  daysSinceLastUse: number | null;
} {
  if (!tags) {
    return {
      totalUsage: 0,
      usageByMoment: {} as Record<LiturgicalMoment, number>,
      lastUsedDate: null,
      daysSinceLastUse: null,
    };
  }

  const usageByMoment = tags.usageHistory.reduce((acc, record) => {
    acc[record.moment] = (acc[record.moment] || 0) + 1;
    return acc;
  }, {} as Record<LiturgicalMoment, number>);

  let daysSinceLastUse: number | null = null;
  if (tags.lastUsed) {
    const lastUsedDate = new Date(tags.lastUsed);
    const now = new Date();
    daysSinceLastUse = Math.floor(
      (now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    totalUsage: tags.usageCount,
    usageByMoment,
    lastUsedDate: tags.lastUsed || null,
    daysSinceLastUse,
  };
}

/**
 * Obtiene canciones sugeridas para un momento, ordenadas por relevancia
 * Prioriza canciones no usadas recientemente
 */
export function getSuggestedSongs(
  songs: Song[],
  moment: LiturgicalMoment,
  limit: number = 10
): Song[] {
  const relevantSongs = filterSongsByMoment(songs, moment);

  // Ordenar por fecha de último uso (más antiguo primero)
  const sorted = relevantSongs.sort((a, b) => {
    const aLastUsed = a.songTags?.lastUsed || '1900-01-01';
    const bLastUsed = b.songTags?.lastUsed || '1900-01-01';
    return aLastUsed.localeCompare(bLastUsed);
  });

  return sorted.slice(0, limit);
}

/**
 * Busca canciones con filtros combinados (operates on in-memory Song[])
 */
export function searchSongsWithFilters(
  songs: Song[],
  filters: {
    query?: string;
    tempo?: SongTempo;
    themes?: SongTheme[];
    moments?: LiturgicalMoment[];
    notUsedInDays?: number;
  }
): Song[] {
  return songs.filter((song) => {
    // Filtro por texto
    if (filters.query) {
      const query = filters.query.toLowerCase();
      const matchesTitle = song.title.toLowerCase().includes(query);
      const matchesArtist = song.artist?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesArtist) {
        return false;
      }
    }

    // Filtro por tempo
    if (filters.tempo && song.songTags?.tempo !== filters.tempo) {
      return false;
    }

    // Filtro por temas (debe tener al menos uno)
    if (filters.themes && filters.themes.length > 0) {
      const hasTheme = filters.themes.some((theme) =>
        song.songTags?.themes?.includes(theme)
      );
      if (!hasTheme) {
        return false;
      }
    }

    // Filtro por momentos (debe estar sugerido para al menos uno)
    if (filters.moments && filters.moments.length > 0) {
      const hasMoment = filters.moments.some((moment) =>
        song.songTags?.suggestedMoments?.includes(moment)
      );
      if (!hasMoment) {
        return false;
      }
    }

    // Filtro por días sin usar
    if (filters.notUsedInDays !== undefined) {
      const stats = getSongUsageStats(song.songTags);
      if (stats.daysSinceLastUse !== null && stats.daysSinceLastUse < filters.notUsedInDays) {
        return false;
      }
    }

    return true;
  });
}
