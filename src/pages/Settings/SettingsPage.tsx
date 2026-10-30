import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
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
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { useGuidedTour } from '@/tour/GuidedTourContext';
import { DeviceSyncSection } from '@/components/settings/DeviceSyncSection';
import { DataHealthSection } from '@/components/settings/DataHealthSection';
import { Link as RouterLink } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import { db } from '@/services/database/db';
import { SETTINGS_KEYS } from '@/models';

export default function SettingsPage() {
  const { start: startGuidedTour } = useGuidedTour();
  const lastDeviceSyncAt = useLiveQuery(async () => {
    const record = await db.appSettings.get(SETTINGS_KEYS.lastDeviceSyncAt);
    return (record?.value as string) ?? null;
  }, []);
  const syncSubtitle =
    lastDeviceSyncAt === undefined
      ? undefined
      : `Last sync: ${lastDeviceSyncAt ? dayjs(lastDeviceSyncAt).format('D MMM YYYY, HH:mm') : 'Never'}`;

  return (
    <Box>
      <Typography variant="h6" component="h1" fontWeight={600} sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Stack spacing={4} divider={<Divider />}>
        <CollapsibleSection title="Sync" icon={CloudOutlinedIcon} subtitle={syncSubtitle}>
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

        <ListItemButton component={RouterLink} to={ROUTES.reminders} sx={{ px: 0, py: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <NotificationsActiveOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </ListItemIcon>
          <ListItemText
            primary="Reminders"
            secondary="Schedule one-off reminders for things you want to read, watch or listen to."
            primaryTypographyProps={{ variant: 'subtitle2', color: 'text.secondary' }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItemButton>

        <ListItemButton component={RouterLink} to={ROUTES.integrations} sx={{ px: 0, py: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <HubOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </ListItemIcon>
          <ListItemText
            primary="Integrations"
            secondary="Connect accounts, import files and review the outcome of previous imports in one place."
            primaryTypographyProps={{ variant: 'subtitle2', color: 'text.secondary' }}
            secondaryTypographyProps={{ variant: 'caption' }}
          />
        </ListItemButton>

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
