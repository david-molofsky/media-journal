import { useEffect } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
import { theme } from '@/theme';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRoutes } from '@/routes/AppRoutes';
import { ensureDatabaseSeeded } from '@/services/database/seed';

export default function App() {
  useEffect(() => {
    void ensureDatabaseSeeded();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
