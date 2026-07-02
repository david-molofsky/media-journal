import { Component, type ErrorInfo, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetting: boolean;
}

/**
 * Top-level error boundary.
 *
 * Catches unexpected rendering errors and shows a recovery screen
 * instead of crashing the whole application.
 *
 * Two recovery options are offered:
 *   • Reload — simple page refresh, correct for most React render errors.
 *   • Reset database — deletes the IndexedDB database then reloads.
 *     Use this when the error is database-related (e.g. the iOS Safari
 *     DataError caused by the *tags multiEntry index in v4 that is now
 *     removed). Users who hit a DB-open failure have no stored data
 *     yet so nothing is lost.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetting: false };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled application error:', error, info.componentStack);
  }

  /** Simple reload — correct for most React rendering errors. */
  private handleReload = (): void => {
    window.location.reload();
  };

  /**
   * Deletes the IndexedDB database then reloads. Safe to use when the
   * app cannot open the database at all (iOS Safari DataError etc.) —
   * in that case no entries were ever saved so nothing is lost.
   */
  private handleReset = (): void => {
    this.setState({ resetting: true });
    const request = indexedDB.deleteDatabase('MediaJournalDatabase');
    const finish = () => window.location.reload();
    request.onsuccess = finish;
    request.onerror = finish;
    request.onblocked = finish;
  };

  override render(): ReactNode {
    const { error, resetting } = this.state;

    if (!error) {
      return this.props.children;
    }

    const isDbError =
      error.name === 'InvalidStateError' ||
      error.name === 'AbortError' ||
      error.name === 'DataError' ||
      error.message.toLowerCase().includes('database') ||
      error.message.toLowerCase().includes('indexeddb') ||
      error.message.toLowerCase().includes('dexie');

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          px: 3,
        }}
      >
        <Stack spacing={2} alignItems="center" maxWidth={420}>
          <Typography variant="h5" fontWeight={600}>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Media Journal ran into an unexpected error. Your data is stored
            safely on this device — reloading should fix this.
          </Typography>

          {/* Error details — helps diagnose iOS-specific issues */}
          <Box
            sx={{
              bgcolor: '#1a1a1a',
              color: '#ff6b6b',
              p: 2,
              borderRadius: 2,
              textAlign: 'left',
              width: '100%',
              overflowX: 'auto',
            }}
          >
            <Typography
              variant="caption"
              component="pre"
              sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
            >
              {error.name}: {error.message}
              {'\n\n'}
              {error.stack ?? 'No stack available'}
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={this.handleReload}
            disabled={resetting}
            fullWidth
          >
            Reload app
          </Button>

          {/* Reset option — shown prominently for DB errors, subtly otherwise */}
          <Box sx={{ width: '100%' }}>
            <Button
              variant={isDbError ? 'outlined' : 'text'}
              color="error"
              onClick={this.handleReset}
              disabled={resetting}
              fullWidth
              size={isDbError ? 'medium' : 'small'}
            >
              {resetting ? 'Resetting…' : 'Reset database and reload'}
            </Button>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: 'block', mt: 0.5 }}
            >
              {isDbError
                ? 'Recommended — clears a corrupt database. No entries have been saved yet if this is your first visit.'
                : 'Only use this if reloading does not fix the problem. Your library entries will be deleted.'}
            </Typography>
          </Box>
        </Stack>
      </Box>
    );
  }
}
