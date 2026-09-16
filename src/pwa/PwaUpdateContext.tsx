import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { shouldApplyPwaUpdate } from './updateSafety';

interface PwaUpdateContextValue {
  /** Ask the current service worker registration to check the network. */
  checkForUpdates: () => Promise<void>;
  /** Register or clear one mounted unsaved-work blocker. */
  setUpdateBlocker: (id: symbol, blocked: boolean) => void;
  /** False when service workers are unavailable or disabled in local development. */
  supported: boolean;
}

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null);

/**
 * Registers the service worker once for the app. Updates may download
 * immediately, but activation waits until every dirty-form blocker has
 * cleared so a newly installed version cannot reload unfinished work.
 */
export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const updateApplyingRef = useRef(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateBlockers, setUpdateBlockers] = useState<ReadonlySet<symbol>>(
    () => new Set(),
  );

  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null;
    },
    onNeedRefresh() {
      setUpdateAvailable(true);
    },
  });

  const setUpdateBlocker = useCallback((id: symbol, blocked: boolean) => {
    setUpdateBlockers((current) => {
      if (current.has(id) === blocked) return current;

      const next = new Set(current);
      if (blocked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (
      !shouldApplyPwaUpdate(
        updateAvailable,
        updateBlockers.size,
        updateApplyingRef.current,
      )
    ) {
      return;
    }

    updateApplyingRef.current = true;
    void updateServiceWorker(true).catch(() => {
      // Keep the update pending so a later check or blocker transition
      // can retry activation.
      updateApplyingRef.current = false;
    });
  }, [updateAvailable, updateBlockers, updateServiceWorker]);

  const checkForUpdates = useCallback(async () => {
    await registrationRef.current?.update();
  }, []);

  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

  const value = useMemo(
    () => ({ checkForUpdates, setUpdateBlocker, supported }),
    [checkForUpdates, setUpdateBlocker, supported],
  );

  return <PwaUpdateContext.Provider value={value}>{children}</PwaUpdateContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- context + hooks intentionally share one module.
export function usePwaUpdate(): PwaUpdateContextValue {
  const ctx = useContext(PwaUpdateContext);
  if (!ctx) {
    throw new Error('usePwaUpdate must be used within a PwaUpdateProvider');
  }
  return ctx;
}

/** Prevent an installed update from activating while `blocked` is true. */
// eslint-disable-next-line react-refresh/only-export-components -- context + hooks intentionally share one module.
export function usePwaUpdateBlocker(blocked: boolean): void {
  const { setUpdateBlocker } = usePwaUpdate();
  const blockerId = useRef(Symbol('pwa-update-blocker'));

  useEffect(() => {
    const id = blockerId.current;
    setUpdateBlocker(id, blocked);
    return () => setUpdateBlocker(id, false);
  }, [blocked, setUpdateBlocker]);
}
