import { useEffect, useRef } from 'react';
import { SETTINGS_KEYS } from '@/models';
import { getSetting } from '@/services/database/settingsService';
import { isFirebaseSyncConfigured } from '@/services/sync/firebaseClient';
import { subscribeToSyncUser } from '@/services/sync/firebaseAuthService';
import { syncDeviceNow } from '@/services/sync/deviceSyncService';

const SYNC_INTERVAL_MS = 60_000;

export function useDeviceSync(): void {
  const syncing = useRef(false);

  useEffect(() => {
    if (!isFirebaseSyncConfigured) return;

    let userId: string | null = null;
    let stopped = false;

    const sync = async () => {
      if (stopped || syncing.current || !userId || !navigator.onLine) return;
      const [provider, enrolledUserId] = await Promise.all([
        getSetting<string | null>(SETTINGS_KEYS.syncProvider, null),
        getSetting<string | null>(SETTINGS_KEYS.syncUserId, null),
      ]);
      if (provider !== 'firebase' || enrolledUserId !== userId) return;

      syncing.current = true;
      try {
        await syncDeviceNow(userId);
      } catch {
        // The service records the error for Settings. Offline-first use continues.
      } finally {
        syncing.current = false;
      }
    };

    const unsubscribe = subscribeToSyncUser((user) => {
      userId = user?.uid ?? null;
      if (userId) void sync();
    });
    const interval = window.setInterval(() => void sync(), SYNC_INTERVAL_MS);
    const handleOnline = () => void sync();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void sync();
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopped = true;
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}
