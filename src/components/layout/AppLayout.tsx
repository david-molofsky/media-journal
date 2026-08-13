import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';

const BOTTOM_NAV_HEIGHT = 64;

/**
 * Top-level application shell: header, routed page content, and the
 * persistent bottom navigation bar. Content is centred and width
 * constrained on larger screens, per UI & UX Specification section 12
 * (Responsive Behaviour).
 */
export function AppLayout() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppHeader />
      <Box
        component="main"
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 960,
          mx: 'auto',
          px: { xs: 2, sm: 3 },
          py: 3,
          pb: `${BOTTOM_NAV_HEIGHT + 24}px`,
        }}
      >
        <Outlet />
        <Box
          component="footer"
          sx={{
            mt: 4,
            pt: 2,
            textAlign: 'center',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Media Journal — a permanent, offline-first archive of everything you read, watch and
            listen to.{' '}
            <Typography
              component="a"
              href={`${import.meta.env.BASE_URL}privacy.html`}
              variant="caption"
              color="primary"
              sx={{ textDecoration: 'none' }}
            >
              Privacy Policy
            </Typography>
          </Typography>
        </Box>
      </Box>
      <BottomNav />
    </Box>
  );
}
