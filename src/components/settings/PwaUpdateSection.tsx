import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { usePwaUpdate } from '@/pwa/PwaUpdateContext';

/** How long to leave the progress state visible after asking the
 * service-worker registration to check the network. */
const CHECK_TIMEOUT_MS = 6000;

/**
 * Lets the household manually force a check for a newer build rather
 * than waiting on the browser's own update timing. A found update
 * reloads the page once no dirty entry form blocks activation.
 */
export function PwaUpdateSection() {
  const { checkForUpdates, supported } = usePwaUpdate();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleCheck = async () => {
    setStatus(null);
    setChecking(true);
    try {
      await checkForUpdates();
      window.setTimeout(() => {
        setChecking(false);
        setStatus({
          type: 'success',
          message:
            'Update check complete. Any available update will apply when it is safe.',
        });
      }, CHECK_TIMEOUT_MS);
    } catch {
      setChecking(false);
      setStatus({
        type: 'error',
        message: "Couldn't check for updates \u2014 check your connection and try again.",
      });
    }
  };

  if (!supported) return null;

  return (
    <Stack spacing={1.5} sx={{ mt: 2 }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={
          checking ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <RefreshOutlinedIcon />
          )
        }
        onClick={() => void handleCheck()}
        disabled={checking}
        sx={{ alignSelf: 'flex-start' }}
      >
        {checking ? 'Checking\u2026' : 'Check for updates'}
      </Button>
      {status && (
        <Alert severity={status.type} sx={{ mt: 0.5 }} onClose={() => setStatus(null)}>
          {status.message}
        </Alert>
      )}
    </Stack>
  );
}
