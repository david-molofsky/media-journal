import { describe, expect, it } from 'vitest';
import { compareSubscriptionValue } from './subscriptionCostService';

describe('compareSubscriptionValue', () => {
  it.each([
    [0, 'Great'],
    [0.09999, 'Great'],
    [0.1, 'Good'],
    [0.19999, 'Good'],
    [0.2, 'Fair'],
    [0.3, 'Poor'],
  ])('classifies unrounded GBP cost %s as %s', (cost, label) => {
    expect(compareSubscriptionValue(cost, 0.2).label).toBe(label);
  });

  it('keeps GBP good/great labels independent of the portfolio median', () => {
    expect(compareSubscriptionValue(0.08, 0.01).label).toBe('Great');
    expect(compareSubscriptionValue(0.15, 0.01).label).toBe('Good');
  });

  it('retains the relative comparison as supplementary context', () => {
    expect(compareSubscriptionValue(0.08, 0.1).percent).toBeCloseTo(20);
  });

  it('handles a zero-cost median without dividing by zero', () => {
    expect(compareSubscriptionValue(0, 0)).toEqual({ label: 'Great', percent: null });
    expect(compareSubscriptionValue(0.1, 0)).toEqual({ label: 'Good', percent: null });
  });

  it('does not apply GBP thresholds to USD prices', () => {
    expect(compareSubscriptionValue(0.1, 0.1, 'US').label).toBe('Fair');
    expect(compareSubscriptionValue(0.08, 0.1, 'US').label).toBe('Good');
  });
});
