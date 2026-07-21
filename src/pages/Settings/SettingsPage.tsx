import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import { DarkModeToggle } from '@/components/settings/DarkModeToggle';
import { TvTrackingSection } from '@/components/settings/TvTrackingSection';
import { TmdbAutofillSection } from '@/components/settings/TmdbAutofillSection';
import { ComicVineAutofillSection } from '@/components/settings/ComicVineAutofillSection';
import { ImportExportSection } from '@/components/settings/ImportExportSection';
import { ImportSourcesSection } from '@/components/settings/ImportSourcesSection';
import { GoogleDriveSection } from '@/components/settings/GoogleDriveSection';
import { MediaTypeManager } from '@/components/settings/MediaTypeManager';
import { RegionSection } from '@/components/settings/RegionSection';
import { MalImportSection } from '@/components/settings/MalImportSection';
import { TraktImportSection } from '@/components/settings/TraktImportSection';

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h6" component="h1" fontWeight={600} sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Stack spacing={4} divider={<Divider />}>
        <GoogleDriveSection />

        {/* General — dark mode + TV tracking grouped together */}
        <Stack spacing={3}>
          <Typography variant="subtitle2" color="text.secondary">
            General
          </Typography>
          <DarkModeToggle />
          <TvTrackingSection />
        </Stack>

        <RegionSection />

        <ImportExportSection />

        {/* Import Data — CSV-based sources plus the two connected-account
            sources (MAL, Trakt), grouped together per the original
            scoping decision (see chat) rather than split apart. */}
        <Stack spacing={3}>
          <ImportSourcesSection />
          <MalImportSection />
          <TraktImportSection />
        </Stack>

        <MediaTypeManager />

        <TmdbAutofillSection />

        <ComicVineAutofillSection />

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
