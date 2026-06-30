import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface MonthDatum {
  month: number;
  label: string;
  count: number;
}

interface MonthlyActivityChartProps {
  monthlyBreakdown: Record<number, number>;
  /** Tapping a bar opens the Library filtered to that month (UI & UX
   * Specification, section 4). Omit to render a static, non-tappable
   * chart (used on the Statistics screen). */
  onSelectMonth?: (month: number) => void;
}

/** Vertical bar chart of entries per calendar month (PRD section 5;
 * UI & UX Specification section 4). */
export function MonthlyActivityChart({ monthlyBreakdown, onSelectMonth }: MonthlyActivityChartProps) {
  const theme = useTheme();
  const data: MonthDatum[] = MONTH_ABBREVIATIONS.map((label, index) => ({
    month: index + 1,
    label,
    count: monthlyBreakdown[index + 1] ?? 0,
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
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.palette.divider} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
        <Tooltip cursor={{ fill: theme.palette.action.hover }} />
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
