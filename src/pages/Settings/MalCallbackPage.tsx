import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { completeMalAuth } from '@/services/metadata/malService';
import { useMalImportFlow } from '@/hooks/useMalImportFlow';
import { MalDateReviewDialog } from '@/components/settings/MalDateReviewDialog';
import { ROUTES } from '@/routes/paths';

type AuthPhase = 'connecting' | 'ready' | 'error';

/**
 * Lands here after MyAnimeList redirects back through
 * public/oauth-callback.html. Completes the token exchange, then hands
 * off to the shared useMalImportFlow hook — which fetches both lists,
 * skips straight to importing if nothing needs a date, or shows the
 * review step first if MAL has any 'completed' entries with no
 * finish_date recorded (see chat).
 */
export default function MalCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [authPhase, setAuthPhase] = useState<AuthPhase>('connecting');
  const [authError, setAuthError] = useState<string | null>(null);
  const flow = useMalImportFlow();

  useEffect(() => {
    (async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const oauthError = searchParams.get('error');

      if (oauthError) {
        setAuthError(`MyAnimeList declined the connection (${oauthError}).`);
        setAuthPhase('error');
        return;
      }
      if (!code || !state) {
        setAuthError('Missing authorisation details from MyAnimeList — please try connecting again.');
        setAuthPhase('error');
        return;
      }

      try {
        await completeMalAuth(code, state);
        setAuthPhase('ready');
        await flow.start();
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : 'Something went wrong connecting to MyAnimeList.');
        setAuthPhase('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authPhase === 'connecting') {
    return (
      <CenteredMessage>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Connecting to MyAnimeList…
        </Typography>
      </CenteredMessage>
    );
  }

  if (authPhase === 'error') {
    return (
      <CenteredMessage>
        <Alert severity="error" variant="outlined">
          {authError}
        </Alert>
        <Button variant="contained" onClick={() => navigate(ROUTES.settings)}>
          Back to Settings
        </Button>
      </CenteredMessage>
    );
  }

  if (flow.phase === 'fetching') {
    return (
      <CenteredMessage>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Fetching your {flow.fetchProgress.phase} list…
          {flow.fetchProgress.fetched > 0 ? ` ${flow.fetchProgress.fetched} found so far` : ''}
        </Typography>
      </CenteredMessage>
    );
  }

  if (flow.phase === 'review') {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', pt: 4 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Review before importing
        </Typography>
        <MalDateReviewDialog
          rows={flow.rows}
          onSetCompletedDate={flow.setCompletedDate}
          onSkip={flow.skipRow}
          onConfirm={() => void flow.confirmReview()}
        />
      </Box>
    );
  }

  if (flow.phase === 'importing') {
    return (
      <CenteredMessage>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Importing… {flow.applyProgress.done} of {flow.applyProgress.total}
        </Typography>
      </CenteredMessage>
    );
  }

  // flow.phase === 'done'
  return (
    <CenteredMessage>
      <Alert severity="success" variant="outlined" sx={{ textAlign: 'left' }}>
        Imported {flow.summary.imported} {flow.summary.imported === 1 ? 'entry' : 'entries'}
        {flow.summary.skipped > 0 ? `, ${flow.summary.skipped} skipped` : ''}.
      </Alert>
      <Button variant="contained" onClick={() => navigate(ROUTES.settings)}>
        Done
      </Button>
    </CenteredMessage>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 320, textAlign: 'center' }}>
        {children}
      </Stack>
    </Box>
  );
}
