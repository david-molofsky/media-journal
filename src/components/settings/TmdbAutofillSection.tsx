import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { useBooleanSetting } from '@/hooks/useBooleanSetting';

interface ToggleRowProps {
  label: string;
  helperText: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({ label, helperText, checked, onChange }: ToggleRowProps) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Box>
        <Typography variant="body1">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {helperText}
        </Typography>
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            onChange={(_, next) => onChange(next)}
            inputProps={{ 'aria-label': `Auto-fill ${label.toLowerCase()}` }}
          />
        }
        label=""
        sx={{ mr: 0 }}
      />
    </Stack>
  );
}

/**
 * Controls which fields TMDB auto-fill populates when searching for a
 * Film or TV entry (MetadataSearch > tmdbService). Lives permanently in
 * Settings rather than per-import, so David doesn't have to re-toggle
 * anything on every new entry.
 *
 * All fields default to on except Poster image, which is opt-in: it's
 * the one field that changes what an entry visually looks like (shown
 * only in Edit Entry, never in the Library card or grid), so it stays
 * off until explicitly enabled.
 */
export function TmdbAutofillSection() {
  const [overview, setOverview] = useBooleanSetting('autofillOverview', true);
  const [runtime, setRuntime] = useBooleanSetting('autofillRuntime', true);
  const [productionCompany, setProductionCompany] = useBooleanSetting(
    'autofillProductionCompany',
    true,
  );
  const [tvStatus, setTvStatus] = useBooleanSetting('autofillTvStatus', true);
  const [series, setSeries] = useBooleanSetting('autofillSeries', true);
  const [poster, setPoster] = useBooleanSetting('autofillPoster', false);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <DownloadOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle2" color="text.secondary">
          Metadata auto-fill
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which fields TMDB fills in automatically when you search for a Film or TV entry.
      </Typography>

      <Stack spacing={2}>
        <ToggleRow
          label="Overview"
          helperText="Fills the synopsis field"
          checked={overview}
          onChange={setOverview}
        />
        <ToggleRow
          label="Runtime"
          helperText="Minutes, film and episode length"
          checked={runtime}
          onChange={setRuntime}
        />
        <ToggleRow
          label="Production company / network"
          helperText="Studio for film, network for TV"
          checked={productionCompany}
          onChange={setProductionCompany}
        />
        <ToggleRow
          label="TV status"
          helperText="Ongoing, ended, or cancelled"
          checked={tvStatus}
          onChange={setTvStatus}
        />
        <ToggleRow
          label="Series"
          helperText="Merges franchise name into Series (Film only — TMDB has no TV equivalent)"
          checked={series}
          onChange={setSeries}
        />
      </Stack>

      <Box sx={{ mt: 2, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body1">Poster image</Typography>
            <Typography variant="body2" color="text.secondary">
              Off by default
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={poster}
                onChange={(_, next) => setPoster(next)}
                inputProps={{ 'aria-label': 'Auto-fill poster image, off by default' }}
              />
            }
            label=""
            sx={{ mr: 0 }}
          />
        </Stack>
        <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
          Stores TMDB&apos;s image path only, not the file. Shown in Edit Entry only — the
          Library list and grid stay text-only either way.
        </Alert>
      </Box>
    </Box>
  );
}
