import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import dayjs from 'dayjs';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useAvailableYears } from '@/hooks/useAvailableYears';
import { useDashboardData } from '@/hooks/useDashboardData';
import { YearSelector } from '@/components/common/YearSelector';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { GoalsSection } from '@/components/dashboard/GoalsSection';
import { InProgressSection } from '@/components/dashboard/InProgressSection';
import { MonthlyActivityChart } from '@/components/charts/MonthlyActivityChart';
import { MediaBreakdownChart } from '@/components/charts/MediaBreakdownChart';
import { RatingDistributionChart } from '@/components/charts/RatingDistributionChart';
import { EntryCard } from '@/components/library/EntryCard';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { WelcomeScreen } from '@/components/dashboard/WelcomeScreen';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { useBooleanSetting } from '@/hooks/useBooleanSetting';
import { SETTINGS_KEYS } from '@/models';
import { ROUTES, editEntryPath } from '@/routes/paths';
import type { LibraryFilterRequest } from '@/pages/Library/LibraryPage';

export default function DashboardPage() {
  const navigate = useNavigate();
  const mediaTypes = useMediaTypes();
  const availableYears = useAvailableYears();
  const [year, setYear] = useState<number | null>(() => dayjs().year());
  const data = useDashboardData(year);
  const [hasSeenWelcome, setHasSeenWelcome] = useBooleanSetting(SETTINGS_KEYS.hasSeenWelcome, false);

  const goToLibrary = (filter: LibraryFilterRequest) => {
    navigate(ROUTES.library, { state: filter });
  };

  if (mediaTypes === undefined || data === undefined || availableYears === undefined) {
    return <LoadingIndicator />;
  }

  const mediaTypeById = new Map(mediaTypes.map((type) => [type.id, type]));

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h6" component="h1" fontWeight={600}>
          Overview
        </Typography>
        <YearSelector year={year} years={availableYears} onChange={setYear} />
      </Stack>

      <Stack spacing={4}>
        <InProgressSection mediaTypes={mediaTypes} />

        {data.totalEntries === 0 ? (
          hasSeenWelcome ? (
            <PagePlaceholder
              title="No entries yet"
              description="Add your first entry to start seeing your yearly overview here."
            />
          ) : (
            <WelcomeScreen
              onAddEntry={() => {
                setHasSeenWelcome(true);
                navigate(ROUTES.addEntry);
              }}
              onOpenSettings={() => {
                setHasSeenWelcome(true);
                navigate(ROUTES.settings);
              }}
            />
          )
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                gap: 1.5,
              }}
            >
              {mediaTypes.map((mediaType) => {
                const count = data.totalsByMediaType[mediaType.id] ?? 0;
                const percentOfYear =
                  data.totalEntries === 0 ? 0 : Math.round((count / data.totalEntries) * 100);
                return (
                  <SummaryCard
                    key={mediaType.id}
                    mediaType={mediaType}
                    count={count}
                    percentOfYear={percentOfYear}
                    onClick={() =>
                      goToLibrary(
                        year === null
                          ? { mediaTypeIds: [mediaType.id] }
                          : { year, mediaTypeIds: [mediaType.id] },
                      )
                    }
                  />
                );
              })}
            </Box>

            {year !== null && (
              <GoalsSection year={year} mediaTypes={mediaTypes} totalsByMediaType={data.totalsByMediaType} />
            )}

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Monthly activity
              </Typography>
              <MonthlyActivityChart
                monthlyBreakdown={data.monthlyBreakdown}
                onSelectMonth={(month) => goToLibrary(year === null ? { month } : { year, month })}
              />
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Media breakdown
                </Typography>
                <MediaBreakdownChart
                  totalsByMediaType={data.totalsByMediaType}
                  mediaTypes={mediaTypes}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Rating distribution
                </Typography>
                <RatingDistributionChart ratingDistribution={data.ratingDistribution} />
              </Box>
            </Stack>

            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Recent activity
              </Typography>
              <Stack spacing={1.5}>
                {data.recentEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    mediaType={mediaTypeById.get(entry.mediaType)}
                    onOpen={() => navigate(editEntryPath(entry.id))}
                  />
                ))}
              </Stack>
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
}
