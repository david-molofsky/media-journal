import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface MetricCardProps {
  label: string;
  value: string | number;
}

/** Muted-surface metric card for a single statistic (total entries,
 * average rating, longest streak, etc.) — UI & UX Specification,
 * section 8: "Overview". */
export function MetricCard({ label, value }: MetricCardProps) {
  return (
    <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.5 }}>
      <Typography variant="h6" fontWeight={600}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
