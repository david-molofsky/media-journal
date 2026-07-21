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
  getTopGenresByCount,
  getAverageRatingByGenre,
  getWishlistGenreTotals,
  getTopGenreShareByMediaType,
} from '@/services/statistics/statisticsService';
import type { MediaEntry } from '@/models';
import type { TopGenreShareByMediaType, StatsFilters } from '@/services/statistics/statisticsService';
export type { StatsFilters };

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
  topSourcesByCount: Record<string, Record<string, number>>;
  wishlistSourceTotals: Record<string, Record<string, number>>;
  averageRatingBySource: Record<string, Record<string, number>>;
  topGenresByCount: Record<string, number>;
  averageRatingByGenre: Record<string, number>;
  wishlistGenreTotals: Record<string, number>;
  topGenreShareByMediaType: TopGenreShareByMediaType | null;
}

/** Combines every statistics service call the Statistics screen needs
 * (Database Schema & Data Model, section 9) into one reactive query. */
export function useStatisticsData(year: number | null, filters?: StatsFilters): StatisticsData | undefined {
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
      topGenresByCount,
      averageRatingByGenre,
      wishlistGenreTotals,
      topGenreShareByMediaType,
    ] = await Promise.all([
      getYearSummary(year, filters),
      getMonthlyBreakdown(year, filters),
      getWeeklyTotals(year, filters),
      getRatingDistribution(year, filters),
      getAverageRating(year, filters),
      getAverageRatingByMediaType(year, filters),
      getHighestRated(year, 5, filters),
      getLongestStreak(year, filters),
      getFavouriteMediaType(year, filters),
      getMostActiveMonth(year, filters),
      getRepeatConsumption(year, filters),
      getInsights(year, filters),
      getTopSourcesByCount(year, filters),
      // Wishlist breakdowns are deliberately excluded from the filter
      // bar — see StatsFilters' doc comment — so these two calls never
      // receive `filters`.
      getWishlistSourceTotals(),
      getAverageRatingBySource(year, filters),
      getTopGenresByCount(year, filters),
      getAverageRatingByGenre(year, filters),
      getWishlistGenreTotals(),
      getTopGenreShareByMediaType(year, filters),
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
      topGenresByCount,
      averageRatingByGenre,
      wishlistGenreTotals,
      topGenreShareByMediaType,
    };
  }, [year, JSON.stringify(filters)]);
}
