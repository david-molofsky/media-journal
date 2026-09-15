export function shouldApplyPwaUpdate(
  updateAvailable: boolean,
  blockerCount: number,
  updateApplying: boolean,
): boolean {
  return updateAvailable && blockerCount === 0 && !updateApplying;
}
