/**
 * Availability Helpers — Compute musician availability from patterns + overrides.
 */

import { getDate, lastDayOfMonth, isBefore, isAfter, parseISO } from 'date-fns';
import type {
  MusicianFull,
  MusicServiceDateRow,
  MusicAvailabilityOverrideRow,
  AvailabilityPatternType,
} from '@/types/musicPlanning';

/**
 * Determine which "week of month" a date falls on (1–5).
 * Week 1 = days 1–7, Week 2 = days 8–14, etc.
 */
export function getWeekOfMonth(date: Date): number {
  return Math.ceil(getDate(date) / 7);
}

/**
 * Check if a date is the last occurrence of its weekday in the month.
 */
export function isLastWeekOfMonth(date: Date): boolean {
  const day = getDate(date);
  const lastDay = getDate(lastDayOfMonth(date));
  return day > lastDay - 7;
}

/**
 * Check if a pattern_type matches a given date.
 */
export function patternMatchesDate(
  patternType: AvailabilityPatternType,
  customWeeks: number[] | null,
  date: Date
): boolean {
  const week = getWeekOfMonth(date);

  switch (patternType) {
    case 'every_week':
      return true;
    case 'first_and_third':
      return week === 1 || week === 3;
    case 'second_and_fourth':
      return week === 2 || week === 4;
    case 'first_only':
      return week === 1;
    case 'second_only':
      return week === 2;
    case 'third_only':
      return week === 3;
    case 'fourth_only':
      return week === 4;
    case 'last_only':
      return isLastWeekOfMonth(date);
    case 'custom':
      return customWeeks?.includes(week) ?? false;
    default:
      return false;
  }
}

/**
 * Compute a musician's availability status for a given service date.
 *
 * Priority: override > recurring pattern > unknown
 */
export function computeAvailabilityStatus(
  musician: MusicianFull,
  serviceDate: MusicServiceDateRow,
  overrides: MusicAvailabilityOverrideRow[]
): 'available' | 'unavailable' | 'maybe' | 'unknown' {
  // 1. Check for explicit override
  const override = overrides.find(
    (o) => o.musician_id === musician.id && o.service_date_id === serviceDate.id
  );
  if (override) return override.status;

  // 2. Check recurring patterns
  const date = parseISO(serviceDate.date);
  for (const pattern of musician.music_recurring_availability) {
    const from = parseISO(pattern.effective_from);
    const until = pattern.effective_until ? parseISO(pattern.effective_until) : null;

    // Check if pattern is currently effective
    if (isBefore(date, from)) continue;
    if (until && isAfter(date, until)) continue;

    // Check if pattern matches this date
    if (patternMatchesDate(pattern.pattern_type, pattern.custom_weeks, date)) {
      return 'available';
    }
  }

  // 3. No override, no matching pattern
  return 'unknown';
}
