import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { RollingMonthDatum } from '@/services/statistics/statisticsService';

interface MonthlyActivityChartProps {
  /** Trailing 12 months, oldest to newest — from
   * `useRollingMonthlyBreakdown`. Replaces the old single-calendar-year
   * `monthlyBreakdown: Record<number, number>` prop (see chat, Sept
   * 2026): the chart is no longer tied to whichever year is selected
   * elsewhere on the page, always "now minus 11 months through now".
   * The 3-month moving-average trend line that briefly lived here has
   * been removed — plain bars only, per David's call. */
  data: RollingMonthDatum[];
  /** Tapping a bar opens the Library filtered to that specific
   * (year, month) — both are needed, not just month, since a rolling
   * window spans two calendar years and "Sep" alone would be
   * ambiguous between this September and last. Omit to render a
   * static, non-tappable chart. */
  onSelectMonth?: (year: number, month: number) => void;
}

/** Vertical bar chart of entries per calendar month, trailing 12
 * months ending with the current one. Shared by the Dashboard and the
 * Statistics page's Monthly tab. */
export function MonthlyActivityChart({ data, onSelectMonth }: MonthlyActivityChartProps) {
  const theme = useTheme();

  const handleBarClick = (entry: unknown) => {
    if (!onSelectMonth) return;
    const datum = entry as Partial<RollingMonthDatum>;
    if (typeof datum.year === 'number' && typeof datum.month === 'number') {
      onSelectMonth(datum.year, datum.month);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.palette.divider} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          formatter={(value) => [String(value), 'Entries']}
        />
        <Bar
          dataKey="count"
          fill={theme.palette.primary.main}
          radius={[4, 4, 0, 0]}
          onClick={onSelectMonth ? handleBarClick : undefined}
          cursor={onSelectMonth ? 'pointer' : undefined}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
