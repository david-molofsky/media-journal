import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';

/**
 * Application header.
 *
 * Houses the app title and a quick settings shortcut now; a year
 * selector will be added to the Dashboard header in Milestone 5
 * (UI & UX Specification, section 4).
 */
export function AppHeader() {
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      color="default"
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontWeight: 700 }}>
          Media Journal
        </Typography>
        <IconButton aria-label="Open settings" onClick={() => navigate(ROUTES.settings)}>
          <SettingsOutlinedIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
