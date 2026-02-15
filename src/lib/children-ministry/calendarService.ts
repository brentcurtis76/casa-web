/**
 * Calendar Service — Supabase CRUD for class sessions
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChildrenCalendarRow,
  ChildrenCalendarInsert,
  ChildrenCalendarUpdate,
  ChildrenCalendarFull,
  CalendarFilters,
} from '@/types/childrenMinistry';

/**
 * Get calendar sessions with optional filters, including nested joins
 * (age_groups, lessons, session_assignments with volunteers).
 */
export async function getCalendarSessions(filters?: CalendarFilters): Promise<ChildrenCalendarFull[]> {
  let query = supabase
    .from('church_children_calendar')
    .select(
      '*, church_children_age_groups(*), church_children_lessons(*), church_children_session_assignments(*, church_children_volunteers(*))',
    );

  if (filters?.from) {
    query = query.gte('date', filters.from);
  }

  if (filters?.to) {
    query = query.lte('date', filters.to);
  }

  if (filters?.age_group_id) {
    query = query.eq('age_group_id', filters.age_group_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ChildrenCalendarFull[];
}

/**
 * Get a single session by ID with nested joins.
 */
export async function getSession(id: string): Promise<ChildrenCalendarFull> {
  const { data, error } = await supabase
    .from('church_children_calendar')
    .select(
      '*, church_children_age_groups(*), church_children_lessons(*), church_children_session_assignments(*, church_children_volunteers(*))',
    )
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as ChildrenCalendarFull;
}

/**
 * Create a new calendar session.
 */
export async function createSession(
  session: ChildrenCalendarInsert,
): Promise<ChildrenCalendarRow> {
  const { data, error } = await supabase
    .from('church_children_calendar')
    .insert(session)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenCalendarRow;
}

/**
 * Update a calendar session.
 */
export async function updateSession(
  id: string,
  update: ChildrenCalendarUpdate,
): Promise<ChildrenCalendarRow> {
  const { data, error } = await supabase
    .from('church_children_calendar')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenCalendarRow;
}

/**
 * Delete a calendar session.
 */
export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_children_calendar')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get upcoming sessions (date >= today), with optional limit.
 */
export async function getUpcomingSessions(limit?: number): Promise<ChildrenCalendarFull[]> {
  const today = new Date().toISOString().split('T')[0];

  let query = supabase
    .from('church_children_calendar')
    .select(
      '*, church_children_age_groups(*), church_children_lessons(*), church_children_session_assignments(*, church_children_volunteers(*))',
    )
    .gte('date', today)
    .order('date', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ChildrenCalendarFull[];
}
