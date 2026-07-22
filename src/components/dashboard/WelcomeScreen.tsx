import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import AddIcon from '@mui/icons-material/Add';
import DevicesOutlinedIcon from '@mui/icons-material/DevicesOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';

interface WelcomeScreenProps {
  onAddEntry: () => void;
  onOpenSettings: () => void;
}

const FEATURES = [
  { icon: DevicesOutlinedIcon, label: 'Track across 10+ media types' },
  { icon: BarChartOutlinedIcon, label: 'See yearly stats build up' },
  { icon: CloudUploadOutlinedIcon, label: 'Back up to Google Drive' },
];

/**
 * First-run onboarding screen — shown in place of the plain "No
 * entries yet" placeholder on the Dashboard, only when
 * hasSeenWelcome hasn't been set yet (see DashboardPage.tsx and
 * SETTINGS_KEYS.hasSeenWelcome). Purely presentational; the caller
 * owns marking it seen and navigation.
 */
export function WelcomeScreen({ onAddEntry, onOpenSettings }: WelcomeScreenProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        minHeight: '60vh',
        justifyContent: 'center',
        gap: 3,
        px: 3,
      }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: '14px',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.16)' : 'primary.light',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AutoStoriesOutlinedIcon color="primary" sx={{ fontSize: 28 }} />
      </Box>

      <Box>
        <Typography variant="h5" component="h1" fontWeight={600} sx={{ mb: 1 }}>
          Welcome to Media Journal
        </Typography>
        <Typography variant="body1" color="text.secondary" maxWidth={360}>
          Your personal record of everything you watch, read and listen to — films, shows,
          books, comics and more, all in one place.
        </Typography>
      </Box>

      <Stack alignItems="center" spacing={1}>
        <IconButton
          onClick={onAddEntry}
          aria-label="Add your first entry"
          sx={{
            width: 64,
            height: 64,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          <AddIcon sx={{ fontSize: 30 }} />
        </IconButton>
        <Typography variant="body1" fontWeight={500}>
          Add your first entry
        </Typography>
      </Stack>

      <Stack direction="row" spacing={3} justifyContent="center" flexWrap="wrap">
        {FEATURES.map(({ icon: Icon, label }) => (
          <Stack key={label} alignItems="center" spacing={0.75} sx={{ width: 96 }}>
            <Icon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              {label}
            </Typography>
          </Stack>
        ))}
      </Stack>

      <Typography variant="caption" color="text.secondary" maxWidth={360}>
        Already have data?{' '}
        <Link component="button" onClick={onOpenSettings} sx={{ verticalAlign: 'baseline' }}>
          Import your library
        </Link>{' '}
        from a variety of sources, or restore a{' '}
        <Link component="button" onClick={onOpenSettings} sx={{ verticalAlign: 'baseline' }}>
          Google Drive backup
        </Link>{' '}
        in Settings.
      </Typography>
    </Box>
  );
}
