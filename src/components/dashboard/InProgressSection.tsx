import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useInProgressEntries } from '@/hooks/useInProgressEntries';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { getEntryImageUrl } from '@/utils/entryImage';
import { ROUTES, entryDetailPath } from '@/routes/paths';
import type { MediaType } from '@/models';

dayjs.extend(relativeTime);

dayjs.extend(relativeTime);

interface InProgressSectionProps {
  mediaTypes: MediaType[];
}

export function InProgressSection({ mediaTypes }: InProgressSectionProps) {
  const navigate = useNavigate();
  const all = useInProgressEntries();
  // Tracks which image URLs have failed to load, per entry — a Set rather
  // than EntryCard's single failedImageUrl state, since this component
  // renders several entries in one list rather than one entry per instance.
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  if (!all || all.length === 0) return null;

  const shown = all.slice(0, 3);
  const mediaTypeById = new Map(mediaTypes.map((t) => [t.id, t]));

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" color="text.secondary">
          In Progress
        </Typography>
        {all.length > 3 && (
          <Button size="small" onClick={() => navigate(ROUTES.library, { state: { status: 'in_progress' } })}>
            See all ({all.length})
          </Button>
        )}
      </Stack>
      <Stack spacing={1.5}>
        {shown.map((entry) => {
          const mediaType = mediaTypeById.get(entry.mediaType);
          const colour = mediaType?.colour ?? '#616161';
          const Icon = getMediaTypeIcon(mediaType?.icon ?? '');
          const imageUrl = getEntryImageUrl(entry);
          const showImage = typeof imageUrl === 'string' && !failedImageUrls.has(imageUrl);
          return (
            <Card
              key={entry.id}
              variant="outlined"
              sx={{ borderRadius: 3, borderLeft: `4px solid ${colour}` }}
            >
              <CardActionArea
                onClick={() => navigate(entryDetailPath(entry.id))}
                sx={{ p: 1.5 }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {showImage && imageUrl ? (
                    <Box
                      component="img"
                      src={imageUrl}
                      alt=""
                      onError={() =>
                        setFailedImageUrls((prev) => new Set(prev).add(imageUrl))
                      }
                      sx={{
                        width: 40,
                        height: 56,
                        borderRadius: 1.5,
                        flexShrink: 0,
                        objectFit: 'cover',
                        bgcolor: 'action.hover',
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        bgcolor: `${colour}1A`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ color: colour, fontSize: 18 }} />
                    </Box>
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight={600} noWrap>
                      {entry.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Started {entry.startedDate ? dayjs(entry.startedDate).fromNow() : 'recently'}
                    </Typography>
                  </Box>
                  <Chip label="In progress" size="small" variant="outlined" />
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
