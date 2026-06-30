import { useLiveQuery } from 'dexie-react-hooks';
import { listMediaTypes } from '@/services/database/mediaTypeService';
import type { MediaType } from '@/models';

/** Reactive list of every configured media type, enabled or not — for
 * Settings' "Manage Media Types" screen (Milestone 7). Most other
 * consumers want `useMediaTypes` (enabled only) instead. */
export function useAllMediaTypes(): MediaType[] | undefined {
  return useLiveQuery(() => listMediaTypes(), []);
}
