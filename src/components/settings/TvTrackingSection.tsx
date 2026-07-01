import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import { useTvTrackingMode } from '@/hooks/useTvTrackingMode';
import { setSetting } from '@/services/database/settingsService';
import type { TvTrackingMode } from '@/models';

/**
 * Toggles whether TV entries are logged as complete seasons (default)
 * or individual episode ranges. When episode mode is on, the Add/Edit
 * form gains Episode Start and Episode End fields (parallel to comic
 * Issue Start / Issue End) and statistics weight TV entries by episode
 * count rather than 1 per entry.
 */
export function TvTrackingSection() {
  const mode = useTvTrackingMode();

  const handleChange = async (_: React.MouseEvent, value: TvTrackingMode | null) => {
    if (!value) return; // ToggleButtonGroup returns null if the active button is clicked again
    await setSetting('tvTrackingMode', value);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TvOutlinedIcon fontSize="small" sx={{ color: '#388E3C' }} />
        <Typography variant="subtitle2" color="text.secondary">
          TV tracking
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose whether to log TV entries as full seasons or individual episode ranges.
        Episode mode adds start and end episode fields and counts statistics by episode,
        the same way comics are counted by issue.
      </Typography>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={handleChange}
        size="small"
        aria-label="TV tracking mode"
      >
        <ToggleButton value="season" aria-label="Track by season">
          Full seasons
        </ToggleButton>
        <ToggleButton value="episode" aria-label="Track by episode">
          Episodes
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
