/**
 * Motor de Recomendación de Canciones
 *
 * Sugiere canciones basándose en:
 * 1. Momento litúrgico (himno-entrada, himno-gloria, etc.)
 * 2. Tempo apropiado para el momento
 * 3. Temas relacionados con el contexto de la liturgia
 * 4. Historial de uso (prioriza canciones no usadas recientemente)
 * 5. Diversidad (evita repetir canciones del mismo artista)
 */

import type {
  Song,
  SongTempo,
  SongTheme,
  LiturgicalMoment,
  SongTags,
} from '@/types/shared/song';
import type { LiturgyContext } from '@/types/shared/liturgy';

/**
 * Configuración de tempo recomendado por momento litúrgico
 */
const TEMPO_BY_MOMENT: Record<LiturgicalMoment, SongTempo[]> = {
  'himno-entrada': ['rápida', 'intermedia'],
  'himno-gloria': ['rápida', 'intermedia'],
  'cancion-meditacion': ['lenta', 'intermedia'],
  'himno-salida': ['rápida', 'intermedia'],
  'comunion': ['lenta'],
  'ofrenda': ['lenta', 'intermedia'],
  'adoracion': ['lenta', 'intermedia'],
  'reflexion': ['lenta'],
};

/**
 * Temas relacionados frecuentemente con cada momento litúrgico
 */
const THEMES_BY_MOMENT: Record<LiturgicalMoment, SongTheme[]> = {
  'himno-entrada': ['alabanza', 'gozo', 'comunidad'],
  'himno-gloria': ['alabanza', 'adoracion', 'gozo'],
  'cancion-meditacion': ['paz', 'fe', 'esperanza', 'reflexion' as SongTheme],
  'himno-salida': ['gozo', 'servicio', 'comunidad', 'esperanza'],
  'comunion': ['amor', 'gracia', 'comunidad', 'paz'],
  'ofrenda': ['gracia', 'servicio', 'amor'],
  'adoracion': ['adoracion', 'alabanza', 'amor'],
  'reflexion': ['paz', 'fe', 'esperanza', 'arrepentimiento'],
};

/**
 * Peso de cada factor en el algoritmo de recomendación (0-1)
 */
const WEIGHTS = {
  momentMatch: 0.35,      // Si el momento litúrgico coincide
  tempoMatch: 0.20,       // Si el tempo es apropiado
  themeMatch: 0.15,       // Si los temas coinciden con el contexto
  recencyBonus: 0.20,     // Bonus por no haber sido usada recientemente
  diversityBonus: 0.10,   // Bonus por diversidad de artistas
};

/**
 * Opciones de configuración para el motor de recomendación
 */
export interface RecommendationOptions {
  /** Momento litúrgico para el cual buscar canciones */
  moment: LiturgicalMoment;
  /** Contexto de la liturgia actual */
  context?: LiturgyContext;
  /** Canciones ya seleccionadas en esta liturgia (para diversidad) */
  selectedSongs?: Song[];
  /** Número mínimo de días desde el último uso para considerar */
  minDaysSinceLastUse?: number;
  /** Límite de resultados */
  limit?: number;
  /** Excluir canciones con estos IDs */
  excludeIds?: string[];
}

/**
 * Resultado de una recomendación
 */
export interface SongRecommendation {
  song: Song;
  score: number;
  reasons: string[];
}

/**
 * Extrae palabras clave del contexto de la liturgia
 */
const extractContextKeywords = (context?: LiturgyContext): string[] => {
  if (!context) return [];

  const keywords: string[] = [];

  // Del título
  if (context.title) {
    keywords.push(...context.title.toLowerCase().split(/\s+/));
  }

  // Del resumen
  if (context.summary) {
    keywords.push(...context.summary.toLowerCase().split(/\s+/));
  }

  // De las lecturas
  context.readings?.forEach((reading) => {
    if (reading.text) {
      // Extraer palabras significativas (más de 4 caracteres)
      const words = reading.text
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);
      keywords.push(...words.slice(0, 20)); // Limitar
    }
  });

  // Filtrar palabras comunes
  const stopWords = new Set([
    'para', 'como', 'sobre', 'cuando', 'donde', 'porque', 'todos', 'todas',
    'esto', 'esta', 'esos', 'esas', 'entre', 'tiene', 'tienen', 'hacer',
  ]);

  return [...new Set(keywords.filter((w) => !stopWords.has(w)))];
};

/**
 * Calcula el puntaje de coincidencia con el momento litúrgico
 */
const calculateMomentScore = (song: Song, moment: LiturgicalMoment): number => {
  const tags = song.songTags;
  if (!tags?.suggestedMoments?.length) return 0.3; // Puntaje base si no tiene tags

  return tags.suggestedMoments.includes(moment) ? 1 : 0;
};

/**
 * Calcula el puntaje de tempo
 */
const calculateTempoScore = (song: Song, moment: LiturgicalMoment): number => {
  const tags = song.songTags;
  const recommendedTempos = TEMPO_BY_MOMENT[moment];

  if (!tags?.tempo) return 0.5; // Puntaje medio si no tiene tempo definido
  return recommendedTempos.includes(tags.tempo) ? 1 : 0.2;
};

/**
 * Calcula el puntaje de coincidencia de temas
 */
const calculateThemeScore = (
  song: Song,
  moment: LiturgicalMoment,
  contextKeywords: string[]
): number => {
  const tags = song.songTags;
  const recommendedThemes = THEMES_BY_MOMENT[moment];

  if (!tags?.themes?.length) return 0.4; // Puntaje base si no tiene temas

  // Coincidencia con temas del momento
  const momentThemeMatch = tags.themes.some((t) => recommendedThemes.includes(t));

  // Coincidencia con palabras clave del contexto
  let contextMatch = 0;
  if (contextKeywords.length > 0) {
    const songText = `${song.title} ${song.artist || ''}`.toLowerCase();
    const matchingKeywords = contextKeywords.filter((kw) => songText.includes(kw));
    contextMatch = Math.min(matchingKeywords.length / 3, 1);
  }

  return momentThemeMatch ? 0.7 + contextMatch * 0.3 : contextMatch * 0.5;
};

/**
 * Calcula el bonus por no haber sido usada recientemente
 */
const calculateRecencyScore = (
  song: Song,
  minDaysSinceLastUse: number = 30
): number => {
  const tags = song.songTags;

  if (!tags?.lastUsed) return 1; // Máximo puntaje si nunca ha sido usada

  const lastUsedDate = new Date(tags.lastUsed);
  const now = new Date();
  const daysSinceLastUse = Math.floor(
    (now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastUse >= minDaysSinceLastUse) return 1;
  return daysSinceLastUse / minDaysSinceLastUse;
};

/**
 * Calcula el bonus de diversidad (evitar mismo artista)
 */
const calculateDiversityScore = (song: Song, selectedSongs: Song[]): number => {
  if (selectedSongs.length === 0) return 1;

  const selectedArtists = new Set(
    selectedSongs.map((s) => s.artist?.toLowerCase())
  );

  // Penalizar si el artista ya fue seleccionado
  if (song.artist && selectedArtists.has(song.artist.toLowerCase())) {
    return 0.3;
  }

  return 1;
};

/**
 * Genera razones legibles para la recomendación
 */
const generateReasons = (
  song: Song,
  moment: LiturgicalMoment,
  scores: {
    moment: number;
    tempo: number;
    theme: number;
    recency: number;
    diversity: number;
  }
): string[] => {
  const reasons: string[] = [];
  const tags = song.songTags;

  if (scores.moment === 1) {
    reasons.push(`Recomendada para ${MOMENT_LABELS[moment]}`);
  }

  if (scores.tempo === 1 && tags?.tempo) {
    reasons.push(`Tempo ${tags.tempo} apropiado`);
  }

  if (scores.recency === 1) {
    reasons.push('No usada recientemente');
  } else if (!tags?.lastUsed) {
    reasons.push('Nunca usada');
  }

  if (scores.diversity === 1 && song.artist) {
    reasons.push('Aporta variedad de artistas');
  }

  if (tags?.themes?.length) {
    reasons.push(`Temas: ${tags.themes.slice(0, 2).join(', ')}`);
  }

  return reasons;
};

/**
 * Labels para mostrar momentos litúrgicos
 */
const MOMENT_LABELS: Record<LiturgicalMoment, string> = {
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
 * Motor principal de recomendación
 */
export const recommendSongs = (
  allSongs: Song[],
  options: RecommendationOptions
): SongRecommendation[] => {
  const {
    moment,
    context,
    selectedSongs = [],
    minDaysSinceLastUse = 30,
    limit = 10,
    excludeIds = [],
  } = options;

  // Filtrar canciones excluidas
  const availableSongs = allSongs.filter(
    (song) => !excludeIds.includes(song.id)
  );

  // Extraer keywords del contexto
  const contextKeywords = extractContextKeywords(context);

  // Calcular puntajes para cada canción
  const recommendations: SongRecommendation[] = availableSongs.map((song) => {
    const scores = {
      moment: calculateMomentScore(song, moment),
      tempo: calculateTempoScore(song, moment),
      theme: calculateThemeScore(song, moment, contextKeywords),
      recency: calculateRecencyScore(song, minDaysSinceLastUse),
      diversity: calculateDiversityScore(song, selectedSongs),
    };

    // Calcular puntaje total ponderado
    const totalScore =
      scores.moment * WEIGHTS.momentMatch +
      scores.tempo * WEIGHTS.tempoMatch +
      scores.theme * WEIGHTS.themeMatch +
      scores.recency * WEIGHTS.recencyBonus +
      scores.diversity * WEIGHTS.diversityBonus;

    return {
      song,
      score: totalScore,
      reasons: generateReasons(song, moment, scores),
    };
  });

  // Ordenar por puntaje descendente y limitar
  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};

/**
 * Obtiene canciones recomendadas para un momento específico
 * (versión simplificada para uso rápido)
 */
export const getQuickRecommendations = (
  songs: Song[],
  moment: LiturgicalMoment,
  limit: number = 5
): Song[] => {
  const recommendations = recommendSongs(songs, { moment, limit });
  return recommendations.map((r) => r.song);
};

/**
 * Verifica si una canción es apropiada para un momento litúrgico
 */
export const isSongAppropriateForMoment = (
  song: Song,
  moment: LiturgicalMoment
): { isAppropriate: boolean; score: number; reasons: string[] } => {
  const momentScore = calculateMomentScore(song, moment);
  const tempoScore = calculateTempoScore(song, moment);

  const isAppropriate = momentScore > 0.5 || tempoScore > 0.5;
  const score = (momentScore + tempoScore) / 2;

  const reasons: string[] = [];
  if (momentScore === 1) reasons.push('Momento sugerido');
  if (tempoScore === 1) reasons.push('Tempo apropiado');
  if (!isAppropriate) reasons.push('No configurada para este momento');

  return { isAppropriate, score, reasons };
};

export default recommendSongs;
