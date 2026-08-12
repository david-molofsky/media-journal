import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { db } from '@/services/database/db';
import { createEntry } from '@/services/database/entryService';
import { getNextInSeriesEligibility, nextInSeriesButtonLabel } from '@/utils/nextInSeries';
import {
  findNextInSeries,
  type NextInSeriesFound,
} from '@/services/metadata/nextInSeriesService';
import type { MediaEntry } from '@/models';

interface NextInSeriesSectionProps {
  entry: MediaEntry;
}

type PopupState =
  | { step: 'loading' }
  | { step: 'found'; found: NextInSeriesFound; alreadyExists: boolean }
  | { step: 'not_found' }
  | { step: 'error'; message: string };

/**
 * "Find Next in Series" — see chat (Aug 2026), full scope in
 * nextInSeries.ts (eligibility) and nextInSeriesService.ts (the actual
 * per-type lookups). Renders nothing for media types the feature
 * doesn't support at all (Art/Theatre/Sport/custom types, see
 * isNextInSeriesSupported) — same "just don't show up" pattern as
 * WishlistRecommendationsSection returning null when there's nothing
 * to show, rather than a disabled button no one asked for.
 */
export function NextInSeriesSection({ entry }: NextInSeriesSectionProps) {
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const eligibility = getNextInSeriesEligibility(entry);
  // Button doesn't render at all for wholly-unsupported media types
  // (Art/Theatre/Sport/custom) — see nextInSeries.ts's
  // isNextInSeriesSupported. For supported types with missing fields,
  // it renders disabled with a tooltip instead, so the user discovers
  // the feature exists and what it needs.
  if (!eligibility.eligible && eligibility.reason === 'Not available for this media type') {
    return null;
  }

  const handleClick = async () => {
    setPopup({ step: 'loading' });
    const result = await findNextInSeries(entry);

    if (result.status === 'not_found') {
      setPopup({ step: 'not_found' });
      return;
    }
    if (result.status === 'error') {
      setPopup({ step: 'error', message: result.message });
      return;
    }

    // Duplicate check — same media type + title already logged
    // anywhere (Completed/In Progress/Wishlist), so this doesn't offer
    // to add something already in the library a second time.
    const candidates = await db.mediaEntries.where('mediaType').equals(entry.mediaType).toArray();
    const alreadyExists = candidates.some(
      (candidate) => candidate.title.toLowerCase() === result.found.title.toLowerCase(),
    );

    setPopup({ step: 'found', found: result.found, alreadyExists });
  };

  const handleAddToWishlist = async () => {
    if (popup?.step !== 'found') return;
    const created = await createEntry(popup.found.entryInput);
    setPopup(null);
    setToastMessage(`Added "${created.title}" to Wishlist`);
  };

  const coverImagePath =
    popup?.step === 'found' && typeof popup.found.entryInput.metadata.coverImagePath === 'string'
      ? popup.found.entryInput.metadata.coverImagePath
      : undefined;

  return (
    <>
      <Tooltip title={eligibility.eligible ? '' : eligibility.reason}>
        {/* span wrapper so the tooltip still shows on a disabled button
            (MUI buttons don't fire pointer events while disabled). */}
        <span>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<SearchOutlinedIcon />}
            disabled={!eligibility.eligible}
            onClick={handleClick}
          >
            {nextInSeriesButtonLabel(entry.mediaType)}
          </Button>
        </span>
      </Tooltip>

      <Dialog open={popup !== null} onClose={() => setPopup(null)} fullWidth maxWidth="xs">
        <DialogTitle>
          {entry.mediaType === 'podcast' ? 'Next Episode' : 'Next in Series'}
        </DialogTitle>
        <DialogContent>
          {popup?.step === 'loading' && (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 2 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Searching…
              </Typography>
            </Stack>
          )}

          {popup?.step === 'not_found' && (
            <Stack alignItems="center" spacing={1} sx={{ py: 2, textAlign: 'center' }}>
              <SearchOutlinedIcon fontSize="large" sx={{ opacity: 0.4 }} />
              <Typography variant="body1">No next entry found</Typography>
              <Typography variant="body2" color="text.secondary">
                It may not exist yet, or couldn&apos;t be matched confidently.
              </Typography>
            </Stack>
          )}

          {popup?.step === 'error' && (
            <Stack alignItems="center" spacing={1} sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body1">Couldn&apos;t search for the next entry</Typography>
              <Typography variant="body2" color="text.secondary">
                {popup.message}
              </Typography>
            </Stack>
          )}

          {popup?.step === 'found' && (
            <Stack direction="row" spacing={1.5} sx={{ py: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 84,
                  borderRadius: 1,
                  flexShrink: 0,
                  overflow: 'hidden',
                  bgcolor: 'action.hover',
                }}
              >
                {coverImagePath && (
                  <Box
                    component="img"
                    src={coverImagePath}
                    alt=""
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </Box>
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={600} noWrap>
                  {popup.found.title}
                </Typography>
                {popup.found.subtitle && (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {popup.found.subtitle}
                  </Typography>
                )}
                <Chip label={popup.found.sourceBadge} size="small" sx={{ alignSelf: 'flex-start' }} />
                {popup.alreadyExists && (
                  <Typography variant="caption" color="text.secondary">
                    Already in your library
                  </Typography>
                )}
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPopup(null)}>Dismiss</Button>
          {popup?.step === 'found' && !popup.alreadyExists && (
            <Button variant="contained" onClick={handleAddToWishlist}>
              Add to Wishlist
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toastMessage !== null}
        autoHideDuration={4000}
        onClose={() => setToastMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToastMessage(null)}>
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
