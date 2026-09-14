import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { getSetting, setSetting } from '@/services/database/settingsService';
import { SETTINGS_KEYS } from '@/models';
import { tourSteps } from './tourSteps';
import type { TourStep } from './types';

interface GuidedTourContextValue {
  active: boolean;
  stepIndex: number;
  currentStep: TourStep | null;
  nextStep: TourStep | null;
  totalSteps: number;
  start: () => void;
  next: () => void;
  back: () => void;
  skipStep: () => void;
  endTour: () => void;
}

const GuidedTourContext = createContext<GuidedTourContextValue | null>(null);

export function GuidedTourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Raw reads — deliberately `undefined` while the Dexie query is
  // still loading, rather than useBooleanSetting's `fallback` overload
  // (which returns `false` synchronously before the real value
  // resolves). That collapsed `false` was indistinguishable from a
  // genuine "never completed", so the auto-start effect below fired
  // on every reload regardless of the saved flag (see chat). Waiting
  // for both to resolve, plus only auto-starting when there's 0 or 1
  // entry, fixes it from two directions.
  const hasCompletedTour = useLiveQuery(
    () => getSetting<boolean>(SETTINGS_KEYS.hasCompletedGuidedTour, false),
    [],
  );
  const entryCount = useLiveQuery(() => db.mediaEntries.count(), []);

  const goToStep = useCallback(
    (index: number) => {
      const step = tourSteps[index];
      if (!step) return;
      setStepIndex(index);
      if (location.pathname !== step.route) {
        navigate(step.route);
      }
    },
    [navigate, location.pathname],
  );

  const endTour = useCallback(() => {
    setActive(false);
    void setSetting(SETTINGS_KEYS.hasCompletedGuidedTour, true);
  }, []);

  const next = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= tourSteps.length) {
      endTour();
      return;
    }
    goToStep(nextIndex);
  }, [stepIndex, goToStep, endTour]);

  const back = useCallback(() => {
    goToStep(Math.max(0, stepIndex - 1));
  }, [stepIndex, goToStep]);

  const skipStep = useCallback(() => {
    next();
  }, [next]);

  const start = useCallback(() => {
    setActive(true);
    goToStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-start once — only once both queries have actually resolved
  // (not their loading state), the tour has never been completed on
  // this device, and there's 0 or 1 entry. More than 1 entry means
  // this clearly isn't a first run (e.g. an existing library, or a
  // device where the completion flag failed to save for some other
  // reason) — either way, don't interrupt an established user.
  useEffect(() => {
    (() => {
      if (active) return;
      if (hasCompletedTour !== false) return;
      if (entryCount === undefined || entryCount > 1) return;
      start();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCompletedTour, entryCount]);

  const currentStep = active ? (tourSteps[stepIndex] ?? null) : null;
  const nextStep = active ? (tourSteps[stepIndex + 1] ?? null) : null;

  // Steps whose real action is a route change the tour doesn't
  // trigger itself (e.g. saving the Add Entry form redirects to
  // Library) auto-advance the moment that navigation happens.
  useEffect(() => {
    (() => {
      if (!active || !currentStep?.autoAdvanceOnRouteLeave) return;
      if (location.pathname !== currentStep.route) {
        next();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, active, currentStep]);

  const value = useMemo<GuidedTourContextValue>(
    () => ({
      active,
      stepIndex,
      currentStep,
      nextStep,
      totalSteps: tourSteps.length,
      start,
      next,
      back,
      skipStep,
      endTour,
    }),
    [active, stepIndex, currentStep, nextStep, start, next, back, skipStep, endTour],
  );

  return (
    <GuidedTourContext.Provider value={value}>{children}</GuidedTourContext.Provider>
  );
}

export function useGuidedTour(): GuidedTourContextValue {
  const ctx = useContext(GuidedTourContext);
  if (!ctx) {
    throw new Error('useGuidedTour must be used within a GuidedTourProvider');
  }
  return ctx;
}
