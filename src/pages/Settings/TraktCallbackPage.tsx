import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { completeTraktAuth } from '@/services/metadata/traktService';
import { runTraktImport, type TraktImportSummary, type TraktImportProgress } from '@/services/importExport/traktImportService';
import { ROUTES } from '@/routes/paths';

type Phase = 'connecting' | 'importing' | 'done' | 'error';

const PHASE_LABEL: Record<TraktImportProgress['phase'], string> = {
  movies: 'movies',
  shows: 'shows',
  watchlist: 'watchlist',
};

/**
 * Lands here after Trakt redirects back through
 * public/oauth-callback.html. Completes the token exchange, then runs
 * the full movies + shows + watchlist import with a live progress
 * readout — same shape as MalCallbackPage.
 */
export default function TraktCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('connecting');
  const [progress, setProgress] = useState<TraktImportProgress>({ phase: 'movies', done: 0, total: 0 });
  const [summary, setSummary] = useState<TraktImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const oauthError = searchParams.get('error');

      if (oauthError) {
        setError(`Trakt declined the connection (${oauthError}).`);
        setPhase('error');
        return;
      }
      if (!code || !state) {
        setError('Missing authorisation details from Trakt — please try connecting again.');
        setPhase('error');
        return;
      }

      try {
        await completeTraktAuth(code, state);
        setPhase('importing');
        const result = await runTraktImport((p) => setProgress(p));
        setSummary(result);
        setPhase('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong connecting to Trakt.');
        setPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 320, textAlign: 'center' }}>
        {phase === 'connecting' && (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Connecting to Trakt…
            </Typography>
          </>
        )}

        {phase === 'importing' && (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Importing your {PHASE_LABEL[progress.phase]}…
              {progress.total > 0 ? ` ${progress.done} of ${progress.total}` : ''}
            </Typography>
          </>
        )}

        {phase === 'error' && (
          <>
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
            <Button variant="contained" onClick={() => navigate(ROUTES.settings)}>
              Back to Settings
            </Button>
          </>
        )}

        {phase === 'done' && summary && (
          <>
            <Alert severity="success" variant="outlined" sx={{ textAlign: 'left' }}>
              Imported {summary.moviesImported} movies
              {summary.moviesSkipped > 0 ? ` (${summary.moviesSkipped} already imported)` : ''}
              {summary.moviesErrored > 0 ? ` (${summary.moviesErrored} failed)` : ''},{' '}
              {summary.seasonsImported} TV seasons
              {summary.showsErrored > 0 ? ` (${summary.showsErrored} shows failed)` : ''}, and{' '}
              {summary.watchlistImported} watchlist
              {summary.watchlistSkipped > 0 ? ` (${summary.watchlistSkipped} already imported)` : ''}
              {summary.watchlistErrored > 0 ? ` (${summary.watchlistErrored} failed)` : ''}.
            </Alert>
            <Button variant="contained" onClick={() => navigate(ROUTES.settings)}>
              Done
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
