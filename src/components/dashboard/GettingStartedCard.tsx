import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useGettingStartedStatus } from '@/hooks/useGettingStartedStatus';
import { useBooleanSetting } from '@/hooks/useBooleanSetting';
import { SETTINGS_KEYS } from '@/models';
import { ROUTES } from '@/routes/paths';

interface ChecklistItemDef {
  key: string;
  label: string;
  description?: string;
  done: boolean;
  onClick: () => void;
}

/**
 * Adaptive Dashboard checklist (see chat — onboarding package). Each
 * row reflects real app state (see useGettingStartedStatus) rather
 * than a manually-ticked flag. Dismissing via the close icon hides it
 * for good; it also auto-hides once every item is complete, without
 * requiring a dismiss. Renders only once entries exist — the
 * zero-entry state is covered by WelcomeScreen instead.
 */
export function GettingStartedCard() {
  const navigate = useNavigate();
  const status = useGettingStartedStatus();
  const [dismissed, setDismissed] = useBooleanSetting(SETTINGS_KEYS.gettingStartedDismissed, false);

  if (dismissed || status === undefined) return null;

  const items: ChecklistItemDef[] = [
    {
      key: 'entry',
      label: 'Add your first entry',
      done: status.hasEntry,
      onClick: () => navigate(ROUTES.addEntry),
    },
    {
      key: 'drive',
      label: 'Connect Google Drive backup',
      description: "Protects your library — it's stored only on this device otherwise.",
      done: status.hasDrive,
      onClick: () => navigate(ROUTES.settings),
    },
    {
      key: 'wishlist',
      label: 'Add something to your Wishlist',
      done: status.hasWishlistItem,
      onClick: () => navigate(ROUTES.addEntry),
    },
    {
      key: 'goal',
      label: 'Set a yearly goal',
      done: status.hasGoal,
      onClick: () => navigate(ROUTES.dashboard),
    },
  ];

  const doneCount = items.filter((item) => item.done).length;
  if (doneCount === items.length) return null;

  const progress = Math.round((doneCount / items.length) * 100);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        px: 2.5,
        py: 2,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Getting started
        </Typography>
        <IconButton
          size="small"
          aria-label="Dismiss getting started checklist"
          onClick={() => setDismissed(true)}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 4, borderRadius: 2, mb: 1.5 }}
      />

      <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
        {items.map((item) => (
          <Box
            key={item.key}
            component="button"
            type="button"
            onClick={item.done ? undefined : item.onClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1,
              border: 'none',
              bgcolor: 'transparent',
              cursor: item.done ? 'default' : 'pointer',
              textAlign: 'left',
              font: 'inherit',
              color: 'inherit',
              width: '100%',
            }}
          >
            <Box
              sx={{
                width: 18,
                height: 18,
                borderRadius: '4px',
                border: '1.5px solid',
                borderColor: item.done ? 'primary.main' : 'divider',
                bgcolor: item.done ? 'primary.main' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {item.done && <CheckIcon sx={{ fontSize: 13, color: 'primary.contrastText' }} />}
            </Box>
            <Box>
              <Typography
                variant="body2"
                sx={{
                  color: item.done ? 'text.secondary' : 'text.primary',
                  textDecoration: item.done ? 'line-through' : 'none',
                }}
              >
                {item.label}
              </Typography>
              {item.description && !item.done && (
                <Typography variant="caption" color="text.secondary">
                  {item.description}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
