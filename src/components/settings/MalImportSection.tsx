import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { BrandIcon } from '@/components/dashboard/BrandIcon';
import { useMalConnected } from '@/hooks/useMalConnected';
import { beginMalAuth, disconnectMal } from '@/services/metadata/malService';
import { useMalImportFlow } from '@/hooks/useMalImportFlow';
import { MalDateReviewDialog } from '@/components/settings/MalDateReviewDialog';

interface MalImportSectionProps {
  /** 'row' (default) is Settings' existing layout, unchanged. 'box' is
   * the compact tap-card used on the welcome screen, matching the CSV
   * sources' box styling — see WelcomeImportSources.tsx. Both variants
   * share the same underlying hooks/dialog; only the trigger UI
   * differs. The box variant omits Disconnect (still available in
   * Settings via the row variant) to keep the box a single, obvious
   * tap target rather than needing a second control crammed in. */
  variant?: 'row' | 'box';
}

/**
 * Settings > MyAnimeList. Initial connection happens via a full-page
 * redirect (beginMalAuth → MalCallbackPage handles the return trip and
 * first import). Once connected, "Sync now" re-runs the same
 * classify/review/apply flow in place — the review dialog now always
 * opens (previously only when some entries were missing a date), so
 * every synced entry gets a chance to be reviewed/unticked via the
 * "tick box" feature (see chat), not just ones needing a date.
 */
export function MalImportSection({ variant = 'row' }: MalImportSectionProps) {
  const connected = useMalConnected();
  const flow = useMalImportFlow();
  const syncing = flow.phase !== 'idle';

  const handleSync = () => {
    void flow.start();
  };

  const handleDisconnect = async () => {
    await disconnectMal();
    flow.reset();
  };

  const dialogOpen = flow.phase !== 'idle';

  const dialog = (
    <Dialog open={dialogOpen} onClose={flow.phase === 'done' ? flow.reset : undefined} fullWidth maxWidth="xs">
      <DialogTitle>Sync MyAnimeList</DialogTitle>
      <DialogContent>
        {flow.phase === 'fetching' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Fetching your {flow.fetchProgress.phase} list…
              {flow.fetchProgress.fetched > 0 ? ` ${flow.fetchProgress.fetched} found so far` : ''}
            </Typography>
          </Stack>
        )}

        {flow.phase === 'review' && (
          <MalDateReviewDialog
            rows={flow.rows}
            onSetCompletedDate={flow.setCompletedDate}
            onSkip={flow.skipRow}
            onSetIncluded={flow.setIncluded}
            onSetAllIncluded={flow.setAllIncluded}
            onConfirm={() => void flow.confirmReview()}
          />
        )}

        {flow.phase === 'importing' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Importing… {flow.applyProgress.done} of {flow.applyProgress.total}
            </Typography>
          </Stack>
        )}

        {flow.phase === 'done' && (
          <Stack spacing={2}>
            <Alert severity="success" variant="outlined">
              Imported {flow.summary.imported} {flow.summary.imported === 1 ? 'entry' : 'entries'}
              {flow.summary.skipped > 0 ? `, ${flow.summary.skipped} skipped` : ''}.
            </Alert>
            <Button variant="contained" onClick={flow.reset}>
              Close
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );

  if (variant === 'box') {
    return (
      <>
        <Box
          component="button"
          type="button"
          onClick={connected ? handleSync : beginMalAuth}
          disabled={syncing}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            bgcolor: 'action.hover',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            py: 2,
            px: 1,
            cursor: 'pointer',
            font: 'inherit',
            color: 'inherit',
            '&:hover': { borderColor: 'primary.main' },
            '&:disabled': { cursor: 'default', opacity: 0.7 },
          }}
        >
          <BrandIcon slug="myanimelist" size={32} />
          <Typography variant="body2" fontWeight={600}>
            MyAnimeList
          </Typography>
          <Box
            sx={{
              fontSize: 11,
              fontWeight: 600,
              px: 1.25,
              py: 0.25,
              borderRadius: 4,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {syncing && <CircularProgress size={10} sx={{ color: 'inherit' }} />}
            {syncing ? 'Syncing…' : connected ? 'Sync now' : 'Connect'}
          </Box>
        </Box>
        {dialog}
      </>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BrandIcon slug="myanimelist" size={28} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body1" fontWeight={500}>
            MyAnimeList
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {connected ? 'Connected — imports Anime and Manga lists' : 'Import your anime and manga lists'}
          </Typography>
        </Box>
      </Stack>

      {!connected && (
        <Button variant="contained" size="small" onClick={beginMalAuth} sx={{ alignSelf: 'flex-start' }}>
          Connect MyAnimeList
        </Button>
      )}

      {connected && (
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleSync}
            disabled={syncing}
            startIcon={syncing ? <CircularProgress size={14} /> : undefined}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button size="small" color="inherit" onClick={() => void handleDisconnect()} disabled={syncing}>
            Disconnect
          </Button>
        </Stack>
      )}

      {dialog}
    </Stack>
  );
}
