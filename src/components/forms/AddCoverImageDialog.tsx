import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';

interface AddCoverImageDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the pasted image URL. The caller writes this to
   * `metadata.coverImagePath` and closes the dialog. */
  onSelect: (url: string) => void;
}

/**
 * "Add cover image" dialog, opened from EntryForm's cover/poster field
 * only when that field is empty (see chat). Originally paired a
 * Google Custom Search image grid with this manual paste field, but
 * the search half was dropped (see chat) — Google closed the Custom
 * Search JSON API to new customers/projects in 2024, so a freshly
 * created API key can never work regardless of configuration, and the
 * realistic paid alternatives (SerpAPI's 100/month free tier, Brave's
 * now-paid-only API) weren't worth the cost/complexity for how often
 * this gets used. Manual paste alone costs nothing and has no
 * external dependency to break.
 */
export function AddCoverImageDialog({ open, onClose, onSelect }: AddCoverImageDialogProps) {
  const [url, setUrl] = useState('');

  // Clean slate each time the dialog opens. Wrapped in an IIFE
  // (same shape as CoverImageSearchDialog's old reset effect, and
  // IsbnScanDialog.tsx's camera-start effect) rather than calling
  // setState directly as a top-level statement in the effect body.
  useEffect(() => {
    (() => {
      if (open) setUrl('');
    })();
  }, [open]);

  const handleUse = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSelect(trimmed);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Add Cover Image
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Paste a direct link to an image (right-click an image online and choose "Copy image
            address", or similar).
          </Typography>
          <TextField
            size="small"
            fullWidth
            autoFocus
            label="Image URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleUse();
              }
            }}
            placeholder="https://…"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleUse} disabled={!url.trim()}>
          Use Image
        </Button>
      </DialogActions>
    </Dialog>
  );
}
