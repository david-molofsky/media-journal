import { useState } from 'react';
import dayjs from 'dayjs';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import ReplayIcon from '@mui/icons-material/Replay';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type { MediaEntry, MediaType } from '@/models';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';

/** Position badge shown during Reorder mode — gold for the top 10 per
 * David's emphasis on those slots being precisely settable, neutral
 * grey beyond that. */
const TOP10_BADGE = { bgcolor: '#D4A017', color: '#2A1E00', border: '#D4A017' } as const;
const RANK_BADGE = { bgcolor: 'action.hover', color: 'text.secondary', border: 'divider' } as const;

interface EntryCardProps {
  entry: MediaEntry;
  mediaType: MediaType | undefined;
  onOpen: () => void;
  selected?: boolean;
  onMarkFinished?: () => void;
  onStartTracking?: () => void;
  onMoveToWishlist?: () => void;
  /** Reorder mode (Wishlist, "My Order" sort). When set, the card shows
   * a position badge and up/down arrows instead of being tappable. */
  reorder?: {
    position: number;
    maxPosition: number;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    /** Tap-the-position-number jump — a 1-based target position,
     * clamped by the caller. */
    onJumpToPosition: (newPosition: number) => void;
  };
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
 * Derives the subtitle line shown beneath the title: just a date, plus
 * Source rendered separately as its own badge (see `completedSource` /
 * `source` below).
 *
 * Bug fix: this used to always format `entry.completedDate` regardless
 * of status. Wishlist entries (and In Progress entries before a start
 * date is set) have no `completedDate`, and `dayjs(undefined)` doesn't
 * return "no date" — it returns *right now* — so every Wishlist card
 * was silently showing today's date as if it had just been added,
 * which directly undermined the "Newest added" default sort (every
 * card looked equally recent). Mirrors the status-aware date already
 * used correctly in ShareEntrySheet.tsx's getFooterDateText.
 */
function buildSubtitle(entry: MediaEntry): string {
  if (entry.status === 'completed' && entry.completedDate) {
    return dayjs(entry.completedDate).format('D MMM YYYY');
  }
  if (entry.status === 'in_progress' && entry.startedDate) {
    return `Started ${dayjs(entry.startedDate).format('D MMM YYYY')}`;
  }
  return `Added ${dayjs(entry.createdAt).format('D MMM YYYY')}`;
}

export function EntryCard({
  entry,
  mediaType,
  onOpen,
  selected,
  onMarkFinished,
  onStartTracking,
  onMoveToWishlist,
  reorder,

}: EntryCardProps) {
  const [jumpAnchor, setJumpAnchor] = useState<HTMLElement | null>(null);
  const [jumpValue, setJumpValue] = useState('');

  const openJumpPopover = (e: React.MouseEvent<HTMLElement>) => {
    if (!reorder) return;
    setJumpValue(String(reorder.position));
    setJumpAnchor(e.currentTarget);
  };
  const closeJumpPopover = () => setJumpAnchor(null);
  const confirmJump = () => {
    if (!reorder) return;
    const parsed = Number(jumpValue);
    if (Number.isFinite(parsed) && parsed >= 1) {
      const clamped = Math.max(1, Math.min(Math.round(parsed), reorder.maxPosition));
      reorder.onJumpToPosition(clamped);
    }
    closeJumpPopover();
  };

  // `Icon` is resolved from a module-level lookup table (utils/mediaTypeIcon.tsx)
  // keyed by a stable string — it doesn't change between renders for the same
  // media type. The react-compiler lint rule can't see that statically, so we
  // suppress it at the JSX usage site below.
  const Icon = getMediaTypeIcon(mediaType?.icon ?? '');
  const colour = mediaType?.colour ?? '#616161';

  const statusCfg = entry.status && entry.status !== 'completed' ? STATUS_CONFIG[entry.status] : null;
  const hasActions = Boolean(onMarkFinished ?? onStartTracking ?? onMoveToWishlist);
  // Shown next to the status badge only — Wishlist/In Progress cards
  // surface Source here since it's most useful when deciding what to
  // watch/read next or continuing something already started.
  const source =
    statusCfg && typeof entry.metadata.source === 'string' && entry.metadata.source.trim()
      ? entry.metadata.source
      : null;
  // Completed cards show Source inline next to the date instead —
  // there's no separate badge row for Completed, so it rides along
  // the subtitle line rather than adding a new row to every card.
  const completedSource =
    entry.status === 'completed' && typeof entry.metadata.source === 'string' && entry.metadata.source.trim()
      ? entry.metadata.source
      : null;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderLeft: `4px solid ${colour}`, overflow: 'hidden', ...(selected !== undefined && { outline: selected ? `2px solid ${colour}` : '2px solid transparent' }) }}>
      <Stack direction="row" alignItems="stretch">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Deliberately NOT using CardActionArea's `disabled` prop
           * to stop the card body from navigating during Reorder mode
           * — `disabled` renders a real native <button disabled>, and
           * browsers refuse to dispatch click events to ANY descendant
           * of a disabled button (this happens beneath CSS entirely,
           * so pointer-events:auto on a child can't override it). That
           * silently broke the position badge's tap-to-jump popover
           * nested inside. onClick={undefined} already achieves the
           * same "tapping the card body does nothing" result without
           * disabling the button at the browser level. */}
          <CardActionArea
            onClick={reorder ? undefined : onOpen}
            disableRipple={Boolean(reorder)}
            sx={{ p: 2, cursor: reorder ? 'default' : 'pointer' }}
          >
            <Stack direction="row" spacing={2} alignItems="center">
              {reorder && (
                <Box
                  onClick={(e) => { e.stopPropagation(); openJumpPopover(e); }}
                  sx={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    bgcolor: reorder.position <= 10 ? TOP10_BADGE.bgcolor : RANK_BADGE.bgcolor,
                    color: reorder.position <= 10 ? TOP10_BADGE.color : RANK_BADGE.color,
                    border: `1px solid ${reorder.position <= 10 ? TOP10_BADGE.border : 'transparent'}`,
                  }}
                >
                  {reorder.position}
                </Box>
              )}
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
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary" noWrap>{buildSubtitle(entry)}</Typography>
                  {completedSource && (
                    <Box sx={{ flexShrink: 0, display: 'inline-block', bgcolor: SOURCE_BADGE.bgcolor, color: SOURCE_BADGE.color, border: `1px solid ${SOURCE_BADGE.border}`, borderRadius: 1.5, fontSize: 10, fontWeight: 700, px: 1, py: 0.25 }}>
                      {completedSource}
                    </Box>
                  )}
                </Stack>
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
        </Box>

        {reorder && (
          <Stack justifyContent="center" alignItems="center" spacing={0.25} sx={{ px: 1, borderLeft: 1, borderColor: 'divider' }}>
            <IconButton size="small" disabled={!reorder.onMoveUp} onClick={reorder.onMoveUp}>
              <KeyboardArrowUpIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" disabled={!reorder.onMoveDown} onClick={reorder.onMoveDown}>
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Stack>

      {reorder && (
        <Popover
          open={Boolean(jumpAnchor)}
          anchorEl={jumpAnchor}
          onClose={closeJumpPopover}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box sx={{ p: 2, width: 200 }} onClick={(e) => e.stopPropagation()}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Move "{entry.title}" to position:
            </Typography>
            <TextField
              autoFocus
              size="small"
              type="number"
              fullWidth
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmJump(); }}
              slotProps={{ htmlInput: { min: 1, max: reorder.maxPosition, style: { textAlign: 'center' } } }}
              sx={{ mb: 1.5 }}
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" onClick={closeJumpPopover}>Cancel</Button>
              <Button size="small" variant="contained" onClick={confirmJump}>Move</Button>
            </Stack>
          </Box>
        </Popover>
      )}
    </Card>
  );
}
