import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { completeMalAuth } from '@/services/metadata/malService';
import { runMalImport, type MalImportSummary, type MalImportProgress } from '@/services/importExport/malImportService';
import { ROUTES } from '@/routes/paths';

type Phase = 'connecting' | 'importing' | 'done' | 'error';

/**
 * Lands here after MyAnimeList redirects back through
 * public/oauth-callback.html. Completes the token exchange, then runs
 * the full anime + manga import with a live progress readout, all on
 * one page — simpler than round-tripping back into a Settings dialog
 * after a full-page redirect (which would lose all in-memory state
 * anyway).
 */
export default function MalCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('connecting');
  const [progress, setProgress] = useState<MalImportProgress>({ phase: 'anime', fetched: 0 });
  const [summary, setSummary] = useState<MalImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const oauthError = searchParams.get('error');

      if (oauthError) {
        setError(`MyAnimeList declined the connection (${oauthError}).`);
        setPhase('error');
        return;
      }
      if (!code || !state) {
        setError('Missing authorisation details from MyAnimeList — please try connecting again.');
        setPhase('error');
        return;
      }

      try {
        await completeMalAuth(code, state);
        setPhase('importing');
        const result = await runMalImport((p) => setProgress(p));
        setSummary(result);
        setPhase('done');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong connecting to MyAnimeList.');
        setPhase('error');
      }
    })();
    // Intentionally run once — searchParams won't meaningfully change
    // after the initial navigation to this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 320, textAlign: 'center' }}>
        {phase === 'connecting' && (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Connecting to MyAnimeList…
            </Typography>
          </>
        )}

        {phase === 'importing' && (
          <>
            <CircularProgress size={32} />
            <Typography variant="body2" color="text.secondary">
              Importing your {progress.phase === 'anime' ? 'anime' : 'manga'} list…
              {progress.fetched > 0 ? ` ${progress.fetched} found so far` : ''}
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
              Imported {summary.animeImported} anime
              {summary.animeSkipped > 0 ? ` (${summary.animeSkipped} already imported)` : ''}
              {summary.animeErrored > 0 ? ` (${summary.animeErrored} failed)` : ''} and{' '}
              {summary.mangaImported} manga
              {summary.mangaSkipped > 0 ? ` (${summary.mangaSkipped} already imported)` : ''}
              {summary.mangaErrored > 0 ? ` (${summary.mangaErrored} failed)` : ''}.
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
