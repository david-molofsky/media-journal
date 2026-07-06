import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useAvailableYears } from '@/hooks/useAvailableYears';
import { useStatisticsData } from '@/hooks/useStatisticsData';
import { YearSelector } from '@/components/common/YearSelector';
import { MetricCard } from '@/components/statistics/MetricCard';
import { InsightCard } from '@/components/statistics/InsightCard';
import { MonthlyActivityChart } from '@/components/charts/MonthlyActivityChart';
import { WeeklyActivityChart } from '@/components/charts/WeeklyActivityChart';
import { CumulativeWeeklyChart } from '@/components/charts/CumulativeWeeklyChart';
import { RatingDistributionChart } from '@/components/charts/RatingDistributionChart';
import { GenreBarChart } from '@/components/charts/GenreBarChart';
import { TopList, type TopListItem } from '@/components/statistics/TopList';
import { EntryCard } from '@/components/library/EntryCard';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES, editEntryPath } from '@/routes/paths';
import { TYPE_SORT_ORDER } from '@/services/database/entryService';
import type { LibraryFilterRequest } from '@/pages/Library/LibraryPage';
import type { MediaType } from '@/models';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Orders a grouped-by-media-type Source record (e.g.
 * `topSourcesByCount`) into media-type sections — Film & TV, Comics,
 * etc. — each with its sources sorted by value descending. Group order
 * follows `TYPE_SORT_ORDER` (same ordering used elsewhere, e.g. the
 * Library's "By type" sort), falling back to alphabetical by display
 * name for types not in that list. */
function sortedSourceGroups(
  record: Record<string, Record<string, number>>,
  mediaTypeById: Map<string, MediaType>,
): { mediaTypeId: string; displayName: string; sources: [string, number][] }[] {
  return Object.entries(record)
    .map(([mediaTypeId, sources]) => ({
      mediaTypeId,
      displayName: mediaTypeById.get(mediaTypeId)?.displayName ?? mediaTypeId,
      sources: Object.entries(sources).sort(([, a], [, b]) => b - a),
    }))
    .sort((a, b) => {
      const orderA = TYPE_SORT_ORDER[a.mediaTypeId] ?? 99;
      const orderB = TYPE_SORT_ORDER[b.mediaTypeId] ?? 99;
      return orderA !== orderB ? orderA - orderB : a.displayName.localeCompare(b.displayName);
    });
}

/** Merges `topSourcesByCount` and `averageRatingBySource` into a single
 * per-group `TopListItem[]`, sorted by count descending — one row per
 * source (name, count, rating) instead of two separate lists. */
function mergedSourceGroups(
  counts: Record<string, Record<string, number>>,
  ratings: Record<string, Record<string, number>>,
  mediaTypeById: Map<string, MediaType>,
): { mediaTypeId: string; displayName: string; items: TopListItem[] }[] {
  return sortedSourceGroups(counts, mediaTypeById).map((group) => ({
    mediaTypeId: group.mediaTypeId,
    displayName: group.displayName,
    items: group.sources.map(([name, count]) => ({
      name,
      count,
      rating: ratings[group.mediaTypeId]?.[name],
    })),
  }));
}
/**
 * Statistics — detailed analytics, trends, streaks and insights (PRD
 * section 5; UI & UX Specification section 8).
 */
export default function StatisticsPage() {
  const navigate = useNavigate();
  const mediaTypes = useMediaTypes();
  const availableYears = useAvailableYears();
  const [year, setYear] = useState(() => dayjs().year());

  const data = useStatisticsData(year);

  const goToLibrary = (filter: LibraryFilterRequest) => {
    navigate(ROUTES.library, { state: filter });
  };

  if (mediaTypes === undefined || data === undefined || availableYears === undefined) {
    return <LoadingIndicator />;
  }

  if (data.totalEntries === 0) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Typography variant="h6" component="h1" fontWeight={600}>
            Statistics
          </Typography>
          <YearSelector year={year} years={availableYears} onChange={setYear} />
        </Stack>
        <PagePlaceholder
          title="Statistics will appear after you've added some media"
          description="Come back here once you've logged a few entries for this year."
        />
      </Box>
    );
  }

  const mediaTypeById = new Map(mediaTypes.map((type) => [type.id, type]));
  const favouriteDisplayName = data.favouriteMediaType
    ? (mediaTypeById.get(data.favouriteMediaType)?.displayName ?? data.favouriteMediaType)
    : '—';

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h6" component="h1" fontWeight={600}>
          Statistics
        </Typography>
        <YearSelector year={year} years={availableYears} onChange={setYear} />
      </Stack>

      <Stack spacing={4}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Overview
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: 1.5,
            }}
          >
            <MetricCard label="Total entries" value={data.totalEntries} />
            <MetricCard
              label="Average rating"
              value={data.averageRating !== null ? data.averageRating.toFixed(1) : '—'}
            />
            <MetricCard label="Longest streak" value={`${data.longestStreak} day${data.longestStreak === 1 ? '' : 's'}`} />
            <MetricCard
              label="Most active month"
              value={
                data.mostActiveMonth !== null
                  ? (MONTH_NAMES[data.mostActiveMonth - 1] ?? '—')
                  : '—'
              }
            />
            <MetricCard label="Favourite media type" value={favouriteDisplayName} />
            <MetricCard label="Rereads / rewatches" value={data.repeatConsumption} />
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Trends
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Monthly activity
              </Typography>
              <MonthlyActivityChart
                monthlyBreakdown={data.monthlyBreakdown}
                onSelectMonth={(month) => goToLibrary({ year, month })}
              />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Weekly activity
              </Typography>
              <WeeklyActivityChart weeklyTotals={data.weeklyTotals} />
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total media consumed
              </Typography>
              <CumulativeWeeklyChart weeklyTotals={data.weeklyTotals} year={year} />
            </Box>
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Ratings
          </Typography>
          <Stack spacing={2}>
            <RatingDistributionChart ratingDistribution={data.ratingDistribution} />
            {Object.keys(data.averageRatingByMediaType).length > 0 && (
              <Stack spacing={0.75}>
                {Object.entries(data.averageRatingByMediaType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([mediaType, average]) => (
                    <Stack key={mediaType} direction="row" justifyContent="space-between">
                      <Typography variant="body2">
                        {mediaTypeById.get(mediaType)?.displayName ?? mediaType}
                      </Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {average.toFixed(1)}
                      </Typography>
                    </Stack>
                  ))}
              </Stack>
            )}
            {data.highestRated.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Highest rated
                </Typography>
                {data.highestRated.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    mediaType={mediaTypeById.get(entry.mediaType)}
                    onOpen={() => navigate(editEntryPath(entry.id))}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </Box>

        {(Object.keys(data.topGenresByCount).length > 0 ||
          Object.keys(data.wishlistGenreTotals).length > 0) && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Genres
            </Typography>
            <Stack spacing={2}>
              {Object.keys(data.topGenresByCount).length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Top genres this year
                  </Typography>
                  <GenreBarChart
                    topGenresByCount={data.topGenresByCount}
                    averageRatingByGenre={data.averageRatingByGenre}
                  />
                </Box>
              )}

              {Object.keys(data.wishlistGenreTotals).length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Wishlist by genre (all time)
                  </Typography>
                  <TopList
                    items={Object.entries(data.wishlistGenreTotals)
                      .map(([name, count]) => ({ name, count }))
                      .sort((a, b) => b.count - a.count)}
                  />
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {(Object.keys(data.topSourcesByCount).length > 0 ||
          Object.keys(data.wishlistSourceTotals).length > 0) && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Sources
            </Typography>
            <Stack spacing={2}>
              {Object.keys(data.topSourcesByCount).length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    This year, by source
                  </Typography>
                  <Stack spacing={1.5}>
                    {mergedSourceGroups(data.topSourcesByCount, data.averageRatingBySource, mediaTypeById).map((group) => (
                      <Box key={group.mediaTypeId}>
                        <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 0.5 }}>
                          {group.displayName}
                        </Typography>
                        <TopList items={group.items} />
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {Object.keys(data.wishlistSourceTotals).length > 0 && (() => {
                const groups = sortedSourceGroups(data.wishlistSourceTotals, mediaTypeById);
                // "Most saved on" is still a single all-time headline —
                // computed across every group's sources, not per group.
                const top = groups
                  .flatMap((g) => g.sources)
                  .sort(([, a], [, b]) => b - a)[0];
                return (
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Wishlist by source (all time)
                    </Typography>
                    <Stack spacing={1.5}>
                      {groups.map((group) => (
                        <Box key={group.mediaTypeId}>
                          <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 0.5 }}>
                            {group.displayName}
                          </Typography>
                          <TopList
                            items={group.sources.map(([name, count]) => ({ name, count }))}
                          />
                        </Box>
                      ))}
                    </Stack>
                    {top && (
                      <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ display: 'block', mt: 1 }}>
                        ★ Most saved on {top[0]}
                      </Typography>
                    )}
                  </Box>
                );
              })()}
            </Stack>
          </Box>
        )}

        {data.insights.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Insights
            </Typography>
            <Stack spacing={1}>
              {data.insights.map((insight) => (
                <InsightCard key={insight} text={insight} />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
