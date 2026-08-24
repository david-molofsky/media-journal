import { useCallback, useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import { searchBooks, searchBooksPage } from '@/services/metadata/openLibraryService';
import { searchSeries, searchSeriesPage } from '@/services/metadata/comicVineService';
import { searchGoogleBooksPage } from '@/services/metadata/googleBooksService';
import type { SearchResult } from '@/services/metadata/openLibraryService';

interface AddCoverImageDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the pasted-or-picked image URL. The caller writes
   * this to `metadata.coverImagePath` and closes the dialog. */
  onSelect: (url: string) => void;
  /** Book/Audiobook/Comic only get a Search tab (see below) — any
   * other media type renders the Paste URL tab alone, same as before
   * this dialog had search at all. */
  mediaTypeId: string;
  /** Prefilled from the entry's current Title, so the person doesn't
   * have to retype what's already on the form. Still editable here —
   * refining the query doesn't touch the entry's actual title. */
  initialTitle: string;
  /** Prefilled from the entry's current Author field, if any (same
   * narrowing purpose as MetadataSearch's Author field — see chat,
   * Aug 2026). Empty for media types with no Author field. */
  initialAuthor: string;
}

type CoverSource = 'openlibrary' | 'comicvine' | null;

function getCoverSource(mediaTypeId: string): CoverSource {
  if (mediaTypeId === 'book' || mediaTypeId === 'audiobook') return 'openlibrary';
  if (mediaTypeId === 'comic') return 'comicvine';
  return null;
}

/**
 * "Add cover image" dialog, opened from EntryForm's cover/poster field
 * only when that field is empty (see chat). Originally paired a
 * Google Custom Search image grid with a manual paste field, but the
 * search half was dropped (see chat) — Google closed the Custom
 * Search JSON API to new customers/projects in 2024, so a freshly
 * created API key can never work regardless of configuration.
 *
 * Search reintroduced Aug 2026 for Book/Audiobook/Comic, this time via
 * Open Library/ComicVine (already free, no key) with a Google Books
 * fallback for self-published titles those two sources tend to miss —
 * same pattern, same author-narrowing field, same silent cross-source
 * pivot as MetadataSearch.tsx's Title-field search. Unlike
 * MetadataSearch, this is a manual Search button rather than live
 * typeahead: the person is refining an already-known title/author
 * (prefilled from the entry), not typing a title from scratch.
 *
 * Only results carrying a `coverImagePath` are shown — a text-only
 * match is useless in an image-picker grid. Known limitation: Open
 * Library results only include a cover at all when "Auto-fill book
 * cover image" is enabled in Settings > Metadata auto-fill, since this
 * reuses openLibraryService's existing search functions rather than a
 * parallel cover-only code path — worth revisiting if that setting
 * being off turns out to make this tab feel broken rather than just
 * sparse.
 */
export function AddCoverImageDialog({
  open,
  onClose,
  onSelect,
  mediaTypeId,
  initialTitle,
  initialAuthor,
}: AddCoverImageDialogProps) {
  const [tab, setTab] = useState<'search' | 'paste'>('search');
  const [url, setUrl] = useState('');

  const source = getCoverSource(mediaTypeId);

  const [titleQuery, setTitleQuery] = useState(initialTitle);
  const [authorQuery, setAuthorQuery] = useState(initialAuthor);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);

  const requestIdRef = useRef(0);
  const cursorRef = useRef(0);
  const activeSourceRef = useRef<'primary' | 'googlebooks'>('primary');
  const googleBooksCursorRef = useRef(0);

  // Clean slate each time the dialog opens — same IIFE-wrapped effect
  // shape as before (see IsbnScanDialog.tsx's camera-start effect).
  useEffect(() => {
    (() => {
      if (open) {
        setUrl('');
        setTab(source ? 'search' : 'paste');
        setTitleQuery(initialTitle);
        setAuthorQuery(initialAuthor);
        setResults([]);
        setSelectedId(null);
        setSearched(false);
        setHasMore(false);
      }
    })();
  }, [open, source, initialTitle, initialAuthor]);

  const runSearch = useCallback(async () => {
    if (!source || !titleQuery.trim()) return;
    const requestId = ++requestIdRef.current;
    setSearching(true);
    setSearched(true);
    setSelectedId(null);
    activeSourceRef.current = 'primary';
    googleBooksCursorRef.current = 0;
    try {
      const raw =
        source === 'openlibrary'
          ? await searchBooks(titleQuery, authorQuery)
          : await searchSeries(titleQuery);
      if (requestIdRef.current !== requestId) return;
      const withCovers = raw.filter((r) => r.fields.coverImagePath);
      setResults(withCovers);
      cursorRef.current = raw.length;
      setHasMore(raw.length >= 15);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setResults([]);
      setHasMore(false);
    } finally {
      if (requestIdRef.current === requestId) setSearching(false);
    }
  }, [source, titleQuery, authorQuery]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || searching || !source) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    try {
      if (activeSourceRef.current === 'primary') {
        const page =
          source === 'openlibrary'
            ? await searchBooksPage(titleQuery, cursorRef.current, authorQuery)
            : await searchSeriesPage(titleQuery, cursorRef.current);
        if (requestIdRef.current !== requestId) return;
        cursorRef.current += page.results.length;
        setResults((prev) => [...prev, ...page.results.filter((r) => r.fields.coverImagePath)]);
        if (page.hasMore) {
          setHasMore(true);
        } else {
          // Primary exhausted — pivot to Google Books, same continuous
          // scroll as MetadataSearch.tsx (see chat).
          const gbPage = await searchGoogleBooksPage(titleQuery, authorQuery, 0);
          if (requestIdRef.current !== requestId) return;
          activeSourceRef.current = 'googlebooks';
          googleBooksCursorRef.current = gbPage.results.length;
          setResults((prev) => [...prev, ...gbPage.results.filter((r) => r.fields.coverImagePath)]);
          setHasMore(gbPage.hasMore);
        }
      } else {
        const gbPage = await searchGoogleBooksPage(titleQuery, authorQuery, googleBooksCursorRef.current);
        if (requestIdRef.current !== requestId) return;
        googleBooksCursorRef.current += gbPage.results.length;
        setResults((prev) => [...prev, ...gbPage.results.filter((r) => r.fields.coverImagePath)]);
        setHasMore(gbPage.hasMore);
      }
    } catch {
      if (requestIdRef.current !== requestId) return;
      setHasMore(false);
    } finally {
      if (requestIdRef.current === requestId) setLoadingMore(false);
    }
  }, [hasMore, loadingMore, searching, source, titleQuery, authorQuery]);

  const handleGridScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
        void handleLoadMore();
      }
    },
    [handleLoadMore],
  );

  const handleUsePasted = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onSelect(trimmed);
  };

  const handleUseSelected = () => {
    const picked = results.find((r) => r.id === selectedId);
    const cover = picked?.fields.coverImagePath;
    if (cover) onSelect(cover);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Add Cover Image
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {source && (
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ minHeight: 40 }}>
          <Tab value="search" label="Search" sx={{ minHeight: 40 }} />
          <Tab value="paste" label="Paste URL" sx={{ minHeight: 40 }} />
        </Tabs>
      )}

      {tab === 'search' && source ? (
        <>
          <DialogContent>
            <Stack spacing={1.5}>
              <TextField
                size="small"
                fullWidth
                autoFocus
                label="Title"
                value={titleQuery}
                onChange={(e) => setTitleQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
              />
              <TextField
                size="small"
                fullWidth
                label="Author (optional — narrows results)"
                value={authorQuery}
                onChange={(e) => setAuthorQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
              />
              <Button
                variant="outlined"
                onClick={() => void runSearch()}
                disabled={!titleQuery.trim() || searching}
              >
                {searching ? 'Searching…' : 'Search'}
              </Button>

              {searched && !searching && results.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No cover images found — this is common for self-published work. Try the Paste
                  URL tab instead.
                </Typography>
              )}

              {results.length > 0 && (
                <Box
                  onScroll={handleGridScroll}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 1,
                    maxHeight: 320,
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {results.map((r) => (
                    <Box
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: 1,
                        overflow: 'hidden',
                        border: '2px solid',
                        borderColor: selectedId === r.id ? 'primary.main' : 'transparent',
                      }}
                    >
                      <Box
                        component="img"
                        src={r.fields.coverImagePath}
                        alt={r.title}
                        sx={{ width: '100%', aspectRatio: '2 / 3', objectFit: 'cover', display: 'block' }}
                      />
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          px: 0.5,
                          py: 0.25,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.title}
                      </Typography>
                    </Box>
                  ))}
                  {loadingMore && (
                    <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', py: 1 }}>
                      <CircularProgress size={18} />
                    </Box>
                  )}
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleUseSelected} disabled={!selectedId}>
              Use Selected Cover
            </Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Paste a direct link to an image (right-click an image online and choose "Copy
                image address", or similar).
              </Typography>
              <TextField
                size="small"
                fullWidth
                autoFocus={!source}
                label="Image URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUsePasted();
                  }
                }}
                placeholder="https://…"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleUsePasted} disabled={!url.trim()}>
              Use Image
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
