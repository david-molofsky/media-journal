import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getMediaTypeColour } from '@/theme';
import type { MediaType } from '@/models';

interface MediaBreakdownChartProps {
  totalsByMediaType: Record<string, number>;
  mediaTypes: MediaType[];
}

/** Pie chart of relative consumption by media type (UI & UX
 * Specification, section 4: "Media Breakdown"), coloured by each
 * type's accent colour. */
export function MediaBreakdownChart({ totalsByMediaType, mediaTypes }: MediaBreakdownChartProps) {
  const mediaTypeById = new Map(mediaTypes.map((type) => [type.id, type]));
  const data = Object.entries(totalsByMediaType)
    .filter(([, count]) => count > 0)
    .map(([mediaType, count]) => ({
      mediaType,
      name: mediaTypeById.get(mediaType)?.displayName ?? mediaType,
      count,
    }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.mediaType} fill={getMediaTypeColour(entry.mediaType)} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
