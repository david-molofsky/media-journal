import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import ImportExportOutlinedIcon from '@mui/icons-material/ImportExportOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
import { AudiobookshelfImportSection } from '@/components/settings/AudiobookshelfImportSection';
import { JellyfinImportSection } from '@/components/settings/JellyfinImportSection';
import { PlexImportSection } from '@/components/settings/PlexImportSection';
import { SubscriptionsSection } from '@/components/settings/SubscriptionsSection';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { PwaUpdateSection } from '@/components/settings/PwaUpdateSection';

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h6" component="h1" fontWeight={600} sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Stack spacing={4} divider={<Divider />}>
        <GoogleDriveSection />

        <CollapsibleSection title="General" icon={TuneOutlinedIcon}>
          <Stack spacing={3}>
            <DarkModeToggle />
            <TvTrackingSection />
          </Stack>
        </CollapsibleSection>

        <RegionSection />

        <ImportExportSection />

        {/* Import Data — CSV-based sources plus the two connected-account
            sources (MAL, Trakt), grouped together per the original
            scoping decision (see chat) rather than split apart. */}
        <CollapsibleSection title="Import data" icon={ImportExportOutlinedIcon}>
          <Stack spacing={3}>
            <ImportSourcesSection />
            <MalImportSection />
            <TraktImportSection />
            <AudiobookshelfImportSection />
            <JellyfinImportSection />
            <PlexImportSection />
          </Stack>
        </CollapsibleSection>

        <MediaTypeManager />

        <TmdbAutofillSection />

        <ComicVineAutofillSection />

        <SubscriptionsSection />

        <CollapsibleSection title="About" icon={InfoOutlinedIcon}>
          <Typography variant="body2" color="text.secondary">
            Media Journal v1.0 — a permanent, offline-first archive of everything you
            read, watch and listen to. Built with React, MUI and Dexie.
          </Typography>
          <PwaUpdateSection />
        </CollapsibleSection>

        <CollapsibleSection title="Sync" icon={CloudOutlinedIcon}>
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
        </CollapsibleSection>
      </Stack>
    </Box>
  );
}
