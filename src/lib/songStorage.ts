/**
 * Song Storage — Compatibility shim over Supabase
 *
 * @deprecated Use songService.ts for new code. This file exists only to
 * preserve backward compatibility for existing callers that import from
 * '@/lib/songStorage'. All functions are now async and delegate to the
 * Supabase-backed songService.
 *
 * Mutation operations (saveCustomSong, deleteCustomSong) and localStorage
 * functions have been removed. Use songService.createSong / songService.deleteSong.
 */

import type {
  Song,
  SongIndex,
  SongIndexEntry,
  SongFilters,
  Verse,
  SongTempo,
  SongTheme,
  LiturgicalMoment,
} from '@/types/shared/song';
import type { MusicSongRow } from '@/types/musicPlanning';
import * as songService from '@/lib/music-planning/songService';
import { getUsageStats } from '@/lib/music-planning/songUsageService';

// =====================================================
// Mapping helpers: MusicSongRow -> Song / SongIndexEntry
// =====================================================

/**
 * Map a DB row to the legacy SongIndexEntry interface.
 * Song.id in the old system was the slug-like string (e.g., "01-el-espiritu").
 * The migration script stored this as the DB `slug` column.
 */
function rowToSongIndexEntry(row: MusicSongRow): SongIndexEntry {
  const lyrics = row.lyrics as Verse[] | null;
  return {
    id: row.slug,               // backward compat: old Song.id = slug
    number: row.number ?? 0,
    title: row.title,
    slug: row.slug,
    verseCount: lyrics?.length ?? 0,
    artist: row.artist ?? undefined,
  };
}

/**
 * Map a DB row to the full Song interface.
 */
function rowToSong(row: MusicSongRow): Song {
  const lyrics = row.lyrics as Verse[] | null;
  const verses = lyrics ?? [];

  return {
    id: row.slug,               // backward compat: old Song.id = slug
    number: row.number ?? 0,
    title: row.title,
    artist: row.artist ?? undefined,
    slug: row.slug,
    verses,
    metadata: {
      verseCount: verses.length,
      hasChorus: verses.some(v => v.type === 'chorus'),
      source: 'pdf',
    },
    songTags: {
      tempo: (row.tempo ?? undefined) as SongTempo | undefined,
      themes: (row.themes ?? []) as SongTheme[],
      suggestedMoments: (row.suggested_moments ?? []) as LiturgicalMoment[],
      usageHistory: [],          // usage history is now in music_song_usage_log
      usageCount: 0,
    },
  };
}

// =====================================================
// Public API — async versions of the old sync functions
// =====================================================

/**
 * @deprecated Use songService.getSongs() directly.
 * Returns the full song index (total, generatedAt, source, songs[]).
 */
export async function getSongIndex(): Promise<SongIndex> {
  const rows = await songService.getSongs({ orderBy: 'number', ascending: true });
  return {
    total: rows.length,
    generatedAt: new Date().toISOString(),
    source: 'supabase',
    songs: rows.map(rowToSongIndexEntry),
  };
}

/**
 * @deprecated Use songService.getSongs() directly.
 * Returns all songs as SongIndexEntry[].
 */
export async function getAllSongEntries(): Promise<SongIndexEntry[]> {
  const rows = await songService.getSongs({ orderBy: 'number', ascending: true });
  return rows.map(rowToSongIndexEntry);
}

/**
 * @deprecated Use songService.getSongBySlug() directly.
 * Loads a song by its legacy ID (which is the slug column in the DB).
 */
export async function getSongById(id: string): Promise<Song | null> {
  const row = await songService.getSongBySlug(id);
  if (!row) return null;

  const song = rowToSong(row);

  // Enrich with usage stats from the usage log
  try {
    const stats = await getUsageStats(row.id);
    if (song.songTags) {
      song.songTags.usageCount = stats.totalUses;
      song.songTags.lastUsed = stats.lastUsed ?? undefined;
    }
  } catch {
    // Non-fatal: if usage fetch fails, continue with defaults
  }

  return song;
}

/**
 * @deprecated Use songService.getSongs({ query }) directly.
 * Search songs by text query against title/artist.
 */
export async function searchSongs(query: string): Promise<SongIndexEntry[]> {
  if (!query.trim()) {
    return getAllSongEntries();
  }
  const rows = await songService.getSongs({ query });
  return rows.map(rowToSongIndexEntry);
}

/**
 * @deprecated Use songService.getSongs() with filters directly.
 * Filter songs by various criteria.
 */
export async function filterSongs(filters: SongFilters): Promise<SongIndexEntry[]> {
  const rows = await songService.getSongs({
    query: filters.query,
    themes: filters.tags,  // old SongFilters.tags maps to themes
  });

  // Client-side filter for hasChorus (not a DB column)
  let results = rows;
  if (filters.hasChorus !== undefined) {
    results = rows.filter((row) => {
      const lyrics = row.lyrics as Verse[] | null;
      const hasChorus = lyrics?.some((v: Verse) => v.type === 'chorus') ?? false;
      return hasChorus === filters.hasChorus;
    });
  }

  return results.map(rowToSongIndexEntry);
}

/**
 * @deprecated Use songService.getSongByNumber() directly.
 * Look up a song by its number.
 */
export async function getSongByNumber(number: number): Promise<SongIndexEntry | undefined> {
  const row = await songService.getSongByNumber(number);
  if (!row) return undefined;
  return rowToSongIndexEntry(row);
}

/**
 * @deprecated Use songService.getSongBySlug() directly.
 * Look up a song by slug.
 */
export async function getSongBySlug(slug: string): Promise<SongIndexEntry | undefined> {
  const row = await songService.getSongBySlug(slug);
  if (!row) return undefined;
  return rowToSongIndexEntry(row);
}
