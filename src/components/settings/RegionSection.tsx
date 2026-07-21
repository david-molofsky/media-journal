import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import { useWatchProviderRegion } from '@/hooks/useWatchProviderRegion';
import { setSetting } from '@/services/database/settingsService';
import { WATCH_PROVIDER_REGIONS, type WatchProviderRegion } from '@/utils/watchProviderRegions';

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
export function RegionSection() {
  const region = useWatchProviderRegion();
  const selected = WATCH_PROVIDER_REGIONS.find((r) => r.code === region) ?? null;

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <PublicOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Box>
          <Typography variant="body1" fontWeight={500}>
            Region
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Used for streaming availability lookups (TMDB/JustWatch) only
          </Typography>
        </Box>
      </Stack>

      <Autocomplete
        size="small"
        options={WATCH_PROVIDER_REGIONS}
        value={selected}
        getOptionLabel={(option: WatchProviderRegion) => option.name}
        isOptionEqualToValue={(option, value) => option.code === value.code}
        onChange={(_, newValue) => {
          setSetting('watchProviderRegion', newValue?.code ?? 'GB');
        }}
        renderInput={(params) => <TextField {...params} placeholder="Search countries…" />}
      />
    </Stack>
  );
}
