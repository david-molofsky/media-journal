import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useAvailableYears } from '@/hooks/useAvailableYears';
import { useAvailableGenres } from '@/hooks/useAvailableGenres';
import { useAvailableTags } from '@/hooks/useAvailableTags';
import { useStatisticsData, type StatsFilters } from '@/hooks/useStatisticsData';
import { useFavouriteSubscription } from '@/hooks/useFavouriteSubscription';
import { StatsFilterBar } from '@/components/statistics/StatsFilterBar';
import { YearSelector } from '@/components/common/YearSelector';
import { MetricCard } from '@/components/statistics/MetricCard';
import { InsightCard } from '@/components/statistics/InsightCard';
import { TrendsTabs } from '@/components/statistics/TrendsTabs';
import { RatingDistributionChart } from '@/components/charts/RatingDistributionChart';
import { GenreBarChart } from '@/components/charts/GenreBarChart';
import { GenreShareByType } from '@/components/statistics/GenreShareByType';
import { TopList, type TopListItem } from '@/components/statistics/TopList';
import { SubscriptionValueCard } from '@/components/statistics/SubscriptionValueCard';
import { SUBSCRIPTION_VALUE_GROUPS } from '@/services/statistics/subscriptionValueService';
import {
  WatchedWishlistToggle,
  type WatchedWishlistView,
} from '@/components/statistics/WatchedWishlistToggle';
import { EntryCard } from '@/components/library/EntryCard';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES, editEntryPath } from '@/routes/paths';
import { TYPE_SORT_ORDER } from '@/services/database/entryService';
import type { LibraryFilterRequest } from '@/pages/Library/LibraryPage';
import type { MediaType } from '@/models';

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
      return orderA !== orderB
        ? orderA - orderB
        : a.displayName.localeCompare(b.displayName);
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
 *
 * Section order and grouping per the Statistics page redesign (see
 * chat): Overview → Insights → Sources → Trends → Ratings → Top Rated
 * → Genres. Sources sits directly under Insights (a product USP, kept
 * high on the page rather than buried); Trends collapses three
 * always-stacked charts into a tab switcher; Genres and Sources share
 * a Watched/Wishlist toggle instead of stacking both views; "Highest
 * rated" entries moved out of Ratings into their own Top Rated
 * section, since they're a highlight reel, not a statistic.
 */
export default function StatisticsPage() {
  const navigate = useNavigate();
  const mediaTypes = useMediaTypes();
  const availableYears = useAvailableYears();
  const availableGenres = useAvailableGenres();
  const availableTags = useAvailableTags();
  const [year, setYear] = useState<number | null>(() => dayjs().year());
  const [filters, setFilters] = useState<StatsFilters>({});
  const [sourcesView, setSourcesView] = useState<WatchedWishlistView>('watched');
  const [genresView, setGenresView] = useState<WatchedWishlistView>('watched');

  const data = useStatisticsData(year, filters);
  const favouriteSubscription = useFavouriteSubscription();

  const goToLibrary = (filter: LibraryFilterRequest) => {
    navigate(ROUTES.library, { state: filter });
  };

  if (mediaTypes === undefined || data === undefined || availableYears === undefined) {
    return <LoadingIndicator />;
  }

  const hasActiveFilters =
    (filters.mediaTypeIds && filters.mediaTypeIds.length > 0) ||
    !!filters.genre ||
    !!filters.tag ||
    filters.ratingMin !== undefined ||
    filters.ratingMax !== undefined;

  if (data.totalEntries === 0) {
    return (
      <Box>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 3 }}
        >
          <Typography variant="h6" component="h1" fontWeight={600}>
            Statistics
          </Typography>
          <YearSelector year={year} years={availableYears} onChange={setYear} />
        </Stack>
        <StatsFilterBar
          filters={filters}
          onChange={setFilters}
          mediaTypes={mediaTypes}
          availableGenres={availableGenres}
          availableTags={availableTags}
        />
        {hasActiveFilters ? (
          <PagePlaceholder
            title="No entries match these filters"
            description="Try widening the Media Type, Genre, Tags or Rating range."
          />
        ) : (
          <PagePlaceholder
            title="Statistics will appear after you've added some media"
            description="Come back here once you've logged a few entries."
          />
        )}
      </Box>
    );
  }

  const mediaTypeById = new Map(mediaTypes.map((type) => [type.id, type]));
  const hasSources =
    Object.keys(data.topSourcesByCount).length > 0 ||
    Object.keys(data.wishlistSourceTotals).length > 0;
  const hasGenres =
    Object.keys(data.topGenresByCount).length > 0 ||
    Object.keys(data.wishlistGenreTotals).length > 0;

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 3 }}
      >
        <Typography variant="h6" component="h1" fontWeight={600}>
          Statistics
        </Typography>
        <YearSelector year={year} years={availableYears} onChange={setYear} />
      </Stack>

      <StatsFilterBar
        filters={filters}
        onChange={setFilters}
        mediaTypes={mediaTypes}
        availableGenres={availableGenres}
        availableTags={availableTags}
      />

      <Stack spacing={4}>
        {/* Overview */}
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
            <MetricCard label="Favourite source" value={data.favouriteSource ?? '—'} />
            <MetricCard
              label="Favourite subscription"
              value={favouriteSubscription ?? '—'}
            />
          </Box>
        </Box>

        {/* Insights */}
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

        {/* Sources (incl. Subscription Value) */}
        {hasSources && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Sources
            </Typography>
            <WatchedWishlistToggle value={sourcesView} onChange={setSourcesView} />

            {sourcesView === 'watched' &&
              (Object.keys(data.topSourcesByCount).length > 0 ? (
                <Stack spacing={1.5}>
                  {mergedSourceGroups(
                    data.topSourcesByCount,
                    data.averageRatingBySource,
                    mediaTypeById,
                  ).map((group) => (
                    <Box key={group.mediaTypeId}>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        color="primary.main"
                        sx={{ display: 'block', mb: 0.5 }}
                      >
                        {group.displayName}
                      </Typography>
                      <TopList
                        items={group.items}
                        onSelectItem={(source) =>
                          goToLibrary(
                            year === null
                              ? { source, mediaType: group.mediaTypeId }
                              : { year, source, mediaType: group.mediaTypeId },
                          )
                        }
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No completed entries with a Source set yet.
                </Typography>
              ))}

            {sourcesView === 'wishlist' &&
              (Object.keys(data.wishlistSourceTotals).length > 0 ? (
                (() => {
                  const groups = sortedSourceGroups(data.wishlistSourceTotals, mediaTypeById);
                  // "Most saved on" is still a single all-time headline —
                  // computed across every group's sources, not per group.
                  const top = groups
                    .flatMap((g) => g.sources)
                    .sort(([, a], [, b]) => b - a)[0];
                  return (
                    <Box>
                      <Stack spacing={1.5}>
                        {groups.map((group) => (
                          <Box key={group.mediaTypeId}>
                            <Typography
                              variant="caption"
                              fontWeight={700}
                              color="primary.main"
                              sx={{ display: 'block', mb: 0.5 }}
                            >
                              {group.displayName}
                            </Typography>
                            <TopList
                              items={group.sources.map(([name, count]) => ({
                                name,
                                count,
                              }))}
                              onSelectItem={(source) =>
                                goToLibrary({
                                  source,
                                  mediaType: group.mediaTypeId,
                                  status: 'wishlist',
                                })
                              }
                            />
                          </Box>
                        ))}
                      </Stack>
                      {top && (
                        <Typography
                          variant="caption"
                          color="primary.main"
                          fontWeight={600}
                          sx={{ display: 'block', mt: 1 }}
                        >
                          ★ Most saved on {top[0]}
                        </Typography>
                      )}
                    </Box>
                  );
                })()
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Nothing on the wishlist with a Source set yet.
                </Typography>
              ))}

            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 3, mb: 0.5 }}>
              Subscription Value
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Which services are earning their keep, based on what you&apos;ve watched and
              rated.
            </Typography>
            <Stack spacing={2}>
              {SUBSCRIPTION_VALUE_GROUPS.map((group) => (
                <SubscriptionValueCard
                  key={group.title}
                  title={group.title}
                  colour={group.colour}
                  mediaTypeIds={group.mediaTypeIds}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Trends */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Trends
          </Typography>
          <TrendsTabs
            monthlyBreakdown={data.monthlyBreakdown}
            weeklyTotals={data.weeklyTotals}
            year={year}
            onSelectMonth={(month) =>
              goToLibrary(year === null ? { month } : { year, month })
            }
          />
        </Box>

        {/* Ratings */}
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
          </Stack>
        </Box>

        {/* Top Rated */}
        {data.highestRated.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Top Rated
            </Typography>
            <Stack spacing={1.5}>
              {data.highestRated.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  mediaType={mediaTypeById.get(entry.mediaType)}
                  onOpen={() => navigate(editEntryPath(entry.id))}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Genres */}
        {hasGenres && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Genres
            </Typography>
            <WatchedWishlistToggle value={genresView} onChange={setGenresView} />
            <Stack spacing={2}>
              {genresView === 'watched' &&
                (Object.keys(data.topGenresByCount).length > 0 ? (
                  <GenreBarChart
                    topGenresByCount={data.topGenresByCount}
                    averageRatingByGenre={data.averageRatingByGenre}
                    onSelectGenre={(genre) =>
                      goToLibrary(year === null ? { genre } : { year, genre })
                    }
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No completed entries with a Genre set yet.
                  </Typography>
                ))}

              {genresView === 'wishlist' &&
                (Object.keys(data.wishlistGenreTotals).length > 0 ? (
                  <TopList
                    items={Object.entries(data.wishlistGenreTotals)
                      .map(([name, count]) => ({ name, count }))
                      .sort((a, b) => b.count - a.count)}
                    onSelectItem={(genre) => goToLibrary({ genre, status: 'wishlist' })}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Nothing on the wishlist with a Genre set yet.
                  </Typography>
                ))}

              {data.topGenreShareByMediaType && mediaTypes && (
                <GenreShareByType
                  data={data.topGenreShareByMediaType}
                  mediaTypes={mediaTypes}
                />
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
  );
}
