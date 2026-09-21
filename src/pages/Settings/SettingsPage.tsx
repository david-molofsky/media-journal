import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PodcastsOutlinedIcon from '@mui/icons-material/PodcastsOutlined';
import { DarkModeToggle } from '@/components/settings/DarkModeToggle';
import { TvTrackingSection } from '@/components/settings/TvTrackingSection';
import { TmdbAutofillSection } from '@/components/settings/TmdbAutofillSection';
import { ComicVineAutofillSection } from '@/components/settings/ComicVineAutofillSection';
import { OpenLibraryAutofillSection } from '@/components/settings/OpenLibraryAutofillSection';
import { ImportExportSection } from '@/components/settings/ImportExportSection';
import { GoogleDriveSection } from '@/components/settings/GoogleDriveSection';
import { MediaTypeManager } from '@/components/settings/MediaTypeManager';
import { RegionSection } from '@/components/settings/RegionSection';
import { SubscriptionsSection } from '@/components/settings/SubscriptionsSection';
import { PodcastSubscriptionsSection } from '@/components/settings/PodcastSubscriptionsSection';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { PwaUpdateSection } from '@/components/settings/PwaUpdateSection';
import Button from '@mui/material/Button';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { useGuidedTour } from '@/tour/GuidedTourContext';
import { DeviceSyncSection } from '@/components/settings/DeviceSyncSection';
import { DataHealthSection } from '@/components/settings/DataHealthSection';
import { Link as RouterLink } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';

export default function SettingsPage() {
  const { start: startGuidedTour } = useGuidedTour();

  return (
    <Box>
      <Typography variant="h6" component="h1" fontWeight={600} sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Stack spacing={4} divider={<Divider />}>
        <CollapsibleSection title="Sync" icon={CloudOutlinedIcon}>
          <DeviceSyncSection />
        </CollapsibleSection>

        <Box data-tour-target="settings-backup">
          <GoogleDriveSection />
        </Box>

        <CollapsibleSection title="General" icon={TuneOutlinedIcon}>
          <Stack spacing={3}>
            <DarkModeToggle />
            <TvTrackingSection />
          </Stack>
        </CollapsibleSection>

        <RegionSection />

        <ImportExportSection />

        <CollapsibleSection title="Integrations" icon={HubOutlinedIcon}>
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography variant="body2" color="text.secondary">
              Connect accounts, import files and review the outcome of previous imports in
              one place.
            </Typography>
            <Button component={RouterLink} to={ROUTES.integrations} variant="outlined">
              Open Integrations
            </Button>
          </Stack>
        </CollapsibleSection>

        <CollapsibleSection title="Data health" icon={FactCheckOutlinedIcon}>
          <DataHealthSection />
        </CollapsibleSection>

        <Box data-tour-target="settings-media-types">
          <MediaTypeManager />
        </Box>

        <TmdbAutofillSection />

        <ComicVineAutofillSection />

        <OpenLibraryAutofillSection />

        {/* Podcast Subscriptions — deliberately just another Settings
            section, not a dedicated screen (David's call — doesn't
            want the app to feel "podcast first"). See chat. */}
        <CollapsibleSection title="Podcasts" icon={PodcastsOutlinedIcon}>
          <PodcastSubscriptionsSection />
        </CollapsibleSection>

        <SubscriptionsSection />

        <CollapsibleSection title="About" icon={InfoOutlinedIcon}>
          <Typography variant="body2" color="text.secondary">
            Media Journal v{__APP_VERSION__} — a permanent, offline-first archive of
            everything you read, watch and listen to. Built with React, MUI and Dexie.
          </Typography>
          <PwaUpdateSection />
        </CollapsibleSection>

        <CollapsibleSection title="Guided Tour" icon={ExploreOutlinedIcon}>
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography variant="body2" color="text.secondary">
              Replay the spotlight walkthrough of the Dashboard, Journal, Add Entry,
              Statistics and Subscriptions pages.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ExploreOutlinedIcon />}
              onClick={() => startGuidedTour()}
            >
              Replay Guided Tour
            </Button>
          </Stack>
        </CollapsibleSection>
      </Stack>
    </Box>
  );
}
