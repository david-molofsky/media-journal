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
import Slider from '@mui/material/Slider';
import { ServerConnectForm, type ServerAuthMethod } from '@/components/settings/ServerConnectForm';
import { ExternalImportReviewPanel } from '@/components/settings/ExternalImportReviewPanel';
import { useAudiobookshelfConnected } from '@/hooks/useAudiobookshelfConnected';
import { useAudiobookshelfImportFlow } from '@/hooks/useAudiobookshelfImportFlow';
import { loginAudiobookshelf, verifyAudiobookshelfToken } from '@/services/metadata/audiobookshelfService';
import { setSetting } from '@/services/database/settingsService';
import { SETTINGS_KEYS } from '@/models';

const CORS_HELP_TEXT =
  "Self-hosted servers sometimes block browser requests (CORS). If connecting fails, this may need routing through a proxy — let David know if you hit this.";

/**
 * Settings > Audiobookshelf. Connect form (username/password or a
 * pasted admin token) when not yet connected; "Sync now" / "Disconnect"
 * once it is. Sync opens a dialog: pick a progress threshold → fetch →
 * review (tick-box) → apply — same dialog-phase shape as
 * TraktImportSection, plus the threshold step Audiobookshelf alone
 * needs (see useAudiobookshelfImportFlow).
 */
export function AudiobookshelfImportSection() {
  const connected = useAudiobookshelfConnected();
  const flow = useAudiobookshelfImportFlow();

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
      const resolvedToken =
        authMethod === 'password' ? await loginAudiobookshelf(serverUrl, username, password) : token;
      await verifyAudiobookshelfToken(serverUrl, resolvedToken);
      await setSetting(SETTINGS_KEYS.absServerUrl, serverUrl.trim());
      await setSetting(SETTINGS_KEYS.absAuthMethod, authMethod);
      await setSetting(SETTINGS_KEYS.absToken, resolvedToken);
      setPassword('');
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Couldn't connect — check your details and try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await setSetting(SETTINGS_KEYS.absServerUrl, '');
    await setSetting(SETTINGS_KEYS.absToken, '');
    flow.reset();
  };

  const dialogOpen = flow.phase !== 'idle';

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Audiobookshelf
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Import finished (or nearly finished) books and audiobooks from your self-hosted Audiobookshelf server.
      </Typography>

      {!connected ? (
        <ServerConnectForm
          serverUrl={serverUrl}
          onServerUrlChange={setServerUrl}
          serverUrlPlaceholder="https://abs.example.com"
          supportsPasswordAuth
          authMethod={authMethod}
          onAuthMethodChange={setAuthMethod}
          username={username}
          onUsernameChange={setUsername}
          password={password}
          onPasswordChange={setPassword}
          token={token}
          onTokenChange={setToken}
          tokenLabel="API token"
          connecting={connecting}
          error={connectError}
          onConnect={() => void handleConnect()}
          helpText={CORS_HELP_TEXT}
        />
      ) : (
        <Stack spacing={1.5}>
          <Alert severity="success" variant="outlined" sx={{ py: 0.5 }}>
            Connected to Audiobookshelf
          </Alert>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" size="small" onClick={flow.begin}>
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
        <DialogTitle>Sync Audiobookshelf</DialogTitle>
        <DialogContent>
          {flow.phase === 'threshold' && (
            <Stack spacing={2} sx={{ py: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Only import items at or above this progress:
              </Typography>
              <Typography variant="h4" fontWeight={700} textAlign="center" color="primary">
                {Math.round(flow.threshold * 100)}%
              </Typography>
              <Slider
                value={flow.threshold * 100}
                onChange={(_, value) => flow.setThreshold((value as number) / 100)}
                min={0}
                max={100}
              />
              <Button variant="contained" onClick={() => void flow.fetchLibrary()}>
                Fetch library
              </Button>
            </Stack>
          )}

          {flow.phase === 'fetching' && (
            <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Fetching your library…
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
              onSelectType={flow.selectType}
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
