import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import dayjs from 'dayjs';
import type { MediaEntry, MediaType } from '@/models';

interface ShareEntrySheetProps {
  open: boolean;
  entry: MediaEntry;
  mediaType: MediaType | undefined;
  onClose: () => void;
}

/**
 * Generates a 1200×630 (OG-image-sized) card on a hidden canvas,
 * then either downloads it as a PNG or passes it to the Web Share API.
 * Drawn entirely with the Canvas 2D API — no extra dependencies.
 */
function buildShareCanvas(entry: MediaEntry, mediaType: MediaType | undefined): HTMLCanvasElement {
  const W = 1200;
  const H = 630;
  const colour = mediaType?.colour ?? '#2E7D32';

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

  const contentX = cardX + 52;
  const contentY = cardY + 60;

  // Media type label
  ctx.font = '600 28px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = colour;
  ctx.fillText((mediaType?.displayName ?? entry.mediaType).toUpperCase(), contentX, contentY);

  // Title
  const titleY = contentY + 72;
  ctx.font = '700 68px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#1a1a1a';
  const maxTitleW = cardW - 120;
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

  // Completed date
  const dateText = dayjs(entry.completedDate).format('D MMMM YYYY');
  ctx.font = '400 30px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText(`Completed ${dateText}`, contentX, subline ? titleY + 112 : titleY + 56);

  // Rating
  if (entry.rating !== undefined) {
    const ratingY = cardY + cardH - 100;
    ctx.font = '700 96px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = colour;
    ctx.fillText(
      entry.rating % 1 === 0 ? entry.rating.toFixed(1) : String(entry.rating),
      contentX,
      ratingY,
    );
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

  // Footer branding
  ctx.font = '500 24px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.textAlign = 'right';
  ctx.fillText('Media Journal', cardX + cardW - 30, cardY + cardH - 28);

  return canvas;
}

export function ShareEntrySheet({ open, entry, mediaType, onClose }: ShareEntrySheetProps) {
  const colour = mediaType?.colour ?? '#2E7D32';
  const meta = entry.metadata;

  const subline =
    typeof meta.author === 'string' && meta.author
      ? meta.author
      : typeof meta.director === 'string' && meta.director
        ? `Dir. ${meta.director}`
        : '';

  const handleDownload = () => {
    const canvas = buildShareCanvas(entry, mediaType);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${entry.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    link.click();
  };

  const handleShare = async () => {
    const canvas = buildShareCanvas(entry, mediaType);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'entry.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: entry.title });
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
          {entry.rating !== undefined && (
            <Typography variant="h4" fontWeight={700} sx={{ mt: 1.5 }}>
              {entry.rating % 1 === 0 ? entry.rating.toFixed(1) : entry.rating}
              <Typography component="span" variant="body2" sx={{ ml: 0.5, opacity: 0.7 }}>
                / 10
              </Typography>
            </Typography>
          )}
          {entry.notes && (
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 1.5, opacity: 0.8, fontStyle: 'italic' }}
            >
              "{entry.notes.slice(0, 100)}{entry.notes.length > 100 ? '…' : ''}"
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.5 }}>
            Media Journal · {dayjs(entry.completedDate).format('D MMM YYYY')}
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
