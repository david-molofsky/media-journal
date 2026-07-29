import { useEffect, useMemo } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { HashRouter } from 'react-router-dom';
import { createAppTheme } from '@/theme';
import { useColorMode } from '@/hooks/useColorMode';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRoutes } from '@/routes/AppRoutes';
import { ensureDatabaseSeeded } from '@/services/database/seed';

export default function App() {
  const colorMode = useColorMode();
  const appTheme = useMemo(() => createAppTheme(colorMode), [colorMode]);

  useEffect(() => {
    void ensureDatabaseSeeded();
  }, []);

  useAutoBackup();

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <ErrorBoundary>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ErrorBoundary>
      </LocalizationProvider>
    </ThemeProvider>
  );
}
