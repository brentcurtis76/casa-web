export interface MonthWorkflow {
  status: string;
  dinner_date?: string | null;
  registration_deadline?: string | null;
}

export interface MatchingGateResult {
  ok: boolean;
  reason?: 'wrong-status' | 'deadline-not-passed';
  deadline?: Date;
}

export function canRunMatching(
  month: MonthWorkflow,
  now: Date = new Date()
): MatchingGateResult {
  if (month.status !== 'open') {
    return { ok: false, reason: 'wrong-status' };
  }
  if (month.registration_deadline) {
    const deadline = new Date(month.registration_deadline);
    if (deadline.getTime() > now.getTime()) {
      return { ok: false, reason: 'deadline-not-passed', deadline };
    }
  }
  return { ok: true };
}

export function canMarkCompleted(
  month: MonthWorkflow,
  now: Date = new Date()
): boolean {
  if (month.status !== 'matched') return false;
  if (!month.dinner_date) return false;
  // Parse as UTC end-of-day to stay consistent with registration_deadline (also UTC).
  // Trade-off: button appears up to ~3h after Chilean end-of-day, which is acceptable.
  const endOfDinnerDay = new Date(month.dinner_date + 'T23:59:59Z').getTime();
  return endOfDinnerDay < now.getTime();
}
