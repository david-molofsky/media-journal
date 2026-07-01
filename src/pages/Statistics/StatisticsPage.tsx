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
import { EntryCard } from '@/components/library/EntryCard';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES, editEntryPath } from '@/routes/paths';
import type { LibraryFilterRequest } from '@/pages/Library/LibraryPage';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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
                {Object.entries(data.averageRatingByMediaType).map(([mediaType, average]) => (
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
