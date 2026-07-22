import { useState } from 'react';
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
import { useTraktConnected } from '@/hooks/useTraktConnected';
import { beginTraktAuth, disconnectTrakt } from '@/services/metadata/traktService';
import { runTraktImport, type TraktImportSummary, type TraktImportProgress } from '@/services/importExport/traktImportService';

const PHASE_LABEL: Record<TraktImportProgress['phase'], string> = {
  movies: 'movies',
  shows: 'shows',
  watchlist: 'watchlist',
};

interface TraktImportSectionProps {
  /** Same convention as MalImportSection — see its comment. */
  variant?: 'row' | 'box';
}

/**
 * Settings > Trakt. Mirrors MalImportSection exactly: initial
 * connection is a full-page redirect (TraktCallbackPage handles the
 * return trip and first import); once connected, "Sync now" re-runs
 * the import in place using the already-stored tokens.
 */
export function TraktImportSection({ variant = 'row' }: TraktImportSectionProps) {
  const connected = useTraktConnected();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<TraktImportProgress | null>(null);
  const [summary, setSummary] = useState<TraktImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSummary(null);
    setError(null);
    try {
      const result = await runTraktImport((p) => setProgress(p));
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const handleDisconnect = async () => {
    await disconnectTrakt();
    setSummary(null);
    setError(null);
  };

  if (variant === 'box') {
    // Box variant surfaces progress/summary/error in a small dialog
    // instead of inline text below the row — there's no room for that
    // in a compact tap-card. Settings' row variant below is untouched.
    const dialogOpen = syncing || Boolean(summary) || Boolean(error);
    return (
      <>
        <Box
          component="button"
          type="button"
          onClick={connected ? () => void handleSync() : beginTraktAuth}
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
          <BrandIcon slug="trakt" size={32} />
          <Typography variant="body2" fontWeight={600}>
            Trakt
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

        <Dialog open={dialogOpen} onClose={syncing ? undefined : () => { setSummary(null); setError(null); }} fullWidth maxWidth="xs">
          <DialogTitle>Sync Trakt</DialogTitle>
          <DialogContent>
            {syncing && (
              <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">
                  {progress
                    ? `Importing your ${PHASE_LABEL[progress.phase]}…${progress.total > 0 ? ` ${progress.done} of ${progress.total}` : ''}`
                    : 'Starting sync…'}
                </Typography>
              </Stack>
            )}
            {!syncing && summary && (
              <Stack spacing={2}>
                <Alert severity="success" variant="outlined">
                  Imported {summary.moviesImported} movies
                  {summary.moviesSkipped > 0 ? ` (${summary.moviesSkipped} already imported)` : ''}
                  {summary.moviesErrored > 0 ? ` (${summary.moviesErrored} failed)` : ''},{' '}
                  {summary.seasonsImported} TV seasons
                  {summary.showsErrored > 0 ? ` (${summary.showsErrored} shows failed)` : ''}, and{' '}
                  {summary.watchlistImported} watchlist
                  {summary.watchlistSkipped > 0 ? ` (${summary.watchlistSkipped} already imported)` : ''}
                  {summary.watchlistErrored > 0 ? ` (${summary.watchlistErrored} failed)` : ''}.
                </Alert>
                <Button variant="contained" onClick={() => setSummary(null)}>
                  Close
                </Button>
              </Stack>
            )}
            {!syncing && error && (
              <Stack spacing={2}>
                <Alert severity="error" variant="outlined">
                  {error}
                </Alert>
                <Button variant="contained" onClick={() => setError(null)}>
                  Close
                </Button>
              </Stack>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <BrandIcon slug="trakt" size={28} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body1" fontWeight={500}>
            Trakt
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {connected ? 'Connected — imports Films, TV seasons and Watchlist' : 'Import your Trakt watch history'}
          </Typography>
        </Box>
      </Stack>

      {!connected && (
        <Button variant="contained" size="small" onClick={beginTraktAuth} sx={{ alignSelf: 'flex-start' }}>
          Connect Trakt
        </Button>
      )}

      {connected && (
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => void handleSync()}
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

      {syncing && progress && (
        <Typography variant="caption" color="text.secondary">
          Importing your {PHASE_LABEL[progress.phase]}…
          {progress.total > 0 ? ` ${progress.done} of ${progress.total}` : ''}
        </Typography>
      )}

      {summary && (
        <Alert severity="success" variant="outlined">
          Imported {summary.moviesImported} movies
          {summary.moviesSkipped > 0 ? ` (${summary.moviesSkipped} already imported)` : ''}
          {summary.moviesErrored > 0 ? ` (${summary.moviesErrored} failed)` : ''},{' '}
          {summary.seasonsImported} TV seasons
          {summary.showsErrored > 0 ? ` (${summary.showsErrored} shows failed)` : ''}, and{' '}
          {summary.watchlistImported} watchlist
          {summary.watchlistSkipped > 0 ? ` (${summary.watchlistSkipped} already imported)` : ''}
          {summary.watchlistErrored > 0 ? ` (${summary.watchlistErrored} failed)` : ''}.
        </Alert>
      )}

      {error && (
        <Alert severity="error" variant="outlined">
          {error}
        </Alert>
      )}
    </Stack>
  );
}
