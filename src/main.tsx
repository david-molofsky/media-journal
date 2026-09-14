import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { initialiseAnalytics } from '@/services/analytics/analyticsService';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Initialise before React mounts so the first route effect can always
// queue a page view for users who have already granted consent.
initialiseAnalytics();

/**
 * Root-level ErrorBoundary wraps App itself, so errors thrown in App's
 * own body (e.g. from useLiveQuery in useColorMode) are caught here
 * rather than propagating to React's unhandled error handler.
 * The inner ErrorBoundary in App.tsx catches errors in child routes.
 */
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
