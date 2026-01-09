/**
 * Módulo de Canciones - Exportaciones centralizadas
 */

// Tag management
export {
  TEMPO_LABELS,
  THEME_LABELS,
  MOMENT_LABELS,
  THEME_COLORS,
  createEmptySongTags,
  recordSongUsage,
  updateSongTempo,
  addSongTheme,
  removeSongTheme,
  addSuggestedMoment,
  removeSuggestedMoment,
  filterSongsByMoment,
  filterSongsByTheme,
  filterSongsByTempo,
  getSuggestedSongs,
  getSongUsageStats,
  searchSongsWithFilters,
} from './songTagsManager';

// Recommendation engine
export {
  recommendSongs,
  getQuickRecommendations,
  isSongAppropriateForMoment,
  type RecommendationOptions,
  type SongRecommendation,
} from './songRecommendationEngine';
