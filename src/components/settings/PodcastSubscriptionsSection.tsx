import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import {
  listPodcastSubscriptions,
  removePodcastSubscription,
} from '@/services/database/podcastSubscriptionService';
import { checkAllSubscriptionsForNewEpisodes } from '@/services/podcasts/podcastEpisodeSync';
import { AddPodcastSubscriptionDialog } from './AddPodcastSubscriptionDialog';
import type { PodcastSubscription } from '@/models';

dayjs.extend(relativeTime);

/**
 * Podcast Subscriptions — see chat. Lives in Settings (David's call —
 * he doesn't want the app to feel "podcast first" by giving this its
 * own dedicated screen), under the same roof as every other import
 * source. Checking is manual only: no background/automatic fetching
 * happens anywhere in this app.
 *
 * The subscriptions list is read via `useLiveQuery` rather than
 * manual state + a mount effect — it re-renders on its own whenever
 * `podcastSubscriptions` changes (add, unsubscribe, or a check
 * touching `lastCheckedAt`), so nothing here has to remember to call
 * a `refresh()` after those actions. Matches EditEntryPage.tsx /
 * GoogleDriveSection.tsx's existing use of the same hook.
 */
export function PodcastSubscriptionsSection() {
  const subscriptions = useLiveQuery(() => listPodcastSubscriptions(), [], []);
  const loading = subscriptions === undefined;

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [pendingUnsubscribe, setPendingUnsubscribe] = useState<PodcastSubscription | null>(null);

  const [checking, setChecking] = useState(false);
  const [checkSummary, setCheckSummary] = useState<string | null>(null);
  const [checkErrors, setCheckErrors] = useState<string[]>([]);

  async function handleCheckForNewEpisodes() {
    setChecking(true);
    setCheckSummary(null);
    setCheckErrors([]);
    try {
      const results = await checkAllSubscriptionsForNewEpisodes();
      const totalNew = results.reduce((sum, r) => sum + r.newEpisodeTitles.length, 0);
      const checkedCount = results.length;
      setCheckSummary(
        checkedCount === 0
          ? 'No subscriptions to check yet.'
          : totalNew === 0
            ? `Checked ${checkedCount} subscription${checkedCount === 1 ? '' : 's'} — no new episodes.`
            : `Found ${totalNew} new episode${totalNew === 1 ? '' : 's'} across ${checkedCount} subscription${checkedCount === 1 ? '' : 's'} — added to Wishlist.`,
      );
      setCheckErrors(
        results.filter((r) => r.error).map((r) => `${r.showTitle}: ${r.error}`),
      );
    } finally {
      setChecking(false);
    }
  }

  async function confirmUnsubscribe() {
    if (!pendingUnsubscribe) return;
    await removePodcastSubscription(pendingUnsubscribe.id);
    setPendingUnsubscribe(null);
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Subscribe to a podcast's RSS feed to pull in new episodes as Wishlist entries whenever you
        check — nothing happens automatically in the background.
      </Typography>

      {loading ? (
        <Stack alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size={20} />
        </Stack>
      ) : subscriptions.length === 0 ? (
        <Typography variant="body2" color="text.disabled">
          No subscriptions yet.
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {subscriptions.map((sub) => (
            <Stack
              key={sub.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ py: 0.75 }}
            >
              {sub.showArtworkUrl ? (
                <Box
                  component="img"
                  src={sub.showArtworkUrl}
                  alt=""
                  sx={{ width: 34, height: 34, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1,
                    backgroundColor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <RssFeedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </Box>
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {sub.showTitle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sub.lastCheckedAt ? `Last checked ${dayjs(sub.lastCheckedAt).fromNow()}` : 'Never checked'}
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label={`Unsubscribe from ${sub.showTitle}`}
                onClick={() => setPendingUnsubscribe(sub)}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      )}

      {checkSummary && <Alert severity="success">{checkSummary}</Alert>}
      {checkErrors.map((msg) => (
        <Alert severity="warning" key={msg}>
          {msg}
        </Alert>
      ))}

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => setAddDialogOpen(true)}
          sx={{ textTransform: 'none' }}
        >
          Add Subscription
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => void handleCheckForNewEpisodes()}
          disabled={checking || !subscriptions || subscriptions.length === 0}
          startIcon={checking ? <CircularProgress size={14} /> : undefined}
          sx={{ textTransform: 'none' }}
        >
          Check for New Episodes
        </Button>
      </Stack>

      <AddPodcastSubscriptionDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubscribed={() => {}}
      />

      <Dialog open={!!pendingUnsubscribe} onClose={() => setPendingUnsubscribe(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Unsubscribe?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Unsubscribe from "{pendingUnsubscribe?.showTitle}"? Episodes already in your library are
            kept — this only stops future checks for new episodes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingUnsubscribe(null)}>Cancel</Button>
          <Button color="error" onClick={() => void confirmUnsubscribe()}>
            Unsubscribe
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

