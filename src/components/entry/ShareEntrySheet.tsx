import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import dayjs from 'dayjs';
import type { MediaEntry, MediaType } from '@/models';
import { buildShareMessage, getConsumptionVerb } from '@/services/share/shareMessageService';
import { getEntryImageUrl } from '@/utils/entryImage';

interface ShareEntrySheetProps {
  open: boolean;
  entry: MediaEntry;
  mediaType: MediaType | undefined;
  onClose: () => void;
}

/** Main status line drawn under the subline, above the rating/badge. */
function getStatusLineText(entry: MediaEntry): string {
  if (entry.status === 'completed') {
    return `Completed ${dayjs(entry.completedDate).format('D MMMM YYYY')}`;
  }
  if (entry.status === 'in_progress') {
    return entry.startedDate
      ? `Started ${dayjs(entry.startedDate).format('D MMMM YYYY')}`
      : 'In progress';
  }
  return 'On my wishlist';
}

/** Footer branding date — shorter format, different source date per status. */
function getFooterDateText(entry: MediaEntry): string {
  if (entry.status === 'completed' && entry.completedDate) {
    return dayjs(entry.completedDate).format('D MMM YYYY');
  }
  if (entry.status === 'in_progress' && entry.startedDate) {
    return `Started ${dayjs(entry.startedDate).format('D MMM YYYY')}`;
  }
  return `Added ${dayjs(entry.createdAt).format('D MMM YYYY')}`;
}

/** Pill badge text — only shown for non-completed statuses. */
function getBadgeText(entry: MediaEntry): string | null {
  if (entry.status === 'wishlist') return 'Wishlist';
  if (entry.status === 'in_progress') {
    return `Currently ${getConsumptionVerb(entry.mediaType)}`;
  }
  return null;
}

/** Draws a small rounded pill with uppercase text at (x, y). Returns its height. */
function drawBadge(ctx: CanvasRenderingContext2D, colour: string, text: string, x: number, y: number): number {
  const pillH = 44;
  ctx.font = '700 22px system-ui, -apple-system, sans-serif';
  const label = text.toUpperCase();
  const pillW = ctx.measureText(label).width + 32;

  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y, pillW, pillH, pillH / 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 16, y + 29);

  return pillH;
}

/** Poster box drawn on the exported canvas, left of the text column —
 * same 2:3 ratio as the in-app preview's 120×180, just scaled up to
 * suit the 1200×630 export (see chat). */
const CANVAS_POSTER_W = 240;
const CANVAS_POSTER_H = 360;
const CANVAS_POSTER_GAP = 44;

/**
 * Loads an image for drawing onto the canvas. Resolves `null` (rather
 * than rejecting) on any load failure — a broken/expired poster URL
 * should silently fall back to the text-only layout, exactly like
 * EntryCard's `onError` → icon fallback, not break the whole export.
 */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Generates a 1200×630 (OG-image-sized) card on a hidden canvas,
 * then either downloads it as a PNG or passes it to the Web Share API.
 * Drawn entirely with the Canvas 2D API — no extra dependencies.
 *
 * Layout adapts to entry.status: completed entries show the original
 * "Completed {date}" + rating treatment; in_progress/wishlist entries
 * show a status line and a pill badge instead of a rating (unless one
 * happens to be set — rating is drawn whenever present, regardless of
 * status).
 *
 * Async because it awaits the poster image loading (if the entry has
 * one) before drawing — see chat, poster now appears on the exported
 * image as well as the in-app preview. Text content shifts right of
 * the poster when one is present; falls back to the original
 * full-width layout when it isn't (no image, or the image fails
 * to load).
 */
async function buildShareCanvas(
  entry: MediaEntry,
  mediaType: MediaType | undefined,
): Promise<HTMLCanvasElement> {
  const W = 1200;
  const H = 630;
  const colour = mediaType?.colour ?? '#2E7D32';

  const imageUrl = getEntryImageUrl(entry, 'poster');
  const posterImg = imageUrl ? await loadImage(imageUrl) : null;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, W, H);

  // White card area
  const pad = 60;
  const cardX = pad;
  const cardY = pad;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;
  const r = 24;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, r);
  ctx.fill();

  // Accent left strip
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, 12, cardH, [r, 0, 0, r]);
  ctx.fill();

  const baseContentX = cardX + 52;

  // Poster, if present — drawn top-left of the content area; the rest
  // of the text column shifts right to make room for it.
  if (posterImg) {
    const posterX = baseContentX;
    const posterY = cardY + 56;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(posterX, posterY, CANVAS_POSTER_W, CANVAS_POSTER_H, 12);
    ctx.clip();
    ctx.drawImage(posterImg, posterX, posterY, CANVAS_POSTER_W, CANVAS_POSTER_H);
    ctx.restore();
  }
  const contentX = posterImg ? baseContentX + CANVAS_POSTER_W + CANVAS_POSTER_GAP : baseContentX;
  const contentY = cardY + 60;

  // Media type label
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = colour;
  ctx.fillText((mediaType?.displayName ?? entry.mediaType).toUpperCase(), contentX, contentY);

  // Title
  const titleY = contentY + 72;
  ctx.font = '700 68px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#1a1a1a';
  const maxTitleW = cardX + cardW - 68 - contentX;
  let title = entry.title;
  while (ctx.measureText(title).width > maxTitleW && title.length > 3) {
    title = title.slice(0, -4) + '…';
  }
  ctx.fillText(title, contentX, titleY);

  // Author / director / etc.
  const meta = entry.metadata;
  const subline =
    typeof meta.author === 'string' && meta.author
      ? meta.author
      : typeof meta.director === 'string' && meta.director
        ? `Dir. ${meta.director}`
        : typeof meta.series === 'string' && meta.series
          ? meta.series
          : '';

  if (subline) {
    ctx.font = '400 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText(subline, contentX, titleY + 56);
  }

  // Status line (Completed {date} / Started {date} / In progress / On my wishlist)
  const statusLineY = subline ? titleY + 112 : titleY + 56;
  ctx.font = '400 30px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#888';
  ctx.textAlign = 'left';
  ctx.fillText(getStatusLineText(entry), contentX, statusLineY);

  // Badge (Currently {verb} / Wishlist) — only for non-completed statuses
  const badgeText = getBadgeText(entry);
  if (badgeText) {
    drawBadge(ctx, colour, badgeText, contentX, statusLineY + 24);
  }

  // Rating — drawn whenever present, regardless of status. Kept in the
  // same shifted text column as everything above (rather than back at
  // the card's full-width margin) so it doesn't collide with a tall
  // poster; a poster this size clears the rating position comfortably.
  if (entry.rating !== undefined) {
    const ratingY = cardY + cardH - 100;
    ctx.font = '700 96px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = colour;
    ctx.textAlign = 'left';
    ctx.fillText(String(entry.rating), contentX, ratingY);
    ctx.font = '400 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('/ 10', contentX + 140, ratingY);
  }

  // Notes excerpt
  if (entry.notes && entry.notes.trim().length > 0) {
    const excerpt = entry.notes.slice(0, 120).replace(/\n/g, ' ');
    ctx.font = 'italic 26px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(`"${excerpt}${entry.notes.length > 120 ? '…' : ''}"`, contentX, cardY + cardH - 52);
  }

  // Footer branding — always full-width bottom-right, unaffected by
  // the poster (it never extends this low).
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.textAlign = 'right';
  ctx.fillText(
    `Media Journal · ${getFooterDateText(entry)}`,
    cardX + cardW - 30,
    cardY + cardH - 28,
  );

  return canvas;
}

export function ShareEntrySheet({ open, entry, mediaType, onClose }: ShareEntrySheetProps) {
  const colour = mediaType?.colour ?? '#2E7D32';
  const meta = entry.metadata;

  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getEntryImageUrl(entry, 'poster');
  const showImage = Boolean(imageUrl) && !imageFailed;

  const subline =
    typeof meta.author === 'string' && meta.author
      ? meta.author
      : typeof meta.director === 'string' && meta.director
        ? `Dir. ${meta.director}`
        : '';

  const message = buildShareMessage(entry);
  const badgeText = getBadgeText(entry);

  const handleDownload = async () => {
    const canvas = await buildShareCanvas(entry, mediaType);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${entry.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    link.click();
  };

  const handleShare = async () => {
    const canvas = await buildShareCanvas(entry, mediaType);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'entry.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: entry.title, text: message });
      } else {
        // Fallback: just download
        handleDownload();
      }
    }, 'image/png');
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Share Entry</DialogTitle>
      <DialogContent>
        {/* Card preview */}
        <Box
          sx={{
            borderRadius: 3,
            bgcolor: colour,
            p: 2.5,
            mb: 2,
            color: '#fff',
          }}
        >
          <Stack direction="row" spacing={2}>
            {showImage && (
              <Box
                component="img"
                src={imageUrl}
                onError={() => setImageFailed(true)}
                alt=""
                sx={{
                  flexShrink: 0,
                  width: 120,
                  height: 180,
                  borderRadius: 2,
                  objectFit: 'cover',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
                }}
              />
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" sx={{ opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 }}>
                {mediaType?.displayName ?? entry.mediaType}
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, mb: 0.25 }}>
                {entry.title}
              </Typography>
              {subline && (
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {subline}
                </Typography>
              )}
              <Typography
                variant="body2"
                sx={{
                  opacity: 0.9,
                  mt: 0.5,
                  pt: 1,
                  borderTop: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                {getStatusLineText(entry)}
              </Typography>
              {badgeText && (
                <Chip
                  label={badgeText.toUpperCase()}
                  size="small"
                  sx={{
                    mt: 1,
                    bgcolor: 'rgba(255,255,255,0.18)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: 0.5,
                  }}
                />
              )}
              {entry.rating !== undefined && (
                <Typography variant="h4" fontWeight={700} sx={{ mt: 1.5 }}>
                  {entry.rating}
                  <Typography component="span" variant="body2" sx={{ ml: 0.5, opacity: 0.7 }}>
                    / 10
                  </Typography>
                </Typography>
              )}
            </Box>
          </Stack>
          {entry.notes && (
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 1.5, opacity: 0.8, fontStyle: 'italic' }}
            >
              "{entry.notes.slice(0, 100)}{entry.notes.length > 100 ? '…' : ''}"
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.5 }}>
            Media Journal · {getFooterDateText(entry)}
          </Typography>
        </Box>

        <Typography
          variant="caption"
          sx={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.75 }}
        >
          Message
        </Typography>
        <Box
          sx={{
            bgcolor: 'action.hover',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            px: 1.5,
            py: 1,
            mb: 1,
          }}
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
            {message}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <Button onClick={onClose} color="inherit">Cancel</Button>
        <Button startIcon={<DownloadOutlinedIcon />} variant="outlined" onClick={handleDownload}>
          Save image
        </Button>
        <Button startIcon={<ShareOutlinedIcon />} variant="contained" onClick={handleShare}>
          Share
        </Button>
      </DialogActions>
    </Dialog>
  );
}
