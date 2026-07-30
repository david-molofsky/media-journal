import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

export type ServerAuthMethod = 'password' | 'token';

interface ServerConnectFormProps {
  serverUrl: string;
  onServerUrlChange: (value: string) => void;
  serverUrlPlaceholder: string;
  /** When false (Plex), only the token field is shown — no
   * username/password option, since Plex tokens aren't obtained via a
   * login call this app makes itself. */
  supportsPasswordAuth: boolean;
  authMethod: ServerAuthMethod;
  onAuthMethodChange: (value: ServerAuthMethod) => void;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  token: string;
  onTokenChange: (value: string) => void;
  tokenLabel: string;
  tokenHelperText?: string;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
  /** Extra note shown under the Connect button — e.g. a CORS caveat. */
  helpText?: string;
}

/**
 * Shared "connect to a self-hosted server" form — server URL plus
 * either username/password or a pasted token, depending on the
 * source. Used by Audiobookshelf, Jellyfin (both support either
 * method) and Plex (token only). Purely presentational; each source's
 * *ImportSection.tsx owns the actual connect call and where the
 * result gets stored.
 */
export function ServerConnectForm({
  serverUrl,
  onServerUrlChange,
  serverUrlPlaceholder,
  supportsPasswordAuth,
  authMethod,
  onAuthMethodChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  token,
  onTokenChange,
  tokenLabel,
  tokenHelperText,
  connecting,
  error,
  onConnect,
  helpText,
}: ServerConnectFormProps) {
  const usingPassword = supportsPasswordAuth && authMethod === 'password';

  return (
    <Stack spacing={1.5}>
      <TextField
        label="Server URL"
        placeholder={serverUrlPlaceholder}
        value={serverUrl}
        onChange={(e) => onServerUrlChange(e.target.value)}
        size="small"
        fullWidth
      />

      {supportsPasswordAuth && (
        <ToggleButtonGroup
          size="small"
          exclusive
          value={authMethod}
          onChange={(_, value) => value && onAuthMethodChange(value)}
          fullWidth
        >
          <ToggleButton value="password">Username / password</ToggleButton>
          <ToggleButton value="token">{tokenLabel}</ToggleButton>
        </ToggleButtonGroup>
      )}

      {usingPassword ? (
        <>
          <TextField
            label="Username"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            size="small"
            fullWidth
          />
        </>
      ) : (
        <TextField
          label={tokenLabel}
          value={token}
          onChange={(e) => onTokenChange(e.target.value)}
          size="small"
          fullWidth
        />
      )}

      {error && (
        <Alert severity="error" variant="outlined">
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={onConnect}
        disabled={connecting || !serverUrl.trim()}
        startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : undefined}
      >
        {connecting ? 'Connecting…' : 'Connect'}
      </Button>

      {(tokenHelperText || helpText) && (
        <Typography variant="caption" color="text.secondary">
          {usingPassword ? helpText : (tokenHelperText ?? helpText)}
        </Typography>
      )}
    </Stack>
  );
}
