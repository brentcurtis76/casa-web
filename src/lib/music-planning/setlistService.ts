/**
 * Setlist Service — Supabase CRUD for setlist tables.
 *
 * Covers: music_setlists, music_setlist_items
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicSetlistRow,
  MusicSetlistInsert,
  MusicSetlistUpdate,
  MusicSetlistItemRow,
  MusicSetlistItemInsert,
  MusicSetlistItemUpdate,
  MusicSongRow,
  SetlistWithItems,
} from '@/types/musicPlanning';

// =====================================================
// SETLISTS — CRUD
// =====================================================

/**
 * List setlists with optional date range filter via joined music_service_dates.
 * Order by music_service_dates(date) ascending.
 */
export async function getSetlists(
  from?: string,
  to?: string
): Promise<(MusicSetlistRow & { music_service_dates: { date: string; service_type: string; title: string | null } | null })[]> {
  let query = supabase
    .from('music_setlists')
    .select('*, music_service_dates(date, service_type, title)')
    .order('date', { ascending: true, referencedTable: 'music_service_dates' });

  if (from) query = query.gte('music_service_dates.date', from);
  if (to) query = query.lte('music_service_dates.date', to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as (MusicSetlistRow & { music_service_dates: { date: string; service_type: string; title: string | null } | null })[];
}

/**
 * Get all setlists for a specific service date.
 */
export async function getSetlistsForServiceDate(serviceDateId: string): Promise<MusicSetlistRow[]> {
  const { data, error } = await supabase
    .from('music_setlists')
    .select('*')
    .eq('service_date_id', serviceDateId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicSetlistRow[];
}

/**
 * Get single setlist by ID with items joined to music_songs, ordered by sort_order ascending.
 */
export async function getSetlistById(id: string): Promise<SetlistWithItems | null> {
  const { data, error } = await supabase
    .from('music_setlists')
    .select('*, music_setlist_items(*, music_songs(*))')
    .eq('id', id)
    .order('sort_order', { ascending: true, referencedTable: 'music_setlist_items' })
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as unknown as SetlistWithItems;
}

/**
 * Create a new setlist.
 */
export async function createSetlist(setlist: MusicSetlistInsert): Promise<MusicSetlistRow> {
  const { data, error } = await supabase
    .from('music_setlists')
    .insert(setlist)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicSetlistRow;
}

/**
 * Update a setlist by ID.
 */
export async function updateSetlist(id: string, updates: MusicSetlistUpdate): Promise<MusicSetlistRow> {
  const { data, error } = await supabase
    .from('music_setlists')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicSetlistRow;
}

/**
 * Delete a setlist by ID. CASCADE handles items.
 */
export async function deleteSetlist(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_setlists')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Duplicate a setlist: create new setlist + copy all items.
 * New setlist gets title "(copia)", status = 'draft', same service_date_id.
 */
export async function duplicateSetlist(
  sourceSetlistId: string,
  targetServiceDateId: string
): Promise<MusicSetlistRow> {
  const original = await getSetlistById(sourceSetlistId);
  if (!original) throw new Error('Setlist no encontrada');

  const newSetlist = await createSetlist({
    service_date_id: targetServiceDateId,
    title: (original.title ?? 'Setlist') + ' (copia)',
    status: 'draft',
  });

  if (original.music_setlist_items.length > 0) {
    const itemRows = original.music_setlist_items.map((item) => ({
      setlist_id: newSetlist.id,
      song_id: item.song_id,
      arrangement_id: item.arrangement_id,
      liturgical_moment: item.liturgical_moment,
      song_key: item.song_key,
      sort_order: item.sort_order,
      notes: item.notes,
      transition_notes: item.transition_notes,
    }));

    const { error } = await supabase
      .from('music_setlist_items')
      .insert(itemRows);

    if (error) throw new Error(error.message);
  }

  return newSetlist;
}

// =====================================================
// SETLIST ITEMS — CRUD
// =====================================================

/**
 * Get items for a setlist joined to music_songs, ordered by sort_order ascending.
 */
export async function getSetlistItems(
  setlistId: string
): Promise<(MusicSetlistItemRow & { music_songs: MusicSongRow })[]> {
  const { data, error } = await supabase
    .from('music_setlist_items')
    .select('*, music_songs(*)')
    .eq('setlist_id', setlistId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as (MusicSetlistItemRow & { music_songs: MusicSongRow })[];
}

/**
 * Add a song to a setlist.
 */
export async function addSetlistItem(item: MusicSetlistItemInsert): Promise<MusicSetlistItemRow> {
  const { data, error } = await supabase
    .from('music_setlist_items')
    .insert(item)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicSetlistItemRow;
}

/**
 * Update a setlist item (key, moment, notes, transition_notes).
 */
export async function updateSetlistItem(id: string, updates: MusicSetlistItemUpdate): Promise<MusicSetlistItemRow> {
  const { data, error } = await supabase
    .from('music_setlist_items')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicSetlistItemRow;
}

/**
 * Remove a song from a setlist.
 */
export async function removeSetlistItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_setlist_items')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Batch reorder setlist items. Takes array of { id, sort_order }.
 * Uses Promise.all with individual updates (small N — typically <15 songs).
 */
export async function reorderSetlistItems(items: { id: string; sort_order: number }[]): Promise<void> {
  await Promise.all(
    items.map(({ id, sort_order }) =>
      supabase
        .from('music_setlist_items')
        .update({ sort_order })
        .eq('id', id)
        .then(({ error }) => {
          if (error) throw new Error(error.message);
        })
    )
  );
}
