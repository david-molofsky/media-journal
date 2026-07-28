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
import { useTraktImportFlow } from '@/hooks/useTraktImportFlow';
import { TraktReviewPanel } from '@/components/settings/TraktReviewPanel';
import type { TraktFetchProgress } from '@/services/importExport/traktImportService';

const FETCH_PHASE_LABEL: Record<TraktFetchProgress['phase'], string> = {
  movies: 'movies',
  shows: 'shows',
  watchlist: 'watchlist',
};

interface TraktImportSectionProps {
  /** Same convention as MalImportSection — see its comment. */
  variant?: 'row' | 'box';
}

/**
 * Settings > Trakt. Mirrors MalImportSection: initial connection is a
 * full-page redirect (TraktCallbackPage handles the return trip and
 * first import); once connected, "Sync now" re-runs the same
 * fetch/review/apply flow in place using the already-stored tokens.
 *
 * Restructured (see chat: the "tick box" feature) — this used to fetch
 * and create entries in one pass with no review step at all; now a
 * review dialog always opens after fetching, same as every other
 * import source, with movies/shows/watchlist items all individually
 * tickable via the shared TraktReviewPanel.
 */
export function TraktImportSection({ variant = 'row' }: TraktImportSectionProps) {
  const connected = useTraktConnected();
  const flow = useTraktImportFlow();
  const syncing = flow.phase !== 'idle';

  const handleSync = () => {
    void flow.start();
  };

  const handleDisconnect = async () => {
    await disconnectTrakt();
    flow.reset();
  };

  const dialogOpen = flow.phase !== 'idle';

  const dialog = (
    <Dialog
      open={dialogOpen}
      onClose={flow.phase === 'done' || flow.phase === 'error' ? flow.reset : undefined}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Sync Trakt</DialogTitle>
      <DialogContent>
        {flow.phase === 'fetching' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Fetching your {FETCH_PHASE_LABEL[flow.fetchProgress.phase]}…
              {flow.fetchProgress.total > 0 ? ` ${flow.fetchProgress.done} of ${flow.fetchProgress.total}` : ''}
            </Typography>
          </Stack>
        )}

        {flow.phase === 'error' && (
          <Stack spacing={2}>
            <Alert severity="error" variant="outlined">
              {flow.error}
            </Alert>
            <Button variant="contained" onClick={flow.reset}>
              Close
            </Button>
          </Stack>
        )}

        {flow.phase === 'review' && (
          <TraktReviewPanel
            data={flow.data}
            onToggleMovie={flow.toggleMovieIncluded}
            onToggleWatchlist={flow.toggleWatchlistIncluded}
            onToggleSeason={flow.toggleSeason}
            onSetAllIncluded={flow.setAllIncluded}
            onConfirm={() => void flow.applyAll()}
          />
        )}

        {flow.phase === 'importing' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Importing…
              {flow.applyProgress.total > 0 ? ` ${flow.applyProgress.done} of ${flow.applyProgress.total}` : ''}
            </Typography>
          </Stack>
        )}

        {flow.phase === 'done' && (
          <Stack spacing={2}>
            <Alert severity="success" variant="outlined">
              Imported {flow.summary.moviesImported} movies
              {flow.summary.moviesSkipped > 0 ? ` (${flow.summary.moviesSkipped} already imported)` : ''}
              {flow.summary.moviesErrored > 0 ? ` (${flow.summary.moviesErrored} failed)` : ''},{' '}
              {flow.summary.seasonsImported} TV seasons
              {flow.summary.showsErrored > 0 ? ` (${flow.summary.showsErrored} shows failed)` : ''}, and{' '}
              {flow.summary.watchlistImported} watchlist
              {flow.summary.watchlistSkipped > 0 ? ` (${flow.summary.watchlistSkipped} already imported)` : ''}
              {flow.summary.watchlistErrored > 0 ? ` (${flow.summary.watchlistErrored} failed)` : ''}.
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
    // Box variant surfaces progress/review/summary/error in a small
    // dialog instead of inline text below the row — there's no room
    // for that in a compact tap-card. Settings' row variant below is
    // untouched.
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

        {dialog}
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

      {dialog}
    </Stack>
  );
}
