/**
 * Song Usage Service — Supabase CRUD for the music_song_usage_log table
 *
 * Tracks when and where songs were used in services.
 * Provides usage statistics via the get_song_usage_stats RPC function.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicSongUsageLogRow,
  MusicSongUsageLogInsert,
} from '@/types/musicPlanning';

// =====================================================
// USAGE LOG — CRUD
// =====================================================

/**
 * Record a song usage. The table has a UNIQUE constraint on
 * (song_id, service_date, liturgical_moment), so duplicate entries
 * for the same song + date + moment will be ignored.
 */
export async function recordUsage(entry: MusicSongUsageLogInsert): Promise<MusicSongUsageLogRow> {
  const { data, error } = await supabase
    .from('music_song_usage_log')
    .upsert(entry, { ignoreDuplicates: true })
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);

  // If duplicate was ignored, data is null — fetch the existing row
  if (!data) {
    const { data: existing, error: fetchError } = await supabase
      .from('music_song_usage_log')
      .select('*')
      .eq('song_id', entry.song_id)
      .eq('service_date', entry.service_date)
      .eq('liturgical_moment', entry.liturgical_moment ?? '')
      .single();

    if (fetchError) throw new Error(fetchError.message);
    return existing as MusicSongUsageLogRow;
  }

  return data as MusicSongUsageLogRow;
}

/**
 * Get usage history for a specific song, ordered by service_date descending.
 */
export async function getUsageForSong(songId: string, limit?: number): Promise<MusicSongUsageLogRow[]> {
  let query = supabase
    .from('music_song_usage_log')
    .select('*')
    .eq('song_id', songId)
    .order('service_date', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MusicSongUsageLogRow[];
}

/**
 * Get aggregated usage statistics for a song via the get_song_usage_stats
 * RPC function. Returns total uses, last used date, distinct moments,
 * and average gap days between uses.
 *
 * @param songId  UUID of the song
 * @param days    Look-back window in days (default 365)
 */
export async function getUsageStats(
  songId: string,
  days: number = 365
): Promise<{
  totalUses: number;
  lastUsed: string | null;
  moments: string[];
  avgGapDays: number;
}> {
  const { data, error } = await supabase.rpc('get_song_usage_stats', {
    p_song_id: songId,
    p_days: days,
  });

  if (error) throw new Error(error.message);

  // The RPC returns a single-row table; Supabase wraps it in an array
  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return { totalUses: 0, lastUsed: null, moments: [], avgGapDays: 0 };
  }

  return {
    totalUses: Number(row.total_uses) || 0,
    lastUsed: row.last_used ?? null,
    moments: row.moments ?? [],
    avgGapDays: Number(row.avg_gap_days) || 0,
  };
}

/**
 * Get all usage records in the last N days, ordered by service_date descending.
 *
 * @param days  Look-back window (default 90)
 */
export async function getRecentUsage(days: number = 90): Promise<MusicSongUsageLogRow[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from('music_song_usage_log')
    .select('*')
    .gte('service_date', cutoff)
    .order('service_date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicSongUsageLogRow[];
}

/**
 * Get usage records for multiple songs, grouped by song_id.
 * Useful for analytics dashboards that display usage for many songs.
 *
 * @param songIds  Array of song UUIDs
 * @param days     Look-back window (default 365)
 */
export async function getRecentUsageForSongs(
  songIds: string[],
  days: number = 365
): Promise<Record<string, MusicSongUsageLogRow[]>> {
  if (songIds.length === 0) return {};

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = cutoffDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('music_song_usage_log')
    .select('*')
    .in('song_id', songIds)
    .gte('service_date', cutoff)
    .order('service_date', { ascending: false });

  if (error) throw new Error(error.message);

  const grouped: Record<string, MusicSongUsageLogRow[]> = {};
  for (const row of (data ?? []) as MusicSongUsageLogRow[]) {
    if (!grouped[row.song_id]) {
      grouped[row.song_id] = [];
    }
    grouped[row.song_id].push(row);
  }
  return grouped;
}

/**
 * Delete a usage record by UUID.
 */
export async function deleteUsageRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_song_usage_log')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
