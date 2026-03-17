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
  AssignmentRole,
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
 * Get currently-effective recurring availability for a volunteer.
 * Filters by effective date range and deduplicates per day_of_week,
 * keeping the most recent effective_from record.
 */
export async function getRecurringAvailability(
  volunteerId: string,
): Promise<ChildrenRecurringAvailabilityRow[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('church_children_recurring_availability')
    .select('*')
    .eq('volunteer_id', volunteerId)
    .lte('effective_from', today)
    .order('effective_from', { ascending: false });

  if (error) throw new Error(error.message);

  // Client-side filter for effective_until (null = indefinite, or >= today)
  const withinRange = (data ?? []).filter((record) => {
    const until = record.effective_until as string | null;
    return until === null || until >= today;
  });

  // Deduplicate per day_of_week: first-wins = most recent effective_from
  const byDay = new Map<number, ChildrenRecurringAvailabilityRow>();
  for (const record of withinRange) {
    if (!byDay.has(record.day_of_week)) {
      byDay.set(record.day_of_week, record as ChildrenRecurringAvailabilityRow);
    }
  }

  return Array.from(byDay.values());
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
 * Supabase returns the join under key `church_children_volunteers`.
 * We remap it to `volunteer` to match the ChildrenCalendarFull composite type.
 */
export async function getSessionAssignments(
  calendarId: string,
): Promise<(ChildrenSessionAssignmentRow & { volunteer: ChildrenVolunteerRow })[]> {
  const { data, error } = await supabase
    .from('church_children_session_assignments')
    .select('*, church_children_volunteers(*)')
    .eq('calendar_id', calendarId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { church_children_volunteers, ...assignment } = row as ChildrenSessionAssignmentRow & {
      church_children_volunteers: ChildrenVolunteerRow;
    };
    return { ...assignment, volunteer: church_children_volunteers };
  });
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
 * Fetches ALL availability records for the day, deduplicates per volunteer
 * by most-recent effective_from (same pattern as getRecurringAvailability),
 * then returns only volunteers whose most-recent record is is_available=true.
 */
export async function getAvailableVolunteers(
  date: string,
  dayOfWeek: number,
): Promise<ChildrenVolunteerRow[]> {
  // Fetch ALL records for this day_of_week (not just is_available=true)
  // so superseding is_available=false records are considered
  const { data, error } = await supabase
    .from('church_children_recurring_availability')
    .select('volunteer_id, is_available, effective_from, effective_until, church_children_volunteers(*)')
    .eq('day_of_week', dayOfWeek)
    .lte('effective_from', date)
    .order('effective_from', { ascending: false });

  if (error) throw new Error(error.message);

  // Client-side filter for effective_until (null = indefinite, or >= date)
  const withinRange = (data ?? []).filter((record) => {
    const until = record.effective_until as string | null;
    return until === null || until >= date;
  });

  // Deduplicate per volunteer_id: first-wins = most recent effective_from
  // Then only keep volunteers whose most-recent record says is_available=true
  const byVolunteer = new Map<string, typeof withinRange[number]>();
  for (const record of withinRange) {
    if (!byVolunteer.has(record.volunteer_id)) {
      byVolunteer.set(record.volunteer_id, record);
    }
  }

  const volunteers: ChildrenVolunteerRow[] = [];
  for (const record of byVolunteer.values()) {
    if (!record.is_available) continue;
    const v = record.church_children_volunteers as ChildrenVolunteerRow | null;
    if (v != null && v.is_active) {
      volunteers.push(v);
    }
  }

  return volunteers;
}

/**
 * Get existing assignments for a set of volunteers on a specific date.
 * Used for conflict detection when assigning volunteers to sessions.
 * Filters by date server-side via inner join on church_children_calendar.
 */
export async function getVolunteerAssignmentsByDate(
  volunteerIds: string[],
  date: string,
): Promise<Array<{
  volunteer_id: string;
  calendar_id: string;
  session_date: string;
  session_start_time: string;
  session_end_time: string;
  role: AssignmentRole;
}>> {
  if (volunteerIds.length === 0) return [];

  // Use !inner join to filter assignments to only those whose calendar date matches.
  // This avoids fetching all historical assignments and filtering client-side.
  const { data, error } = await supabase
    .from('church_children_session_assignments')
    .select('volunteer_id, role, calendar_id, church_children_calendar!inner(date, start_time, end_time)')
    .in('volunteer_id', volunteerIds)
    .eq('church_children_calendar.date', date);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const cal = row.church_children_calendar as { date: string; start_time: string; end_time: string };
    return {
      volunteer_id: row.volunteer_id,
      calendar_id: row.calendar_id,
      session_date: cal.date,
      session_start_time: cal.start_time,
      session_end_time: cal.end_time,
      role: row.role as AssignmentRole,
    };
  });
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
