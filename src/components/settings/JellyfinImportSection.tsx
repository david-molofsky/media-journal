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
import { ServerConnectForm, type ServerAuthMethod } from '@/components/settings/ServerConnectForm';
import { ExternalImportReviewPanel } from '@/components/settings/ExternalImportReviewPanel';
import { useJellyfinConnected } from '@/hooks/useJellyfinConnected';
import { useJellyfinImportFlow } from '@/hooks/useJellyfinImportFlow';
import { loginJellyfin, resolveJellyfinUserId, verifyJellyfinToken } from '@/services/metadata/jellyfinService';
import { setSetting } from '@/services/database/settingsService';
import { SETTINGS_KEYS } from '@/models';

const TOKEN_HELP_TEXT =
  'API keys sometimes omit played-status data on this server version — username/password is the more reliable option if syncing comes back empty.';
const CORS_HELP_TEXT =
  "Self-hosted servers sometimes block browser requests (CORS). If connecting fails, this may need routing through a proxy — let David know if you hit this.";

/**
 * Settings > Jellyfin. Connect form (username/password or an admin
 * API key) when not yet connected; "Sync now" / "Disconnect" once it
 * is. Mirrors AudiobookshelfImportSection's shape minus the progress
 * threshold step, since Jellyfin already has a clean played:true flag.
 */
export function JellyfinImportSection() {
  const connected = useJellyfinConnected();
  const flow = useJellyfinImportFlow();

  const [serverUrl, setServerUrl] = useState('');
  const [authMethod, setAuthMethod] = useState<ServerAuthMethod>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      let resolvedToken: string;
      let userId: string;
      if (authMethod === 'password') {
        const result = await loginJellyfin(serverUrl, username, password);
        resolvedToken = result.token;
        userId = result.userId;
      } else {
        resolvedToken = token;
        userId = await resolveJellyfinUserId(serverUrl, resolvedToken);
      }
      await verifyJellyfinToken(serverUrl, resolvedToken, userId);
      await setSetting(SETTINGS_KEYS.jellyfinServerUrl, serverUrl.trim());
      await setSetting(SETTINGS_KEYS.jellyfinAuthMethod, authMethod);
      await setSetting(SETTINGS_KEYS.jellyfinToken, resolvedToken);
      await setSetting(SETTINGS_KEYS.jellyfinUserId, userId);
      setPassword('');
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Couldn't connect — check your details and try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await setSetting(SETTINGS_KEYS.jellyfinServerUrl, '');
    await setSetting(SETTINGS_KEYS.jellyfinToken, '');
    await setSetting(SETTINGS_KEYS.jellyfinUserId, '');
    flow.reset();
  };

  const dialogOpen = flow.phase !== 'idle';

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Jellyfin
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Import played Movies, TV Shows, Books, and Audiobooks from your self-hosted Jellyfin server.
      </Typography>

      {!connected ? (
        <ServerConnectForm
          serverUrl={serverUrl}
          onServerUrlChange={setServerUrl}
          serverUrlPlaceholder="https://jellyfin.example.com"
          supportsPasswordAuth
          authMethod={authMethod}
          onAuthMethodChange={setAuthMethod}
          username={username}
          onUsernameChange={setUsername}
          password={password}
          onPasswordChange={setPassword}
          token={token}
          onTokenChange={setToken}
          tokenLabel="Admin API key"
          tokenHelperText={TOKEN_HELP_TEXT}
          connecting={connecting}
          error={connectError}
          onConnect={() => void handleConnect()}
          helpText={CORS_HELP_TEXT}
        />
      ) : (
        <Stack spacing={1.5}>
          <Alert severity="success" variant="outlined" sx={{ py: 0.5 }}>
            Connected to Jellyfin
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

      <Dialog
        open={dialogOpen}
        onClose={flow.phase === 'done' || flow.phase === 'error' ? flow.reset : undefined}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Sync Jellyfin</DialogTitle>
        <DialogContent>
          {flow.phase === 'fetching' && (
            <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Fetching played items…
                {flow.fetchProgress.total > 0
                  ? ` ${flow.fetchProgress.done} of ${flow.fetchProgress.total}`
                  : ''}
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
    </Box>
  );
}
