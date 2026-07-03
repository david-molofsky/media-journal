import { useLiveQuery } from 'dexie-react-hooks';
import {
  getYearSummary,
  getMonthlyBreakdown,
  getWeeklyTotals,
  getRatingDistribution,
  getAverageRating,
  getAverageRatingByMediaType,
  getHighestRated,
  getLongestStreak,
  getFavouriteMediaType,
  getMostActiveMonth,
  getRepeatConsumption,
  getInsights,
  getTopSourcesByCount,
  getWishlistSourceTotals,
  getAverageRatingBySource,
} from '@/services/statistics/statisticsService';
import type { MediaEntry } from '@/models';

export interface StatisticsData {
  totalEntries: number;
  totalsByMediaType: Record<string, number>;
  monthlyBreakdown: Record<number, number>;
  weeklyTotals: Record<number, number>;
  ratingDistribution: Record<number, number>;
  averageRating: number | null;
  averageRatingByMediaType: Record<string, number>;
  highestRated: MediaEntry[];
  longestStreak: number;
  favouriteMediaType: string | null;
  mostActiveMonth: number | null;
  repeatConsumption: number;
  insights: string[];
  topSourcesByCount: Record<string, number>;
  wishlistSourceTotals: Record<string, number>;
  averageRatingBySource: Record<string, number>;
}

/** Combines every statistics service call the Statistics screen needs
 * (Database Schema & Data Model, section 9) into one reactive query. */
export function useStatisticsData(year: number): StatisticsData | undefined {
  return useLiveQuery(async () => {
    const [
      summary,
      monthlyBreakdown,
      weeklyTotals,
      ratingDistribution,
      averageRating,
      averageRatingByMediaType,
      highestRated,
      longestStreak,
      favouriteMediaType,
      mostActiveMonth,
      repeatConsumption,
      insights,
      topSourcesByCount,
      wishlistSourceTotals,
      averageRatingBySource,
    ] = await Promise.all([
      getYearSummary(year),
      getMonthlyBreakdown(year),
      getWeeklyTotals(year),
      getRatingDistribution(year),
      getAverageRating(year),
      getAverageRatingByMediaType(year),
      getHighestRated(year, 5),
      getLongestStreak(year),
      getFavouriteMediaType(year),
      getMostActiveMonth(year),
      getRepeatConsumption(year),
      getInsights(year),
      getTopSourcesByCount(year),
      getWishlistSourceTotals(),
      getAverageRatingBySource(year),
    ]);
    return {
      totalEntries: summary.totalEntries,
      totalsByMediaType: summary.totalsByMediaType,
      monthlyBreakdown,
      weeklyTotals,
      ratingDistribution,
      averageRating,
      averageRatingByMediaType,
      highestRated,
      longestStreak,
      favouriteMediaType,
      mostActiveMonth,
      repeatConsumption,
      insights,
      topSourcesByCount,
      wishlistSourceTotals,
      averageRatingBySource,
    };
  }, [year]);
}
