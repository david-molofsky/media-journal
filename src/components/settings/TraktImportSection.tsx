import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined';
import { useTraktConnected } from '@/hooks/useTraktConnected';
import { beginTraktAuth, disconnectTrakt } from '@/services/metadata/traktService';
import { runTraktImport, type TraktImportSummary, type TraktImportProgress } from '@/services/importExport/traktImportService';

const PHASE_LABEL: Record<TraktImportProgress['phase'], string> = {
  movies: 'movies',
  shows: 'shows',
  watchlist: 'watchlist',
};

/**
 * Settings > Trakt. Mirrors MalImportSection exactly: initial
 * connection is a full-page redirect (TraktCallbackPage handles the
 * return trip and first import); once connected, "Sync now" re-runs
 * the import in place using the already-stored tokens.
 */
export function TraktImportSection() {
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

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <MovieOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
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
          {summary.moviesSkipped > 0 ? ` (${summary.moviesSkipped} already imported)` : ''},{' '}
          {summary.seasonsImported} TV seasons, and {summary.watchlistImported} watchlist
          {summary.watchlistSkipped > 0 ? ` (${summary.watchlistSkipped} already imported)` : ''}.
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
