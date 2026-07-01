import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import { useTheme } from '@mui/material/styles';

interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
}

/**
 * Compact streak widget for the Dashboard. Shows the current
 * consecutive-day streak and the year's personal best. The flame icon
 * dims when the streak is zero (nothing logged today or yesterday).
 */
export function StreakWidget({ currentStreak, longestStreak }: StreakWidgetProps) {
  const theme = useTheme();
  const active = currentStreak > 0;

  return (
    <Box
      sx={{
        borderRadius: 3,
        bgcolor: active ? 'primary.main' : 'action.hover',
        color: active ? 'primary.contrastText' : 'text.secondary',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <LocalFireDepartmentOutlinedIcon
        sx={{
          fontSize: 36,
          color: active ? '#FFD54F' : theme.palette.action.disabled,
        }}
      />
      <Box sx={{ flex: 1 }}>
        <Stack direction="row" alignItems="baseline" spacing={0.75}>
          <Typography variant="h4" fontWeight={700} lineHeight={1}>
            {currentStreak}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            day streak
          </Typography>
        </Stack>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          {active
            ? `Personal best: ${longestStreak} day${longestStreak === 1 ? '' : 's'}`
            : 'Log an entry to start a streak'}
        </Typography>
      </Box>
      {active && (
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" sx={{ opacity: 0.75 }}>
            Last logged
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            Today
          </Typography>
        </Box>
      )}
    </Box>
  );
}
