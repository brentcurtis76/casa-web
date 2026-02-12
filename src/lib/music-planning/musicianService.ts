/**
 * Musician Service — Supabase CRUD for musician roster tables.
 *
 * Covers: music_musicians, music_musician_instruments
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicMusicianRow,
  MusicMusicianInsert,
  MusicMusicianUpdate,
  MusicMusicianInstrumentRow,
  MusicMusicianInstrumentInsert,
  MusicianFull,
  MusicianListFilters,
  InstrumentType,
} from '@/types/musicPlanning';

/** Musician row with inline instrument list for table display */
export type MusicianWithInstruments = MusicMusicianRow & {
  instruments: { instrument: InstrumentType; is_primary: boolean }[];
};

// =====================================================
// MUSICIANS — CRUD
// =====================================================

/**
 * List musicians with optional filters.
 * Text search on display_name/email, instrument filter via two-step query,
 * is_active filter. Ordered by display_name ascending.
 */
export async function getMusicians(filters?: MusicianListFilters): Promise<MusicianWithInstruments[]> {
  let query = supabase
    .from('music_musicians')
    .select('*, music_musician_instruments(instrument, is_primary)')
    .order('display_name', { ascending: true });

  if (filters?.query) {
    const pattern = `%${filters.query}%`;
    query = query.or(`display_name.ilike.${pattern},email.ilike.${pattern}`);
  }

  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let musicians = (data ?? []) as (MusicMusicianRow & {
    music_musician_instruments: { instrument: InstrumentType; is_primary: boolean }[];
  })[];

  // Client-side filter for instrument (PostgREST can't filter parent by child column)
  if (filters?.instrument) {
    musicians = musicians.filter((m) =>
      m.music_musician_instruments.some((i) => i.instrument === filters.instrument)
    );
  }

  // Reshape: move nested instruments to a cleaner `instruments` field
  return musicians.map(({ music_musician_instruments, ...rest }) => ({
    ...rest,
    instruments: music_musician_instruments,
  }));
}

/**
 * Get a single musician by UUID with instruments and recurring availability.
 */
export async function getMusicianById(id: string): Promise<MusicianFull | null> {
  const { data, error } = await supabase
    .from('music_musicians')
    .select('*, music_musician_instruments(*), music_recurring_availability(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as unknown as MusicianFull;
}

/**
 * Insert a new musician.
 */
export async function createMusician(musician: MusicMusicianInsert): Promise<MusicMusicianRow> {
  const { data, error } = await supabase
    .from('music_musicians')
    .insert(musician)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicMusicianRow;
}

/**
 * Update an existing musician by UUID.
 */
export async function updateMusician(id: string, updates: MusicMusicianUpdate): Promise<MusicMusicianRow> {
  const { data, error } = await supabase
    .from('music_musicians')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicMusicianRow;
}

/**
 * Delete a musician by UUID. CASCADE handles instruments + availability.
 */
export async function deleteMusician(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_musicians')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Batch-fetch all active musicians with instruments + recurring availability.
 * Single query per table instead of N+1.
 */
export async function getMusiciansFullData(): Promise<MusicianFull[]> {
  const { data, error } = await supabase
    .from('music_musicians')
    .select('*, music_musician_instruments(*), music_recurring_availability(*)')
    .eq('is_active', true)
    .order('display_name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MusicianFull[];
}

// =====================================================
// INSTRUMENTS — CRUD
// =====================================================

/**
 * Get instruments for a musician.
 */
export async function getInstrumentsByMusicianId(musicianId: string): Promise<MusicMusicianInstrumentRow[]> {
  const { data, error } = await supabase
    .from('music_musician_instruments')
    .select('*')
    .eq('musician_id', musicianId);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicMusicianInstrumentRow[];
}

/**
 * Add an instrument to a musician.
 */
export async function addInstrument(instrument: MusicMusicianInstrumentInsert): Promise<MusicMusicianInstrumentRow> {
  const { data, error } = await supabase
    .from('music_musician_instruments')
    .insert(instrument)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicMusicianInstrumentRow;
}

/**
 * Remove an instrument by row id.
 */
export async function removeInstrument(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_musician_instruments')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Update an instrument (proficiency or is_primary).
 */
export async function updateInstrument(
  id: string,
  updates: Partial<MusicMusicianInstrumentInsert>
): Promise<MusicMusicianInstrumentRow> {
  const { data, error } = await supabase
    .from('music_musician_instruments')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicMusicianInstrumentRow;
}
