import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { getSetting, setSetting } from '@/services/database/settingsService';
import { SETTINGS_KEYS } from '@/models';
import { isDriveConnected } from '@/services/googleDrive/googleDriveService';

const FIRST_THRESHOLD = 10;
const REPEAT_INTERVAL = 25;

/** Largest nudge threshold (10, 35, 60, 85, ...) at or below `count`,
 * or 0 if `count` hasn't reached the first one yet. */
function eligibleThreshold(count: number): number {
  if (count < FIRST_THRESHOLD) return 0;
  return FIRST_THRESHOLD + Math.floor((count - FIRST_THRESHOLD) / REPEAT_INTERVAL) * REPEAT_INTERVAL;
}

interface BackupNudgeState {
  visible: boolean;
  entryCount: number;
  /** Marks the current threshold as dismissed — reappears once the
   * next one (+25 entries) is crossed, or hides for good once Drive
   * is connected. */
  dismiss: () => void;
}

/**
 * Google Drive backup nudge (see chat — onboarding package). Fires
 * once the library crosses 10 entries with no Drive connection, then
 * again every +25 entries, until Drive is connected. Retroactive: an
 * existing library already past a threshold sees it on the next
 * Dashboard visit rather than waiting for the next new one.
 */
export function useBackupNudge(): BackupNudgeState | undefined {
  const result = useLiveQuery(async () => {
    const [entryCount, hasDrive, dismissedThreshold] = await Promise.all([
      db.mediaEntries.count(),
      isDriveConnected(),
      getSetting(SETTINGS_KEYS.backupNudgeDismissedThreshold, 0),
    ]);

    const threshold = eligibleThreshold(entryCount);
    const visible = !hasDrive && threshold > 0 && threshold > dismissedThreshold;

    return { visible, entryCount, threshold };
  }, []);

  if (result === undefined) return undefined;

  return {
    visible: result.visible,
    entryCount: result.entryCount,
    dismiss: () => {
      void setSetting(SETTINGS_KEYS.backupNudgeDismissedThreshold, result.threshold);
    },
  };
}
