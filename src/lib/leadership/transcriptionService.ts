/**
 * Transcription Service — Trigger and manage recording transcriptions via edge function
 */

import { supabase } from '@/integrations/supabase/client';
import type { RecordingRow } from '@/types/leadershipModule';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://mulsqxfhxxdsadxsljss.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11bHNxeGZoeHhkc2FkeHNsanNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0NzE2ODAsImV4cCI6MjA1OTA0NzY4MH0.K4KKonF8Sd_PbFZtunMTuAAf2rFCGjvuecW3Hn46Cb8';

/**
 * Trigger transcription for a recording by calling the transcribe-meeting edge function.
 * Sets status to 'pending' before invoking, then the edge function transitions to
 * 'processing' -> 'completed' or 'failed'.
 *
 * Uses a direct fetch instead of supabase.functions.invoke so we can surface the
 * edge function's actual error body (including `detail`) to the UI instead of the
 * library's generic "non-2xx response" message.
 */
export async function triggerTranscription(recordingId: string): Promise<void> {
  // Mark as pending up-front so the UI reflects the attempt.
  const { error: updateError } = await supabase
    .from('church_leadership_recordings')
    .update({ transcription_status: 'pending' })
    .eq('id', recordingId);

  if (updateError) throw new Error(updateError.message);

  // Grab the current session's access token so the edge function can verify
  // the caller and check leadership:write permission.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    await supabase
      .from('church_leadership_recordings')
      .update({ transcription_status: 'failed' })
      .eq('id', recordingId);
    throw new Error(
      `Sesión expirada. Cierra sesión, inicia sesión de nuevo e intenta otra vez.`,
    );
  }

  const accessToken = sessionData.session.access_token;

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/transcribe-meeting`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ recording_id: recordingId }),
    });
  } catch (networkErr) {
    await supabase
      .from('church_leadership_recordings')
      .update({ transcription_status: 'failed' })
      .eq('id', recordingId);
    throw new Error(
      `Error de red al invocar la transcripción: ${
        networkErr instanceof Error ? networkErr.message : String(networkErr)
      }`,
    );
  }

  if (response.ok) {
    // 202/200 — edge function started processing; status will flip to
    // 'processing' then 'completed' via its own DB updates.
    return;
  }

  // Try to extract a useful error detail from the response body.
  let bodyText = '';
  let bodyJson: { error?: string; detail?: string } | null = null;
  try {
    bodyText = await response.text();
    bodyJson = JSON.parse(bodyText);
  } catch {
    /* response body wasn't JSON; keep bodyText as-is */
  }

  const errorPiece = bodyJson?.error ?? '';
  const detailPiece = bodyJson?.detail ?? '';
  const composed = [errorPiece, detailPiece].filter(Boolean).join(' — ');
  const humanMessage = composed || bodyText || `HTTP ${response.status}`;

  // Revert status so the UI can show the retry button again.
  await supabase
    .from('church_leadership_recordings')
    .update({ transcription_status: 'failed' })
    .eq('id', recordingId);

  throw new Error(`Error al iniciar la transcripción: ${humanMessage}`);
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
