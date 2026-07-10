import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import dayjs from 'dayjs';

interface CumulativeWeeklyChartProps {
  weeklyTotals: Record<number, number>;
  /** `null` means All — every week 1–53 renders complete, since
   * there's no "future" to truncate when this isn't one specific
   * calendar year in progress. */
  year: number | null;
}

/**
 * Area/line chart showing the cumulative running total of media
 * consumed week-by-week across `year`. Complements the per-week bar
 * chart in the Statistics Trends section — the bar chart answers
 * "how much did I consume each week?", this answers "where am I for
 * the year overall?". For the current year, data points after the
 * current week are omitted so the line doesn't flatline at zero; for
 * All, every week renders (weeklyTotals is already aggregated by
 * week-of-year across every year — see getWeeklyTotals).
 */
export function CumulativeWeeklyChart({ weeklyTotals, year }: CumulativeWeeklyChartProps) {
  const theme = useTheme();

  const currentYear = dayjs().year();
  const currentWeek =
    year === currentYear
      ? Math.ceil(dayjs().diff(dayjs(`${year}-01-01`), 'day') / 7)
      : 53;

  const { data, maxTotal } = useMemo(() => {
    const [points, total] = Array.from({ length: 53 }, (_, i) => i + 1).reduce<
      [{ week: number; total: number | null }[], number]
    >(
      ([acc, sum], week) => {
        const newSum = sum + (weeklyTotals[week] ?? 0);
        return [
          [...acc, { week, total: week <= currentWeek ? newSum : null }],
          newSum,
        ];
      },
      [[], 0],
    );
    return {
      data: points.filter((point) => point.total !== null),
      maxTotal: total,
    };
  }, [weeklyTotals, currentWeek]);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="cumulativeGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.25} />
            <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={theme.palette.divider} />
        <XAxis
          dataKey="week"
          tickLine={false}
          axisLine={false}
          fontSize={10}
          interval={7}
          tickFormatter={(week: number) => `W${week}`}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          fontSize={10}
          domain={[0, Math.max(maxTotal, 1)]}
        />
        <Tooltip
          formatter={(value) => [String(value), 'Total consumed']}
          labelFormatter={(week) => `Week ${week}`}
          cursor={{ stroke: theme.palette.divider }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke={theme.palette.primary.main}
          strokeWidth={2}
          fill="url(#cumulativeGradient)"
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
