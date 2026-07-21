import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';

interface GenreDatum {
  genre: string;
  count: number;
  rating?: number;
}

interface GenreBarChartProps {
  topGenresByCount: Record<string, number>;
  averageRatingByGenre: Record<string, number>;
  /** How many genres to show, by count descending. Defaults to 8. */
  limit?: number;
  /** Called with the genre name when a bar is tapped/clicked — used to
   * drill down into the Library filtered to that genre. Bars render
   * with a pointer cursor only when this is provided. */
  onSelectGenre?: (genre: string) => void;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: GenreDatum }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  const { genre, count, rating } = datum;
  return (
    <div style={{ background: '#1E1E1E', border: '1px solid #333', borderRadius: 8, padding: '6px 10px', fontSize: 12 }}>
      <div style={{ fontWeight: 600 }}>{genre}</div>
      <div>{count} entr{count === 1 ? 'y' : 'ies'}</div>
      {rating !== undefined && <div>★ {rating.toFixed(1)} average</div>}
    </div>
  );
}

/** Horizontal bar chart of the top genres by entry count. Flat — not
 * grouped by media type — since a genre means the same thing across
 * types (see `getTopGenresByCount`). Hovering a bar shows average
 * rating for that genre, keeping the chart itself uncluttered rather
 * than adding a second rating axis or a separate list. */
export function GenreBarChart({
  topGenresByCount,
  averageRatingByGenre,
  limit = 8,
  onSelectGenre,
}: GenreBarChartProps) {
  const theme = useTheme();
  const data: GenreDatum[] = Object.entries(topGenresByCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([genre, count]) => ({ genre, count, rating: averageRatingByGenre[genre] }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 32)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={theme.palette.divider} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
        <YAxis type="category" dataKey="genre" tickLine={false} axisLine={false} fontSize={12} width={90} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.palette.action.hover }} />
        <Bar
          dataKey="count"
          fill={theme.palette.secondary.main}
          radius={[0, 4, 4, 0]}
          style={{ cursor: onSelectGenre ? 'pointer' : undefined }}
          onClick={(data) => {
            const genre = (data as unknown as { payload?: GenreDatum })?.payload?.genre;
            if (genre) onSelectGenre?.(genre);
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
