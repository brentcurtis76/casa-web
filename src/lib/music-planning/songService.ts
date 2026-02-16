/**
 * Song Service — Supabase CRUD for the Song Library tables
 *
 * Covers: music_songs, music_arrangements, music_stems,
 *         music_chord_charts, music_audio_references
 *
 * All functions throw on Supabase errors. Callers are responsible
 * for catching and displaying errors in the UI layer.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicSongRow,
  MusicSongInsert,
  MusicSongUpdate,
  MusicArrangementRow,
  MusicArrangementInsert,
  MusicArrangementUpdate,
  MusicStemRow,
  MusicStemInsert,
  MusicChordChartRow,
  MusicChordChartInsert,
  MusicAudioReferenceRow,
  MusicAudioReferenceInsert,
  SongFull,
  SongListFilters,
} from '@/types/musicPlanning';

// =====================================================
// SONGS — CRUD
// =====================================================

/**
 * List songs with optional filters (text search, tempo, themes, moments).
 * Uses ilike for text search on title/artist.
 * Uses overlaps for TEXT[] array filtering on themes/suggested_moments.
 */
export async function getSongs(filters?: SongListFilters): Promise<MusicSongRow[]> {
  let query = supabase.from('music_songs').select('*');

  if (filters?.query) {
    const pattern = `%${filters.query}%`;
    query = query.or(`title.ilike.${pattern},artist.ilike.${pattern}`);
  }

  if (filters?.tempo) {
    query = query.eq('tempo', filters.tempo);
  }

  if (filters?.themes && filters.themes.length > 0) {
    query = query.overlaps('themes', filters.themes);
  }

  if (filters?.suggestedMoments && filters.suggestedMoments.length > 0) {
    query = query.overlaps('suggested_moments', filters.suggestedMoments);
  }

  const orderBy = filters?.orderBy ?? 'title';
  const ascending = filters?.ascending ?? true;
  query = query.order(orderBy, { ascending });

  // Pagination: use .range() when offset is present, .limit() only when it's not
  if (filters?.offset) {
    const size = filters.limit ?? 100;
    query = query.range(filters.offset, filters.offset + size - 1);
  } else if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MusicSongRow[];
}

/**
 * Get a single song by UUID with all arrangements, stems, chord charts,
 * and audio references (nested select).
 */
export async function getSongById(id: string): Promise<SongFull | null> {
  const { data, error } = await supabase
    .from('music_songs')
    .select('*, music_arrangements(*, music_stems(*), music_chord_charts(*)), music_audio_references(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(error.message);
  }
  return data as unknown as SongFull;
}

/**
 * Lookup a song by its slug column.
 */
export async function getSongBySlug(slug: string): Promise<MusicSongRow | null> {
  const { data, error } = await supabase
    .from('music_songs')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(error.message);
  }
  return data as MusicSongRow;
}

/**
 * Lookup a song by slug with arrangements (sorted by sort_order).
 * Used by publish service to resolve arrangement_id for slug-based songs.
 */
export async function getSongBySlugWithArrangements(
  slug: string
): Promise<(MusicSongRow & { music_arrangements: MusicArrangementRow[] }) | null> {
  const { data, error } = await supabase
    .from('music_songs')
    .select('*, music_arrangements(*)')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(error.message);
  }
  return data as unknown as MusicSongRow & { music_arrangements: MusicArrangementRow[] };
}

/**
 * Lookup a song by its number column.
 */
export async function getSongByNumber(num: number): Promise<MusicSongRow | null> {
  const { data, error } = await supabase
    .from('music_songs')
    .select('*')
    .eq('number', num)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(error.message);
  }
  return data as MusicSongRow;
}

/**
 * Text search songs by title or artist (convenience wrapper around getSongs).
 */
export async function searchSongs(query: string): Promise<MusicSongRow[]> {
  return getSongs({ query });
}

/**
 * Insert a new song.
 */
export async function createSong(song: MusicSongInsert): Promise<MusicSongRow> {
  const { data, error } = await supabase
    .from('music_songs')
    .insert(song)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicSongRow;
}

/**
 * Update an existing song by UUID.
 */
export async function updateSong(id: string, song: MusicSongUpdate): Promise<MusicSongRow> {
  const { data, error } = await supabase
    .from('music_songs')
    .update(song)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicSongRow;
}

/**
 * Delete a song by UUID. Cascades to arrangements, stems, charts, audio refs.
 */
export async function deleteSong(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_songs')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// ARRANGEMENTS — CRUD
// =====================================================

/**
 * Get arrangements for a song.
 */
export async function getArrangementsBySongId(songId: string): Promise<MusicArrangementRow[]> {
  const { data, error } = await supabase
    .from('music_arrangements')
    .select('*')
    .eq('song_id', songId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicArrangementRow[];
}

/**
 * Get a single arrangement with its stems.
 */
export async function getArrangementWithStems(id: string) {
  const { data, error } = await supabase
    .from('music_arrangements')
    .select('*, music_stems(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as unknown as MusicArrangementRow & { music_stems: MusicStemRow[] };
}

/**
 * Get a single arrangement with its stems AND chord charts.
 */
export async function getArrangementWithDetails(id: string) {
  const { data, error } = await supabase
    .from('music_arrangements')
    .select('*, music_stems(*), music_chord_charts(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as unknown as MusicArrangementRow & {
    music_stems: MusicStemRow[];
    music_chord_charts: MusicChordChartRow[];
  };
}

/**
 * Create an arrangement.
 */
export async function createArrangement(arrangement: MusicArrangementInsert): Promise<MusicArrangementRow> {
  const { data, error } = await supabase
    .from('music_arrangements')
    .insert(arrangement)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicArrangementRow;
}

/**
 * Update an arrangement.
 */
export async function updateArrangement(id: string, updates: MusicArrangementUpdate): Promise<MusicArrangementRow> {
  const { data, error } = await supabase
    .from('music_arrangements')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicArrangementRow;
}

/**
 * Delete an arrangement by UUID.
 */
export async function deleteArrangement(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_arrangements')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// STEMS — CRUD
// =====================================================

/**
 * Get stems for an arrangement.
 */
export async function getStemsByArrangementId(arrangementId: string): Promise<MusicStemRow[]> {
  const { data, error } = await supabase
    .from('music_stems')
    .select('*')
    .eq('arrangement_id', arrangementId);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicStemRow[];
}

/**
 * Create a stem.
 */
export async function createStem(stem: MusicStemInsert): Promise<MusicStemRow> {
  const { data, error } = await supabase
    .from('music_stems')
    .insert(stem)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicStemRow;
}

/**
 * Delete a stem by UUID.
 */
export async function deleteStem(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_stems')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// CHORD CHARTS — CRUD
// =====================================================

/**
 * Get chord charts for an arrangement.
 */
export async function getChartsByArrangementId(arrangementId: string): Promise<MusicChordChartRow[]> {
  const { data, error } = await supabase
    .from('music_chord_charts')
    .select('*')
    .eq('arrangement_id', arrangementId);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicChordChartRow[];
}

/**
 * Create a chord chart.
 */
export async function createChordChart(chart: MusicChordChartInsert): Promise<MusicChordChartRow> {
  const { data, error } = await supabase
    .from('music_chord_charts')
    .insert(chart)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicChordChartRow;
}

/**
 * Delete a chord chart by UUID.
 */
export async function deleteChordChart(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_chord_charts')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// AUDIO REFERENCES — CRUD
// =====================================================

/**
 * Get audio references for a song.
 */
export async function getAudioReferencesBySongId(songId: string): Promise<MusicAudioReferenceRow[]> {
  const { data, error } = await supabase
    .from('music_audio_references')
    .select('*')
    .eq('song_id', songId);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicAudioReferenceRow[];
}

/**
 * Create an audio reference.
 */
export async function createAudioReference(ref: MusicAudioReferenceInsert): Promise<MusicAudioReferenceRow> {
  const { data, error } = await supabase
    .from('music_audio_references')
    .insert(ref)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicAudioReferenceRow;
}

/**
 * Delete an audio reference by UUID.
 */
export async function deleteAudioReference(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_audio_references')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// COMPOSITE QUERIES
// =====================================================

/**
 * Get a song with all its arrangements (but no stems/charts).
 */
export async function getSongWithArrangements(id: string) {
  const { data, error } = await supabase
    .from('music_songs')
    .select('*, music_arrangements(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as unknown as MusicSongRow & { music_arrangements: MusicArrangementRow[] };
}

/**
 * Dynamic filter query (alias for getSongs, kept for spec compatibility).
 */
export async function filterSongs(filters: SongListFilters): Promise<MusicSongRow[]> {
  return getSongs(filters);
}
