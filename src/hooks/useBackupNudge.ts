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

type BackupNudgeKind = 'connect' | 'failed';

interface BackupNudgeState {
  visible: boolean;
  entryCount: number;
  kind: BackupNudgeKind;
  /** Connection nudges are dismissible until the next threshold.
   * Failure warnings remain until a backup succeeds or automatic
   * backup is disabled, so a data-protection problem cannot be
   * permanently hidden by accident. */
  dismiss?: () => void;
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
    const [
      entryCount,
      hasDrive,
      dismissedThreshold,
      autoBackupEnabled,
      lastAutoBackupError,
    ] = await Promise.all([
      db.mediaEntries.count(),
      isDriveConnected(),
      getSetting(SETTINGS_KEYS.backupNudgeDismissedThreshold, 0),
      getSetting(SETTINGS_KEYS.autoBackupEnabled, false),
      getSetting<string | null>(SETTINGS_KEYS.lastAutoBackupError, null),
    ]);

    const threshold = eligibleThreshold(entryCount);
    const backupFailed =
      hasDrive && autoBackupEnabled && Boolean(lastAutoBackupError);
    const needsConnection =
      !hasDrive && threshold > 0 && threshold > dismissedThreshold;
    const kind: BackupNudgeKind = backupFailed ? 'failed' : 'connect';

    return {
      visible: backupFailed || needsConnection,
      entryCount,
      threshold,
      kind,
    };
  }, []);

  if (result === undefined) return undefined;

  return {
    visible: result.visible,
    entryCount: result.entryCount,
    kind: result.kind,
    dismiss:
      result.kind === 'connect'
        ? () => {
            void setSetting(
              SETTINGS_KEYS.backupNudgeDismissedThreshold,
              result.threshold,
            );
          }
        : undefined,
  };
}
