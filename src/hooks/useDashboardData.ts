import { useLiveQuery } from 'dexie-react-hooks';
import {
  getYearSummary,
  getMonthlyBreakdown,
  getRatingDistribution,
  getRecentEntries,
  getCurrentStreak,
  getLongestStreak,
} from '@/services/statistics/statisticsService';
import type { MediaEntry } from '@/models';

export interface DashboardData {
  totalEntries: number;
  totalsByMediaType: Record<string, number>;
  monthlyBreakdown: Record<number, number>;
  ratingDistribution: Record<number, number>;
  recentEntries: MediaEntry[];
  currentStreak: number;
  longestStreak: number;
}

export function useDashboardData(year: number | null): DashboardData | undefined {
  return useLiveQuery(async () => {
    const [summary, monthlyBreakdown, ratingDistribution, recentEntries, currentStreak, longestStreak] =
      await Promise.all([
        getYearSummary(year),
        getMonthlyBreakdown(year),
        getRatingDistribution(year),
        getRecentEntries(5),
        getCurrentStreak(),
        getLongestStreak(year),
      ]);
    return {
      totalEntries: summary.totalEntries,
      totalsByMediaType: summary.totalsByMediaType,
      monthlyBreakdown,
      ratingDistribution,
      recentEntries,
      currentStreak,
      longestStreak,
    };
  }, [year]);
}
