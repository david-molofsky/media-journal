import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useMediaEntries } from '@/hooks/useMediaEntries';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useAvailableYears } from '@/hooks/useAvailableYears';
import { FilterChip, type FilterChipOption } from '@/components/library/FilterChip';
import { EntryCard } from '@/components/library/EntryCard';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { deleteEntry, type EntrySortOrder } from '@/services/database/entryService';
import { editEntryPath } from '@/routes/paths';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_OPTIONS: FilterChipOption[] = MONTH_NAMES.map((name, index) => ({
  label: name,
  value: String(index + 1),
}));

const SORT_OPTIONS: { label: string; value: EntrySortOrder }[] = [
  { label: 'Newest completion date', value: 'completedDateDesc' },
  { label: 'Oldest completion date', value: 'completedDateAsc' },
  { label: 'Alphabetical', value: 'alphabetical' },
  { label: 'Highest rating', value: 'ratingDesc' },
  { label: 'Lowest rating', value: 'ratingAsc' },
];

/**
 * Library — the permanent, searchable archive of every entry (PRD
 * section 5; UI & UX Specification section 5). Search and filters
 * (year, month, media type) combine, sort is independent, and the
 * underlying query is handled by `listEntries`/`useMediaEntries` —
 * this page only manages filter/sort state and renders the results.
 */
export default function LibraryPage() {
  const navigate = useNavigate();
  const mediaTypes = useMediaTypes();
  const availableYears = useAvailableYears();

  const [searchText, setSearchText] = useState('');
  const [year, setYear] = useState<string | undefined>(undefined);
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [mediaTypeId, setMediaTypeId] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<EntrySortOrder>('completedDateDesc');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

  const filter = useMemo(
    () => ({
      year: year ? Number(year) : undefined,
      month: month ? Number(month) : undefined,
      mediaType: mediaTypeId,
      searchText,
    }),
    [year, month, mediaTypeId, searchText],
  );

  const entries = useMediaEntries(filter, sort);

  const yearOptions: FilterChipOption[] = useMemo(
    () => (availableYears ?? []).map((y) => ({ label: String(y), value: String(y) })),
    [availableYears],
  );

  const mediaTypeOptions: FilterChipOption[] = useMemo(
    () => (mediaTypes ?? []).map((type) => ({ label: type.displayName, value: type.id })),
    [mediaTypes],
  );

  const hasActiveFilters = Boolean(year || month || mediaTypeId || searchText);

  if (mediaTypes === undefined || entries === undefined) {
    return <LoadingIndicator />;
  }

  const mediaTypeById = new Map(mediaTypes.map((type) => [type.id, type]));

  return (
    <Box>
      <Stack spacing={2} sx={{ mb: 3 }}>
        <TextField
          placeholder="Search by title…"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          fullWidth
          size="small"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
          <FilterChip label="Year" value={year} options={yearOptions} onChange={setYear} />
          <FilterChip label="Month" value={month} options={MONTH_OPTIONS} onChange={setMonth} />
          <FilterChip
            label="Type"
            value={mediaTypeId}
            options={mediaTypeOptions}
            onChange={setMediaTypeId}
          />
        </Stack>

        <FormControl size="small" sx={{ alignSelf: 'flex-end', minWidth: 220 }}>
          <Select value={sort} onChange={(event) => setSort(event.target.value as EntrySortOrder)}>
            {SORT_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {entries.length === 0 ? (
        <PagePlaceholder
          title={hasActiveFilters ? 'No matching entries' : 'Start building your Media Journal'}
          description={
            hasActiveFilters
              ? 'Try adjusting or clearing your search and filters.'
              : "Entries you've finished will show up here once you add them."
          }
        />
      ) : (
        <Stack spacing={1.5}>
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              mediaType={mediaTypeById.get(entry.mediaType)}
              onOpen={() => navigate(editEntryPath(entry.id))}
              onDelete={() => setPendingDelete({ id: entry.id, title: entry.title })}
            />
          ))}
        </Stack>
      )}

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete this entry?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes “{pendingDelete?.title}” from your library. This can't be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={async () => {
              if (pendingDelete) {
                await deleteEntry(pendingDelete.id);
              }
              setPendingDelete(null);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
