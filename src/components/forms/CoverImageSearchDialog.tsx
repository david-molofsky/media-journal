import { useEffect, useState } from 'react';
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
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  searchCoverImages,
  ImageSearchQuotaError,
  type ImageSearchResult,
} from '@/services/metadata/googleImageSearchService';

interface CoverImageSearchDialogProps {
  open: boolean;
  /** Entry title (plus author/creator when available) — pre-fills the
   * search box and drives the search that runs automatically once,
   * when the dialog opens. */
  defaultQuery: string;
  onClose: () => void;
  /** Called with the chosen image URL — either a selected search
   * result or the pasted URL. The caller writes this to
   * `metadata.coverImagePath` and closes the dialog. */
  onSelect: (url: string) => void;
}

/**
 * "Find cover image" dialog, opened from EntryForm's cover/poster
 * field only when that field is empty (see chat). Two independent
 * ways to end up with an image:
 *   1. Search results — via the Worker's Google Custom Search proxy
 *      (100 free searches/day across the whole app).
 *   2. Paste a URL directly — always available, including once the
 *      daily search quota is exhausted.
 */
export function CoverImageSearchDialog({
  open,
  defaultQuery,
  onClose,
  onSelect,
}: CoverImageSearchDialogProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<ImageSearchResult[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [pasteUrl, setPasteUrl] = useState('');
  const [searching, setSearching] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Reset to a clean slate and run one search automatically each time
  // the dialog opens, so it isn't just an empty search box the person
  // has to trigger themselves — mirrors the wireframe. Wrapped in an
  // async IIFE (same shape as IsbnScanDialog.tsx's camera-start
  // effect) rather than calling setState directly as top-level
  // statements in the effect body.
  useEffect(() => {
    (async () => {
      if (!open) return;
      setQuery(defaultQuery);
      setResults([]);
      setSelectedUrl(null);
      setPasteUrl('');
      setQuotaExceeded(false);
      setSearchError(null);
      if (defaultQuery.trim()) {
        await runSearch(defaultQuery);
      }
    })();
  }, [open, defaultQuery]);

  async function runSearch(searchQuery: string) {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSelectedUrl(null);
    try {
      const found = await searchCoverImages(searchQuery);
      setResults(found);
      if (found.length === 0) setSearchError('No results found.');
    } catch (err) {
      if (err instanceof ImageSearchQuotaError) {
        setQuotaExceeded(true);
      } else {
        setSearchError('Search failed. You can still paste an image URL below.');
      }
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  const handleUse = () => {
    const url = pasteUrl.trim() || selectedUrl;
    if (!url) return;
    onSelect(url);
  };

  const canUse = !!(pasteUrl.trim() || selectedUrl);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Find Cover Image
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void runSearch(query);
                }
              }}
              disabled={quotaExceeded}
              placeholder="Search for an image…"
            />
            <Button
              variant="contained"
              onClick={() => void runSearch(query)}
              disabled={searching || quotaExceeded || !query.trim()}
              startIcon={searching ? <CircularProgress size={14} color="inherit" /> : <SearchIcon fontSize="small" />}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Search
            </Button>
          </Stack>

          {quotaExceeded && (
            <Alert severity="warning">
              Out of image searches for today. You can still paste an image URL below.
            </Alert>
          )}
          {!quotaExceeded && searchError && <Alert severity="info">{searchError}</Alert>}

          {results.length > 0 && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1,
              }}
            >
              {results.map((result) => {
                const selected = selectedUrl === result.url;
                return (
                  <Box
                    key={result.url}
                    onClick={() => {
                      setSelectedUrl(result.url);
                      setPasteUrl('');
                    }}
                    sx={{
                      position: 'relative',
                      aspectRatio: '2 / 3',
                      borderRadius: 1,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: 2,
                      borderColor: selected ? 'primary.main' : 'transparent',
                    }}
                  >
                    <Box
                      component="img"
                      src={result.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {selected && (
                      <CheckCircleIcon
                        fontSize="small"
                        color="primary"
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          backgroundColor: 'background.paper',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                  </Box>
                );
              })}
            </Box>
          )}

          <Divider>
            <Typography variant="caption" color="text.secondary">
              or
            </Typography>
          </Divider>

          <TextField
            size="small"
            fullWidth
            label="Paste an image URL"
            value={pasteUrl}
            onChange={(e) => {
              setPasteUrl(e.target.value);
              if (e.target.value.trim()) setSelectedUrl(null);
            }}
            placeholder="https://…"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleUse} disabled={!canUse}>
          Use Selected Image
        </Button>
      </DialogActions>
    </Dialog>
  );
}
