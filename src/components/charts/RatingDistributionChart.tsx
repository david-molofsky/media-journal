import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';

interface RatingDistributionChartProps {
  ratingDistribution: Record<number, number>;
}

/**
 * Histogram of ratings 0–10 (UI & UX Specification, section 4 and
 * section 8). Entries are rated in 0.5 increments, but for chart
 * readability this buckets into whole-number bars — the underlying
 * entries keep their precise 0.5 rating, this view just groups them.
 */
export function RatingDistributionChart({ ratingDistribution }: RatingDistributionChartProps) {
  const theme = useTheme();
  const buckets = Array.from({ length: 11 }, (_, rating) => ({ rating, count: 0 }));
  for (const [rating, count] of Object.entries(ratingDistribution)) {
    const bucket = Math.round(Number(rating));
    const target = buckets[bucket];
    if (target) {
      target.count += count;
    }
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={buckets} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.palette.divider} />
        <XAxis dataKey="rating" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
        <Tooltip cursor={{ fill: theme.palette.action.hover }} />
        <Bar dataKey="count" fill={theme.palette.secondary.main} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
