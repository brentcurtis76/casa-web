import { describe, it, expect } from 'vitest';
import { canMarkCompleted, canRunMatching } from '../monthWorkflow';

describe('canRunMatching', () => {
  const now = new Date('2026-05-27T12:00:00Z');

  it('allows matching when status=open and deadline already passed', () => {
    const result = canRunMatching(
      {
        status: 'open',
        registration_deadline: '2026-05-26T23:59:00Z',
      },
      now
    );
    expect(result.ok).toBe(true);
  });

  it('allows matching when status=open and deadline is null', () => {
    const result = canRunMatching(
      { status: 'open', registration_deadline: null },
      now
    );
    expect(result.ok).toBe(true);
  });

  it('rejects matching when deadline is in the future', () => {
    const result = canRunMatching(
      {
        status: 'open',
        registration_deadline: '2026-05-28T23:59:00Z',
      },
      now
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('deadline-not-passed');
    expect(result.deadline?.toISOString()).toBe('2026-05-28T23:59:00.000Z');
  });

  it('rejects matching when status is not open', () => {
    const result = canRunMatching(
      {
        status: 'matched',
        registration_deadline: '2026-05-01T23:59:00Z',
      },
      now
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('wrong-status');
  });
});

describe('canMarkCompleted', () => {
  // All times are explicit UTC instants; dinner_date is interpreted as UTC end-of-day,
  // so these assertions hold regardless of the developer's local timezone.
  const now = new Date('2026-05-27T12:00:00Z');

  it('returns true for matched month with past dinner_date', () => {
    expect(
      canMarkCompleted(
        { status: 'matched', dinner_date: '2026-05-20' },
        now
      )
    ).toBe(true);
  });

  it('returns false for matched month with future dinner_date', () => {
    expect(
      canMarkCompleted(
        { status: 'matched', dinner_date: '2026-06-15' },
        now
      )
    ).toBe(false);
  });

  it('returns false for matched month with dinner_date today (not yet end of UTC day)', () => {
    expect(
      canMarkCompleted(
        { status: 'matched', dinner_date: '2026-05-27' },
        now
      )
    ).toBe(false);
  });

  it('returns true exactly after end-of-UTC-day of dinner_date', () => {
    // dinner_date 2026-05-27 → endOfDinnerDay = 2026-05-27T23:59:59Z
    const justAfter = new Date('2026-05-28T00:00:00Z');
    expect(
      canMarkCompleted(
        { status: 'matched', dinner_date: '2026-05-27' },
        justAfter
      )
    ).toBe(true);
  });

  it('returns false when status is open', () => {
    expect(
      canMarkCompleted(
        { status: 'open', dinner_date: '2026-05-20' },
        now
      )
    ).toBe(false);
  });

  it('returns false when status is completed', () => {
    expect(
      canMarkCompleted(
        { status: 'completed', dinner_date: '2026-05-20' },
        now
      )
    ).toBe(false);
  });

  it('returns false when dinner_date is missing', () => {
    expect(
      canMarkCompleted({ status: 'matched', dinner_date: null }, now)
    ).toBe(false);
  });
});
