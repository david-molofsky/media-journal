import { useLiveQuery } from 'dexie-react-hooks';
import { listEnabledMediaTypes } from '@/services/database/mediaTypeService';
import type { MediaType } from '@/models';

/** Reactive list of enabled media types, for the Add Entry media-type
 * picker (Milestone 3) and anywhere else that needs to render
 * type-specific colours/icons without hard-coding which types exist. */
export function useMediaTypes(): MediaType[] | undefined {
  return useLiveQuery(() => listEnabledMediaTypes(), []);
}
