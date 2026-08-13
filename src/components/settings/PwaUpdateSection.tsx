import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { usePwaUpdate } from '@/pwa/PwaUpdateContext';

/** How long to wait after triggering a check before assuming nothing
 * new was found. If an update *is* found, `registerType: 'autoUpdate'`
 * (vite.config.ts) installs and activates it automatically, which
 * reloads the page well within this window \u2014 so this timeout only
 * ever fires when the check genuinely found nothing new. */
const CHECK_TIMEOUT_MS = 6000;

/**
 * Lets the household manually force a check for a newer build rather
 * than waiting on the browser's own update timing \u2014 useful when one
 * device seems to be running an older version than another. A found
 * update reloads the page on its own (autoUpdate mode); this only
 * needs to report "nothing new" if that doesn't happen.
 *
 * Ported directly from Media Journal's PwaUpdateSection.tsx.
 */
export function PwaUpdateSection() {
  const { checkForUpdates, supported } = usePwaUpdate();
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );

  const handleCheck = async () => {
    setStatus(null);
    setChecking(true);
    try {
      await checkForUpdates();
      window.setTimeout(() => {
        setChecking(false);
        setStatus({ type: 'success', message: "You're on the latest version." });
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
          checking ? <CircularProgress size={16} color="inherit" /> : <RefreshOutlinedIcon />
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
