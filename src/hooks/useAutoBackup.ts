import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { getSetting, setSetting } from '@/services/database/settingsService';
import { SETTINGS_KEYS } from '@/models';
import { isDriveConnected, exportToGoogleDrive } from '@/services/googleDrive/googleDriveService';

const CHECK_INTERVAL_MS = 60_000;
const SCHEDULED_HOUR = 23;
const SCHEDULED_MINUTE = 59;

/**
 * App-level watcher for the "automatic daily backup" setting (Settings >
 * Google Drive). Mounted once near the app root — see App.tsx.
 *
 * Runs at most once per calendar day, via two triggers:
 *   1. Scheduled — while the app is open, a 60s interval fires the
 *      backup once local time reaches 23:59 and today hasn't run yet.
 *   2. Catch-up — on mount and whenever the tab/app regains visibility,
 *      if the last recorded backup is from a previous day (i.e. the
 *      device was closed through 23:59), the backup runs immediately
 *      rather than waiting for 23:59 again.
 *
 * Both triggers converge on the same rule: has today's date already
 * been recorded in `lastAutoBackupAt`? If not, and it's either past
 * 23:59 or we're catching up from a missed day, run it. A PWA can't
 * guarantee code runs at an exact time while fully closed — this is
 * the closest opportunistic approximation (see Settings > Google
 * Drive for the same caveat surfaced to the user).
 *
 * Failures (not connected, expired/revoked token, network error) are
 * swallowed silently — `lastAutoBackupAt` is only written on success,
 * so a failed attempt is retried on the next check rather than being
 * marked done.
 */
export function useAutoBackup(): void {
  const runningRef = useRef(false);

  useEffect(() => {
    const alreadyRanToday = async (): Promise<boolean> => {
      const lastAt = await getSetting<string | null>(SETTINGS_KEYS.lastAutoBackupAt, null);
      return lastAt !== null && dayjs(lastAt).isSame(dayjs(), 'day');
    };

    const runBackup = async (): Promise<void> => {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        const enabled = await getSetting(SETTINGS_KEYS.autoBackupEnabled, false);
        if (!enabled) return;
        if (await alreadyRanToday()) return;

        const connected = await isDriveConnected();
        if (!connected) return;

        await exportToGoogleDrive();
        await setSetting(SETTINGS_KEYS.lastAutoBackupAt, dayjs().toISOString());
      } catch {
        // Silent by design — see doc comment above. Next check retries.
      } finally {
        runningRef.current = false;
      }
    };

    const checkCatchUp = async (): Promise<void> => {
      const enabled = await getSetting(SETTINGS_KEYS.autoBackupEnabled, false);
      if (!enabled) return;
      if (await alreadyRanToday()) return;

      const lastAt = await getSetting<string | null>(SETTINGS_KEYS.lastAutoBackupAt, null);
      // Never run before, or last run was a previous day — either way,
      // today's backup is outstanding. Catch up now rather than
      // waiting for 23:59, matching the "closed at 23:58, opened next
      // morning" behavior.
      if (lastAt === null || dayjs(lastAt).isBefore(dayjs(), 'day')) {
        void runBackup();
      }
    };

    const checkScheduled = async (): Promise<void> => {
      const now = dayjs();
      if (now.hour() > SCHEDULED_HOUR || (now.hour() === SCHEDULED_HOUR && now.minute() >= SCHEDULED_MINUTE)) {
        void runBackup();
      }
    };

    // Mount: catch up on anything missed while closed.
    void checkCatchUp();

    // Foreground/resume: PWA reopened from background without a full reload.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void checkCatchUp();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // While open: catch the 23:59 boundary.
    const interval = window.setInterval(() => void checkScheduled(), CHECK_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);
}
