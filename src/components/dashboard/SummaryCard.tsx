import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { MediaType } from '@/models';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';

interface SummaryCardProps {
  mediaType: MediaType;
  count: number;
  percentOfYear: number;
  onClick: () => void;
}

/** One card per media type on the Dashboard: icon, total, % of yearly
 * total, accent colour — tappable through to a filtered Library (UI &
 * UX Specification, section 4). */
export function SummaryCard({ mediaType, count, percentOfYear, onClick }: SummaryCardProps) {
  const Icon = getMediaTypeIcon(mediaType.icon);

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderTop: `3px solid ${mediaType.colour}` }}>
      <CardActionArea onClick={onClick} sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* eslint-disable-next-line react-hooks/static-components -- see EntryCard.tsx */}
          <Icon sx={{ color: mediaType.colour, fontSize: 22 }} />
          <Typography variant="caption" color="text.secondary">
            {percentOfYear}%
          </Typography>
        </Box>
        <Typography variant="h6" fontWeight={600} sx={{ mt: 0.5 }}>
          {count}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {mediaType.displayName}
        </Typography>
      </CardActionArea>
    </Card>
  );
}
