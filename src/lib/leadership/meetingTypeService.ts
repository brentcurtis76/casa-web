/**
 * Meeting Type Service — Supabase CRUD for meeting types and their members
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MeetingTypeRow,
  MeetingTypeInsert,
  MeetingTypeUpdate,
  MeetingTypeMemberRow,
  MeetingTypeMemberInsert,
  MeetingTypeWithMembers,
} from '@/types/leadershipModule';

/**
 * Get all meeting types ordered by display name.
 */
export async function getMeetingTypes(): Promise<MeetingTypeRow[]> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_types')
    .select('*')
    .order('display_name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingTypeRow[];
}

/**
 * Get a single meeting type by ID with its members (nested select).
 */
export async function getMeetingType(id: string): Promise<MeetingTypeWithMembers> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_types')
    .select('*, church_leadership_meeting_type_members(*)')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as MeetingTypeWithMembers;
}

/**
 * Create a new meeting type.
 */
export async function createMeetingType(
  meetingType: MeetingTypeInsert,
): Promise<MeetingTypeRow> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_types')
    .insert(meetingType)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingTypeRow;
}

/**
 * Update an existing meeting type.
 */
export async function updateMeetingType(
  id: string,
  update: MeetingTypeUpdate,
): Promise<MeetingTypeRow> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_types')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingTypeRow;
}

/**
 * Delete a meeting type (only non-system types, enforced by RLS).
 */
export async function deleteMeetingType(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_leadership_meeting_types')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get all members of a meeting type.
 */
export async function getMeetingTypeMembers(
  meetingTypeId: string,
): Promise<MeetingTypeMemberRow[]> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_type_members')
    .select('*')
    .eq('meeting_type_id', meetingTypeId)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as MeetingTypeMemberRow[];
}

/**
 * Add a member to a meeting type.
 */
export async function addMeetingTypeMember(
  member: MeetingTypeMemberInsert,
): Promise<MeetingTypeMemberRow> {
  const { data, error } = await supabase
    .from('church_leadership_meeting_type_members')
    .insert(member)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MeetingTypeMemberRow;
}

/**
 * Remove a member from a meeting type.
 */
export async function removeMeetingTypeMember(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_leadership_meeting_type_members')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
