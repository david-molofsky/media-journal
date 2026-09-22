import { describe, expect, it } from 'vitest';
import { getGoalStatus } from '@/components/dashboard/goalStatus';

describe('getGoalStatus', () => {
  const halfwayThrough2026 = new Date(2026, 6, 2);

  it('marks a reached or exceeded target as achieved', () => {
    expect(
      getGoalStatus({ count: 120, target: 120, year: 2026, now: halfwayThrough2026 }),
    ).toBe('achieved');
    expect(
      getGoalStatus({ count: 125, target: 120, year: 2026, now: halfwayThrough2026 }),
    ).toBe('achieved');
  });

  it('marks progress at the elapsed-year pace as on track', () => {
    expect(
      getGoalStatus({ count: 60, target: 120, year: 2026, now: halfwayThrough2026 }),
    ).toBe('on-track');
  });

  it('marks progress below the elapsed-year pace as behind', () => {
    expect(
      getGoalStatus({ count: 40, target: 120, year: 2026, now: halfwayThrough2026 }),
    ).toBe('behind');
  });

  it('uses the full target as the pace for past years', () => {
    expect(
      getGoalStatus({ count: 119, target: 120, year: 2025, now: halfwayThrough2026 }),
    ).toBe('behind');
  });
});
