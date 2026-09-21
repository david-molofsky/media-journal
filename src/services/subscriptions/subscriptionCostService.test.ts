import { describe, expect, it } from 'vitest';
import { compareSubscriptionValue } from './subscriptionCostService';

describe('compareSubscriptionValue', () => {
  it('classifies subscriptions at least 20% cheaper than the median as Good', () => {
    const result = compareSubscriptionValue(0.08, 0.1);
    expect(result.label).toBe('Good');
    expect(result.percent).toBeCloseTo(20);
  });

  it('classifies subscriptions within 20% of the median as Fair', () => {
    expect(compareSubscriptionValue(0.1, 0.1)).toEqual({
      label: 'Fair',
      percent: 0,
    });
  });

  it('classifies subscriptions at least 20% more expensive than the median as Poor', () => {
    const result = compareSubscriptionValue(0.12, 0.1);
    expect(result.label).toBe('Poor');
    expect(result.percent).toBeCloseTo(-20);
  });

  it('handles a zero-cost median without dividing by zero', () => {
    expect(compareSubscriptionValue(0, 0)).toEqual({ label: 'Fair', percent: null });
    expect(compareSubscriptionValue(0.1, 0)).toEqual({ label: 'Poor', percent: null });
  });
});
