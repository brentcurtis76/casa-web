/**
 * Shared formatting utilities for the music-planning domain.
 */

/**
 * Formats a duration in seconds to "m:ss" display format.
 * Returns '--' for null/0 values.
 */
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
