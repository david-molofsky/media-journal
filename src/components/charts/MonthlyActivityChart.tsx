import {
  Bar,
  ComposedChart,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@mui/material/styles';

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Width (in months) of the trailing moving average — see chat, Sept
 * 2026 (Month-over-month trend backlog item). A 3-month trailing
 * window smooths month-to-month noise (e.g. one busy binge week)
 * without lagging so far behind that the line stops tracking the
 * shape of the bars. Early months in the year use whatever's
 * available (Jan = itself, Feb = avg of Jan+Feb) rather than pulling
 * in the previous year's data — the Monthly tab is scoped to a single
 * `year`, so there's no reliable prior-year tail to draw on when
 * `year` is a specific number, and mixing scopes would be misleading
 * for 'last12'/'All' too. */
const TREND_WINDOW = 3;

function trailingMovingAverage(values: number[], window: number): number[] {
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    const sum = slice.reduce((total, v) => total + v, 0);
    return sum / slice.length;
  });
}

interface MonthDatum {
  month: number;
  label: string;
  count: number;
  trend: number;
}

interface MonthlyActivityChartProps {
  monthlyBreakdown: Record<number, number>;
  /** Tapping a bar opens the Library filtered to that month (UI & UX
   * Specification, section 4). Omit to render a static, non-tappable
   * chart (used on the Statistics screen). */
  onSelectMonth?: (month: number) => void;
}

/** Vertical bar chart of entries per calendar month (PRD section 5;
 * UI & UX Specification section 4), with a smoothed trailing
 * 3-month-average line overlaid to show the underlying trend without
 * the month-to-month noise of the raw bars. */
export function MonthlyActivityChart({ monthlyBreakdown, onSelectMonth }: MonthlyActivityChartProps) {
  const theme = useTheme();
  const counts = MONTH_ABBREVIATIONS.map((_, index) => monthlyBreakdown[index + 1] ?? 0);
  const trend = trailingMovingAverage(counts, TREND_WINDOW);
  const data: MonthDatum[] = MONTH_ABBREVIATIONS.map((label, index) => ({
    month: index + 1,
    label,
    count: counts[index] ?? 0,
    trend: Math.round((trend[index] ?? 0) * 10) / 10,
  }));

  const handleBarClick = (entry: unknown) => {
    if (!onSelectMonth) return;
    const datum = entry as { month?: number };
    if (typeof datum.month === 'number') {
      onSelectMonth(datum.month);
    }
  };

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.palette.divider} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          formatter={(value, name) => [
            String(value),
            name === 'trend' ? '3-month average' : 'Entries',
          ]}
        />
        <Bar
          dataKey="count"
          fill={theme.palette.primary.main}
          radius={[4, 4, 0, 0]}
          onClick={onSelectMonth ? handleBarClick : undefined}
          cursor={onSelectMonth ? 'pointer' : undefined}
        />
        <Line
          type="monotone"
          dataKey="trend"
          stroke={theme.palette.secondary.main}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
