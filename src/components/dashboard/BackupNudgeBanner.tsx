import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useBackupNudge } from '@/hooks/useBackupNudge';
import { ROUTES } from '@/routes/paths';

/**
 * Dismissible banner nudging the user to connect Google Drive backup
 * once their library crosses a size threshold with no backup
 * connected (see chat — onboarding package, and useBackupNudge for
 * the threshold logic). Dismissing hides this occurrence only — it
 * reappears once the next threshold is crossed.
 */
export function BackupNudgeBanner() {
  const navigate = useNavigate();
  const nudge = useBackupNudge();

  if (nudge === undefined || !nudge.visible) return null;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1.5}
      sx={{
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        px: 2,
        py: 1.25,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <CloudOffOutlinedIcon color="action" fontSize="small" />
        <Typography variant="body2">
          You've logged {nudge.entryCount} entries with no backup connected. Your library only
          exists on this device.
        </Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={0.5} flexShrink={0}>
        <Button size="small" onClick={() => navigate(ROUTES.settings)}>
          Connect Drive
        </Button>
        <IconButton size="small" aria-label="Dismiss backup nudge" onClick={nudge.dismiss}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}
