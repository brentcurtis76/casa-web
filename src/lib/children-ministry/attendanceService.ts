/**
 * Attendance Service — Supabase CRUD for attendance records
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChildrenAttendanceRow,
  ChildrenAttendanceInsert,
  ChildrenAttendanceUpdate,
} from '@/types/childrenMinistry';

/**
 * Get all attendance records for a calendar session.
 */
export async function getAttendance(calendarId: string): Promise<ChildrenAttendanceRow[]> {
  const { data, error } = await supabase
    .from('church_children_attendance')
    .select('*')
    .eq('calendar_id', calendarId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenAttendanceRow[];
}

/**
 * Mark attendance for multiple children (bulk insert).
 */
export async function markAttendance(
  records: ChildrenAttendanceInsert[],
): Promise<ChildrenAttendanceRow[]> {
  const { data, error } = await supabase
    .from('church_children_attendance')
    .insert(records)
    .select('*');

  if (error) throw new Error(error.message);
  return (data ?? []) as ChildrenAttendanceRow[];
}

/**
 * Update a single attendance record.
 */
export async function updateAttendance(
  id: string,
  update: ChildrenAttendanceUpdate,
): Promise<ChildrenAttendanceRow> {
  const { data, error } = await supabase
    .from('church_children_attendance')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as ChildrenAttendanceRow;
}

/**
 * Delete an attendance record.
 */
export async function deleteAttendance(id: string): Promise<void> {
  const { error } = await supabase
    .from('church_children_attendance')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
}

/**
 * Get attendance summary for a date range.
 * Groups by date and counts records where is_present = true.
 * Client-side aggregation of fetched records.
 */
export async function getAttendanceSummary(
  from: string,
  to: string,
): Promise<{ date: string; count: number }[]> {
  const fromTimestamp = from + 'T00:00:00';
  const toTimestamp = to + 'T23:59:59';

  const { data, error } = await supabase
    .from('church_children_attendance')
    .select('calendar_id, is_present, church_children_calendar(date)')
    .gte('created_at', fromTimestamp)
    .lte('created_at', toTimestamp);

  if (error) throw new Error(error.message);

  const records = data ?? [];

  const summaryMap = new Map<string, number>();
  records.forEach((record) => {
    const calendarData = record.church_children_calendar as { date: string } | null;
    if (record.is_present && calendarData?.date) {
      const date = calendarData.date;
      summaryMap.set(date, (summaryMap.get(date) ?? 0) + 1);
    }
  });

  const summary = Array.from(summaryMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return summary;
}
