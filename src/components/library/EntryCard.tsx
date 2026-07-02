import dayjs from 'dayjs';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ReplayIcon from '@mui/icons-material/Replay';
import type { MediaEntry, MediaType } from '@/models';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';

interface EntryCardProps {
  entry: MediaEntry;
  mediaType: MediaType | undefined;
  onOpen: () => void;
  selected?: boolean;
  onMarkFinished?: () => void;
  onStartTracking?: () => void;
  onMoveToWishlist?: () => void;
}

const STATUS_CONFIG = {
  in_progress: { label: '▶ In Progress', bgcolor: '#FFF8E1', color: '#F57F17', border: '#FFE082' },
  wishlist: { label: '★ Wishlist', bgcolor: '#F3E5F5', color: '#7B1FA2', border: '#CE93D8' },
} as const;

// Same pastel-bg/dark-text/border formula as STATUS_CONFIG above, so the
// Source badge sits visually consistent next to the status badge it
// appears alongside.
const SOURCE_BADGE = { bgcolor: '#E3F2FD', color: '#1565C0', border: '#90CAF9' } as const;

/**
 * Derives the subtitle line shown beneath the title. Each media type
 * surfaces the most useful field rather than showing the type name
 * (which is already implicit from the icon colour):
 *   Book / Audiobook  → Author name
 *   Film              → Dir. {Director}
 *   TV                → Season {N}
 *   Comic             → Issues {start}–{end}
 *   Custom            → falls back to the type's displayName
 *
 * The completion date always follows, separated by a mid-dot.
 */
function buildSubtitle(entry: MediaEntry, mediaType: MediaType | undefined): string {
  const { metadata, mediaType: typeId, completedDate } = entry;
  const date = dayjs(completedDate).format('D MMM YYYY');

  // Default: custom type — show display name. Known types overwrite below.
  let detail: string = mediaType?.displayName ?? typeId;
  if (typeId === 'book' || typeId === 'audiobook') {
    detail = typeof metadata.author === 'string' && metadata.author ? metadata.author : '';
  } else if (typeId === 'film') {
    detail =
      typeof metadata.director === 'string' && metadata.director
        ? `Dir. ${metadata.director}`
        : '';
  } else if (typeId === 'tv') {
    const { seasonNumber, episodeStart, episodeEnd } = metadata;
    const hasEpisodes =
      typeof episodeStart === 'number' && typeof episodeEnd === 'number';
    if (hasEpisodes) {
      const seasonPart = typeof seasonNumber === 'number' ? `S${seasonNumber} ` : '';
      detail = `${seasonPart}Ep ${episodeStart}–${episodeEnd}`;
    } else if (typeof seasonNumber === 'number') {
      detail = `Season ${seasonNumber}`;
    }
  } else if (typeId === 'comic') {
    const { issueStart, issueEnd } = metadata;
    detail =
      typeof issueStart === 'number' && typeof issueEnd === 'number'
        ? `Issues ${issueStart}–${issueEnd}`
        : '';
  }

  return [detail, date].filter(Boolean).join(' · ');
}

export function EntryCard({
  entry,
  mediaType,
  onOpen,
  selected,
  onMarkFinished,
  onStartTracking,
  onMoveToWishlist,

}: EntryCardProps) {
  // `Icon` is resolved from a module-level lookup table (utils/mediaTypeIcon.tsx)
  // keyed by a stable string — it doesn't change between renders for the same
  // media type. The react-compiler lint rule can't see that statically, so we
  // suppress it at the JSX usage site below.
  const Icon = getMediaTypeIcon(mediaType?.icon ?? '');
  const colour = mediaType?.colour ?? '#616161';

  const statusCfg = entry.status && entry.status !== 'completed' ? STATUS_CONFIG[entry.status] : null;
  const hasActions = Boolean(onMarkFinished ?? onStartTracking ?? onMoveToWishlist);
  // Shown next to the status badge only — Completed cards are already
  // dominated by rating/date, and Source is most useful when deciding
  // what to watch/read next from Wishlist or continuing something
  // already In Progress.
  const source =
    statusCfg && typeof entry.metadata.source === 'string' && entry.metadata.source.trim()
      ? entry.metadata.source
      : null;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderLeft: `4px solid ${colour}`, overflow: 'hidden', ...(selected !== undefined && { outline: selected ? `2px solid ${colour}` : '2px solid transparent' }) }}>
      <CardActionArea onClick={onOpen} sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {selected !== undefined && (
            <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? colour : '#ccc'}`, bgcolor: selected ? colour : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {selected ? '✓' : ''}
            </Box>
          )}
          <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: `${colour}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {/* eslint-disable-next-line react-hooks/static-components */}
            <Icon sx={{ color: colour, fontSize: 22 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="subtitle1" fontWeight={600} noWrap>{entry.title}</Typography>
              {entry.repeatConsumption && (
                <Tooltip title="Re-read / Re-watch"><ReplayIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></Tooltip>
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" noWrap>{buildSubtitle(entry, mediaType)}</Typography>
          </Box>
          {entry.rating !== undefined && (
            <Box sx={{ flexShrink: 0, bgcolor: colour, color: '#fff', fontWeight: 700, fontSize: 12, borderRadius: 20, px: 1.25, py: 0.4, lineHeight: 1.4 }}>
              {entry.rating % 1 === 0 ? entry.rating.toFixed(1) : entry.rating}
            </Box>
          )}
        </Stack>
      </CardActionArea>

      {statusCfg && (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ mb: hasActions ? 1 : 0 }}>
            <Box sx={{ display: 'inline-block', bgcolor: statusCfg.bgcolor, color: statusCfg.color, border: `1px solid ${statusCfg.border}`, borderRadius: 1.5, fontSize: 10, fontWeight: 700, px: 1, py: 0.25 }}>
              {statusCfg.label}
            </Box>
            {source && (
              <Box sx={{ display: 'inline-block', bgcolor: SOURCE_BADGE.bgcolor, color: SOURCE_BADGE.color, border: `1px solid ${SOURCE_BADGE.border}`, borderRadius: 1.5, fontSize: 10, fontWeight: 700, px: 1, py: 0.25 }}>
                {source}
              </Box>
            )}
          </Stack>
          {hasActions && (
            <>
              <Divider sx={{ mb: 1 }} />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {onMarkFinished && (
                  <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); onMarkFinished(); }}>✓ Mark finished</Button>
                )}
                {onStartTracking && (
                  <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); void onStartTracking(); }}>▶ Start tracking</Button>
                )}
                {onMoveToWishlist && (
                  <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); void onMoveToWishlist(); }}>★ Move to wishlist</Button>
                )}
              </Stack>
            </>
          )}
        </Box>
      )}
    </Card>
  );
}
