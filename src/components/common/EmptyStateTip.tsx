import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useBooleanSetting } from '@/hooks/useBooleanSetting';
import type { SettingsKey } from '@/models';

interface EmptyStateTipProps {
  message: string;
  dismissedKey: SettingsKey;
}

/**
 * One-time dismissible tip shown alongside a page's genuine empty
 * state (see chat — onboarding package, Timeline/Statistics first
 * visit). Sits above the existing PagePlaceholder rather than
 * replacing it. Dismisses via its own close icon, and effectively
 * retires itself once the page has real data (the caller only renders
 * this inside the same `entries.length === 0` branch as the
 * placeholder).
 */
export function EmptyStateTip({ message, dismissedKey }: EmptyStateTipProps) {
  const [dismissed, setDismissed] = useBooleanSetting(dismissedKey, false);

  if (dismissed) return null;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="center"
      spacing={1}
      sx={{
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'primary.main',
        borderRadius: 2,
        px: 2,
        py: 1,
        mb: 1,
        maxWidth: 420,
        mx: 'auto',
      }}
    >
      <Typography variant="body2" sx={{ textAlign: 'center' }}>
        {message}
      </Typography>
      <IconButton size="small" aria-label="Dismiss tip" onClick={() => setDismissed(true)}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
