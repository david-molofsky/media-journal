import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined';
import { useMalConnected } from '@/hooks/useMalConnected';
import { beginMalAuth, disconnectMal } from '@/services/metadata/malService';
import { useMalImportFlow } from '@/hooks/useMalImportFlow';
import { MalDateReviewDialog } from '@/components/settings/MalDateReviewDialog';

/**
 * Settings > MyAnimeList. Initial connection happens via a full-page
 * redirect (beginMalAuth → MalCallbackPage handles the return trip and
 * first import). Once connected, "Sync now" re-runs the same
 * classify/review/apply flow in place — a dialog opens only if the
 * review step is actually needed (some entries missing a date);
 * otherwise it goes straight to importing.
 */
export function MalImportSection() {
  const connected = useMalConnected();
  const flow = useMalImportFlow();

  const handleSync = () => {
    void flow.start();
  };

  const handleDisconnect = async () => {
    await disconnectMal();
    flow.reset();
  };

  const dialogOpen = flow.phase !== 'idle';

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <LiveTvOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
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
            disabled={flow.phase !== 'idle'}
            startIcon={flow.phase !== 'idle' ? <CircularProgress size={14} /> : undefined}
          >
            {flow.phase !== 'idle' ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button size="small" color="inherit" onClick={() => void handleDisconnect()} disabled={flow.phase !== 'idle'}>
            Disconnect
          </Button>
        </Stack>
      )}

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
    </Stack>
  );
}
