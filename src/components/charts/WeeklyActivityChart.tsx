import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';

interface WeeklyActivityChartProps {
  weeklyTotals: Record<number, number>;
}

/** Compact weekly activity chart for the Statistics "Trends" section
 * (PRD section 5: "Weekly totals"; UI & UX Specification section 8). */
export function WeeklyActivityChart({ weeklyTotals }: WeeklyActivityChartProps) {
  const theme = useTheme();
  const data = Array.from({ length: 53 }, (_, index) => ({
    week: index + 1,
    count: weeklyTotals[index + 1] ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={10} interval={7} />
        <Tooltip
          cursor={{ fill: theme.palette.action.hover }}
          formatter={(value) => [String(value), 'Entries']}
          labelFormatter={(week) => `Week ${week}`}
        />
        <Bar dataKey="count" fill={theme.palette.primary.light} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
