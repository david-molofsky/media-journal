import { useLiveQuery } from 'dexie-react-hooks';
import {
  getYearSummary,
  getMonthlyBreakdown,
  getRatingDistribution,
  getRecentEntries,
} from '@/services/statistics/statisticsService';
import type { MediaEntry } from '@/models';

export interface DashboardData {
  totalEntries: number;
  totalsByMediaType: Record<string, number>;
  monthlyBreakdown: Record<number, number>;
  ratingDistribution: Record<number, number>;
  recentEntries: MediaEntry[];
}

/** Combines the statistics service calls the Dashboard needs into a
 * single reactive query (Database Schema & Data Model, section 9: "UI
 * components must consume these functions rather than querying the
 * database directly"). */
export function useDashboardData(year: number): DashboardData | undefined {
  return useLiveQuery(async () => {
    const [summary, monthlyBreakdown, ratingDistribution, recentEntries] = await Promise.all([
      getYearSummary(year),
      getMonthlyBreakdown(year),
      getRatingDistribution(year),
      getRecentEntries(5),
    ]);
    return {
      totalEntries: summary.totalEntries,
      totalsByMediaType: summary.totalsByMediaType,
      monthlyBreakdown,
      ratingDistribution,
      recentEntries,
    };
  }, [year]);
}
