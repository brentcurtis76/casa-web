/**
 * Recording Service — Supabase CRUD for church_leadership_recordings and storage
 */

import { supabase } from '@/integrations/supabase/client';
import type { RecordingRow, RecordingInsert, RecordingUpdate } from '@/types/leadershipModule';

/**
 * Upload a recording file to storage and create a DB record.
 * File is stored in: leadership-recordings/meetings/{meetingId}/{timestamp}_{filename}
 */
export async function uploadRecording(
  meetingId: string,
  file: Blob,
  filename: string,
  userId: string,
): Promise<RecordingRow> {
  const timestamp = Date.now();
  const storagePath = `meetings/${meetingId}/${timestamp}_${filename}`;

  const { error: uploadError } = await supabase.storage
    .from('leadership-recordings')
    .upload(storagePath, file);

  if (uploadError) throw new Error(`Error al subir la grabación: ${uploadError.message}`);

  const recordingInsert: RecordingInsert = {
    meeting_id: meetingId,
    filename,
    storage_path: storagePath,
    mime_type: file.type || 'audio/webm',
    file_size_bytes: file.size,
    created_by: userId,
    transcription_status: 'none',
    transcript_text: null,
    transcript_summary: null,
    transcription_action_items: [],
    transcribed_at: null,
    duration_seconds: null,
  };

  const { data, error } = await supabase
    .from('church_leadership_recordings')
    .insert(recordingInsert)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as RecordingRow;
}

/**
 * Get all recordings for a meeting, newest first.
 */
export async function getRecordings(meetingId: string): Promise<RecordingRow[]> {
  const { data, error } = await supabase
    .from('church_leadership_recordings')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as RecordingRow[];
}

/**
 * Get a signed URL for a recording (valid for 1 hour).
 */
export async function getRecordingUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('leadership-recordings')
    .createSignedUrl(storagePath, 3600);

  if (error) throw new Error(`Error al obtener URL de la grabación: ${error.message}`);
  return data?.signedUrl ?? '';
}

/**
 * Update recording transcription data.
 */
export async function updateRecording(
  id: string,
  update: RecordingUpdate,
): Promise<RecordingRow> {
  const { data, error } = await supabase
    .from('church_leadership_recordings')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as RecordingRow;
}

/**
 * Delete a recording from storage and DB.
 */
export async function deleteRecording(id: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from('leadership-recordings')
    .remove([storagePath]);

  if (storageError) throw new Error(`Error al eliminar el archivo: ${storageError.message}`);

  const { error } = await supabase
    .from('church_leadership_recordings')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
