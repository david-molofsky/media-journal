import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function GoalStatusLegend() {
  return (
    <Stack
      direction="row"
      justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
      alignItems="center"
      flexWrap="wrap"
      gap={2}
      sx={{ mt: 1.5 }}
      aria-label="Goal status legend"
    >
      <Typography variant="caption" color="text.secondary">
        📈 On track
      </Typography>
      <Typography variant="caption" color="text.secondary">
        ⏳ Behind pace
      </Typography>
      <Typography variant="caption" color="text.secondary">
        🥅⚽ Goal achieved
      </Typography>
    </Stack>
  );
}
