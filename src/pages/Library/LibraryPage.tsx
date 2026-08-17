import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useMediaEntries } from '@/hooks/useMediaEntries';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useAvailableYears } from '@/hooks/useAvailableYears';
import { useAvailableTags } from '@/hooks/useAvailableTags';
import { useAvailableGenres } from '@/hooks/useAvailableGenres';
import { useAvailableSources } from '@/hooks/useAvailableSources';
import { FilterChip, type FilterChipOption } from '@/components/library/FilterChip';
import { MultiFilterChip } from '@/components/library/MultiFilterChip';
import { EntryCard } from '@/components/library/EntryCard';
import { SeriesView } from '@/components/library/SeriesView';
import { BulkActionBar } from '@/components/library/BulkActionBar';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import {
  type EntrySortOrder,
  TYPE_SORT_ORDER,
  updateEntryStatus,
  normalizeWishlistOrder,
  swapWishlistOrder,
  jumpWishlistOrder,
} from '@/services/database/entryService';
import { setSetting } from '@/services/database/settingsService';
import { getLibrarySessionState, setLibrarySessionState } from '@/state/pageSessionState';
import { editEntryPath } from '@/routes/paths';
import type { EntryStatus, MediaEntry, MediaType } from '@/models';
import { todayIso } from '@/utils/dateUtils';
import dayjs from 'dayjs';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_OPTIONS: FilterChipOption[] = MONTH_NAMES.map((name, index) => ({ label: name, value: String(index + 1) }));

const SORT_OPTIONS: { label: string; value: EntrySortOrder }[] = [
  { label: 'My Order', value: 'wishlistOrderAsc' },
  { label: 'Newest completion date', value: 'completedDateDesc' },
  { label: 'Oldest completion date', value: 'completedDateAsc' },
  { label: 'Newest start date', value: 'startedDateDesc' },
  { label: 'Oldest start date', value: 'startedDateAsc' },
  { label: 'Alphabetical', value: 'alphabetical' },
  { label: 'Highest rating', value: 'ratingDesc' },
  { label: 'Lowest rating', value: 'ratingAsc' },
  { label: 'Newest added', value: 'createdAtDesc' },
  { label: 'Oldest added', value: 'createdAtAsc' },
  { label: 'By type', value: 'byType' },
];

const DATE_SORTS: EntrySortOrder[] = [
  'completedDateDesc',
  'completedDateAsc',
  'createdAtDesc',
  'createdAtAsc',
  'startedDateDesc',
  'startedDateAsc',
];

/** Wishlist entries have no completion date yet, so "Newest completion
 * date" (the default everywhere else) doesn't make sense there —
 * Wishlist defaults to "My Order" (manual reorder) instead. In
 * Progress entries have no completion date either — they default to
 * "Newest start date" instead (see chat, Aug 2026 — previously fell
 * through to the completedDateDesc default same as Completed, which
 * doesn't produce a real order for entries that have no completedDate
 * at all). Applied whenever the Library lands on or switches to a
 * tab (see the Tabs onChange handler below and the initial `sort`
 * state), not as a one-time default that then behaves like any other
 * tab. */
function defaultSortForStatus(status: EntryStatus): EntrySortOrder {
  if (status === 'wishlist') return 'wishlistOrderAsc';
  if (status === 'in_progress') return 'startedDateDesc';
  return 'completedDateDesc';
}

const STATUS_TABS: { value: EntryStatus; label: string; Icon: typeof CheckCircleOutlineIcon }[] = [
  { value: 'completed', label: 'Completed', Icon: CheckCircleOutlineIcon },
  { value: 'in_progress', label: 'In Progress', Icon: PlayArrowIcon },
  { value: 'wishlist', label: 'Wishlist', Icon: StarBorderIcon },
];

export interface LibraryFilterRequest {
  year?: number;
  month?: number;
  mediaTypeIds?: string[];
  tags?: string[];
  genres?: string[];
  sources?: string[];
  searchText?: string;
  status?: EntryStatus;
}

function buildGroups(
  entries: MediaEntry[],
  sort: EntrySortOrder,
  mediaTypeById: Map<string, MediaType>,
): { header: string; entries: MediaEntry[] }[] | null {
  if (DATE_SORTS.includes(sort)) {
    const map = new Map<string, MediaEntry[]>();
    for (const entry of entries) {
      const dateStr =
        sort === 'createdAtDesc' || sort === 'createdAtAsc'
          ? entry.createdAt
          : sort === 'startedDateDesc' || sort === 'startedDateAsc'
            ? (entry.startedDate ?? entry.createdAt)
            : (entry.completedDate ?? entry.createdAt);
      const key = dayjs(dateStr).format('MMMM YYYY');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return Array.from(map.entries()).map(([header, group]) => ({ header, entries: group }));
  }
  if (sort === 'byType') {
    const map = new Map<string, MediaEntry[]>();
    for (const entry of entries) {
      if (!map.has(entry.mediaType)) map.set(entry.mediaType, []);
      map.get(entry.mediaType)!.push(entry);
    }
    const sortedKeys = Array.from(map.keys()).sort((a, b) => {
      const diff = (TYPE_SORT_ORDER[a] ?? 99) - (TYPE_SORT_ORDER[b] ?? 99);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
    return sortedKeys.map((typeId) => ({
      header: mediaTypeById.get(typeId)?.displayName ?? typeId,
      entries: map.get(typeId)!,
    }));
  }
  return null;
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state as LibraryFilterRequest | null;
  const mediaTypes = useMediaTypes();
  const availableYears = useAvailableYears();
  const availableTags = useAvailableTags();
  const availableGenres = useAvailableGenres();
  const availableSources = useAvailableSources();

  // Restored on mount whenever we arrive without an explicit filter
  // request (an `incoming` navigation, e.g. from Statistics or
  // SeriesView, always wins — that's a fresh, intentional filter, not
  // a "come back to where I was" navigation). See pageSessionState.ts.
  // A lazy useState initializer (not a ref) — it only runs once, on
  // mount, and its result is plain state, safe to read during render.
  const [restored] = useState(() => (incoming ? null : getLibrarySessionState()));

  const [statusTab, setStatusTab] = useState<EntryStatus>(
    incoming?.status ?? restored?.statusTab ?? 'completed',
  );
  const [searchText, setSearchText] = useState(incoming?.searchText ?? restored?.searchText ?? '');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState<string | undefined>(
    incoming?.year ? String(incoming.year) : restored?.year,
  );
  const [month, setMonth] = useState<string | undefined>(
    incoming?.month ? String(incoming.month) : restored?.month,
  );
  const [mediaTypeIds, setMediaTypeIds] = useState<string[]>(
    incoming?.mediaTypeIds ?? restored?.mediaTypeIds ?? [],
  );
  const [tags, setTags] = useState<string[]>(incoming?.tags ?? restored?.tags ?? []);
  const [genres, setGenres] = useState<string[]>(incoming?.genres ?? restored?.genres ?? []);
  const [sources, setSources] = useState<string[]>(incoming?.sources ?? restored?.sources ?? []);
  const [sort, setSort] = useState<EntrySortOrder>(
    incoming
      ? defaultSortForStatus(incoming.status ?? 'completed')
      : (restored?.sort ?? defaultSortForStatus(restored?.statusTab ?? 'completed')),
  );
  const [viewMode, setViewMode] = useState<'entries' | 'series'>(restored?.viewMode ?? 'entries');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reorderMode, setReorderMode] = useState(false);

  // Live scroll position, tracked outside React state (no re-render
  // needed) so the unmount-save effect below always has an up-to-date
  // value to persist, however the user leaves the page.
  const scrollYRef = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Mirrors the latest filter/sort/tab state into a ref after every
  // render (an effect, not a render-time write — refs may only be
  // read/written outside render) so the unmount cleanup below, which
  // only runs once, can still read *current* values at the moment the
  // user actually navigates away rather than a stale mount-time one.
  const liveStateRef = useRef({
    statusTab,
    searchText,
    year,
    month,
    mediaTypeIds,
    tags,
    genres,
    sources,
    sort,
    viewMode,
  });
  useEffect(() => {
    liveStateRef.current = {
      statusTab,
      searchText,
      year,
      month,
      mediaTypeIds,
      tags,
      genres,
      sources,
      sort,
      viewMode,
    };
  });

  useEffect(() => {
    return () => {
      setLibrarySessionState({ ...liveStateRef.current, scrollY: scrollYRef.current });
    };
  }, []);

  // A manual filter/sort/tab/search change resets scroll to the top —
  // the old offset doesn't correspond to anything once the list
  // itself has changed (see chat). Skipped on the very first run so
  // it doesn't fight the restore effect above right after mount.
  const skipNextScrollResetRef = useRef(true);
  useEffect(() => {
    if (skipNextScrollResetRef.current) {
      skipNextScrollResetRef.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [statusTab, searchText, year, month, mediaTypeIds, tags, genres, sources, sort]);

  const hasActiveFilters = Boolean(
    year || month || mediaTypeIds.length > 0 || tags.length > 0 || genres.length > 0 || sources.length > 0 || searchText,
  );

  // Picks up `incoming` on every navigation to this route, not just the
  // first mount. Needed because SeriesView navigates here via
  // `navigate(ROUTES.library, { state })` while already mounted on this
  // same route (Series is a view mode on this page, not a separate
  // route) — React Router doesn't remount for a same-path navigation,
  // so the `useState` initializers below never saw the new state and
  // tapping a series silently did nothing: no search applied, view mode
  // stuck on 'series', no flat list of entries to open.
  //
  // Adjusted during render (rather than in a useEffect, which would
  // call setState synchronously and trip the React Compiler's
  // set-state-in-effect constraint) — the standard React pattern for
  // resetting state when something like a navigation key changes.
  const [handledLocationKey, setHandledLocationKey] = useState(location.key);
  if (location.key !== handledLocationKey) {
    setHandledLocationKey(location.key);
    if (incoming) {
      setSearchText(incoming.searchText ?? '');
      setYear(incoming.year ? String(incoming.year) : undefined);
      setMonth(incoming.month ? String(incoming.month) : undefined);
      setMediaTypeIds(incoming.mediaTypeIds ?? []);
      setTags(incoming.tags ?? []);
      setGenres(incoming.genres ?? []);
      setSources(incoming.sources ?? []);
      setStatusTab(incoming.status ?? 'completed');
      setSort(defaultSortForStatus(incoming.status ?? 'completed'));
      // Arriving via a filter always means "show me a matching entries
      // list", regardless of which view (e.g. Series) was showing
      // before the tap that navigated here.
      setViewMode('entries');
    }
  }

  // Remember whichever tab is active so the bottom-nav Add button can
  // default a new entry to matching status (e.g. tapping Add while on
  // Wishlist starts a new entry already set to Wishlist). Persisted
  // rather than session-only, consistent with lastViewedYear.
  useEffect(() => {
    void setSetting('lastLibraryStatusTab', statusTab);
  }, [statusTab]);

  // Reorder mode now works while filtered/searched (arrows are gated
  // separately, per-card, since swapping visually-adjacent filtered
  // items isn't meaningful against true full-list order — see
  // renderCard below). Still requires Wishlist tab + "My Order" sort.
  const isReordering = reorderMode && statusTab === 'wishlist' && sort === 'wishlistOrderAsc';

  // "Mark finished" dialog
  const [finishEntry, setFinishEntry] = useState<MediaEntry | null>(null);
  const [finishDate, setFinishDate] = useState(todayIso());

  const toggleSelect = (id: string) => setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); } return next; });
  const clearSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const filter = useMemo(() => ({
    year: year ? Number(year) : undefined,
    month: month ? Number(month) : undefined,
    mediaTypeIds,
    searchText,
    tags,
    genres,
    sources,
    status: statusTab,
  }), [year, month, mediaTypeIds, searchText, tags, genres, sources, statusTab]);

  const entries = useMediaEntries(filter, sort);

  // Restores scroll position exactly once, after entries have actually
  // loaded (scrolling before the list has height would just no-op).
  const appliedScrollRestoreRef = useRef(false);
  useEffect(() => {
    (() => {
      if (appliedScrollRestoreRef.current || entries === undefined) return;
      appliedScrollRestoreRef.current = true;
      if (restored) requestAnimationFrame(() => window.scrollTo(0, restored.scrollY));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  // Per-tab counts for badge
  const completedEntries = useMediaEntries({ status: 'completed' }, 'completedDateDesc');
  const inProgressEntries = useMediaEntries({ status: 'in_progress' }, 'createdAtDesc');
  const wishlistEntries = useMediaEntries({ status: 'wishlist' }, 'createdAtDesc');

  // Always the *full*, unfiltered Wishlist in true order — used to
  // resolve each entry's real full-list position for the reorder
  // badge, regardless of whatever filter/search is currently narrowing
  // `entries`. Position numbers must stay meaningful (e.g. "12" means
  // 12th overall) even while filtered, per the search-while-reordering
  // spec — computing them from the filtered array's own index would
  // silently give the wrong number.
  const wishlistOrderedEntries = useMediaEntries({ status: 'wishlist' }, 'wishlistOrderAsc');
  const wishlistPositionById = useMemo(
    () => new Map((wishlistOrderedEntries ?? []).map((e, i) => [e.id, i + 1])),
    [wishlistOrderedEntries],
  );

  const yearOptions = useMemo(() => (availableYears ?? []).map((y) => ({ label: String(y), value: String(y) })), [availableYears]);
  const mediaTypeOptions = useMemo(() => (mediaTypes ?? []).map((t) => ({ label: t.displayName, value: t.id })), [mediaTypes]);
  const tagOptions = useMemo(() => availableTags.map((t) => ({ label: t, value: t })), [availableTags]);
  const genreOptions = useMemo(() => availableGenres.map((g) => ({ label: g, value: g })), [availableGenres]);
  const sourceOptions = useMemo(() => availableSources.map((s) => ({ label: s, value: s })), [availableSources]);

  if (mediaTypes === undefined || entries === undefined) return <LoadingIndicator />;
  const mediaTypeById = new Map(mediaTypes.map((t) => [t.id, t]));
  const groups = viewMode === 'entries' ? buildGroups(entries, sort, mediaTypeById) : null;

  // Select all / Deselect all operates on every entry the current
  // filters + search resolve to — not just whichever group is
  // scrolled into view when sorted by month or by type — since the
  // whole point (per David) is "filter to a given month of films,
  // then select all of them" in one step.
  const allVisibleSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(entries.map((e) => e.id)));
  };

  // Unfiltered total for a tab, regardless of which tab is active.
  const tabTotal = (tab: EntryStatus) => {
    if (tab === 'completed') return completedEntries?.length;
    if (tab === 'in_progress') return inProgressEntries?.length;
    return wishlistEntries?.length;
  };

  // Badge shown on a status tab: the currently active tab reflects
  // active filters/search ("23/142"), since `entries` is already
  // scoped to statusTab. Inactive tabs always show their own
  // unfiltered total — filters are per-tab and don't carry over, so
  // an inactive tab's true filtered count isn't known without running
  // its filters, and showing its unfiltered total avoids implying a
  // filter applies where none has been set for that tab.
  const tabCount = (tab: EntryStatus): { count: number | undefined; filteredOf: number | undefined } => {
    const total = tabTotal(tab);
    if (tab === statusTab && hasActiveFilters) {
      return { count: entries.length, filteredOf: total };
    }
    return { count: total, filteredOf: undefined };
  };

  const handleMarkFinished = async () => {
    if (!finishEntry) return;
    await updateEntryStatus(finishEntry.id, 'completed', finishDate || todayIso());
    setFinishEntry(null);
  };

  const statusPlaceholder = statusTab === 'in_progress'
    ? { title: 'Nothing in progress', description: "Use ▶ In Progress when adding an entry to track what you've started." }
    : statusTab === 'wishlist'
    ? { title: 'Wishlist is empty', description: "Use ★ Wishlist when adding an entry to save things for later." }
    : { title: hasActiveFilters ? 'No matching entries' : 'Start building your Media Journal', description: hasActiveFilters ? 'Try adjusting or clearing your filters.' : "Finished entries will appear here." };

  const currentFilterState: LibraryFilterRequest = {
    year: year ? Number(year) : undefined,
    month: month ? Number(month) : undefined,
    mediaTypeIds,
    tags,
    genres,
    sources,
    searchText,
    status: statusTab,
  };

  const renderCard = (entry: MediaEntry, index: number) => (
    <EntryCard
      key={entry.id}
      entry={entry}
      mediaType={mediaTypeById.get(entry.mediaType)}
      onOpen={() => selectionMode ? toggleSelect(entry.id) : navigate(editEntryPath(entry.id), { state: currentFilterState })}
      selected={selectionMode ? selectedIds.has(entry.id) : undefined}
      onMarkFinished={entry.status !== 'completed' ? () => { setFinishDate(todayIso()); setFinishEntry(entry); } : undefined}
      onStartTracking={entry.status === 'wishlist' ? () => updateEntryStatus(entry.id, 'in_progress') : undefined}
      onMoveToWishlist={entry.status === 'in_progress' ? () => updateEntryStatus(entry.id, 'wishlist') : undefined}
      reorder={
        isReordering
          ? {
              position: wishlistPositionById.get(entry.id) ?? index + 1,
              maxPosition: wishlistOrderedEntries?.length ?? entries.length,
              // Swapping only makes sense against true full-list
              // adjacency — while any filter/search narrows the
              // visible list, visually-adjacent cards aren't
              // necessarily true neighbours, so the arrows are
              // disabled (jump-to-position, which always targets the
              // real full-list position, stays available below).
              onMoveUp: hasActiveFilters
                ? undefined
                : (() => {
                    const prev = entries[index - 1];
                    return prev ? () => void swapWishlistOrder(entry.id, prev.id) : undefined;
                  })(),
              onMoveDown: hasActiveFilters
                ? undefined
                : (() => {
                    const next = entries[index + 1];
                    return next ? () => void swapWishlistOrder(entry.id, next.id) : undefined;
                  })(),
              onJumpToPosition: (newPosition) => void jumpWishlistOrder(entry.id, newPosition),
            }
          : undefined
      }
    />
  );

  return (
    <Box>
      <Tabs
        value={statusTab}
        onChange={(_, v) => { const next = v as EntryStatus; setStatusTab(next); setSort(defaultSortForStatus(next)); setSelectedIds(new Set()); setSelectionMode(false); setReorderMode(false); }}
        // Note: switching tabs deliberately does NOT clear filters —
        // matches existing single-select behavior (filters persisted
        // across tab changes already; unchanged by multi-select).
        //
        // Redesigned from bordered-pill tabs to a thin-divider style
        // (see chat): the default MUI active-tab underline indicator
        // is hidden, and a 1px vertical divider is drawn between each
        // tab instead (via borderRight on all but the last Tab) — no
        // pill borders/backgrounds anywhere. Icons and the count
        // badge are unchanged. The active tab is distinguished purely
        // by MUI's built-in selected-tab text colour (primary) plus a
        // bolder weight added below; no underline.
        sx={{ mb: 2, mx: -2, px: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTabs-indicator': { display: 'none' } }}
        variant="fullWidth"
      >
        {STATUS_TABS.map((tab, index) => {
          const { count, filteredOf } = tabCount(tab.value);
          const isFiltered = filteredOf !== undefined;
          return (
            <Tab
              key={tab.value}
              value={tab.value}
              sx={{
                fontWeight: tab.value === statusTab ? 700 : 400,
                borderRight: index < STATUS_TABS.length - 1 ? 1 : 0,
                borderColor: 'divider',
              }}
              label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <tab.Icon sx={{ fontSize: 16 }} />
                  <span>{tab.label}</span>
                  {count !== undefined && (count > 0 || isFiltered) && (
                    <Box
                      sx={{
                        fontSize: 10, fontWeight: 700,
                        bgcolor: isFiltered ? 'primary.main' : (tab.value === statusTab ? 'primary.main' : 'action.hover'),
                        color: isFiltered ? 'primary.contrastText' : (tab.value === statusTab ? 'primary.contrastText' : 'text.secondary'),
                        border: isFiltered ? '1px solid' : undefined,
                        borderColor: isFiltered ? 'primary.light' : undefined,
                        borderRadius: 10, px: 0.75, py: 0.1, lineHeight: 1.6,
                      }}
                    >
                      {isFiltered ? `${count}/${filteredOf}` : count}
                    </Box>
                  )}
                </Stack>
              }
            />
          );
        })}
      </Tabs>

      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            placeholder="Search by title, author, cast…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            fullWidth size="small"
            slotProps={{
              htmlInput: { ref: searchInputRef },
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: searchText && (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Clear search"
                      size="small"
                      edge="end"
                      onClick={() => {
                        setSearchText('');
                        searchInputRef.current?.focus();
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          {selectionMode && (
            <Button size="small" onClick={toggleSelectAll} sx={{ flexShrink: 0 }}>
              {allVisibleSelected ? 'Deselect all' : 'Select all'}
            </Button>
          )}
          {statusTab === 'wishlist' && sort === 'wishlistOrderAsc' && (
            <Button
              size="small"
              variant={isReordering ? 'contained' : 'outlined'}
              onClick={() => {
                if (!reorderMode) void normalizeWishlistOrder();
                setReorderMode((v) => !v);
              }}
              sx={{ flexShrink: 0 }}
            >
              {isReordering ? 'Done' : 'Reorder'}
            </Button>
          )}
          <Button size="small" variant={selectionMode ? 'contained' : 'outlined'} onClick={() => { setSelectionMode((v) => !v); if (selectionMode) clearSelection(); }} sx={{ flexShrink: 0 }}>
            {selectionMode ? 'Done' : 'Select'}
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
          <FilterChip label="Year" value={year} options={yearOptions} onChange={setYear} />
          <FilterChip label="Month" value={month} options={MONTH_OPTIONS} onChange={setMonth} />
          <MultiFilterChip label="Type" values={mediaTypeIds} options={mediaTypeOptions} onChange={setMediaTypeIds} />
          {sourceOptions.length > 0 && <MultiFilterChip label="Source" values={sources} options={sourceOptions} onChange={setSources} />}
          {genreOptions.length > 0 && <MultiFilterChip label="Genre" values={genres} options={genreOptions} onChange={setGenres} />}
          {tagOptions.length > 0 && <MultiFilterChip label="Tag" values={tags} options={tagOptions} onChange={setTags} />}
        </Stack>

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <ToggleButtonGroup size="small" value={viewMode} exclusive onChange={(_, v) => { if (v) setViewMode(v); }}>
            <ToggleButton value="entries"><ViewListOutlinedIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="series"><BookmarksOutlinedIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select value={sort} onChange={(e) => setSort(e.target.value as EntrySortOrder)}>
              {SORT_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {viewMode === 'series' ? (
        <SeriesView entries={entries} mediaTypes={mediaTypes} />
      ) : entries.length === 0 ? (
        <PagePlaceholder title={statusPlaceholder.title} description={statusPlaceholder.description} />
      ) : groups ? (
        <Stack spacing={3}>
          {groups.map(({ header, entries: groupEntries }) => (
            <Box key={header}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', mb: 1, px: 0.5 }}>{header}</Typography>
              <Stack spacing={1.5}>{groupEntries.map(renderCard)}</Stack>
            </Box>
          ))}
        </Stack>
      ) : (
        <Stack spacing={1.5}>{entries.map(renderCard)}</Stack>
      )}

      {selectionMode && selectedIds.size > 0 && (
        <BulkActionBar selectedIds={Array.from(selectedIds)} onClear={clearSelection} />
      )}

      {/* Mark finished dialog */}
      <Dialog open={Boolean(finishEntry)} onClose={() => setFinishEntry(null)} fullWidth maxWidth="xs">
        <DialogTitle>When did you finish "{finishEntry?.title}"?</DialogTitle>
        <DialogContent>
          <TextField
            label="Completed date"
            type="date"
            fullWidth
            value={finishDate}
            onChange={(e) => setFinishDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinishEntry(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleMarkFinished}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
