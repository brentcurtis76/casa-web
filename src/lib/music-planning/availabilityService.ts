/**
 * Availability Service — Supabase CRUD for scheduling tables.
 *
 * Covers: music_service_dates, music_recurring_availability,
 *         music_availability_overrides, music_service_assignments
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  MusicServiceDateRow,
  MusicServiceDateInsert,
  MusicServiceDateUpdate,
  MusicRecurringAvailabilityRow,
  MusicRecurringAvailabilityInsert,
  MusicRecurringAvailabilityUpdate,
  MusicAvailabilityOverrideRow,
  MusicAvailabilityOverrideInsert,
  MusicServiceAssignmentRow,
  MusicServiceAssignmentInsert,
  MusicServiceAssignmentUpdate,
  MusicMusicianRow,
  ServiceDateFull,
} from '@/types/musicPlanning';

// =====================================================
// SERVICE DATES — CRUD
// =====================================================

/**
 * List service dates, optionally filtered by date range.
 */
export async function getServiceDates(from?: string, to?: string): Promise<MusicServiceDateRow[]> {
  let query = supabase
    .from('music_service_dates')
    .select('*')
    .order('date', { ascending: true });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as MusicServiceDateRow[];
}

/**
 * Get a single service date with assignments and overrides (with musician names).
 */
export async function getServiceDateById(id: string): Promise<ServiceDateFull | null> {
  const { data, error } = await supabase
    .from('music_service_dates')
    .select('*, music_service_assignments(*, music_musicians(*)), music_availability_overrides(*, music_musicians(*))')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as unknown as ServiceDateFull;
}

/**
 * Insert a new service date.
 */
export async function createServiceDate(serviceDate: MusicServiceDateInsert): Promise<MusicServiceDateRow> {
  const { data, error } = await supabase
    .from('music_service_dates')
    .insert(serviceDate)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicServiceDateRow;
}

/**
 * Update a service date.
 */
export async function updateServiceDate(id: string, updates: MusicServiceDateUpdate): Promise<MusicServiceDateRow> {
  const { data, error } = await supabase
    .from('music_service_dates')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicServiceDateRow;
}

/**
 * Delete a service date. CASCADE handles assignments + overrides.
 */
export async function deleteServiceDate(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_service_dates')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get upcoming service dates (date >= today), ordered ascending.
 */
export async function getUpcomingServiceDates(limit: number = 10): Promise<MusicServiceDateRow[]> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('music_service_dates')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicServiceDateRow[];
}

// =====================================================
// RECURRING AVAILABILITY — CRUD
// =====================================================

/**
 * Get all recurring availability patterns for a musician.
 */
export async function getRecurringAvailability(musicianId: string): Promise<MusicRecurringAvailabilityRow[]> {
  const { data, error } = await supabase
    .from('music_recurring_availability')
    .select('*')
    .eq('musician_id', musicianId)
    .order('effective_from', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicRecurringAvailabilityRow[];
}

/**
 * Create a recurring availability pattern.
 */
export async function createRecurringAvailability(
  availability: MusicRecurringAvailabilityInsert
): Promise<MusicRecurringAvailabilityRow> {
  const { data, error } = await supabase
    .from('music_recurring_availability')
    .insert(availability)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicRecurringAvailabilityRow;
}

/**
 * Update a recurring availability pattern.
 */
export async function updateRecurringAvailability(
  id: string,
  updates: MusicRecurringAvailabilityUpdate
): Promise<MusicRecurringAvailabilityRow> {
  const { data, error } = await supabase
    .from('music_recurring_availability')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicRecurringAvailabilityRow;
}

/**
 * Delete a recurring availability pattern.
 */
export async function deleteRecurringAvailability(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_recurring_availability')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// AVAILABILITY OVERRIDES — CRUD
// =====================================================

/**
 * Get all overrides for a service date with musician names.
 */
export async function getOverridesForServiceDate(
  serviceDateId: string
): Promise<(MusicAvailabilityOverrideRow & { music_musicians: { display_name: string } })[]> {
  const { data, error } = await supabase
    .from('music_availability_overrides')
    .select('*, music_musicians(display_name)')
    .eq('service_date_id', serviceDateId)
    .order('music_musicians(display_name)', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as (MusicAvailabilityOverrideRow & { music_musicians: { display_name: string } })[];
}

/**
 * Get all overrides for a musician with service date details.
 */
export async function getOverridesForMusician(
  musicianId: string
): Promise<(MusicAvailabilityOverrideRow & { music_service_dates: MusicServiceDateRow })[]> {
  const { data, error } = await supabase
    .from('music_availability_overrides')
    .select('*, music_service_dates(*)')
    .eq('musician_id', musicianId)
    .order('music_service_dates(date)', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as (MusicAvailabilityOverrideRow & { music_service_dates: MusicServiceDateRow })[];
}

/**
 * Upsert an availability override. Uses atomic .upsert() with
 * unique constraint on (musician_id, service_date_id).
 */
export async function upsertOverride(
  override: MusicAvailabilityOverrideInsert
): Promise<MusicAvailabilityOverrideRow> {
  const { data, error } = await supabase
    .from('music_availability_overrides')
    .upsert(
      { ...override, submitted_at: new Date().toISOString() },
      { onConflict: 'musician_id,service_date_id' }
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicAvailabilityOverrideRow;
}

/**
 * Batch-fetch overrides for multiple service dates in a single query.
 */
export async function getOverridesForServiceDates(
  serviceDateIds: string[]
): Promise<MusicAvailabilityOverrideRow[]> {
  if (serviceDateIds.length === 0) return [];
  const { data, error } = await supabase
    .from('music_availability_overrides')
    .select('*')
    .in('service_date_id', serviceDateIds);

  if (error) throw new Error(error.message);
  return (data ?? []) as MusicAvailabilityOverrideRow[];
}

/**
 * Delete an availability override.
 */
export async function deleteOverride(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_availability_overrides')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

// =====================================================
// SERVICE ASSIGNMENTS — CRUD
// =====================================================

/**
 * Get all assignments for a service date with musician details.
 */
export async function getAssignmentsForServiceDate(
  serviceDateId: string
): Promise<(MusicServiceAssignmentRow & { music_musicians: MusicMusicianRow })[]> {
  const { data, error } = await supabase
    .from('music_service_assignments')
    .select('*, music_musicians(*)')
    .eq('service_date_id', serviceDateId);

  if (error) throw new Error(error.message);
  return (data ?? []) as (MusicServiceAssignmentRow & { music_musicians: MusicMusicianRow })[];
}

/**
 * Create a service assignment.
 */
export async function createAssignment(assignment: MusicServiceAssignmentInsert): Promise<MusicServiceAssignmentRow> {
  const { data, error } = await supabase
    .from('music_service_assignments')
    .insert(assignment)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicServiceAssignmentRow;
}

/**
 * Update a service assignment.
 */
export async function updateAssignment(
  id: string,
  updates: MusicServiceAssignmentUpdate
): Promise<MusicServiceAssignmentRow> {
  const { data, error } = await supabase
    .from('music_service_assignments')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as MusicServiceAssignmentRow;
}

/**
 * Delete a service assignment.
 */
export async function deleteAssignment(id: string): Promise<void> {
  const { error } = await supabase
    .from('music_service_assignments')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}
