import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import CloseIcon from '@mui/icons-material/Close';
import { searchPodcasts, fetchAndParseFeed, type PodcastSearchResult, type FetchedPodcastFeed } from '@/services/podcasts/podcastFeedService';
import { subscribeToPodcast, type BackCatalogueOption } from '@/services/podcasts/podcastEpisodeSync';

interface AddPodcastSubscriptionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called once a subscription has actually been created, so the
   * parent list can refresh. Not called on plain Cancel. */
  onSubscribed: () => void;
}

type Phase = 'search' | 'loadingFeed' | 'backCatalogue' | 'subscribing';

interface SelectedShow {
  feedUrl: string;
  showTitle?: string;
}

/**
 * Two-step "Add Subscription" flow (see chat):
 *   1. Find a show — search by name (iTunes) or paste an RSS URL
 *      directly.
 *   2. Choose how much of its back-catalogue to import as Wishlist
 *      entries (asked fresh every time, no remembered default).
 */
export function AddPodcastSubscriptionDialog({
  open,
  onClose,
  onSubscribed,
}: AddPodcastSubscriptionDialogProps) {
  const [phase, setPhase] = useState<Phase>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<PodcastSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState('');

  const [selectedShow, setSelectedShow] = useState<SelectedShow | null>(null);
  const [feedPreview, setFeedPreview] = useState<FetchedPodcastFeed | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [backCatalogueType, setBackCatalogueType] = useState<'all' | 'lastN' | 'none'>('lastN');
  const [lastN, setLastN] = useState(5);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  function resetAndClose() {
    setPhase('search');
    setSearchTerm('');
    setResults([]);
    setSearchError(null);
    setPasteUrl('');
    setSelectedShow(null);
    setFeedPreview(null);
    setFeedError(null);
    setBackCatalogueType('lastN');
    setLastN(5);
    setSubscribeError(null);
    onClose();
  }

  async function runSearch() {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchPodcasts(searchTerm);
      setResults(found);
      if (found.length === 0) setSearchError('No shows found.');
    } catch {
      setSearchError('Search failed. You can still paste an RSS feed URL below.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function chooseShow(show: SelectedShow) {
    setSelectedShow(show);
    setPhase('loadingFeed');
    setFeedError(null);
    try {
      const feed = await fetchAndParseFeed(show.feedUrl);
      setFeedPreview(feed);
      setPhase('backCatalogue');
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Couldn't read this feed.");
      setPhase('search');
    }
  }

  async function handleSubscribe() {
    if (!selectedShow || !feedPreview) return;
    setPhase('subscribing');
    setSubscribeError(null);
    const option: BackCatalogueOption =
      backCatalogueType === 'all'
        ? { type: 'all' }
        : backCatalogueType === 'none'
          ? { type: 'none' }
          : { type: 'lastN', n: lastN };
    try {
      await subscribeToPodcast(selectedShow.feedUrl, option, feedPreview);
      onSubscribed();
      resetAndClose();
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : 'Could not subscribe to this show.');
      setPhase('backCatalogue');
    }
  }

  return (
    <Dialog open={open} onClose={resetAndClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {phase === 'backCatalogue' || phase === 'subscribing'
          ? feedPreview?.showTitle ?? 'Add Subscription'
          : 'Add Subscription'}
        <IconButton size="small" onClick={resetAndClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {(phase === 'search' || phase === 'loadingFeed') && (
        <>
          <DialogContent>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void runSearch();
                    }
                  }}
                  placeholder="Search for a show…"
                  disabled={phase === 'loadingFeed'}
                />
                <Button
                  variant="contained"
                  onClick={() => void runSearch()}
                  disabled={searching || phase === 'loadingFeed' || !searchTerm.trim()}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {searching ? <CircularProgress size={16} color="inherit" /> : 'Search'}
                </Button>
              </Stack>

              {searchError && <Alert severity="info">{searchError}</Alert>}
              {feedError && <Alert severity="warning">{feedError}</Alert>}

              {results.length > 0 && (
                <Stack spacing={0.5}>
                  {results.map((result) => (
                    <Box
                      key={result.feedUrl}
                      onClick={() => void chooseShow(result)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1,
                        borderRadius: 1,
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' },
                      }}
                    >
                      {result.artworkUrl && (
                        <Box
                          component="img"
                          src={result.artworkUrl}
                          alt=""
                          sx={{ width: 36, height: 36, borderRadius: 1, objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                      <Typography variant="body2" fontWeight={600}>
                        {result.showTitle}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}

              <Divider>
                <Typography variant="caption" color="text.secondary">
                  or
                </Typography>
              </Divider>

              <TextField
                size="small"
                fullWidth
                label="Paste an RSS feed URL"
                value={pasteUrl}
                onChange={(e) => setPasteUrl(e.target.value)}
                placeholder="https://…"
                disabled={phase === 'loadingFeed'}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={resetAndClose}>Cancel</Button>
            <Button
              variant="contained"
              disabled={!pasteUrl.trim() || phase === 'loadingFeed'}
              onClick={() => void chooseShow({ feedUrl: pasteUrl.trim() })}
              startIcon={phase === 'loadingFeed' ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              Next
            </Button>
          </DialogActions>
        </>
      )}

      {(phase === 'backCatalogue' || phase === 'subscribing') && feedPreview && (
        <>
          <DialogContent>
            <Stack spacing={1.5}>
              <Alert severity="info">
                This show has {feedPreview.episodes.length} episode
                {feedPreview.episodes.length === 1 ? '' : 's'}. How much of the back-catalogue should
                be added to your Wishlist?
              </Alert>
              {subscribeError && <Alert severity="error">{subscribeError}</Alert>}
              <RadioGroup
                value={backCatalogueType}
                onChange={(e) => setBackCatalogueType(e.target.value as 'all' | 'lastN' | 'none')}
              >
                <FormControlLabel value="all" control={<Radio size="small" />} label="Import all episodes" />
                <FormControlLabel
                  value="lastN"
                  control={<Radio size="small" />}
                  label={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2">Import last</Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={lastN}
                        onChange={(e) => setLastN(Math.max(0, Number(e.target.value) || 0))}
                        onClick={(e) => e.stopPropagation()}
                        slotProps={{ htmlInput: { min: 0, max: feedPreview.episodes.length } }}
                        sx={{ width: 72 }}
                      />
                      <Typography variant="body2">episodes</Typography>
                    </Stack>
                  }
                />
                <FormControlLabel value="none" control={<Radio size="small" />} label="Import none — start fresh" />
              </RadioGroup>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={resetAndClose} disabled={phase === 'subscribing'}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSubscribe()}
              disabled={phase === 'subscribing'}
              startIcon={phase === 'subscribing' ? <CircularProgress size={14} color="inherit" /> : undefined}
            >
              Subscribe
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
