import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import { ImportExportSection } from '@/components/settings/ImportExportSection';
import { MediaTypeManager } from '@/components/settings/MediaTypeManager';

/**
 * Settings — general preferences, import/export, media type
 * management and about info (PRD section 5; UI & UX Specification
 * section 9).
 */
export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h6" component="h1" fontWeight={600} sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Stack spacing={4} divider={<Divider />}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            General
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Media Journal runs entirely offline with no account required. There's nothing to
            configure here yet — theme customisation and other preferences are planned for a
            future release.
          </Typography>
        </Box>

        <ImportExportSection />

        <MediaTypeManager />

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            About
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Media Journal v1.0 — a permanent, offline-first archive of everything you read,
            watch and listen to. Built with React, MUI and Dexie.
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Sync
          </Typography>
          <List disablePadding>
            <ListItem disablePadding sx={{ opacity: 0.5, py: 1 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CloudOutlinedIcon />
              </ListItemIcon>
              <ListItemText
                primary="Multi-device sync"
                secondary="Coming in a future update — your library stays on this device for now."
              />
            </ListItem>
          </List>
        </Box>
      </Stack>
    </Box>
  );
}
