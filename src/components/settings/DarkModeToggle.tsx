import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useColorMode } from '@/hooks/useColorMode';
import { setSetting } from '@/services/database/settingsService';

/**
 * Persisted dark mode toggle. Reading and writing both go through
 * `appSettings` so the preference survives PWA restarts and is
 * included in JSON exports/imports.
 */
export function DarkModeToggle() {
  const mode = useColorMode();

  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Stack direction="row" alignItems="center" spacing={1}>
        <DarkModeOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Box>
          <Typography variant="body1" fontWeight={500}>
            Dark mode
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Switch appearance
          </Typography>
        </Box>
      </Stack>
      <FormControlLabel
        control={
          <Switch
            checked={mode === 'dark'}
            onChange={(_, checked) => setSetting('colorMode', checked ? 'dark' : 'light')}
            inputProps={{ 'aria-label': 'Toggle dark mode' }}
          />
        }
        label=""
        sx={{ mr: 0 }}
      />
    </Stack>
  );
}
