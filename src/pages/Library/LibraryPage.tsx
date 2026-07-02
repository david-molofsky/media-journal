import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import SearchIcon from '@mui/icons-material/Search';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useMediaEntries } from '@/hooks/useMediaEntries';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useAvailableYears } from '@/hooks/useAvailableYears';
import { useAvailableTags } from '@/hooks/useAvailableTags';
import { useAvailableSources } from '@/hooks/useAvailableSources';
import { FilterChip, type FilterChipOption } from '@/components/library/FilterChip';
import { EntryCard } from '@/components/library/EntryCard';
import { SeriesView } from '@/components/library/SeriesView';
import { BulkActionBar } from '@/components/library/BulkActionBar';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { type EntrySortOrder, TYPE_SORT_ORDER, updateEntryStatus } from '@/services/database/entryService';
import { setSetting } from '@/services/database/settingsService';
import { editEntryPath } from '@/routes/paths';
import type { EntryStatus, MediaEntry, MediaType } from '@/models';
import { todayIso } from '@/utils/dateUtils';
import dayjs from 'dayjs';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_OPTIONS: FilterChipOption[] = MONTH_NAMES.map((name, index) => ({ label: name, value: String(index + 1) }));

const SORT_OPTIONS: { label: string; value: EntrySortOrder }[] = [
  { label: 'Newest completion date', value: 'completedDateDesc' },
  { label: 'Oldest completion date', value: 'completedDateAsc' },
  { label: 'Alphabetical', value: 'alphabetical' },
  { label: 'Highest rating', value: 'ratingDesc' },
  { label: 'Lowest rating', value: 'ratingAsc' },
  { label: 'Newest added', value: 'createdAtDesc' },
  { label: 'Oldest added', value: 'createdAtAsc' },
  { label: 'By type', value: 'byType' },
];

const DATE_SORTS: EntrySortOrder[] = ['completedDateDesc', 'completedDateAsc', 'createdAtDesc', 'createdAtAsc'];

const STATUS_TABS: { value: EntryStatus; label: string }[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'wishlist', label: 'Wishlist' },
];

export interface LibraryFilterRequest {
  year?: number;
  month?: number;
  mediaType?: string;
  tag?: string;
  source?: string;
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
      const dateStr = sort === 'createdAtDesc' || sort === 'createdAtAsc' ? entry.createdAt : (entry.completedDate ?? entry.createdAt);
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
  const availableSources = useAvailableSources();

  const [statusTab, setStatusTab] = useState<EntryStatus>(incoming?.status ?? 'completed');
  const [searchText, setSearchText] = useState(incoming?.searchText ?? '');
  const [year, setYear] = useState<string | undefined>(incoming?.year ? String(incoming.year) : undefined);
  const [month, setMonth] = useState<string | undefined>(incoming?.month ? String(incoming.month) : undefined);
  const [mediaTypeId, setMediaTypeId] = useState<string | undefined>(incoming?.mediaType);
  const [tag, setTag] = useState<string | undefined>(incoming?.tag);
  const [source, setSource] = useState<string | undefined>(incoming?.source);
  const [sort, setSort] = useState<EntrySortOrder>('completedDateDesc');
  const [viewMode, setViewMode] = useState<'entries' | 'series'>('entries');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Remember whichever tab is active so the bottom-nav Add button can
  // default a new entry to matching status (e.g. tapping Add while on
  // Wishlist starts a new entry already set to Wishlist). Persisted
  // rather than session-only, consistent with lastViewedYear.
  useEffect(() => {
    void setSetting('lastLibraryStatusTab', statusTab);
  }, [statusTab]);

  // "Mark finished" dialog
  const [finishEntry, setFinishEntry] = useState<MediaEntry | null>(null);
  const [finishDate, setFinishDate] = useState(todayIso());

  const toggleSelect = (id: string) => setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); } return next; });
  const clearSelection = () => { setSelectionMode(false); setSelectedIds(new Set()); };

  const filter = useMemo(() => ({
    year: year ? Number(year) : undefined,
    month: month ? Number(month) : undefined,
    mediaType: mediaTypeId,
    searchText,
    tag,
    source,
    status: statusTab,
  }), [year, month, mediaTypeId, searchText, tag, source, statusTab]);

  const entries = useMediaEntries(filter, sort);

  // Per-tab counts for badge
  const completedEntries = useMediaEntries({ status: 'completed' }, 'completedDateDesc');
  const inProgressEntries = useMediaEntries({ status: 'in_progress' }, 'createdAtDesc');
  const wishlistEntries = useMediaEntries({ status: 'wishlist' }, 'createdAtDesc');

  const yearOptions = useMemo(() => (availableYears ?? []).map((y) => ({ label: String(y), value: String(y) })), [availableYears]);
  const mediaTypeOptions = useMemo(() => (mediaTypes ?? []).map((t) => ({ label: t.displayName, value: t.id })), [mediaTypes]);
  const tagOptions = useMemo(() => availableTags.map((t) => ({ label: t, value: t })), [availableTags]);
  const sourceOptions = useMemo(() => availableSources.map((s) => ({ label: s, value: s })), [availableSources]);
  const hasActiveFilters = Boolean(year || month || mediaTypeId || tag || source || searchText);

  if (mediaTypes === undefined || entries === undefined) return <LoadingIndicator />;
  const mediaTypeById = new Map(mediaTypes.map((t) => [t.id, t]));
  const groups = viewMode === 'entries' ? buildGroups(entries, sort, mediaTypeById) : null;

  const tabCount = (tab: EntryStatus) => {
    if (tab === 'completed') return completedEntries?.length;
    if (tab === 'in_progress') return inProgressEntries?.length;
    return wishlistEntries?.length;
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

  const renderCard = (entry: MediaEntry) => (
    <EntryCard
      key={entry.id}
      entry={entry}
      mediaType={mediaTypeById.get(entry.mediaType)}
      onOpen={() => selectionMode ? toggleSelect(entry.id) : navigate(editEntryPath(entry.id))}
      selected={selectionMode ? selectedIds.has(entry.id) : undefined}
      onMarkFinished={entry.status !== 'completed' ? () => { setFinishDate(todayIso()); setFinishEntry(entry); } : undefined}
      onStartTracking={entry.status === 'wishlist' ? () => updateEntryStatus(entry.id, 'in_progress') : undefined}
      onMoveToWishlist={entry.status === 'in_progress' ? () => updateEntryStatus(entry.id, 'wishlist') : undefined}
    />
  );

  return (
    <Box>
      <Tabs
        value={statusTab}
        onChange={(_, v) => { setStatusTab(v as EntryStatus); setSelectedIds(new Set()); setSelectionMode(false); }}
        sx={{ mb: 2, mx: -2, px: 2, borderBottom: 1, borderColor: 'divider' }}
        variant="fullWidth"
      >
        {STATUS_TABS.map((tab) => {
          const count = tabCount(tab.value);
          return (
            <Tab
              key={tab.value}
              value={tab.value}
              label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <span>{tab.label}</span>
                  {count !== undefined && count > 0 && (
                    <Box
                      sx={{
                        fontSize: 10, fontWeight: 700, bgcolor: tab.value === statusTab ? 'primary.main' : 'action.hover',
                        color: tab.value === statusTab ? 'primary.contrastText' : 'text.secondary',
                        borderRadius: 10, px: 0.75, py: 0.1, lineHeight: 1.6,
                      }}
                    >
                      {count}
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
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          />
          <Button size="small" variant={selectionMode ? 'contained' : 'outlined'} onClick={() => { setSelectionMode((v) => !v); if (selectionMode) clearSelection(); }} sx={{ flexShrink: 0 }}>
            {selectionMode ? 'Done' : 'Select'}
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
          <FilterChip label="Year" value={year} options={yearOptions} onChange={setYear} />
          <FilterChip label="Month" value={month} options={MONTH_OPTIONS} onChange={setMonth} />
          <FilterChip label="Type" value={mediaTypeId} options={mediaTypeOptions} onChange={setMediaTypeId} />
          {sourceOptions.length > 0 && <FilterChip label="Source" value={source} options={sourceOptions} onChange={setSource} />}
          {tagOptions.length > 0 && <FilterChip label="Tag" value={tag} options={tagOptions} onChange={setTag} />}
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
