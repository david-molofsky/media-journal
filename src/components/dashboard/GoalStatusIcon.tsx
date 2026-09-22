import Box from '@mui/material/Box';
import type { GoalStatus } from '@/components/dashboard/goalStatus';

interface GoalStatusIconProps {
  status: GoalStatus;
}

const LABELS: Record<GoalStatus, string> = {
  achieved: 'Goal achieved',
  'on-track': 'On track to achieve goal',
  behind: 'Behind the pace needed to achieve goal',
};

/** Full-colour goal status mark for Dashboard summary cards. */
export function GoalStatusIcon({ status }: GoalStatusIconProps) {
  if (status === 'achieved') {
    return (
      <Box
        component="span"
        role="img"
        aria-label={LABELS[status]}
        sx={{ position: 'relative', width: 31, height: 27, flexShrink: 0 }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{ position: 'absolute', inset: 0, fontSize: 25, lineHeight: 1 }}
        >
          🥅
        </Box>
        <Box
          component="span"
          aria-hidden="true"
          sx={{ position: 'absolute', right: 1, bottom: -1, fontSize: 11, lineHeight: 1 }}
        >
          ⚽
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="span"
      role="img"
      aria-label={LABELS[status]}
      sx={{ width: 31, height: 27, fontSize: 22, lineHeight: 1, textAlign: 'center' }}
    >
      {status === 'on-track' ? '📈' : '⏳'}
    </Box>
  );
}
