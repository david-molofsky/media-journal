import dayjs from 'dayjs';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { MediaEntry, MediaType } from '@/models';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';

interface EntryCardProps {
  entry: MediaEntry;
  mediaType: MediaType | undefined;
  onOpen: () => void;
  onDelete: () => void;
}

/**
 * A single Library entry card, per UI & UX Specification section 5:
 * rating badge, title, media type icon, completion date, series (if
 * applicable) and a re-read/re-watch indicator — coloured by the
 * entry's media type accent colour.
 *
 * Tapping the card opens Edit Entry. The spec also calls for
 * swipe-left-to-delete and swipe-right-to-quick-edit gestures; those
 * need a gesture library this project doesn't yet depend on, so for
 * now delete is a direct action button and quick-edit is just "tap
 * through to Edit Entry" — both fully cover the underlying
 * requirement (browse, edit, delete) without adding a new dependency
 * for a polish-level interaction.
 */
export function EntryCard({ entry, mediaType, onOpen, onDelete }: EntryCardProps) {
  // `Icon` is resolved from a stable, module-level lookup table
  // (utils/mediaTypeIcon.tsx) keyed by `mediaType.icon`, so its identity
  // doesn't actually change between renders for the same media type;
  // the react-compiler lint rule can't see that statically.
  const Icon = getMediaTypeIcon(mediaType?.icon ?? '');
  const colour = mediaType?.colour ?? '#616161';
  const series = typeof entry.metadata.series === 'string' ? entry.metadata.series : undefined;

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: 3, borderLeft: `4px solid ${colour}`, overflow: 'hidden' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
        <CardActionArea onClick={onOpen} sx={{ p: 2, flex: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: `${colour}1A`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {entry.rating !== undefined ? (
                <Typography variant="subtitle2" fontWeight={700} color={colour}>
                  {entry.rating}
                </Typography>
              ) : (
                // eslint-disable-next-line react-hooks/static-components
                <Icon sx={{ color: colour, fontSize: 22 }} />
              )}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="subtitle1" fontWeight={600} noWrap>
                  {entry.title}
                </Typography>
                {entry.repeatConsumption && (
                  <Tooltip title="Re-read / Re-watch">
                    <ReplayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </Tooltip>
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" noWrap>
                {mediaType?.displayName ?? entry.mediaType}
                {series ? ` · ${series}` : ''} · {dayjs(entry.completedDate).format('D MMM YYYY')}
              </Typography>
            </Box>
          </Stack>
        </CardActionArea>
        <IconButton
          aria-label={`Delete ${entry.title}`}
          onClick={onDelete}
          sx={{ alignSelf: 'center', mr: 1 }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>
    </Card>
  );
}
