import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined';
import { useMalConnected } from '@/hooks/useMalConnected';
import { beginMalAuth, disconnectMal } from '@/services/metadata/malService';
import { runMalImport, type MalImportSummary, type MalImportProgress } from '@/services/importExport/malImportService';

/**
 * Settings > MyAnimeList. Initial connection happens via a full-page
 * redirect (beginMalAuth → MalCallbackPage handles the return trip and
 * the first import). Once connected, "Sync now" re-runs the import
 * in-place — tokens are already stored, so no redirect is needed for
 * subsequent syncs, only for the very first connection.
 */
export function MalImportSection() {
  const connected = useMalConnected();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<MalImportProgress | null>(null);
  const [summary, setSummary] = useState<MalImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSummary(null);
    setError(null);
    try {
      const result = await runMalImport((p) => setProgress(p));
      setSummary(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
      setProgress(null);
    }
  };

  const handleDisconnect = async () => {
    await disconnectMal();
    setSummary(null);
    setError(null);
  };

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
          Importing your {progress.phase === 'anime' ? 'anime' : 'manga'} list… {progress.fetched} found so far
        </Typography>
      )}

      {summary && (
        <Alert severity="success" variant="outlined">
          Imported {summary.animeImported} anime
          {summary.animeSkipped > 0 ? ` (${summary.animeSkipped} already imported)` : ''}
          {summary.animeErrored > 0 ? ` (${summary.animeErrored} failed)` : ''} and{' '}
          {summary.mangaImported} manga
          {summary.mangaSkipped > 0 ? ` (${summary.mangaSkipped} already imported)` : ''}
          {summary.mangaErrored > 0 ? ` (${summary.mangaErrored} failed)` : ''}.
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
