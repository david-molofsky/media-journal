import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import type { TopGenreShareByMediaType } from '@/services/statistics/statisticsService';
import type { MediaType } from '@/models';

interface GenreShareByTypeProps {
  data: TopGenreShareByMediaType;
  mediaTypes: MediaType[];
}

/**
 * "{Genre} across your media" breakdown — for the year's top genre
 * (from getTopGenreShareByMediaType), one bar per media type showing
 * what share of that type's own entries carried the genre. Sits under
 * GenreBarChart on the Statistics page.
 *
 * Bars are colour-coded per media type (MediaType.colour) rather than
 * a flat accent, matching the colour used for that type everywhere
 * else (badges, summary cards) — including any custom media types the
 * person has added themselves, since the colour comes from the same
 * per-type field rather than a hard-coded palette.
 */
export function GenreShareByType({ data, mediaTypes }: GenreShareByTypeProps) {
  const colourFor = (mediaTypeId: string): string =>
    mediaTypes.find((mt) => mt.id === mediaTypeId)?.colour ?? '#9E9E9E';

  const nameFor = (mediaTypeId: string): string =>
    mediaTypes.find((mt) => mt.id === mediaTypeId)?.displayName ?? mediaTypeId;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {data.genre} across your media
      </Typography>
      <Stack spacing={1.5}>
        {data.shareByMediaType.map(({ mediaType, percentage }) => (
          <Box key={mediaType}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="body2">{nameFor(mediaType)}</Typography>
              <Typography variant="body2" fontWeight={500}>
                {percentage}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percentage}
              sx={{
                height: 6,
                borderRadius: 1,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: colourFor(mediaType), borderRadius: 1 },
              }}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
