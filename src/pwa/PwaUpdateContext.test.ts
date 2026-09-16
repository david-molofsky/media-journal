import { describe, expect, it } from 'vitest';
import { shouldApplyPwaUpdate } from './updateSafety';

describe('shouldApplyPwaUpdate', () => {
  it('applies a waiting update when no form blocks it', () => {
    expect(shouldApplyPwaUpdate(true, 0, false)).toBe(true);
  });

  it('defers activation while any form is dirty', () => {
    expect(shouldApplyPwaUpdate(true, 1, false)).toBe(false);
    expect(shouldApplyPwaUpdate(true, 2, false)).toBe(false);
  });

  it('does not start a second activation', () => {
    expect(shouldApplyPwaUpdate(true, 0, true)).toBe(false);
  });
});
