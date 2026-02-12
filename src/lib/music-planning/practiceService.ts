/**
 * Practice Service — Supabase CRUD for music_practice_sessions.
 *
 * Practice session logging, stats, and leaderboard queries.
 * The music_practice_sessions table is not in the auto-generated
 * Supabase types — the handwritten types in musicPlanning.ts are authoritative.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicPracticeSessionRow,
  MusicPracticeSessionInsert,
  MusicPracticeSessionUpdate,
  MusicSongRow,
} from '@/types/musicPlanning';

// ─── Composite Types ────────────────────────────────────────────────────────

/** Practice session joined with its song data */
export interface PracticeSessionWithSong extends MusicPracticeSessionRow {
  music_songs: MusicSongRow;
}

// ─── Filters ────────────────────────────────────────────────────────────────

export interface PracticeSessionFilters {
  userId?: string;
  songId?: string;
  from?: string; // ISO date string for started_at >= from
  to?: string;   // ISO date string for started_at <= to
}

// ─── Stats Interfaces ────────────────────────────────────────────────────────

export interface PracticeStats {
  totalSessions: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  uniqueSongs: number;
  uniqueUsers: number;
}

export interface PracticeSongStats {
  songId: string;
  songTitle: string;
  sessionCount: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number;
  lastPracticedAt: string | null;
}

// ─── Query Functions ────────────────────────────────────────────────────────

/**
 * List practice sessions with optional filters. Joined to music_songs.
 * Ordered by started_at descending.
 */
export async function getPracticeSessions(
  filters?: PracticeSessionFilters
): Promise<PracticeSessionWithSong[]> {
  let query = (supabase.from as any)('music_practice_sessions')
    .select('*, music_songs(*)')
    .order('started_at', { ascending: false });

  if (filters?.userId) query = query.eq('user_id', filters.userId);
  if (filters?.songId) query = query.eq('song_id', filters.songId);
  if (filters?.from) query = query.gte('started_at', filters.from);
  if (filters?.to) query = query.lte('started_at', filters.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PracticeSessionWithSong[];
}

/**
 * Get a single practice session by ID, joined to music_songs.
 */
export async function getPracticeSessionById(
  id: string
): Promise<PracticeSessionWithSong | null> {
  const { data, error } = await (supabase.from as any)('music_practice_sessions')
    .select('*, music_songs(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as unknown as PracticeSessionWithSong;
}

/**
 * Get practice sessions for a specific song, ordered by started_at desc.
 */
export async function getPracticeSessionsForSong(
  songId: string,
  limit: number = 50
): Promise<MusicPracticeSessionRow[]> {
  const { data, error } = await (supabase.from as any)('music_practice_sessions')
    .select('*')
    .eq('song_id', songId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicPracticeSessionRow[];
}

/**
 * Get practice sessions for a specific user, joined to music_songs.
 * Ordered by started_at desc.
 */
export async function getPracticeSessionsForUser(
  userId: string,
  limit: number = 50
): Promise<PracticeSessionWithSong[]> {
  const { data, error } = await (supabase.from as any)('music_practice_sessions')
    .select('*, music_songs(*)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PracticeSessionWithSong[];
}

// ─── Mutation Functions ─────────────────────────────────────────────────────

/**
 * Create a new practice session.
 */
export async function createPracticeSession(
  session: MusicPracticeSessionInsert
): Promise<MusicPracticeSessionRow> {
  const { data, error } = await (supabase.from as any)('music_practice_sessions')
    .insert(session)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicPracticeSessionRow;
}

/**
 * Update a practice session by ID.
 */
export async function updatePracticeSession(
  id: string,
  updates: MusicPracticeSessionUpdate
): Promise<MusicPracticeSessionRow> {
  const { data, error } = await (supabase.from as any)('music_practice_sessions')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicPracticeSessionRow;
}

/**
 * Delete a practice session by ID.
 */
export async function deletePracticeSession(id: string): Promise<void> {
  const { error } = await (supabase.from as any)('music_practice_sessions')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// ─── Stats ──────────────────────────────────────────────────────────────────

/**
 * Global practice statistics.
 * Computed client-side from all rows (acceptable for small–medium datasets).
 */
export async function getPracticeStats(): Promise<PracticeStats> {
  const { data, error } = await (supabase.from as any)('music_practice_sessions')
    .select('user_id, song_id, duration_seconds');

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { user_id: string; song_id: string; duration_seconds: number | null }[];

  const uniqueSongs = new Set(rows.map((r) => r.song_id));
  const uniqueUsers = new Set(rows.map((r) => r.user_id));
  const totalDuration = rows.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0);

  return {
    totalSessions: rows.length,
    totalDurationSeconds: totalDuration,
    averageDurationSeconds: rows.length > 0 ? Math.round(totalDuration / rows.length) : 0,
    uniqueSongs: uniqueSongs.size,
    uniqueUsers: uniqueUsers.size,
  };
}

/**
 * Practice leaderboard: top songs by total practice time.
 * Returns aggregated stats per song, joined to song title.
 * Sorted by total duration descending. Client-side aggregation.
 */
export async function getPracticeSongLeaderboard(
  limit: number = 10
): Promise<PracticeSongStats[]> {
  const { data, error } = await (supabase.from as any)('music_practice_sessions')
    .select('song_id, duration_seconds, started_at, music_songs(title)')
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    song_id: string;
    duration_seconds: number | null;
    started_at: string;
    music_songs: { title: string };
  }[];

  // Aggregate by song_id
  const map = new Map<string, {
    songTitle: string;
    sessionCount: number;
    totalDuration: number;
    lastPracticedAt: string | null;
  }>();

  for (const row of rows) {
    const existing = map.get(row.song_id);
    if (existing) {
      existing.sessionCount++;
      existing.totalDuration += row.duration_seconds ?? 0;
      // rows are ordered by started_at desc, so first occurrence is the latest
    } else {
      map.set(row.song_id, {
        songTitle: row.music_songs.title,
        sessionCount: 1,
        totalDuration: row.duration_seconds ?? 0,
        lastPracticedAt: row.started_at,
      });
    }
  }

  const result: PracticeSongStats[] = Array.from(map.entries()).map(([songId, agg]) => ({
    songId,
    songTitle: agg.songTitle,
    sessionCount: agg.sessionCount,
    totalDurationSeconds: agg.totalDuration,
    averageDurationSeconds: agg.sessionCount > 0 ? Math.round(agg.totalDuration / agg.sessionCount) : 0,
    lastPracticedAt: agg.lastPracticedAt,
  }));

  // Sort by total duration desc, take limit
  result.sort((a, b) => b.totalDurationSeconds - a.totalDurationSeconds);
  return result.slice(0, limit);
}

/**
 * Recent practice activity across all users. Joined to music_songs.
 * Ordered by started_at desc.
 */
export async function getRecentPracticeActivity(
  limit: number = 20
): Promise<PracticeSessionWithSong[]> {
  const { data, error } = await (supabase.from as any)('music_practice_sessions')
    .select('*, music_songs(*)')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as PracticeSessionWithSong[];
}
