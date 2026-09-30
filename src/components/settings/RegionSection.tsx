import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import { useWatchProviderRegion } from '@/hooks/useWatchProviderRegion';
import { setSetting } from '@/services/database/settingsService';
import {
  WATCH_PROVIDER_REGIONS,
  type WatchProviderRegion,
} from '@/utils/watchProviderRegions';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';

/**
 * Manual region setting for TMDB/JustWatch streaming availability
 * lookups — replaces the value that used to be hardcoded to 'GB' in
 * tmdbService.ts. Deliberately manual rather than geolocation-based:
 * avoids a GPS permission prompt and stays correct while travelling
 * (an entry logged abroad still reflects home-region availability).
 *
 * Scoped only to streaming provider ("Source" auto-fill) lookups —
 * doesn't affect TMDB search results, metadata language, or anything
 * else. Persisted globally via appSettings, same as every other
 * setting in this app.
 */
const PROVIDER_OPTIONS = [
  'Amazon Prime Video',
  'Apple TV+',
  'BBC iPlayer',
  'Disney+',
  'Hulu',
  'Max',
  'Netflix',
  'NOW',
  'Paramount+',
  'Peacock',
];

export function RegionSection() {
  const region = useWatchProviderRegion();
  const excludedProviders =
    useLiveQuery(
      async () => {
        const record = await db.appSettings.get('excludedWatchProviders');
        return Array.isArray(record?.value)
          ? record.value.filter(
              (provider): provider is string => typeof provider === 'string',
            )
          : [];
      },
      [],
      [],
    ) ?? [];
  const selected = WATCH_PROVIDER_REGIONS.find((r) => r.code === region) ?? null;

  return (
    <CollapsibleSection title="Region" icon={PublicOutlinedIcon}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Used for streaming availability lookups (TMDB/JustWatch) only
      </Typography>

      <Autocomplete
        size="small"
        options={WATCH_PROVIDER_REGIONS}
        value={selected}
        getOptionLabel={(option: WatchProviderRegion) => option.name}
        isOptionEqualToValue={(option, value) => option.code === value.code}
        onChange={(_, newValue) => {
          setSetting('watchProviderRegion', newValue?.code ?? 'GB');
        }}
        renderInput={(params) => (
          <TextField {...params} placeholder="Search countries…" />
        )}
      />

      <Typography variant="subtitle2" sx={{ mt: 2.5, mb: 0.5 }}>
        Ignore services when suggesting Source
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Film and TV entries will skip these services when JustWatch suggests a Source. You
        can choose a suggestion or type another provider.
      </Typography>
      <Autocomplete
        multiple
        freeSolo
        size="small"
        options={PROVIDER_OPTIONS}
        value={excludedProviders}
        onChange={(_, newValue) => {
          const cleaned = Array.from(
            new Set(newValue.map((provider) => provider.trim()).filter(Boolean)),
          );
          void setSetting('excludedWatchProviders', cleaned);
        }}
        renderInput={(params) => (
          <TextField {...params} placeholder="Choose or type services to ignore…" />
        )}
      />
    </CollapsibleSection>
  );
}
