import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import SourceOutlinedIcon from '@mui/icons-material/SourceOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import RecommendOutlinedIcon from '@mui/icons-material/RecommendOutlined';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import {
  deleteEntries,
  bulkAddTags,
  bulkAddGenres,
  bulkRemoveTags,
  bulkRemoveGenres,
  bulkAddWatchedWith,
  bulkRemoveWatchedWith,
  bulkAddRecommendedBy,
  bulkRemoveRecommendedBy,
  bulkSetRating,
  bulkSetSource,
} from '@/services/database/entryService';
import { TagInput } from '@/components/forms/TagInput';
import { GenreInput } from '@/components/forms/GenreInput';
import { WatchedWithInput } from '@/components/forms/WatchedWithInput';
import { RecommendedByInput } from '@/components/forms/RecommendedByInput';
import { useAvailableSources } from '@/hooks/useAvailableSources';
import { useSelectionFieldCounts } from '@/hooks/useSelectionFieldCounts';
import { useBackfillFlow } from '@/hooks/useBackfillFlow';
import { BackfillDialog } from './BackfillDialog';
import { RemoveFieldSelect } from './RemoveFieldSelect';

type BulkListMode = 'add' | 'remove';

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
}

/**
 * Sticky action bar that appears at the bottom of the Library when one
 * or more entries are selected. Provides Source, Genre, Tag, Rate,
 * Back-fill and Delete actions that apply to all selected entries
 * simultaneously. Button/dialog order mirrors the Source/Genre/Tag
 * filter chips at the top of the Library (see chat, Aug 2026).
 */
export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const [tagOpen, setTagOpen] = useState(false);
  const [tagMode, setTagMode] = useState<BulkListMode>('add');
  const [tagValues, setTagValues] = useState<string[]>([]);
  const [genreOpen, setGenreOpen] = useState(false);
  const [genreMode, setGenreMode] = useState<BulkListMode>('add');
  const [genreValues, setGenreValues] = useState<string[]>([]);
  const [watchedWithOpen, setWatchedWithOpen] = useState(false);
  const [watchedWithMode, setWatchedWithMode] = useState<BulkListMode>('add');
  const [watchedWithValues, setWatchedWithValues] = useState<string[]>([]);
  const [recommendedByOpen, setRecommendedByOpen] = useState(false);
  const [recommendedByMode, setRecommendedByMode] = useState<BulkListMode>('add');
  const [recommendedByValues, setRecommendedByValues] = useState<string[]>([]);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [sourceValue, setSourceValue] = useState('');
  const [rateOpen, setRateOpen] = useState(false);
  const [rateValue, setRateValue] = useState<number>(7);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const backfill = useBackfillFlow();
  const availableSources = useAvailableSources();
  const selectedGenreCounts = useSelectionFieldCounts(selectedIds, 'genres');
  const selectedTagCounts = useSelectionFieldCounts(selectedIds, 'tags');
  const selectedWatchedWithCounts = useSelectionFieldCounts(selectedIds, 'watchedWith');
  const selectedRecommendedByCounts = useSelectionFieldCounts(
    selectedIds,
    'recommendedBy',
  );

  const count = selectedIds.length;

  const handleTag = async () => {
    if (tagValues.length > 0) {
      if (tagMode === 'add') await bulkAddTags(selectedIds, tagValues);
      else await bulkRemoveTags(selectedIds, tagValues);
    }
    setTagOpen(false);
    setTagMode('add');
    setTagValues([]);
    onClear();
  };

  const handleGenre = async () => {
    if (genreValues.length > 0) {
      if (genreMode === 'add') await bulkAddGenres(selectedIds, genreValues);
      else await bulkRemoveGenres(selectedIds, genreValues);
    }
    setGenreOpen(false);
    setGenreMode('add');
    setGenreValues([]);
    onClear();
  };

  const handleWatchedWith = async () => {
    if (watchedWithValues.length > 0) {
      if (watchedWithMode === 'add')
        await bulkAddWatchedWith(selectedIds, watchedWithValues);
      else await bulkRemoveWatchedWith(selectedIds, watchedWithValues);
    }
    setWatchedWithOpen(false);
    setWatchedWithMode('add');
    setWatchedWithValues([]);
    onClear();
  };

  const handleRecommendedBy = async () => {
    if (recommendedByValues.length > 0) {
      if (recommendedByMode === 'add')
        await bulkAddRecommendedBy(selectedIds, recommendedByValues);
      else await bulkRemoveRecommendedBy(selectedIds, recommendedByValues);
    }
    setRecommendedByOpen(false);
    setRecommendedByMode('add');
    setRecommendedByValues([]);
    onClear();
  };

  const handleSource = async () => {
    const trimmed = sourceValue.trim();
    if (trimmed) {
      await bulkSetSource(selectedIds, trimmed);
    }
    setSourceOpen(false);
    setSourceValue('');
    onClear();
  };

  const handleRate = async () => {
    await bulkSetRating(selectedIds, rateValue);
    setRateOpen(false);
    onClear();
  };

  const handleDelete = async () => {
    await deleteEntries(selectedIds);
    setDeleteOpen(false);
    onClear();
  };

  return (
    <>
      <Box
        sx={{
          position: 'fixed',
          bottom: 64, // above bottom nav
          left: 0,
          right: 0,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          px: 2,
          py: 1.5,
          zIndex: (theme) => theme.zIndex.appBar,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <IconButton
          size="small"
          onClick={onClear}
          sx={{ color: 'inherit', flexShrink: 0 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
          {count} selected
        </Typography>
        {/* Scrolls horizontally instead of clipping when all 5 actions
            don't fit the viewport width (e.g. on narrow phones) — see
            chat. Hidden scrollbar keeps it looking like a normal
            button row; a swipe reveals whatever's cut off. */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Button
            size="small"
            startIcon={<SourceOutlinedIcon />}
            onClick={() => setSourceOpen(true)}
            sx={{ color: 'inherit', flexShrink: 0 }}
          >
            Source
          </Button>
          <Button
            size="small"
            startIcon={<CategoryOutlinedIcon />}
            onClick={() => setGenreOpen(true)}
            sx={{ color: 'inherit', flexShrink: 0 }}
          >
            Genre
          </Button>
          <Button
            size="small"
            startIcon={<LocalOfferOutlinedIcon />}
            onClick={() => setTagOpen(true)}
            sx={{ color: 'inherit', flexShrink: 0 }}
          >
            Tag
          </Button>
          <Button
            size="small"
            startIcon={<PeopleOutlineIcon />}
            onClick={() => setWatchedWithOpen(true)}
            sx={{ color: 'inherit', flexShrink: 0 }}
          >
            Watched With
          </Button>
          <Button
            size="small"
            startIcon={<RecommendOutlinedIcon />}
            onClick={() => setRecommendedByOpen(true)}
            sx={{ color: 'inherit', flexShrink: 0 }}
          >
            Recommended
          </Button>
          <Button
            size="small"
            startIcon={<StarOutlineIcon />}
            onClick={() => setRateOpen(true)}
            sx={{ color: 'inherit', flexShrink: 0 }}
          >
            Rate
          </Button>
          <Button
            size="small"
            startIcon={<DownloadOutlinedIcon />}
            onClick={() => void backfill.start(selectedIds)}
            sx={{ color: 'inherit', flexShrink: 0 }}
          >
            Back-fill
          </Button>
          <Button
            size="small"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setDeleteOpen(true)}
            sx={{ color: 'inherit', flexShrink: 0 }}
          >
            Delete
          </Button>
        </Stack>
      </Box>

      {/* Source dialog — sets (overwrites) the same source on every
          selected entry, regardless of media type. Free-solo, with
          suggestions drawn from every source already saved anywhere in
          the library (same list that powers the Source filter chip). */}
      <Dialog
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Set source for {count} {count === 1 ? 'entry' : 'entries'}
        </DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            autoFocus
            options={availableSources}
            value={sourceValue}
            onInputChange={(_, newValue) => setSourceValue(newValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.stopPropagation();
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Source"
                placeholder="e.g. Netflix, Humble Bundle…"
                sx={{ mt: 1 }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSourceOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSource}
            disabled={!sourceValue.trim()}
          >
            Set source
          </Button>
        </DialogActions>
      </Dialog>

      {/* Genre dialog — Add mode merges every entered genre into each
          selected entry's existing genres (nothing removed/replaced).
          Remove mode strips only the chosen genre(s) from entries that
          have them, leaving any other genres on those entries alone —
          see bulkRemoveGenres. Mirrors the Tag dialog below exactly
          (same toggle/interaction model — see chat, Sept 2026). */}
      <Dialog
        open={genreOpen}
        onClose={() => setGenreOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Genres for {count} {count === 1 ? 'entry' : 'entries'}
        </DialogTitle>
        <DialogContent>
          <ToggleButtonGroup
            value={genreMode}
            exclusive
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            onChange={(_, v: BulkListMode | null) => {
              if (!v) return;
              setGenreMode(v);
              setGenreValues([]);
            }}
          >
            <ToggleButton value="add">Add</ToggleButton>
            <ToggleButton value="remove">Remove</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ mt: 1 }}>
            {genreMode === 'add' ? (
              <GenreInput value={genreValues} onChange={setGenreValues} />
            ) : (
              <RemoveFieldSelect
                label="Remove genres"
                placeholder="Search genres present on these entries…"
                options={selectedGenreCounts}
                value={genreValues}
                onChange={setGenreValues}
                totalSelected={count}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGenreOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={genreMode === 'remove' ? 'error' : 'primary'}
            onClick={handleGenre}
            disabled={genreValues.length === 0}
          >
            {genreMode === 'add' ? 'Add genres' : 'Remove genres'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Tag dialog — same Add/Remove pattern as the Genre dialog above. */}
      <Dialog open={tagOpen} onClose={() => setTagOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          Tags for {count} {count === 1 ? 'entry' : 'entries'}
        </DialogTitle>
        <DialogContent>
          <ToggleButtonGroup
            value={tagMode}
            exclusive
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            onChange={(_, v: BulkListMode | null) => {
              if (!v) return;
              setTagMode(v);
              setTagValues([]);
            }}
          >
            <ToggleButton value="add">Add</ToggleButton>
            <ToggleButton value="remove">Remove</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ mt: 1 }}>
            {tagMode === 'add' ? (
              <TagInput value={tagValues} onChange={setTagValues} />
            ) : (
              <RemoveFieldSelect
                label="Remove tags"
                placeholder="Search tags present on these entries…"
                options={selectedTagCounts}
                value={tagValues}
                onChange={setTagValues}
                totalSelected={count}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={tagMode === 'remove' ? 'error' : 'primary'}
            onClick={handleTag}
            disabled={tagValues.length === 0}
          >
            {tagMode === 'add' ? 'Add tags' : 'Remove tags'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Watched With dialog — same Add/Remove pattern as Tag/Genre
          above. Bulk action buttons use fixed generic labels since a
          selection can span mixed media types (see
          companionFieldLabels.ts — the per-type label only applies on
          the entry form/detail, which each show a single type). */}
      <Dialog
        open={watchedWithOpen}
        onClose={() => setWatchedWithOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Watched With for {count} {count === 1 ? 'entry' : 'entries'}
        </DialogTitle>
        <DialogContent>
          <ToggleButtonGroup
            value={watchedWithMode}
            exclusive
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            onChange={(_, v: BulkListMode | null) => {
              if (!v) return;
              setWatchedWithMode(v);
              setWatchedWithValues([]);
            }}
          >
            <ToggleButton value="add">Add</ToggleButton>
            <ToggleButton value="remove">Remove</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ mt: 1 }}>
            {watchedWithMode === 'add' ? (
              <WatchedWithInput
                value={watchedWithValues}
                onChange={setWatchedWithValues}
                label="Watched With"
              />
            ) : (
              <RemoveFieldSelect
                label="Remove names"
                placeholder="Search names present on these entries…"
                options={selectedWatchedWithCounts}
                value={watchedWithValues}
                onChange={setWatchedWithValues}
                totalSelected={count}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWatchedWithOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={watchedWithMode === 'remove' ? 'error' : 'primary'}
            onClick={handleWatchedWith}
            disabled={watchedWithValues.length === 0}
          >
            {watchedWithMode === 'add' ? 'Add names' : 'Remove names'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recommended By dialog — same Add/Remove pattern as Watched
          With above. */}
      <Dialog
        open={recommendedByOpen}
        onClose={() => setRecommendedByOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          Recommended By for {count} {count === 1 ? 'entry' : 'entries'}
        </DialogTitle>
        <DialogContent>
          <ToggleButtonGroup
            value={recommendedByMode}
            exclusive
            size="small"
            fullWidth
            sx={{ mb: 2 }}
            onChange={(_, v: BulkListMode | null) => {
              if (!v) return;
              setRecommendedByMode(v);
              setRecommendedByValues([]);
            }}
          >
            <ToggleButton value="add">Add</ToggleButton>
            <ToggleButton value="remove">Remove</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ mt: 1 }}>
            {recommendedByMode === 'add' ? (
              <RecommendedByInput
                value={recommendedByValues}
                onChange={setRecommendedByValues}
              />
            ) : (
              <RemoveFieldSelect
                label="Remove names"
                placeholder="Search names present on these entries…"
                options={selectedRecommendedByCounts}
                value={recommendedByValues}
                onChange={setRecommendedByValues}
                totalSelected={count}
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecommendedByOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color={recommendedByMode === 'remove' ? 'error' : 'primary'}
            onClick={handleRecommendedBy}
            disabled={recommendedByValues.length === 0}
          >
            {recommendedByMode === 'add' ? 'Add names' : 'Remove names'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rate dialog */}
      <Dialog open={rateOpen} onClose={() => setRateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>
          Rate {count} {count === 1 ? 'entry' : 'entries'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography textAlign="center" variant="h5" fontWeight={700}>
              {rateValue.toFixed(1)}
            </Typography>
            <Slider
              value={rateValue}
              onChange={(_, v) => setRateValue(v as number)}
              min={0}
              max={10}
              step={0.5}
              marks={[0, 2, 4, 6, 8, 10].map((v) => ({ value: v, label: String(v) }))}
              valueLabelDisplay="auto"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRate}>
            Apply rating
          </Button>
        </DialogActions>
      </Dialog>

      {/* Back-fill dialog — Film/TV/Comic/Book. State and async work live in
          useBackfillFlow (started above from the button's onClick);
          this dialog only renders it. onClose after 'done' also clears
          the selection, same as every other bulk action here. */}
      <BackfillDialog
        open={backfill.phase !== 'idle'}
        phase={backfill.phase}
        matches={backfill.matches}
        progress={backfill.progress}
        summary={backfill.summary}
        onPickCandidate={backfill.pickCandidate}
        onSkip={backfill.skipEntry}
        onApply={() => void backfill.applyAll()}
        onClose={() => {
          const finishing = backfill.phase === 'done';
          backfill.reset();
          if (finishing) onClear();
        }}
      />

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>
          Delete {count} {count === 1 ? 'entry' : 'entries'}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes{' '}
            {count === 1 ? 'this entry' : `these ${count} entries`} from your library.
            This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
