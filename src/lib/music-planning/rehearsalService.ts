/**
 * Rehearsal Service — Supabase CRUD for rehearsal tables.
 *
 * Covers: music_rehearsals, music_rehearsal_songs, music_rehearsal_attendees
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicRehearsalRow,
  MusicRehearsalInsert,
  MusicRehearsalUpdate,
  MusicRehearsalSongRow,
  MusicRehearsalSongInsert,
  MusicRehearsalSongUpdate,
  MusicRehearsalAttendeeRow,
  MusicRehearsalAttendeeInsert,
  MusicRehearsalAttendeeUpdate,
  MusicSongRow,
  MusicMusicianRow,
  RehearsalFull,
} from '@/types/musicPlanning';

// =====================================================
// REHEARSALS — CRUD
// =====================================================

/**
 * List rehearsals with optional date range filter. Order by date ascending.
 */
export async function getRehearsals(from?: string, to?: string): Promise<MusicRehearsalRow[]> {
  let query = supabase
    .from('music_rehearsals')
    .select('*')
    .order('date', { ascending: true });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MusicRehearsalRow[];
}

/**
 * Get upcoming rehearsals (date >= today), ordered ascending, with limit.
 */
export async function getUpcomingRehearsals(limit: number = 10): Promise<MusicRehearsalRow[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('music_rehearsals')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicRehearsalRow[];
}

/**
 * Get single rehearsal by ID with songs (joined to music_songs) and attendees (joined to music_musicians).
 */
export async function getRehearsalById(id: string): Promise<RehearsalFull | null> {
  const { data, error } = await supabase
    .from('music_rehearsals')
    .select('*, music_rehearsal_songs(*, music_songs(*)), music_rehearsal_attendees(*, music_musicians(*))')
    .eq('id', id)
    .order('sort_order', { ascending: true, referencedTable: 'music_rehearsal_songs' })
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as unknown as RehearsalFull;
}

/**
 * Create a new rehearsal.
 */
export async function createRehearsal(rehearsal: MusicRehearsalInsert): Promise<MusicRehearsalRow> {
  const { data, error } = await supabase
    .from('music_rehearsals')
    .insert(rehearsal)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicRehearsalRow;
}

/**
 * Update a rehearsal by ID.
 */
export async function updateRehearsal(id: string, updates: MusicRehearsalUpdate): Promise<MusicRehearsalRow> {
  const { data, error } = await supabase
    .from('music_rehearsals')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicRehearsalRow;
}

/**
 * Delete a rehearsal by ID. CASCADE handles songs + attendees.
 */
export async function deleteRehearsal(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_rehearsals')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// REHEARSAL SONGS — CRUD
// =====================================================

/**
 * Get songs for a rehearsal, ordered by sort_order. Joined to music_songs.
 */
export async function getRehearsalSongs(
  rehearsalId: string
): Promise<(MusicRehearsalSongRow & { music_songs: MusicSongRow })[]> {
  const { data, error } = await supabase
    .from('music_rehearsal_songs')
    .select('*, music_songs(*)')
    .eq('rehearsal_id', rehearsalId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as (MusicRehearsalSongRow & { music_songs: MusicSongRow })[];
}

/**
 * Add a song to a rehearsal.
 */
export async function addRehearsalSong(song: MusicRehearsalSongInsert): Promise<MusicRehearsalSongRow> {
  const { data, error } = await supabase
    .from('music_rehearsal_songs')
    .insert(song)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicRehearsalSongRow;
}

/**
 * Update a rehearsal song (sort_order, arrangement_id, notes).
 */
export async function updateRehearsalSong(id: string, updates: MusicRehearsalSongUpdate): Promise<MusicRehearsalSongRow> {
  const { data, error } = await supabase
    .from('music_rehearsal_songs')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicRehearsalSongRow;
}

/**
 * Remove a song from a rehearsal.
 */
export async function removeRehearsalSong(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_rehearsal_songs')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Batch reorder rehearsal songs. Takes array of { id, sort_order }.
 * Uses Promise.all with individual updates (small N — typically <10 songs).
 */
export async function reorderRehearsalSongs(items: { id: string; sort_order: number }[]): Promise<void> {
  await Promise.all(
    items.map(({ id, sort_order }) =>
      supabase
        .from('music_rehearsal_songs')
        .update({ sort_order })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw new Error(error.message);
        })
    )
  );
}

// =====================================================
// REHEARSAL ATTENDEES — CRUD
// =====================================================

/**
 * Get attendees for a rehearsal with musician details.
 */
export async function getRehearsalAttendees(
  rehearsalId: string
): Promise<(MusicRehearsalAttendeeRow & { music_musicians: MusicMusicianRow })[]> {
  const { data, error } = await supabase
    .from('music_rehearsal_attendees')
    .select('*, music_musicians(*)')
    .eq('rehearsal_id', rehearsalId);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as (MusicRehearsalAttendeeRow & { music_musicians: MusicMusicianRow })[];
}

/**
 * Add an attendee to a rehearsal.
 */
export async function addRehearsalAttendee(attendee: MusicRehearsalAttendeeInsert): Promise<MusicRehearsalAttendeeRow> {
  const { data, error } = await supabase
    .from('music_rehearsal_attendees')
    .insert(attendee)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicRehearsalAttendeeRow;
}

/**
 * Update attendee RSVP or attendance.
 */
export async function updateRehearsalAttendee(
  id: string,
  updates: MusicRehearsalAttendeeUpdate
): Promise<MusicRehearsalAttendeeRow> {
  const { data, error } = await supabase
    .from('music_rehearsal_attendees')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicRehearsalAttendeeRow;
}

/**
 * Remove an attendee from a rehearsal.
 */
export async function removeRehearsalAttendee(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_rehearsal_attendees')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Batch add attendees (for "invite all active musicians" flow).
 * Takes rehearsalId + array of musician_ids. Inserts with rsvp_status = 'pending'.
 * Uses single .insert() with array of objects (not N separate inserts).
 */
export async function batchAddAttendees(
  rehearsalId: string,
  musicianIds: string[]
): Promise<MusicRehearsalAttendeeRow[]> {
  if (musicianIds.length === 0) return [];

  const rows = musicianIds.map((musician_id) => ({
    rehearsal_id: rehearsalId,
    musician_id,
    rsvp_status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .from('music_rehearsal_attendees')
    .insert(rows)
    .select('*');

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicRehearsalAttendeeRow[];
}
