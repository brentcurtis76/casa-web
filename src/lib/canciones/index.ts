/**
 * Módulo de Canciones - Exportaciones centralizadas
 */

// Tag management — constants + pure filter/utility functions
export {
  TEMPO_LABELS,
  THEME_LABELS,
  MOMENT_LABELS,
  THEME_COLORS,
  filterSongsByTempo,
  filterSongsByTheme,
  filterSongsByMoment,
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
