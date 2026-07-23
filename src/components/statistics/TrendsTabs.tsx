import { useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { MonthlyActivityChart } from '@/components/charts/MonthlyActivityChart';
import { WeeklyActivityChart } from '@/components/charts/WeeklyActivityChart';
import { CumulativeWeeklyChart } from '@/components/charts/CumulativeWeeklyChart';
import type { StatsYearScope } from '@/services/statistics/statisticsService';

type TrendsView = 'monthly' | 'weekly' | 'cumulative';

interface TrendsTabsProps {
  monthlyBreakdown: Record<number, number>;
  weeklyTotals: Record<number, number>;
  year: StatsYearScope;
  onSelectMonth: (month: number) => void;
}

/**
 * Tab switcher for the Statistics "Trends" section. Monthly, Weekly,
 * and Cumulative activity used to render as three stacked full-height
 * charts; this keeps all three views but shows one at a time — see
 * chat (Statistics page redesign).
 */
export function TrendsTabs({
  monthlyBreakdown,
  weeklyTotals,
  year,
  onSelectMonth,
}: TrendsTabsProps) {
  const [view, setView] = useState<TrendsView>('monthly');

  return (
    <Box>
      <Tabs
        value={view}
        onChange={(_, value: TrendsView) => setView(value)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          mb: 1,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 36, textTransform: 'none' },
        }}
      >
        <Tab label="Monthly" value="monthly" />
        <Tab label="Weekly" value="weekly" />
        <Tab label="Cumulative" value="cumulative" />
      </Tabs>
      {view === 'monthly' && (
        <MonthlyActivityChart
          monthlyBreakdown={monthlyBreakdown}
          onSelectMonth={onSelectMonth}
        />
      )}
      {view === 'weekly' && <WeeklyActivityChart weeklyTotals={weeklyTotals} />}
      {view === 'cumulative' && (
        <CumulativeWeeklyChart weeklyTotals={weeklyTotals} year={year} />
      )}
    </Box>
  );
}
