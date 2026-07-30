import { useState } from 'react';
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
import { ServerConnectForm, type ServerAuthMethod } from '@/components/settings/ServerConnectForm';
import { ExternalImportReviewPanel } from '@/components/settings/ExternalImportReviewPanel';
import { usePlexConnected } from '@/hooks/usePlexConnected';
import { usePlexImportFlow } from '@/hooks/usePlexImportFlow';
import { verifyPlexToken } from '@/services/metadata/plexService';
import { setSetting } from '@/services/database/settingsService';
import { SETTINGS_KEYS } from '@/models';

const TOKEN_HELP_TEXT =
  "Don't have a token? Open Plex Web, play anything, open dev tools → Network tab, and copy the X-Plex-Token value from any request.";
const CORS_HELP_TEXT =
  "Self-hosted servers sometimes block browser requests (CORS). If connecting fails, this may need routing through a proxy — let David know if you hit this.";

interface PlexImportSectionProps {
  /** 'row' (default) is Settings' existing layout. 'box' is the
   * compact tap-card used on the welcome screen — see
   * AudiobookshelfImportSection.tsx for the same pattern. */
  variant?: 'row' | 'box';
}

/**
 * Settings > Plex. Connect form (server URL + a manually-pasted
 * X-Plex-Token — no PIN-linking flow in this scope, see chat) when
 * not yet connected; "Sync now" / "Disconnect" once it is.
 */
export function PlexImportSection({ variant = 'row' }: PlexImportSectionProps) {
  const connected = usePlexConnected();
  const flow = usePlexImportFlow();

  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      await verifyPlexToken(serverUrl, token);
      await setSetting(SETTINGS_KEYS.plexServerUrl, serverUrl.trim());
      await setSetting(SETTINGS_KEYS.plexToken, token);
      setConnectDialogOpen(false);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Couldn't connect — check your server URL and token.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await setSetting(SETTINGS_KEYS.plexServerUrl, '');
    await setSetting(SETTINGS_KEYS.plexToken, '');
    flow.reset();
  };

  const dialogOpen = flow.phase !== 'idle';
  const syncing = flow.phase !== 'idle' && flow.phase !== 'error';

  const connectForm = (
    <ServerConnectForm
      serverUrl={serverUrl}
      onServerUrlChange={setServerUrl}
      serverUrlPlaceholder="https://plex.example.com:32400"
      supportsPasswordAuth={false}
      authMethod={'token' as ServerAuthMethod}
      onAuthMethodChange={() => {}}
      username=""
      onUsernameChange={() => {}}
      password=""
      onPasswordChange={() => {}}
      token={token}
      onTokenChange={setToken}
      tokenLabel="X-Plex-Token"
      tokenHelperText={TOKEN_HELP_TEXT}
      connecting={connecting}
      error={connectError}
      onConnect={() => void handleConnect()}
      helpText={CORS_HELP_TEXT}
    />
  );

  const syncDialog = (
    <Dialog
      open={dialogOpen}
      onClose={flow.phase === 'done' || flow.phase === 'error' ? flow.reset : undefined}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>Sync Plex</DialogTitle>
      <DialogContent>
        {flow.phase === 'fetching' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Fetching watched titles…
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
          <ExternalImportReviewPanel
            items={flow.data}
            onToggleIncluded={flow.toggleIncluded}
            onSelectCandidate={flow.selectCandidate}
            onSetAllIncluded={flow.setAllIncluded}
            onConfirm={() => void flow.applyAll()}
          />
        )}

        {flow.phase === 'importing' && (
          <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary">
              Importing…
            </Typography>
          </Stack>
        )}

        {flow.phase === 'done' && (
          <Stack spacing={2}>
            <Typography variant="body2">
              Imported {flow.summary.imported} item{flow.summary.imported === 1 ? '' : 's'}.
              {flow.summary.skipped > 0 ? ` ${flow.summary.skipped} left unticked.` : ''}
            </Typography>
            <Button variant="contained" onClick={flow.reset}>
              Done
            </Button>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );

  if (variant === 'box') {
    return (
      <>
        <Box
          component="button"
          type="button"
          onClick={connected ? () => void flow.start() : () => setConnectDialogOpen(true)}
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
          <BrandIcon slug="plex" size={32} />
          <Typography variant="body2" fontWeight={600}>
            Plex
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
            {syncing ? 'Syncing…' : connected ? 'Sync now' : 'Connect server'}
          </Box>
        </Box>

        <Dialog open={connectDialogOpen} onClose={() => setConnectDialogOpen(false)} fullWidth maxWidth="xs">
          <DialogTitle>Connect Plex</DialogTitle>
          <DialogContent>{connectForm}</DialogContent>
        </Dialog>

        {syncDialog}
      </>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Plex
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Import watched Movies and TV Shows from your Plex Media Server.
      </Typography>

      {!connected ? (
        connectForm
      ) : (
        <Stack spacing={1.5}>
          <Alert severity="success" variant="outlined" sx={{ py: 0.5 }}>
            Connected to Plex
          </Alert>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="small" onClick={() => void flow.start()}>
              Sync now
            </Button>
            <Button variant="outlined" size="small" onClick={() => void handleDisconnect()}>
              Disconnect
            </Button>
          </Stack>
        </Stack>
      )}

      {syncDialog}
    </Box>
  );
}
