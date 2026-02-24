/**
 * Participant Service — Supabase CRUD for church_leadership_meeting_participants
 * NOTE: Table is `church_leadership_meeting_participants` (NOT `church_leadership_participants`)
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MeetingParticipantRow,
  MeetingParticipantInsert,
} from '@/types/leadershipModule';

/**
 * Get all participants for a meeting.
 */
export async function getParticipants(meetingId: string): Promise<MeetingParticipantRow[]> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_participants')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('invited_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingParticipantRow[];
}

/**
 * Add a participant to a meeting.
 */
export async function addParticipant(
  participant: MeetingParticipantInsert,
): Promise<MeetingParticipantRow> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_participants')
    .insert(participant)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingParticipantRow;
}

/**
 * Remove a participant from a meeting.
 */
export async function removeParticipant(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_leadership_meeting_participants')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Mark a participant as attended or not attended.
 */
export async function markAttendance(
  id: string,
  attended: boolean,
): Promise<MeetingParticipantRow> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_participants')
    .update({ attended, responded_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingParticipantRow;
}

/**
 * Bulk add multiple participants to a meeting.
 */
export async function bulkAddParticipants(
  meetingId: string,
  userIds: string[],
): Promise<MeetingParticipantRow[]> {
  const participants = userIds.map((userId) => ({
    meeting_id: meetingId,
    user_id: userId,
  }));

  const { data, error } = await supabase
    .from('church_leadership_meeting_participants')
    .insert(participants)
    .select('*');

  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingParticipantRow[];
}
