import { useEffect, useMemo } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { HashRouter } from 'react-router-dom';
import 'dayjs/locale/en-gb';
import 'dayjs/locale/en';
import { createAppTheme } from '@/theme';
import { useColorMode } from '@/hooks/useColorMode';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { useWatchProviderRegion } from '@/hooks/useWatchProviderRegion';
import { dayjsLocaleForRegion } from '@/utils/dateLocale';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { AppRoutes } from '@/routes/AppRoutes';
import { ensureDatabaseSeeded } from '@/services/database/seed';
import { PwaUpdateProvider } from '@/pwa/PwaUpdateContext';

export default function App() {
  const colorMode = useColorMode();
  const appTheme = useMemo(() => createAppTheme(colorMode), [colorMode]);

  // Drives the one MUI X DatePicker in the app (EntryDatePicker) —
  // US region gets MM/DD, everywhere else gets DD/MM. Reuses the
  // existing Region setting rather than adding a new one (see
  // dateLocale.ts). Reading it live means changing Region in Settings
  // updates the date picker immediately, no reload needed.
  const watchProviderRegion = useWatchProviderRegion();
  const dateLocale = dayjsLocaleForRegion(watchProviderRegion);

  useEffect(() => {
    void ensureDatabaseSeeded();
  }, []);

  useAutoBackup();

  return (
    <PwaUpdateProvider>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dateLocale}>
          <ErrorBoundary>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </ErrorBoundary>
        </LocalizationProvider>
      </ThemeProvider>
    </PwaUpdateProvider>
  );
}
