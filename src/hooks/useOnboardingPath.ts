import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { setSetting } from '@/services/database/settingsService';
import { SETTINGS_KEYS } from '@/models';

export type OnboardingPath = 'fresh' | 'importing' | null;

/**
 * Welcome screen's "starting fresh" vs "importing my library" toggle
 * (see chat — onboarding package). Purely a display preference: it
 * reorders/relabels the existing sections rather than hiding either
 * one, and can be changed at any time. Defaults to null (neither
 * chosen), same as a first-run device.
 */
export function useOnboardingPath(): [OnboardingPath, (value: OnboardingPath) => void] {
  const value =
    useLiveQuery(async () => {
      const record = await db.appSettings.get(SETTINGS_KEYS.onboardingPath);
      return (record?.value as OnboardingPath) ?? null;
    }, [], null) ?? null;

  const setValue = (next: OnboardingPath) => {
    void setSetting(SETTINGS_KEYS.onboardingPath, next);
  };

  return [value, setValue];
}
