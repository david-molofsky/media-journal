import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { completeTraktAuth } from '@/services/metadata/traktService';
import { useTraktImportFlow } from '@/hooks/useTraktImportFlow';
import { TraktReviewPanel } from '@/components/settings/TraktReviewPanel';
import type { TraktFetchProgress } from '@/services/importExport/traktImportService';
import { ROUTES } from '@/routes/paths';

type ConnectPhase = 'connecting' | 'connect_error';

const FETCH_PHASE_LABEL: Record<TraktFetchProgress['phase'], string> = {
  movies: 'movies',
  shows: 'shows',
  watchlist: 'watchlist',
};

/**
 * Lands here after Trakt redirects back through
 * public/oauth-callback.html. Completes the token exchange, then hands
 * off to useTraktImportFlow for the fetch → review → apply sequence —
 * same shape as MalCallbackPage. `connectPhase` only covers the token
 * exchange itself; everything after that is flow.phase.
 */
export default function TraktCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [connectPhase, setConnectPhase] = useState<ConnectPhase>('connecting');
  const [connectError, setConnectError] = useState<string | null>(null);
  const flow = useTraktImportFlow();

  useEffect(() => {
    (async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const oauthError = searchParams.get('error');

      if (oauthError) {
        setConnectError(`Trakt declined the connection (${oauthError}).`);
        setConnectPhase('connect_error');
        return;
      }
      if (!code || !state) {
        setConnectError('Missing authorisation details from Trakt — please try connecting again.');
        setConnectPhase('connect_error');
        return;
      }

      try {
        await completeTraktAuth(code, state);
        void flow.start();
      } catch (e) {
        setConnectError(e instanceof Error ? e.message : 'Something went wrong connecting to Trakt.');
        setConnectPhase('connect_error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 420, textAlign: 'center', width: '100%' }}>
        {connectPhase === 'connecting' && flow.phase === 'idle' && (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Connecting to Trakt…
            </Typography>
          </>
        )}

        {connectPhase === 'connect_error' && (
          <>
            <Alert severity="error" variant="outlined">
              {connectError}
            </Alert>
            <Button variant="contained" onClick={() => navigate(ROUTES.settings)}>
              Back to Settings
            </Button>
          </>
        )}

        {flow.phase === 'fetching' && (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Fetching your {FETCH_PHASE_LABEL[flow.fetchProgress.phase]}…
              {flow.fetchProgress.total > 0 ? ` ${flow.fetchProgress.done} of ${flow.fetchProgress.total}` : ''}
            </Typography>
          </>
        )}

        {flow.phase === 'error' && (
          <>
            <Alert severity="error" variant="outlined">
              {flow.error}
            </Alert>
            <Button variant="contained" onClick={() => navigate(ROUTES.settings)}>
              Back to Settings
            </Button>
          </>
        )}

        {flow.phase === 'review' && (
          <Box sx={{ width: '100%', textAlign: 'left' }}>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2, textAlign: 'center' }}>
              Review before importing
            </Typography>
            <TraktReviewPanel
              data={flow.data}
              onToggleMovie={flow.toggleMovieIncluded}
              onToggleWatchlist={flow.toggleWatchlistIncluded}
              onToggleSeason={flow.toggleSeason}
              onSetAllIncluded={flow.setAllIncluded}
              onConfirm={() => void flow.applyAll()}
            />
          </Box>
        )}

        {flow.phase === 'importing' && (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Importing…
              {flow.applyProgress.total > 0 ? ` ${flow.applyProgress.done} of ${flow.applyProgress.total}` : ''}
            </Typography>
          </>
        )}

        {flow.phase === 'done' && (
          <>
            <Alert severity="success" variant="outlined" sx={{ textAlign: 'left' }}>
              Imported {flow.summary.moviesImported} movies
              {flow.summary.moviesSkipped > 0 ? ` (${flow.summary.moviesSkipped} already imported)` : ''}
              {flow.summary.moviesErrored > 0 ? ` (${flow.summary.moviesErrored} failed)` : ''},{' '}
              {flow.summary.seasonsImported} TV seasons
              {flow.summary.showsErrored > 0 ? ` (${flow.summary.showsErrored} shows failed)` : ''}, and{' '}
              {flow.summary.watchlistImported} watchlist
              {flow.summary.watchlistSkipped > 0 ? ` (${flow.summary.watchlistSkipped} already imported)` : ''}
              {flow.summary.watchlistErrored > 0 ? ` (${flow.summary.watchlistErrored} failed)` : ''}.
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
