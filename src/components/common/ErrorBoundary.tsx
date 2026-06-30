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
}

/**
 * Top-level error boundary.
 *
 * Catches unexpected rendering errors and shows a recovery screen
 * instead of crashing the whole application, per the Technical
 * Architecture Document, section 9 ("Error Handling").
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // In a future milestone this could be wired up to local error
    // logging; for now we keep it simple and offline-friendly.
    console.error('Unhandled application error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  override render(): ReactNode {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

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
            Media Journal ran into an unexpected error. Your data is stored safely on this
            device — returning to the dashboard should fix this.
          </Typography>
          <Button variant="contained" onClick={this.handleReload}>
            Return to Dashboard
          </Button>
        </Stack>
      </Box>
    );
  }
}
