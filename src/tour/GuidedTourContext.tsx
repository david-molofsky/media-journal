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
import { useBooleanSetting } from '@/hooks/useBooleanSetting';
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
  const [hasCompletedTour, setHasCompletedTour] = useBooleanSetting(
    SETTINGS_KEYS.hasCompletedGuidedTour,
    false,
  );
  const navigate = useNavigate();
  const location = useLocation();

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
    setHasCompletedTour(true);
  }, [setHasCompletedTour]);

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

  // Auto-start once, the first time we confirm (via the Dexie-backed
  // setting) that the tour has never run on this device. Only fires
  // once per app load — see start()'s own guard against re-triggering
  // via the `active` check below.
  useEffect(() => {
    (() => {
      if (!active && !hasCompletedTour) {
        start();
      }
    })();
    // Deliberately only re-checks when hasCompletedTour resolves from
    // Dexie (it starts as the `false` fallback, same pattern as
    // hasSeenWelcome elsewhere) — not on every `active` change, or
    // ending the tour would immediately restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCompletedTour]);

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
