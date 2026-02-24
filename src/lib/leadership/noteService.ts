/**
 * Note Service — Supabase CRUD for church_leadership_notes
 */

import { supabase } from '@/integrations/supabase/client';
import type { NoteRow, NoteInsert, NoteUpdate } from '@/types/leadershipModule';

/**
 * Get all notes for a meeting, newest first.
 */
export async function getNotes(meetingId: string): Promise<NoteRow[]> {
  const { data, error } = await supabase
    .from('church_leadership_notes')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as NoteRow[];
}

/**
 * Create a new note.
 */
export async function createNote(note: NoteInsert): Promise<NoteRow> {
  const { data, error } = await supabase
    .from('church_leadership_notes')
    .insert(note)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as NoteRow;
}

/**
 * Update a note.
 */
export async function updateNote(id: string, update: NoteUpdate): Promise<NoteRow> {
  const { data, error } = await supabase
    .from('church_leadership_notes')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as NoteRow;
}

/**
 * Delete a note.
 */
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_leadership_notes')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get the official minutes (is_official=true) for a meeting.
 */
export async function getOfficialMinutes(meetingId: string): Promise<NoteRow | null> {
  const { data, error } = await supabase
    .from('church_leadership_notes')
    .select('*')
    .eq('meeting_id', meetingId)
    .eq('is_official', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as NoteRow) || null;
}

/**
 * Set a note as the official minutes for its meeting.
 * Automatically unsets any previous official minutes for the same meeting.
 */
export async function setOfficialMinutes(id: string, meetingId: string): Promise<NoteRow> {
  // Unset is_official for any previous official note
  const { error: unsetError } = await supabase
    .from('church_leadership_notes')
    .update({ is_official: false })
    .eq('meeting_id', meetingId)
    .eq('is_official', true);

  if (unsetError) throw new Error(unsetError.message);

  // Set this note as official
  const { data, error } = await supabase
    .from('church_leadership_notes')
    .update({ is_official: true })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as NoteRow;
}
