import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/services/database/db';
import { SETTINGS_KEYS } from '@/models';
import { ImportSourcesSection } from '@/components/settings/ImportSourcesSection';
import { MalImportSection } from '@/components/settings/MalImportSection';
import { TraktImportSection } from '@/components/settings/TraktImportSection';
import { AudiobookshelfImportSection } from '@/components/settings/AudiobookshelfImportSection';
import { JellyfinImportSection } from '@/components/settings/JellyfinImportSection';
import { PlexImportSection } from '@/components/settings/PlexImportSection';
import { useMalConnected } from '@/hooks/useMalConnected';
import { useTraktConnected } from '@/hooks/useTraktConnected';
import { useAudiobookshelfConnected } from '@/hooks/useAudiobookshelfConnected';
import { useJellyfinConnected } from '@/hooks/useJellyfinConnected';
import { usePlexConnected } from '@/hooks/usePlexConnected';
import type {
  ImportActivityMap,
  ImportActivityRecord,
} from '@/services/importExport/importActivityService';
import type { ImportSource } from '@/services/analytics/importAnalytics';

const SOURCE_LABELS: Record<ImportSource, string> = {
  amazon_prime: 'Amazon Prime Video',
  audiobookshelf: 'Audiobookshelf',
  goodreads: 'Goodreads',
  imdb: 'IMDb',
  jellyfin: 'Jellyfin',
  letterboxd: 'Letterboxd',
  myanimelist: 'MyAnimeList',
  netflix: 'Netflix',
  plex: 'Plex',
  storygraph: 'StoryGraph',
  trakt: 'Trakt',
};

function formatDate(value?: string): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function ActivityCard({ activity }: { activity: ImportActivityRecord }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Typography variant="body2" fontWeight={600}>
          {SOURCE_LABELS[activity.source]}
        </Typography>
        <Chip
          size="small"
          color={
            activity.status === 'error'
              ? 'error'
              : activity.status === 'success'
                ? 'success'
                : 'info'
          }
          label={
            activity.status === 'running'
              ? 'Running'
              : activity.status === 'success'
                ? 'Successful'
                : 'Failed'
          }
        />
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mt: 0.5 }}
      >
        Last successful import: {formatDate(activity.lastSuccessAt)}
      </Typography>
      {activity.itemsImported !== undefined && (
        <Typography variant="caption" color="text.secondary" display="block">
          {activity.itemsImported} {activity.itemsImported === 1 ? 'entry' : 'entries'}{' '}
          imported
        </Typography>
      )}
      {activity.lastError && (
        <Typography variant="caption" color="error" display="block">
          {activity.lastError}
        </Typography>
      )}
    </Paper>
  );
}

export default function IntegrationsPage() {
  const mal = useMalConnected();
  const trakt = useTraktConnected();
  const audiobookshelf = useAudiobookshelfConnected();
  const jellyfin = useJellyfinConnected();
  const plex = usePlexConnected();
  const activity =
    useLiveQuery(async () => {
      const record = await db.appSettings.get(SETTINGS_KEYS.importActivity);
      return (record?.value ?? {}) as ImportActivityMap;
    }, []) ?? {};
  const history = Object.values(activity).filter(
    (record): record is ImportActivityRecord => record !== undefined,
  );
  const connectionCount = [mal, trakt, audiobookshelf, jellyfin, plex].filter(
    Boolean,
  ).length;

  return (
    <Box>
      <Typography variant="h6" component="h1" fontWeight={600}>
        Integrations
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Connect services, import files and see what happened on the last run.
      </Typography>

      <Stack spacing={3} divider={<Divider />}>
        <Box>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Typography variant="subtitle1" fontWeight={600}>
              Connected services
            </Typography>
            <Chip size="small" label={`${connectionCount}/5 connected`} />
          </Stack>
          <Stack spacing={2}>
            <MalImportSection />
            <TraktImportSection />
            <AudiobookshelfImportSection />
            <JellyfinImportSection />
            <PlexImportSection />
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            File imports
          </Typography>
          <ImportSourcesSection />
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Import history
          </Typography>
          {history.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Completed and failed imports will appear here.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {[...history]
                .sort((a, b) => b.lastAttemptAt.localeCompare(a.lastAttemptAt))
                .map((record) => (
                  <ActivityCard key={record.source} activity={record} />
                ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
