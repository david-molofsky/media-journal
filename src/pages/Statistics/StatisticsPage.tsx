import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import dayjs from 'dayjs';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useAvailableYears } from '@/hooks/useAvailableYears';
import { useAvailableGenres } from '@/hooks/useAvailableGenres';
import { useAvailableTags } from '@/hooks/useAvailableTags';
import { useStatisticsData, type StatsFilters } from '@/hooks/useStatisticsData';
import { useFavouriteSubscription } from '@/hooks/useFavouriteSubscription';
import { useTimelineEntries } from '@/hooks/useTimelineEntries';
import { useRollingMonthlyBreakdown } from '@/hooks/useRollingMonthlyBreakdown';
import { packTimelineBars } from '@/utils/timelinePacking';
import { TimelineChart } from '@/components/timeline/TimelineChart';
import { TimelineTypeFilter } from '@/components/timeline/TimelineTypeFilter';
import {
  TIMELINE_ZOOM_ORDER,
  TIMELINE_ZOOM_LEVELS,
  type TimelineZoomLevel,
} from '@/utils/timelineZoom';
import { StatsFilterBar } from '@/components/statistics/StatsFilterBar';
import { StatsYearSelector } from '@/components/statistics/StatsYearSelector';
import { StatTile } from '@/components/statistics/StatTile';
import { MetricCard } from '@/components/statistics/MetricCard';
import { InsightCard } from '@/components/statistics/InsightCard';
import { TrendsTabs } from '@/components/statistics/TrendsTabs';
import { RatingDistributionChart } from '@/components/charts/RatingDistributionChart';
import { GenreBarChart } from '@/components/charts/GenreBarChart';
import { GenreShareByType } from '@/components/statistics/GenreShareByType';
import { TopList, type TopListItem } from '@/components/statistics/TopList';
import { SubscriptionValueCard } from '@/components/statistics/SubscriptionValueCard';
import {
  SUBSCRIPTION_VALUE_GROUPS,
  effectiveGroupMediaTypeIds,
} from '@/services/statistics/subscriptionValueService';
import type { StatsYearScope } from '@/services/statistics/statisticsService';
import {
  WatchedWishlistToggle,
  type WatchedWishlistView,
} from '@/components/statistics/WatchedWishlistToggle';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { EmptyStateTip } from '@/components/common/EmptyStateTip';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES, entryDetailPath } from '@/routes/paths';
import { TYPE_SORT_ORDER } from '@/services/database/entryService';
import type { LibraryFilterRequest } from '@/pages/Library/LibraryPage';
import { SETTINGS_KEYS, type MediaType } from '@/models';
import { PERSON_ROLE_LABELS, type PersonRole } from '@/utils/personRoles';
import {
  TopListSortSelect,
  sortTopListItems,
  type TopListSortMode,
} from '@/components/statistics/TopListSort';
import {
  getStatisticsSessionState,
  setStatisticsSessionState,
  type StatisticsSessionState,
} from '@/state/pageSessionState';

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
 * Collapsible-tile redesign of the Statistics page (see chat, Aug
 * 2026). Overview stays as fixed, always-visible cards — it's meant
 * to be an at-a-glance summary, not something to open/close. Every
 * other section becomes a tile in a 2-column grid; tapping a tile
 * toggles its expanded panel below the grid (several can be open at
 * once — this is a set of independent toggles, not an accordion that
 * closes others). Panel order follows tile order, not click order.
 *
 * Colours are deliberately bright and distinct from all 13 media-type
 * colours (already-claimed hues would misleadingly suggest a tile is
 * "about" that media type — see chat) — 8 tiles, 8 unique colours, no
 * repeats. "Top Rated" was dropped as its own section per David's
 * call (a highlight reel, not a stat); "Subscription Value" was
 * split out of the old combined Sources section into its own tile.
 */
type StatSectionId =
  | 'subscriptionValue'
  | 'sources'
  | 'ratings'
  | 'insights'
  | 'people'
  | 'genres'
  | 'timeline'
  | 'trends';

const STAT_TILES: {
  id: StatSectionId;
  icon: typeof StarOutlineIcon;
  colour: string;
  title: string;
  description: string;
}[] = [
  {
    id: 'subscriptionValue',
    icon: PaidOutlinedIcon,
    colour: '#FF6F5E',
    title: 'Subscription Score',
    description: "What you're getting for what you pay",
  },
  {
    id: 'sources',
    icon: TvOutlinedIcon,
    colour: '#E0117F',
    title: 'Sources',
    description: 'Where you watch, read and play',
  },
  {
    id: 'ratings',
    icon: StarOutlineIcon,
    colour: '#00A388',
    title: 'Ratings',
    description: 'How you score things, by type',
  },
  {
    id: 'insights',
    icon: LightbulbOutlinedIcon,
    colour: '#D9A200',
    title: 'Insights',
    description: 'Standout patterns in your habits',
  },
  {
    id: 'people',
    icon: PeopleOutlineIcon,
    colour: '#B355D9',
    title: 'People',
    description: 'Most-credited actors, directors and more',
  },
  {
    id: 'genres',
    icon: LocalOfferOutlinedIcon,
    colour: '#A0C000',
    title: 'Genres',
    description: "What you're drawn to most",
  },
  {
    id: 'timeline',
    icon: TimelineOutlinedIcon,
    colour: '#00BCD9',
    title: 'Timeline',
    description: 'Your history laid out chronologically',
  },
  {
    id: 'trends',
    icon: TrendingUpOutlinedIcon,
    colour: '#4C6FEF',
    title: 'Trends',
    description: 'How your activity changes over time',
  },
];

/**
 * Statistics — detailed analytics, trends, streaks and insights (PRD
 * section 5; UI & UX Specification section 8).
 *
 * Section order and grouping per the Statistics page redesign (see
 * chat): Overview → Sources (Subscription Value, then the
 * Watched/Wishlist Source breakdown) → Insights → Trends → Ratings →
 * Top Rated → Genres. Sources sits directly under Overview (a product
 * USP, kept high on the page rather than buried, and ahead of
 * Insights per David's call — see chat); Trends collapses three
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
  // Restored once on mount (see chat, Aug 2026) — so navigating away
  // (e.g. tapping a Person's name through to Library) and coming back
  // via system/back-gesture navigation lands on the same year,
  // filters, expanded tiles, and scroll position, rather than a blank
  // reset page. Resets on an actual app reload, same as Library/
  // Timeline's equivalent restoration already does.
  const [restored] = useState(() => getStatisticsSessionState());
  const [year, setYear] = useState<StatsYearScope>(
    () => restored?.year ?? dayjs().year(),
  );
  const [filters, setFilters] = useState<StatsFilters>(restored?.filters ?? {});
  const [sourcesView, setSourcesView] = useState<WatchedWishlistView>(
    restored?.sourcesView ?? 'watched',
  );
  const [genresView, setGenresView] = useState<WatchedWishlistView>(
    restored?.genresView ?? 'watched',
  );
  // Which role chip is selected in the People section (see chat, Aug
  // 2026) — null until data loads, then defaults to the first role
  // that actually has completed-entry data (set in the effect below).
  const [selectedRole, setSelectedRole] = useState<PersonRole | null>(
    (restored?.selectedRole as PersonRole | null) ?? null,
  );
  // Sort mode for the Sources (watched view) and People ranked lists
  // — see chat, Aug 2026. Default matches each section's prior fixed
  // behavior (count descending), so nothing changes until the person
  // actually picks a different sort.
  const [sourcesSort, setSourcesSort] = useState<TopListSortMode>(
    (restored?.sourcesSort as TopListSortMode) ?? 'countDesc',
  );
  const [peopleSort, setPeopleSort] = useState<TopListSortMode>(
    (restored?.peopleSort as TopListSortMode) ?? 'countDesc',
  );
  // Timeline tile's own zoom/type-filter state — absorbed from the
  // now-retired standalone Timeline page (see chat, Sept 2026). Same
  // restore-on-mount pattern as every other piece of state here.
  const [timelineZoomState, setTimelineZoomState] = useState<TimelineZoomLevel>(
    restored?.timelineZoom ?? 'month',
  );
  const [timelineExcludedTypeIds, setTimelineExcludedTypeIds] = useState<Set<string>>(
    new Set(restored?.timelineExcludedTypeIds ?? []),
  );
  // Which tiles are expanded — a set of independent toggles, not an
  // accordion (several can be open at once). Starts empty; Overview
  // isn't part of this at all, since it's fixed/always-visible now.
  const [expandedSections, setExpandedSections] = useState<Set<StatSectionId>>(
    new Set((restored?.expandedSections as StatSectionId[] | undefined) ?? []),
  );
  const toggleSection = (id: StatSectionId) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Timeline tile's type-filter toggle/solo — identical logic to the
  // now-retired standalone TimelinePage.tsx (tracks exclusions rather
  // than inclusions so "all types on" needs no initialization once
  // mediaTypes loads).
  const timelineAllTypeIds = new Set(mediaTypes?.map((mt) => mt.id) ?? []);
  const toggleTimelineType = (mediaTypeId: string) => {
    setTimelineExcludedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaTypeId)) next.delete(mediaTypeId);
      else next.add(mediaTypeId);
      return next;
    });
  };
  const soloTimelineType = (mediaTypeId: string) => {
    const isAlreadySolo =
      timelineAllTypeIds.size - timelineExcludedTypeIds.size === 1 &&
      !timelineExcludedTypeIds.has(mediaTypeId);
    setTimelineExcludedTypeIds(
      isAlreadySolo
        ? new Set()
        : new Set([...timelineAllTypeIds].filter((id) => id !== mediaTypeId)),
    );
  };

  // Save the current snapshot on unmount (navigating away), and
  // restore scroll position once on mount if we have a snapshot to
  // restore from. Mirrors Library/Timeline's identical pattern.
  const liveStateRef = useRef<Omit<StatisticsSessionState, 'scrollY'>>({
    year,
    filters,
    expandedSections: Array.from(expandedSections),
    selectedRole,
    sourcesView,
    genresView,
    sourcesSort,
    peopleSort,
    timelineZoom: timelineZoomState,
    timelineExcludedTypeIds: Array.from(timelineExcludedTypeIds),
  });
  useEffect(() => {
    liveStateRef.current = {
      year,
      filters,
      expandedSections: Array.from(expandedSections),
      selectedRole,
      sourcesView,
      genresView,
      sourcesSort,
      peopleSort,
      timelineZoom: timelineZoomState,
      timelineExcludedTypeIds: Array.from(timelineExcludedTypeIds),
    };
  });
  const scrollYRef = useRef(0);
  useEffect(() => {
    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  useEffect(() => {
    return () => {
      setStatisticsSessionState({ ...liveStateRef.current, scrollY: scrollYRef.current });
    };
  }, []);
  useEffect(() => {
    if (restored) requestAnimationFrame(() => window.scrollTo(0, restored.scrollY));
    // Only ever needs to run once, right after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timeline tile (see chat, Sept 2026) — now fully self-contained,
  // absorbing the retired standalone page's Week/Month/Quarter/Year
  // zoom and type-filter controls. All-time scope, same as the old
  // standalone page (not scoped to this page's selected `year` — the
  // point of a timeline is seeing overlap across everything).
  // Filtering happens before packing (not after) so hiding a type
  // re-packs the remaining bars tighter into fewer rows, rather than
  // leaving gaps — same as the old standalone page.
  const timelineEntries = useTimelineEntries();
  const timelineBars = timelineEntries
    ? packTimelineBars(
        timelineEntries.filter((e) => !timelineExcludedTypeIds.has(e.mediaType)),
      )
    : undefined;

  const data = useStatisticsData(year, filters);
  // Always a rolling 12 months, independent of the `year` scope above
  // — see chat, Sept 2026.
  const rollingMonthlyData = useRollingMonthlyBreakdown(filters);
  const favouriteSubscription = useFavouriteSubscription(year, filters);

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
          <StatsYearSelector year={year} years={availableYears} onChange={setYear} />
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
          <>
            <EmptyStateTip
              message="Add a few entries to see trends and breakdowns here."
              dismissedKey={SETTINGS_KEYS.statisticsTipDismissed}
            />
            <PagePlaceholder
              title="Statistics will appear after you've added some media"
              description="Come back here once you've logged a few entries."
            />
          </>
        )}
      </Box>
    );
  }

  // A fresh binding (not just a narrowed reference to `data`) so its
  // type stays non-undefined when read inside renderPanel below — a
  // nested function, where TS's control-flow narrowing of `data`
  // itself (from the guards above) doesn't apply.
  const stats = data;
  const types = mediaTypes;
  const mediaTypeById = new Map(mediaTypes.map((type) => [type.id, type]));
  const rolesWithData = (Object.keys(PERSON_ROLE_LABELS) as PersonRole[]).filter(
    (role) => Object.keys(data.topPeopleByRole[role]).length > 0,
  );
  const activeRole =
    selectedRole && rolesWithData.includes(selectedRole)
      ? selectedRole
      : (rolesWithData[0] ?? null);

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
        <StatsYearSelector year={year} years={availableYears} onChange={setYear} />
      </Stack>

      <Box
        sx={{
          position: 'sticky',
          top: { xs: 56, sm: 64 },
          zIndex: (theme) => theme.zIndex.appBar - 1,
          bgcolor: 'background.default',
          py: 1,
          mb: 1,
        }}
      >
        <StatsFilterBar
          filters={filters}
          onChange={setFilters}
          mediaTypes={mediaTypes}
          availableGenres={availableGenres}
          availableTags={availableTags}
        />
      </Box>

      {/* Overview — fixed, always visible (not a tile, see chat) */}
      <Box sx={{ mb: 3 }}>
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

      {/* Tile grid, in rows of 2 — each row's expanded panel(s) render
          immediately below that row (not lumped below the whole
          grid), so tapping a tile shows its content right where you
          tapped instead of scrolling far away to find it (see chat,
          Aug 2026). Several tiles can be expanded at once; panel order
          follows tile order within each row, left to right. */}
      <Stack spacing={1.5} sx={{ mb: 3 }}>
        {Array.from({ length: Math.ceil(STAT_TILES.length / 2) }, (_, rowIndex) =>
          STAT_TILES.slice(rowIndex * 2, rowIndex * 2 + 2),
        ).map((row, rowIndex) => (
          <Box key={rowIndex}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              {row.map((tile) => (
                <StatTile
                  key={tile.id}
                  icon={tile.icon}
                  colour={tile.colour}
                  title={tile.title}
                  description={tile.description}
                  expanded={expandedSections.has(tile.id)}
                  onClick={() => toggleSection(tile.id)}
                />
              ))}
            </Box>
            {row.map((tile) =>
              expandedSections.has(tile.id) ? (
                <Box key={tile.id} sx={{ mt: 1.5 }}>
                  {renderPanel(tile.id)}
                </Box>
              ) : null,
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );

  /** Returns the expanded-panel content for a given tile id — kept as
   * a plain function (not a hook) so it can sit in the row-chunked
   * loop above and still close over all the page's state/data. See
   * chat, Aug 2026 for why panels moved out of a single flat stack. */
  function renderPanel(id: StatSectionId) {
    switch (id) {
      case 'subscriptionValue':
        return (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Which services are earning their keep, based on what you&apos;ve watched and
              rated.
            </Typography>
            <Stack spacing={2}>
              {SUBSCRIPTION_VALUE_GROUPS.map((group) => {
                const effectiveIds = effectiveGroupMediaTypeIds(
                  group,
                  filters.mediaTypeIds,
                );
                // None of this group's media types survive the Media
                // Type filter — hide the card entirely rather than
                // show an empty/misleading one.
                if (effectiveIds.length === 0) return null;
                const excludedNames = group.mediaTypeIds
                  .filter((mtId) => !effectiveIds.includes(mtId))
                  .map((mtId) => mediaTypeById.get(mtId)?.displayName ?? mtId);
                return (
                  <SubscriptionValueCard
                    key={group.title}
                    title={group.title}
                    colour={group.colour}
                    mediaTypeIds={effectiveIds}
                    year={year}
                    filters={filters}
                    excludedMediaTypeNames={excludedNames}
                  />
                );
              })}
            </Stack>
          </Box>
        );

      case 'sources':
        return (
          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 0.5 }}
            >
              <Typography variant="subtitle2" color="text.secondary">
                Sources
              </Typography>
              {sourcesView === 'watched' &&
                Object.keys(stats.topSourcesByCount).length > 0 && (
                  <TopListSortSelect value={sourcesSort} onChange={setSourcesSort} />
                )}
            </Stack>
            <WatchedWishlistToggle value={sourcesView} onChange={setSourcesView} />

            {sourcesView === 'watched' &&
              (Object.keys(stats.topSourcesByCount).length > 0 ? (
                <Stack spacing={1.5}>
                  {mergedSourceGroups(
                    stats.topSourcesByCount,
                    stats.averageRatingBySource,
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
                        items={sortTopListItems(group.items, sourcesSort)}
                        onSelectItem={(source) =>
                          goToLibrary(
                            typeof year === 'number'
                              ? {
                                  year,
                                  status: 'completed',
                                  sources: [source],
                                  mediaTypeIds: [group.mediaTypeId],
                                }
                              : {
                                  status: 'completed',
                                  sources: [source],
                                  mediaTypeIds: [group.mediaTypeId],
                                },
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
              (Object.keys(stats.wishlistSourceTotals).length > 0 ? (
                (() => {
                  const groups = sortedSourceGroups(
                    stats.wishlistSourceTotals,
                    mediaTypeById,
                  );
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
                                  sources: [source],
                                  mediaTypeIds: [group.mediaTypeId],
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
          </Box>
        );

      case 'ratings':
        return (
          <Box>
            <Stack spacing={2}>
              <RatingDistributionChart ratingDistribution={stats.ratingDistribution} />
              {Object.keys(stats.averageRatingByMediaType).length > 0 && (
                <Stack spacing={0.75}>
                  {Object.entries(stats.averageRatingByMediaType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([mediaType, average]) => (
                      <Stack
                        key={mediaType}
                        direction="row"
                        justifyContent="space-between"
                      >
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
        );

      case 'insights':
        return (
          <Box>
            {stats.insights.length > 0 ? (
              <Stack spacing={1}>
                {stats.insights.map((insight) => (
                  <InsightCard key={insight} text={insight} />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No insights yet — check back as you log more entries.
              </Typography>
            )}
          </Box>
        );

      case 'people':
        // Most-credited actors, directors, writers, etc. (see chat,
        // Aug 2026). Completed-only (no watched/wishlist toggle — an
        // uncompleted entry's credits haven't been "watched"/"read"
        // yet). Only roles with actual data show a chip. Clicking a
        // name reuses the existing Library searchText filter (already
        // a case-insensitive substring match across every metadata
        // field), rather than a new filtering mechanism.
        return (
          <Box>
            {activeRole ? (
              <>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="flex-end"
                  sx={{ mb: 0.5 }}
                >
                  <TopListSortSelect value={peopleSort} onChange={setPeopleSort} />
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  flexWrap="wrap"
                  sx={{ mb: 1.5 }}
                >
                  {rolesWithData.map((role) => (
                    <Chip
                      key={role}
                      label={PERSON_ROLE_LABELS[role]}
                      size="small"
                      color={role === activeRole ? 'primary' : 'default'}
                      onClick={() => setSelectedRole(role)}
                    />
                  ))}
                </Stack>
                <TopList
                  items={sortTopListItems(
                    Object.entries(stats.topPeopleByRole[activeRole]).map(
                      ([name, count]) => ({
                        name,
                        count,
                        rating: stats.averageRatingByPersonRole[activeRole][name],
                      }),
                    ),
                    peopleSort,
                  )}
                  onSelectItem={(name) =>
                    goToLibrary(
                      typeof year === 'number'
                        ? { year, searchText: name, status: 'completed' }
                        : { searchText: name, status: 'completed' },
                    )
                  }
                />
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No completed entries with a credited role (actor, director, writer, etc.)
                yet.
              </Typography>
            )}
          </Box>
        );

      case 'genres':
        return (
          <Box>
            <WatchedWishlistToggle value={genresView} onChange={setGenresView} />
            <Stack spacing={2}>
              {genresView === 'watched' &&
                (Object.keys(stats.topGenresByCount).length > 0 ? (
                  <GenreBarChart
                    topGenresByCount={stats.topGenresByCount}
                    averageRatingByGenre={stats.averageRatingByGenre}
                    onSelectGenre={(genre) =>
                      goToLibrary(
                        typeof year === 'number'
                          ? { year, genres: [genre], status: 'completed' }
                          : { genres: [genre], status: 'completed' },
                      )
                    }
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No completed entries with a Genre set yet.
                  </Typography>
                ))}

              {genresView === 'wishlist' &&
                (Object.keys(stats.wishlistGenreTotals).length > 0 ? (
                  <TopList
                    items={Object.entries(stats.wishlistGenreTotals)
                      .map(([name, count]) => ({ name, count }))
                      .sort((a, b) => b.count - a.count)}
                    onSelectItem={(genre) =>
                      goToLibrary({ genres: [genre], status: 'wishlist' })
                    }
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Nothing on the wishlist with a Genre set yet.
                  </Typography>
                ))}

              {stats.topGenreShareByMediaType && mediaTypes && (
                <GenreShareByType
                  data={stats.topGenreShareByMediaType}
                  mediaTypes={mediaTypes}
                />
              )}
            </Stack>
          </Box>
        );

      case 'timeline':
        // Fully self-contained (see chat, Sept 2026) — absorbed the
        // retired standalone page's Week/Month/Quarter/Year zoom and
        // type-filter controls, since this tile is now the only place
        // Timeline lives. No "View full Timeline" hand-off anymore —
        // there's nowhere left for it to point.
        return (
          <Box>
            {mediaTypes && mediaTypes.length > 0 && (
              <Stack
                direction="row"
                alignItems="center"
                spacing={1.5}
                flexWrap="wrap"
                sx={{ mb: 1.5 }}
              >
                <ToggleButtonGroup
                  value={timelineZoomState}
                  exclusive
                  size="small"
                  onChange={(_event, value: TimelineZoomLevel | null) => {
                    if (value) setTimelineZoomState(value);
                  }}
                >
                  {TIMELINE_ZOOM_ORDER.map((level) => (
                    <ToggleButton key={level} value={level}>
                      {TIMELINE_ZOOM_LEVELS[level].label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Stack>
            )}

            {mediaTypes && (
              <Box sx={{ mb: 1.5 }}>
                <TimelineTypeFilter
                  mediaTypes={mediaTypes}
                  excludedTypeIds={timelineExcludedTypeIds}
                  onToggle={toggleTimelineType}
                  onSolo={soloTimelineType}
                />
              </Box>
            )}

            {timelineBars === undefined ? (
              <LoadingIndicator />
            ) : timelineBars.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {timelineExcludedTypeIds.size > 0
                  ? 'No entries match the selected types.'
                  : 'Nothing completed or in progress yet — your timeline will appear here once you have.'}
              </Typography>
            ) : (
              <Box
                sx={{
                  maxHeight: 320,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <TimelineChart
                  bars={timelineBars}
                  zoom={timelineZoomState}
                  mediaTypes={types}
                  onOpenEntry={(entryId) => navigate(entryDetailPath(entryId))}
                />
              </Box>
            )}

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1.5, display: 'block' }}
            >
              A dot means no start date was recorded for that entry, so only the day it
              was completed is shown. A fading edge with an arrow means it's still in
              progress, running through to today. Tap a type above to hide it, double-tap
              to solo it.
            </Typography>
          </Box>
        );

      case 'trends':
        return (
          <Box>
            <TrendsTabs
              monthlyData={rollingMonthlyData}
              weeklyTotals={stats.weeklyTotals}
              year={year}
              onSelectMonth={(monthYear, month) =>
                goToLibrary({ year: monthYear, month, status: 'completed' })
              }
            />
          </Box>
        );

      default:
        return null;
    }
  }
}
