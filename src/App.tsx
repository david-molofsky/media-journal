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
import { GuidedTourProvider } from '@/tour/GuidedTourContext';
import { GuidedTourOverlay } from '@/tour/GuidedTourOverlay';
import { AnalyticsConsentPrompt } from '@/components/common/AnalyticsConsentPrompt';
import { AnalyticsRouteTracker } from '@/components/common/AnalyticsRouteTracker';
import { DeleteUndoProvider } from '@/contexts/DeleteUndoContext';
import { useDeviceSync } from '@/hooks/useDeviceSync';
import { db } from '@/services/database/db';

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
  useDeviceSync();

  // Local notifications are checked while the app is running. Browser/PWA
  // background delivery needs a server-side push scheduler and is not implied here.
  useEffect(() => {
    let checking = false;
    const checkReminders = async () => {
      if (checking || !('Notification' in window) || Notification.permission !== 'granted') return;
      checking = true;
      try {
        const due = await db.reminders.toArray();
        for (const reminder of due) {
          if (reminder.notifiedAt || new Date(reminder.dueAt).getTime() > Date.now()) continue;
          await db.reminders.update(reminder.id, { notifiedAt: new Date().toISOString() });
          const notification = new Notification('Media Journal reminder', { body: reminder.title, tag: reminder.id });
          notification.onclick = () => {
            window.focus();
            window.location.hash = reminder.entryId ? `/entry/${reminder.entryId}/view` : '/reminders';
            notification.close();
          };
        }
      } finally {
        checking = false;
      }
    };
    void checkReminders();
    const timer = window.setInterval(() => void checkReminders(), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <PwaUpdateProvider>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={dateLocale}>
          <ErrorBoundary>
            <HashRouter>
              <AnalyticsRouteTracker />
              <DeleteUndoProvider>
                <GuidedTourProvider>
                  <AnalyticsConsentPrompt />
                  <AppRoutes />
                  <GuidedTourOverlay />
                </GuidedTourProvider>
              </DeleteUndoProvider>
            </HashRouter>
          </ErrorBoundary>
        </LocalizationProvider>
      </ThemeProvider>
    </PwaUpdateProvider>
  );
}
