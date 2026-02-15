/**
 * Volunteer Service — Supabase CRUD for volunteers, availability, and assignments
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChildrenVolunteerRow,
  ChildrenVolunteerInsert,
  ChildrenVolunteerUpdate,
  ChildrenRecurringAvailabilityRow,
  ChildrenRecurringAvailabilityInsert,
  ChildrenSessionAssignmentRow,
  ChildrenSessionAssignmentInsert,
  AssignmentStatus,
  VolunteerFilters,
} from '@/types/childrenMinistry';

// =====================================================
// VOLUNTEER CRUD
// =====================================================

/**
 * Get volunteers with optional filters (is_active, search by display_name).
 */
export async function getVolunteers(filters?: VolunteerFilters): Promise<ChildrenVolunteerRow[]> {
  let query = supabase.from('church_children_volunteers').select('*');

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters?.search) {
    const pattern = `%${filters.search}%`;
    query = query.ilike('display_name', pattern);
  }

  const { data, error } = await query.order('display_name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenVolunteerRow[];
}

/**
 * Get a single volunteer by ID.
 */
export async function getVolunteer(id: string): Promise<ChildrenVolunteerRow> {
  const { data, error } = await supabase
    .from('church_children_volunteers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenVolunteerRow;
}

/**
 * Create a new volunteer.
 */
export async function createVolunteer(volunteer: ChildrenVolunteerInsert): Promise<ChildrenVolunteerRow> {
  const { data, error } = await supabase
    .from('church_children_volunteers')
    .insert(volunteer)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenVolunteerRow;
}

/**
 * Update a volunteer.
 */
export async function updateVolunteer(
  id: string,
  update: ChildrenVolunteerUpdate,
): Promise<ChildrenVolunteerRow> {
  const { data, error } = await supabase
    .from('church_children_volunteers')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenVolunteerRow;
}

/**
 * Delete a volunteer.
 */
export async function deleteVolunteer(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_children_volunteers')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// RECURRING AVAILABILITY
// =====================================================

/**
 * Get recurring availability for a volunteer.
 */
export async function getRecurringAvailability(
  volunteerId: string,
): Promise<ChildrenRecurringAvailabilityRow[]> {
  const { data, error } = await supabase
    .from('church_children_recurring_availability')
    .select('*')
    .eq('volunteer_id', volunteerId)
    .order('day_of_week', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenRecurringAvailabilityRow[];
}

/**
 * Set or update recurring availability for a volunteer on a specific day.
 */
export async function setRecurringAvailability(
  data: ChildrenRecurringAvailabilityInsert,
): Promise<ChildrenRecurringAvailabilityRow> {
  const { data: result, error } = await supabase
    .from('church_children_recurring_availability')
    .insert(data)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return result as ChildrenRecurringAvailabilityRow;
}

// =====================================================
// SESSION ASSIGNMENTS
// =====================================================

/**
 * Get session assignments for a calendar event, with volunteer details.
 */
export async function getSessionAssignments(
  calendarId: string,
): Promise<(ChildrenSessionAssignmentRow & { volunteer: ChildrenVolunteerRow })[]> {
  const { data, error } = await supabase
    .from('church_children_session_assignments')
    .select('*, church_children_volunteers(*)')
    .eq('calendar_id', calendarId);

  if (error) throw new Error(error.message);
  return (data ?? []) as (ChildrenSessionAssignmentRow & { volunteer: ChildrenVolunteerRow })[];
}

/**
 * Assign a volunteer to a session.
 */
export async function assignVolunteer(
  assignment: ChildrenSessionAssignmentInsert,
): Promise<ChildrenSessionAssignmentRow> {
  const { data, error } = await supabase
    .from('church_children_session_assignments')
    .insert(assignment)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenSessionAssignmentRow;
}

/**
 * Update assignment status (e.g., confirmed, declined).
 */
export async function updateAssignmentStatus(
  id: string,
  status: AssignmentStatus,
): Promise<ChildrenSessionAssignmentRow> {
  const { data, error } = await supabase
    .from('church_children_session_assignments')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenSessionAssignmentRow;
}

/**
 * Remove a volunteer from a session.
 */
export async function removeAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_children_session_assignments')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// AVAILABILITY LOOKUP
// =====================================================

/**
 * Get available volunteers for a specific date and day of week.
 * Cross-references recurring_availability with effective date range.
 */
export async function getAvailableVolunteers(
  date: string,
  dayOfWeek: number,
): Promise<ChildrenVolunteerRow[]> {
  const { data: available, error } = await supabase
    .from('church_children_recurring_availability')
    .select('volunteer_id, church_children_volunteers(*)')
    .eq('day_of_week', dayOfWeek)
    .eq('is_available', true)
    .lte('effective_from', date);

  if (error) throw new Error(error.message);

  // Client-side filter for effective_until (null = indefinite, or >= date)
  // This avoids string interpolation in .or() filter
  const withinRange = (available ?? []).filter((record) => {
    const until = record.effective_until as string | null;
    return until === null || until >= date;
  });

  const volunteers = withinRange
    .map((record) => record.church_children_volunteers as unknown as ChildrenVolunteerRow)
    .filter((v): v is ChildrenVolunteerRow => v != null && v.is_active);

  return volunteers;
}

/**
 * Get the volunteer profile for a specific user (by user_id).
 * Returns null if no profile found.
 */
export async function getMyVolunteerProfile(userId: string): Promise<ChildrenVolunteerRow | null> {
  const { data, error } = await supabase
    .from('church_children_volunteers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as ChildrenVolunteerRow | null;
}
