/**
 * Transcription Service — Trigger and manage recording transcriptions via edge function
 */

import { supabase } from '@/integrations/supabase/client';
import type { RecordingRow } from '@/types/leadershipModule';

/**
 * Trigger transcription for a recording by calling the transcribe-meeting edge function.
 * Sets status to 'pending' before invoking, then the edge function transitions to
 * 'processing' -> 'completed' or 'failed'.
 */
export async function triggerTranscription(recordingId: string): Promise<void> {
  // Update recording status to pending
  const { error: updateError } = await supabase
    .from('church_leadership_recordings')
    .update({ transcription_status: 'pending' })
    .eq('id', recordingId);

  if (updateError) throw new Error(updateError.message);

  // Invoke the transcribe-meeting edge function (async — doesn't wait for completion)
  const { error: invokeError } = await supabase.functions.invoke('transcribe-meeting', {
    body: { recording_id: recordingId },
  });

  if (invokeError) {
    // Revert status if invocation failed
    await supabase
      .from('church_leadership_recordings')
      .update({ transcription_status: 'failed' })
      .eq('id', recordingId);

    throw new Error(`Error al iniciar la transcripción: ${invokeError.message}`);
  }
}

/**
 * Get the current transcription status and results for a recording.
 */
export async function getTranscriptionStatus(recordingId: string): Promise<RecordingRow> {
  const { data, error } = await supabase
    .from('church_leadership_recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (error) throw new Error(error.message);
  return data as RecordingRow;
}
