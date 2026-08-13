import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface PwaUpdateContextValue {
  /**
   * Forces the browser to re-check the network for a new service
   * worker (bypassing the HTTP cache, per the standard SW update
   * algorithm) \u2014 this is what "Check for updates" in Settings calls.
   *
   * Doesn't itself report whether an update was found:
   * `registerType: 'autoUpdate'` (vite.config.ts) means any update
   * found installs and activates immediately, which triggers a full
   * page reload on its own via the `activated` handler inside
   * vite-plugin-pwa's registerSW. So the caller just waits a few
   * seconds \u2014 a reload happening means yes, no reload means no.
   */
  checkForUpdates: () => Promise<void>;
  /** False in browsers/contexts without service worker support (or
   * during local dev, where no SW is registered) \u2014 callers should
   * hide the update-check UI entirely rather than show a button that
   * can never do anything. */
  supported: boolean;
}

const PwaUpdateContext = createContext<PwaUpdateContextValue | null>(null);

/**
 * Registers the app's service worker exactly once (via useRegisterSW)
 * and makes a manual "check now" action available anywhere in the
 * tree through usePwaUpdate. Must wrap the app root \u2014 useRegisterSW
 * itself isn't safe to call from more than one place, since each call
 * registers a fresh Workbox instance and listener set.
 *
 * Ported directly from Media Journal's pwa/PwaUpdateContext.tsx \u2014
 * same vite-plugin-pwa setup (registerType: 'autoUpdate'), so the
 * pattern applies unchanged.
 */
export function PwaUpdateProvider({ children }: { children: ReactNode }) {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration ?? null;
    },
  });

  const checkForUpdates = async () => {
    await registrationRef.current?.update();
  };

  const supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

  return (
    <PwaUpdateContext.Provider value={{ checkForUpdates, supported }}>
      {children}
    </PwaUpdateContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- context + its hook are intentionally paired in one file; splitting only saves a dev-mode fast-refresh edge case.
export function usePwaUpdate(): PwaUpdateContextValue {
  const ctx = useContext(PwaUpdateContext);
  if (!ctx) {
    throw new Error('usePwaUpdate must be used within a PwaUpdateProvider');
  }
  return ctx;
}
