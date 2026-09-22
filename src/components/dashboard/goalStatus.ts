export type GoalStatus = 'achieved' | 'on-track' | 'behind';

interface GoalStatusInput {
  count: number;
  target: number;
  year: number;
  now?: Date;
}

/** Compare goal progress with the proportion of the selected year that has elapsed. */
export function getGoalStatus({
  count,
  target,
  year,
  now = new Date(),
}: GoalStatusInput): GoalStatus {
  if (count >= target) return 'achieved';

  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));

  return count / target >= elapsed ? 'on-track' : 'behind';
}
