import { useLiveQuery } from 'dexie-react-hooks';
import { getGoals } from '@/services/database/goalsService';

export function useGoals(year: number): Record<string, number> | undefined {
  return useLiveQuery(() => getGoals(year), [year]);
}
