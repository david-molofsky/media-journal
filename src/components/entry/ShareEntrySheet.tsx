import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import dayjs from 'dayjs';
import type { MediaEntry, MediaType } from '@/models';
import { buildShareMessage } from '@/services/share/shareMessageService';
import { getEntryImageUrl } from '@/utils/entryImage';

interface ShareEntrySheetProps {
  open: boolean;
  entry: MediaEntry;
  mediaType: MediaType | undefined;
  onClose: () => void;
}

/** Main status line drawn under the title/subline — this is now the
 * *only* place status (Wishlist / In progress / Completed) is
 * conveyed on the card. The status pill badge that used to sit below
 * it was removed (see chat) — the rating now takes that slot when
 * present, and it's simply left blank when there isn't one, since the
 * status line already says "On my wishlist" / "Started {date}". */
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

/** Author/source/series subline, shared between the preview and the
 * canvas export so they can never drift apart. Source (e.g. "Amazon
 * Prime Video") replaces director here (see chat) — more useful at a
 * glance on a shared card than who directed it. */
function getSubline(entry: MediaEntry): string {
  const meta = entry.metadata;
  if (typeof meta.author === 'string' && meta.author) return meta.author;
  if (typeof meta.source === 'string' && meta.source) return meta.source;
  if (typeof meta.series === 'string' && meta.series) return meta.series;
  return '';
}

// ── Canvas export ────────────────────────────────────────────────────────────

/** Poster/cover images are drawn onto a <canvas> that then gets
 * exported to a PNG (Save image / Share). That export requires every
 * image on the canvas to have loaded under permissive CORS, or the
 * whole canvas becomes "tainted" and toDataURL()/toBlob() throws.
 * TMDB's image CDN sends the right headers; Open Library's and
 * ComicVine's don't reliably, which silently dropped the poster from
 * the exported file even though it displayed fine in the in-app
 * preview (a plain <img>, no canvas involved). Routing those three
 * hosts through the Worker's /image-proxy re-serves the bytes with an
 * explicit CORS header, so the canvas never sees a cross-origin load
 * at all. Anything else (e.g. Anime/Manga's manually-pasted cover
 * URLs, which can point anywhere) falls back to the old best-effort
 * direct load — deliberately not proxying arbitrary URLs, see the
 * Worker's own comment on IMAGE_PROXY_ALLOWED_HOSTS. */
const IMAGE_PROXY_BASE = 'https://media-journal-comicvine-proxy.david-molofsky.workers.dev';
const IMAGE_PROXY_HOSTS = ['image.tmdb.org', 'covers.openlibrary.org', 'comicvine.gamespot.com'];

function proxiedImageUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (IMAGE_PROXY_HOSTS.includes(host)) {
      return `${IMAGE_PROXY_BASE}/image-proxy?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // Malformed URL — fall through and let the direct load attempt
    // fail on its own rather than throwing here.
  }
  return url;
}

/**
 * Loads an image for drawing onto the canvas. Resolves `null` (rather
 * than rejecting) on any load failure — a broken/expired poster URL,
 * or a non-proxied host with no CORS headers, should silently fall
 * back to the text-only layout, exactly like EntryCard's `onError` →
 * icon fallback, not break the whole export.
 */
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = proxiedImageUrl(url);
  });
}

const CANVAS_W = 1200;
const PAD = 56;
// Poster share of the content width — enlarged from 0.4 to 0.58 (see
// chat: "option 5" of the redesign exploration). Text column narrows
// accordingly, so titles wrap a line sooner than they used to.
// Poster share of the content width — reduced from 0.58 to 0.53 (see
// chat): at 58%, a two-digit rating's "/ 10" suffix ran past the
// right edge of the canvas for some titles, since the text column
// wasn't quite wide enough for the enlarged rating font. 53% gives
// the text column, and therefore the rating, breathing room again.
const POSTER_RATIO = 0.53;
const GAP = 40;
/** Content-column height floor — keeps a short-title card at the
 * original ~4:3 proportions rather than shrinking to fit its content;
 * only grows taller than this when a wrapped title (or notes excerpt)
 * genuinely needs more room. */
const MIN_CONTENT_H = 788;
const MAX_TITLE_LINES = 4;

const LABEL_FONT = '600 26px system-ui, -apple-system, sans-serif';
const LABEL_H = 32;
const LABEL_GAP = 14;
const TITLE_FONT = '700 52px system-ui, -apple-system, sans-serif';
const TITLE_LINE_H = 60;
const SUBLINE_FONT = '400 32px system-ui, -apple-system, sans-serif';
const SUBLINE_H = 40;
const SUBLINE_GAP = 10;
const STATUS_FONT = '400 26px system-ui, -apple-system, sans-serif';
const STATUS_H = 32;
// Rating — enlarged 3x (80px → 240px) and moved out of the bottom
// block into the gap between the subline and the divider, where it's
// vertically centred (see chat). No longer part of bottomBlockH.
const RATING_FONT = '700 240px system-ui, -apple-system, sans-serif';
const RATING_SUFFIX_FONT = '400 90px system-ui, -apple-system, sans-serif';
const RATING_H = 270;
const NOTES_FONT = 'italic 24px system-ui, -apple-system, sans-serif';
const NOTES_H = 34;
const NOTES_GAP = 16;
const DIVIDER_GAP_ABOVE = 24;
const DIVIDER_GAP_BELOW = 16;

/** Greedy word-wrap against a max pixel width, using whatever font is
 * currently set on `ctx`. Capped at MAX_TITLE_LINES — titles are
 * capped at 250 chars by validation, but an unbroken run of very long
 * words could otherwise still produce an impractically tall card. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  if (lines.length > MAX_TITLE_LINES) {
    const truncated = lines.slice(0, MAX_TITLE_LINES);
    let last = truncated[MAX_TITLE_LINES - 1] ?? '';
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    truncated[MAX_TITLE_LINES - 1] = `${last}…`;
    return truncated;
  }
  return lines;
}

/**
 * Generates the share card on a hidden canvas, then either downloads
 * it as a PNG or passes it to the Web Share API. Drawn entirely with
 * the Canvas 2D API — no extra dependencies.
 *
 * Unlike the old version, this is no longer a fixed 1200×630 — the
 * canvas height is computed per-entry from how many lines the title
 * wraps to (see wrapText above), so a long title makes the whole card
 * (poster included, since it stretches to match the text column)
 * taller rather than truncating with an ellipsis. Width is always
 * 1200; height only ever grows from the ~4:3 baseline, never shrinks
 * below it.
 *
 * Colour fills the entire card (matching the in-app preview — these
 * two used to be different designs, a white card with just a colour
 * accent strip for the export vs. a solid colour block for the
 * preview; unified here, see chat) rather than a white card with a
 * colour accent strip.
 */
async function buildShareCanvas(
  entry: MediaEntry,
  mediaType: MediaType | undefined,
): Promise<HTMLCanvasElement> {
  const colour = mediaType?.colour ?? '#2E7D32';
  const title = entry.title;
  const subline = getSubline(entry);
  const statusText = getStatusLineText(entry);
  const hasRating = entry.rating !== undefined;
  const notesExcerpt =
    entry.notes && entry.notes.trim().length > 0
      ? `"${entry.notes.slice(0, 120).replace(/\n/g, ' ')}${entry.notes.length > 120 ? '…' : ''}"`
      : null;

  const imageUrl = getEntryImageUrl(entry, 'poster');
  const posterImg = imageUrl ? await loadImage(imageUrl) : null;

  const contentW = CANVAS_W - PAD * 2;
  const posterW = posterImg ? Math.round(contentW * POSTER_RATIO) : 0;
  const textColW = posterImg ? contentW - posterW - GAP : contentW;

  // Measure against a scratch context — kept separate from the final
  // drawing context so sizing the real canvas doesn't need a
  // resize-and-reset-state dance partway through.
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = TITLE_FONT;
  const titleLines = wrapText(measureCtx, title, textColW);

  const topBlockH =
    LABEL_H + LABEL_GAP + titleLines.length * TITLE_LINE_H + (subline ? SUBLINE_GAP + SUBLINE_H : 0);
  const bottomBlockH =
    DIVIDER_GAP_ABOVE +
    2 +
    DIVIDER_GAP_BELOW +
    STATUS_H +
    (notesExcerpt ? NOTES_GAP + NOTES_H : 0);
  // The rating no longer contributes a fixed amount to either block —
  // it's centred in whatever vertical space is left between them, so
  // a floor is reserved here (only when there is a rating to show)
  // purely to guarantee that gap is never smaller than the rating
  // itself needs, growing the whole card taller if it would be.
  const middleFloorH = hasRating ? RATING_H : 0;
  const contentColH = Math.max(topBlockH + middleFloorH + bottomBlockH, MIN_CONTENT_H);
  const canvasH = contentColH + PAD * 2;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d')!;

  // Card background — rounded rect filling the whole canvas, colour
  // throughout (see function doc comment re: unifying with preview).
  ctx.beginPath();
  ctx.roundRect(0, 0, CANVAS_W, canvasH, 32);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.clip();

  const contentX = PAD;
  const contentY = PAD;

  if (posterImg) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(contentX, contentY, posterW, contentColH, 16);
    ctx.clip();
    // Cover-fit: scale to fill the box, cropping whichever axis
    // overflows, same visual behaviour as the preview's objectFit
    // 'cover'.
    const imgRatio = posterImg.width / posterImg.height;
    const boxRatio = posterW / contentColH;
    let drawW: number;
    let drawH: number;
    if (imgRatio > boxRatio) {
      drawH = contentColH;
      drawW = contentColH * imgRatio;
    } else {
      drawW = posterW;
      drawH = posterW / imgRatio;
    }
    const drawX = contentX + (posterW - drawW) / 2;
    const drawY = contentY + (contentColH - drawH) / 2;
    ctx.drawImage(posterImg, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  const textX = posterImg ? contentX + posterW + GAP : contentX;

  // Top block — label, title (wrapped), subline.
  let y = contentY;
  ctx.textAlign = 'left';
  ctx.font = LABEL_FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  y += LABEL_H - 8;
  ctx.fillText((mediaType?.displayName ?? entry.mediaType).toUpperCase(), textX, y);
  y += LABEL_GAP;

  ctx.font = TITLE_FONT;
  ctx.fillStyle = '#ffffff';
  for (const line of titleLines) {
    y += TITLE_LINE_H - 16;
    ctx.fillText(line, textX, y);
    y += 16;
  }

  if (subline) {
    y += SUBLINE_GAP;
    ctx.font = SUBLINE_FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    y += SUBLINE_H - 10;
    ctx.fillText(subline, textX, y);
  }

  // Middle block — rating, vertically centred in whatever space is
  // left between the subline and the bottom block (see chat: 3x
  // bigger, moved out of the status/rating row it used to share).
  // Left entirely blank when there's no rating — no fallback badge,
  // same rule as before.
  if (hasRating) {
    const middleTop = contentY + topBlockH;
    const middleH = contentColH - topBlockH - bottomBlockH;
    const ratingY = middleTop + (middleH - RATING_H) / 2 + RATING_H - 60;
    ctx.font = RATING_FONT;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(entry.rating), textX, ratingY);
    const ratingWidth = ctx.measureText(String(entry.rating)).width;
    ctx.font = RATING_SUFFIX_FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('/ 10', textX + ratingWidth + 16, ratingY);
  }

  // Bottom block — divider, status, notes — anchored to the bottom of
  // the content column so it stays put regardless of how tall the top
  // block ended up being (mirrors the in-app preview's
  // `margin-top: auto` push-to-bottom treatment).
  let by = contentY + contentColH - bottomBlockH;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(textX, by + DIVIDER_GAP_ABOVE);
  ctx.lineTo(textX + textColW, by + DIVIDER_GAP_ABOVE);
  ctx.stroke();
  by += DIVIDER_GAP_ABOVE + 2 + DIVIDER_GAP_BELOW;

  ctx.font = STATUS_FONT;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  by += STATUS_H - 8;
  ctx.fillText(statusText, textX, by);
  by += 8;

  if (notesExcerpt) {
    by += NOTES_GAP;
    ctx.font = NOTES_FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    by += NOTES_H - 10;
    ctx.fillText(notesExcerpt, textX, by);
  }

  // Footer branding — always bottom-right, within the outer padding
  // margin, unaffected by the content column's dynamic height.
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText(`Media Journal · ${getFooterDateText(entry)}`, CANVAS_W - PAD, canvasH - 26);

  return canvas;
}

// ── In-app preview + dialog ──────────────────────────────────────────────────

export function ShareEntrySheet({ open, entry, mediaType, onClose }: ShareEntrySheetProps) {
  const colour = mediaType?.colour ?? '#2E7D32';

  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getEntryImageUrl(entry, 'poster');
  const showImage = Boolean(imageUrl) && !imageFailed;

  const subline = getSubline(entry);
  const message = buildShareMessage(entry);

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
        {/* Card preview — mirrors buildShareCanvas's layout: colour
            fills the whole card, poster (when present) is a fixed 53%
            of the width and stretches to match the text column's
            height via alignSelf: 'stretch', title wraps naturally
            (browsers do this by default), and the (now 3x larger)
            rating sits centred in the gap between the subline and the
            status divider — left blank when there isn't one. */}
        <Box
          sx={{
            borderRadius: 3,
            bgcolor: colour,
            p: 2.5,
            mb: 2,
            color: '#fff',
            overflow: 'hidden',
          }}
        >
          <Stack direction="row" spacing={2} alignItems="stretch">
            {showImage && (
              <Box
                component="img"
                src={imageUrl}
                onError={() => setImageFailed(true)}
                alt=""
                sx={{
                  flex: '0 0 53%',
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  objectFit: 'cover',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
                }}
              />
            )}
            <Stack sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" sx={{ opacity: 0.75, textTransform: 'uppercase', letterSpacing: 1 }}>
                {mediaType?.displayName ?? entry.mediaType}
              </Typography>
              <Typography variant="h6" fontWeight={700} sx={{ mt: 0.5, mb: 0.25, overflowWrap: 'break-word' }}>
                {entry.title}
              </Typography>
              {subline && (
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  {subline}
                </Typography>
              )}
              {entry.rating !== undefined && (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: 0 }}>
                  <Typography sx={{ fontSize: '3.5rem', fontWeight: 700, lineHeight: 1 }}>
                    {entry.rating}
                    <Typography component="span" variant="body2" sx={{ ml: 0.75, opacity: 0.7 }}>
                      / 10
                    </Typography>
                  </Typography>
                </Box>
              )}
              <Box sx={{ mt: 'auto' }}>
                <Typography
                  variant="body2"
                  sx={{
                    opacity: 0.9,
                    pt: 1,
                    borderTop: '1px solid rgba(255,255,255,0.2)',
                  }}
                >
                  {getStatusLineText(entry)}
                </Typography>
              </Box>
            </Stack>
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
