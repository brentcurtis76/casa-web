/**
 * Meeting Service — Supabase CRUD for church_leadership_meetings
 * NOTE: Column is `meeting_date` (DATE), NOT `date`
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MeetingRow,
  MeetingInsert,
  MeetingUpdate,
  MeetingStatus,
  MeetingWithType,
  MeetingFilters,
} from '@/types/leadershipModule';

/**
 * Get meetings with optional filters.
 */
export async function getMeetings(filters?: MeetingFilters): Promise<MeetingRow[]> {
  let query = supabase.from('church_leadership_meetings').select('*');

  if (filters?.meeting_type_id) {
    query = query.eq('meeting_type_id', filters.meeting_type_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.from_date) {
    query = query.gte('meeting_date', filters.from_date);
  }

  if (filters?.to_date) {
    query = query.lte('meeting_date', filters.to_date);
  }

  if (filters?.search) {
    const pattern = `%${filters.search}%`;
    query = query.ilike('title', pattern);
  }

  const { data, error } = await query.order('meeting_date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingRow[];
}

/**
 * Get a single meeting by ID with meeting_type joined.
 */
export async function getMeeting(id: string): Promise<MeetingWithType> {
  const { data, error } = await supabase
    .from('church_leadership_meetings')
    .select('*, meeting_type:church_leadership_meeting_types(*)')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as MeetingWithType;
}

/**
 * Create a new meeting.
 */
export async function createMeeting(meeting: MeetingInsert): Promise<MeetingRow> {
  const { data, error } = await supabase
    .from('church_leadership_meetings')
    .insert(meeting)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingRow;
}

/**
 * Update an existing meeting.
 */
export async function updateMeeting(
  id: string,
  update: MeetingUpdate,
): Promise<MeetingRow> {
  const { data, error } = await supabase
    .from('church_leadership_meetings')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingRow;
}

/**
 * Delete a meeting.
 */
export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_leadership_meetings')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get upcoming scheduled meetings.
 */
export async function getUpcomingMeetings(limit = 10): Promise<MeetingRow[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('church_leadership_meetings')
    .select('*')
    .eq('status', 'scheduled')
    .gte('meeting_date', today)
    .order('meeting_date', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingRow[];
}

/**
 * Update the status of a meeting.
 */
export async function updateMeetingStatus(
  id: string,
  status: MeetingStatus,
): Promise<MeetingRow> {
  const { data, error } = await supabase
    .from('church_leadership_meetings')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingRow;
}

/**
 * Re-export getMeetingTypes from meetingTypeService for convenience.
 */
export { getMeetingTypes } from './meetingTypeService';

/**
 * Get open (non-completed, non-cancelled) commitments count for dashboard.
 */
export async function getOpenCommitments() {
  const { data, error } = await supabase
    .from('church_leadership_commitments')
    .select('*')
    .not('status', 'in', '(completed,cancelled)');

  if (error) throw new Error(error.message);
  return (data ?? []);
}

/**
 * Get overdue commitments for dashboard (due_date < today and not done/cancelled).
 */
export async function getOverdueCommitments() {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('church_leadership_commitments')
    .select('*')
    .lt('due_date', today)
    .not('status', 'in', '(completed,cancelled)');

  if (error) throw new Error(error.message);
  return (data ?? []);
}

/**
 * Get recent activity stub — returns recent meetings for activity feed.
 */
export async function getRecentActivity(limit = 10) {
  const { data, error } = await supabase
    .from('church_leadership_meetings')
    .select('id, title, meeting_date, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((m: Record<string, unknown>) => ({
    type: 'meeting_created',
    description: `Reunión: ${m.title}`,
    created_at: m.created_at,
  }));
}
