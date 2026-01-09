/**
 * Song Tags Manager - Funciones para gestionar el sistema de tags de canciones
 */

import type {
  Song,
  SongTags,
  SongTempo,
  SongTheme,
  LiturgicalMoment,
  SongUsageRecord,
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

/**
 * Crea un objeto SongTags vacío
 */
export function createEmptySongTags(): SongTags {
  return {
    tempo: undefined,
    themes: [],
    suggestedMoments: [],
    usageHistory: [],
    usageCount: 0,
  };
}

/**
 * Registra el uso de una canción
 */
export function recordSongUsage(
  tags: SongTags | undefined,
  moment: LiturgicalMoment,
  liturgyId?: string
): SongTags {
  const currentTags = tags || createEmptySongTags();
  const now = new Date().toISOString();

  const usageRecord: SongUsageRecord = {
    date: now,
    liturgyId,
    moment,
  };

  return {
    ...currentTags,
    usageHistory: [...currentTags.usageHistory, usageRecord],
    lastUsed: now,
    usageCount: currentTags.usageCount + 1,
  };
}

/**
 * Actualiza el tempo de una canción
 */
export function updateSongTempo(
  tags: SongTags | undefined,
  tempo: SongTempo | undefined
): SongTags {
  const currentTags = tags || createEmptySongTags();
  return {
    ...currentTags,
    tempo,
  };
}

/**
 * Agrega un tema a una canción
 */
export function addSongTheme(
  tags: SongTags | undefined,
  theme: SongTheme
): SongTags {
  const currentTags = tags || createEmptySongTags();
  if (currentTags.themes.includes(theme)) {
    return currentTags;
  }
  return {
    ...currentTags,
    themes: [...currentTags.themes, theme],
  };
}

/**
 * Elimina un tema de una canción
 */
export function removeSongTheme(
  tags: SongTags | undefined,
  theme: SongTheme
): SongTags {
  const currentTags = tags || createEmptySongTags();
  return {
    ...currentTags,
    themes: currentTags.themes.filter((t) => t !== theme),
  };
}

/**
 * Agrega un momento sugerido
 */
export function addSuggestedMoment(
  tags: SongTags | undefined,
  moment: LiturgicalMoment
): SongTags {
  const currentTags = tags || createEmptySongTags();
  if (currentTags.suggestedMoments.includes(moment)) {
    return currentTags;
  }
  return {
    ...currentTags,
    suggestedMoments: [...currentTags.suggestedMoments, moment],
  };
}

/**
 * Elimina un momento sugerido
 */
export function removeSuggestedMoment(
  tags: SongTags | undefined,
  moment: LiturgicalMoment
): SongTags {
  const currentTags = tags || createEmptySongTags();
  return {
    ...currentTags,
    suggestedMoments: currentTags.suggestedMoments.filter((m) => m !== moment),
  };
}

/**
 * Filtra canciones por momento litúrgico
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
 * Filtra canciones por tema
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
 * Filtra canciones por tempo
 */
export function filterSongsByTempo(
  songs: Song[],
  tempo: SongTempo
): Song[] {
  return songs.filter((song) => song.songTags?.tempo === tempo);
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
 * Calcula estadísticas de uso de una canción
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
 * Busca canciones con filtros combinados
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
