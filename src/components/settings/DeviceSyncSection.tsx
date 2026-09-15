import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GoogleIcon from '@mui/icons-material/Google';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import {
  signInToDeviceSyncWithGoogle,
  signOutOfDeviceSync,
  subscribeToSyncUser,
  type SyncUser,
} from '@/services/sync/firebaseAuthService';
import { isFirebaseSyncConfigured } from '@/services/sync/firebaseClient';
import {
  getCloudJournalManifest,
  type CloudJournalManifest,
} from '@/services/sync/cloudJournalService';
import {
  createStartingJournalSnapshot,
  downloadStartingJournalSafetyCopy,
  getOrCreateSyncDeviceId,
  makeThisDeviceStartingJournal,
  summariseJournal,
  type LocalJournalSummary,
} from '@/services/sync/deviceSyncService';
import type { ExportPayload } from '@/services/importExport/importExportService';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Device sync could not be set up.';
}

export function DeviceSyncSection() {
  const [user, setUser] = useState<SyncUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(isFirebaseSyncConfigured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<CloudJournalManifest | null>(null);
  const [snapshot, setSnapshot] = useState<ExportPayload | null>(null);
  const [summary, setSummary] = useState<LocalJournalSummary | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loadSignedInState = useCallback(async (signedInUser: SyncUser) => {
    const [cloudManifest, localSnapshot, currentDeviceId] = await Promise.all([
      getCloudJournalManifest(signedInUser.uid),
      createStartingJournalSnapshot(),
      getOrCreateSyncDeviceId(),
    ]);
    setManifest(cloudManifest);
    setSnapshot(localSnapshot);
    setSummary(summariseJournal(localSnapshot));
    setDeviceId(currentDeviceId);
  }, []);

  useEffect(() => {
    if (!isFirebaseSyncConfigured) return;
    return subscribeToSyncUser((nextUser) => {
      setUser(nextUser);
      setCheckingAuth(false);
      setError(null);
      if (nextUser) {
        void loadSignedInState(nextUser).catch((loadError: unknown) => {
          setError(errorMessage(loadError));
        });
      } else {
        setManifest(null);
        setSnapshot(null);
        setSummary(null);
        setDeviceId(null);
      }
    });
  }, [loadSignedInState]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (operationError) {
      setError(errorMessage(operationError));
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = () =>
    run(async () => {
      const signedInUser = await signInToDeviceSyncWithGoogle();
      setUser(signedInUser);
      await loadSignedInState(signedInUser);
    });

  const handleConfirmStartingDevice = () =>
    run(async () => {
      if (!user || !snapshot) return;
      downloadStartingJournalSafetyCopy(snapshot);
      const uploadedManifest = await makeThisDeviceStartingJournal(user.uid, snapshot);
      setManifest(uploadedManifest);
      setConfirming(false);
    });

  if (!isFirebaseSyncConfigured) {
    return (
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          Multi-device sync is coming in a future update. Your journal stays on this
          device, with Google Drive available for automatic backups.
        </Typography>
      </Stack>
    );
  }

  if (checkingAuth) {
    return <CircularProgress size={20} aria-label="Checking device sync" />;
  }

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      {!user ? (
        <>
          <Typography variant="body2" color="text.secondary">
            Sign in only if you want to keep your journal updated across devices. Media
            Journal will continue to work offline.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={() => void handleSignIn()}
            disabled={busy}
            sx={{ alignSelf: 'flex-start' }}
          >
            Continue with Google
          </Button>
        </>
      ) : manifest?.status === 'ready' && manifest.sourceDeviceId === deviceId ? (
        <>
          <Alert severity="success" icon={<CloudDoneOutlinedIcon />}>
            This device supplied the starting journal. The protected cloud copy contains{' '}
            {manifest.counts.entries}{' '}
            {manifest.counts.entries === 1 ? 'entry' : 'entries'}.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Signed in as {user.email ?? user.displayName ?? 'Google user'}.
          </Typography>
          <Button
            size="small"
            onClick={() => void run(signOutOfDeviceSync)}
            disabled={busy}
            sx={{ alignSelf: 'flex-start' }}
          >
            Sign out
          </Button>
        </>
      ) : manifest?.status === 'ready' ? (
        <Alert severity="info">
          A cloud journal already exists for this account. This device’s local data has
          not been changed. A review-and-merge step is required before it joins sync.
        </Alert>
      ) : manifest?.status === 'uploading' && manifest.sourceDeviceId === deviceId ? (
        <>
          <Alert severity="warning">
            The first upload did not finish. No local data has been removed.
          </Alert>
          <Button
            variant="contained"
            onClick={() => setConfirming(true)}
            disabled={busy || !summary}
            sx={{ alignSelf: 'flex-start' }}
          >
            Retry first upload
          </Button>
        </>
      ) : manifest?.status === 'uploading' ? (
        <Alert severity="warning">
          Another device started the first upload. Finish setup on that device; this
          device’s local journal has not been changed.
        </Alert>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            Signed in as {user.email ?? user.displayName ?? 'Google user'}. Choose the
            device whose current journal should become the starting cloud copy.
          </Typography>
          <Button
            variant="contained"
            onClick={() => setConfirming(true)}
            disabled={busy || !summary}
            sx={{ alignSelf: 'flex-start' }}
          >
            Use this device as starting journal
          </Button>
          <Button
            size="small"
            onClick={() => void run(signOutOfDeviceSync)}
            disabled={busy}
            sx={{ alignSelf: 'flex-start' }}
          >
            Sign out
          </Button>
        </>
      )}

      <Dialog
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Use this device as the starting journal?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Media Journal will download a safety copy, then upload this device’s journal.
            Nothing on this device will be deleted or replaced.
          </DialogContentText>
          {summary && (
            <List dense sx={{ mt: 1 }}>
              <ListItem disableGutters>
                <ListItemText primary="Journal entries" secondary={summary.entries} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText primary="Media types" secondary={summary.mediaTypes} />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Podcast subscriptions"
                  secondary={summary.podcastSubscriptions}
                />
              </ListItem>
              <ListItem disableGutters>
                <ListItemText
                  primary="Portable preferences"
                  secondary={summary.settings}
                />
              </ListItem>
            </List>
          )}
          <Alert severity="info" sx={{ mt: 1 }}>
            If a cloud journal already exists, setup will stop instead of overwriting it.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleConfirmStartingDevice()}
            disabled={busy || !snapshot}
            startIcon={busy ? <CircularProgress size={16} /> : undefined}
          >
            Create cloud copy
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
