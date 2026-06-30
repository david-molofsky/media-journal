import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Generic loading state, used as the Suspense fallback for lazy-loaded
 * routes (Technical Architecture Document, section 10).
 */
export function LoadingIndicator() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      }}
    >
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}
