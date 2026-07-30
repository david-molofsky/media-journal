import { useLiveQuery } from 'dexie-react-hooks';
import { isDriveConnected } from '@/services/googleDrive/googleDriveService';

/**
 * Reactive "is Google Drive connected" flag, updating whenever the
 * stored token changes (sign in/out — isDriveConnected reads through
 * to the same appSettings row Dexie tracks). Shared by
 * GoogleDriveSection, the Getting Started checklist, and the backup
 * nudge banner (see chat — onboarding package) so all three agree on
 * connection status from a single source of truth.
 */
export function useDriveConnected(): boolean {
  return useLiveQuery(() => isDriveConnected(), [], false) ?? false;
}
