import { useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMediaEntry } from '@/hooks/useMediaEntry';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useTvTrackingMode } from '@/hooks/useTvTrackingMode';
import { useDefaultEntryStatus } from '@/hooks/useDefaultEntryStatus';
import { EntryForm } from '@/components/forms/EntryForm';
import { ShareEntrySheet } from '@/components/entry/ShareEntrySheet';
import { WishlistRecommendationsSection } from '@/components/entry/WishlistRecommendationsSection';
import { NextInSeriesSection } from '@/components/entry/NextInSeriesSection';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import {
  updateEntry,
  deleteEntry,
  listEntries,
} from '@/services/database/entryService';
import { convertMetadata } from '@/utils/entryConversion';
import { relogButtonLabel } from '@/utils/relogLabel';
import { todayIso } from '@/utils/dateUtils';
import { ROUTES, editEntryPath } from '@/routes/paths';
import type { MediaType, NewMediaEntryInput } from '@/models';
import type { LibraryFilterRequest } from '@/pages/Library/LibraryPage';
import type { RelogNavigationState } from '@/pages/AddEntry/AddEntryPage';

/** Tags starting with this prefix reflect import provenance, not
 * something the user wants carried onto a freshly re-logged entry —
 * see importedFromTag.ts. Re-logging is a manual action, not an
 * import "from" anywhere. */
const IMPORTED_TAG_PREFIX = 'imported from ';

/** Metadata keys that exist per-type but aren't in defaultMediaTypes.ts's
 * `fields[]` (they get bespoke UI in EntryForm — poster thumbnail,
 * cover image, Overview block) yet are still valid, mappable schema
 * keys. Included here so conversion between e.g. Film and TV carries
 * Overview/poster over like any other shared-role field. */
const BESPOKE_FIELD_KEYS: Record<string, { key: string; label: string }[]> = {
  film: [
    { key: 'overview', label: 'Overview' },
    { key: 'posterPath', label: 'Poster' },
    { key: 'imdbUrl', label: 'IMDb link' },
  ],
  tv: [
    { key: 'overview', label: 'Overview' },
    { key: 'posterPath', label: 'Poster' },
    { key: 'imdbUrl', label: 'IMDb link' },
  ],
  comic: [
    { key: 'coverImagePath', label: 'Cover image' },
    { key: 'comicVineVolumeId', label: 'ComicVine link' },
  ],
  book: [{ key: 'coverImagePath', label: 'Cover image' }],
  audiobook: [{ key: 'coverImagePath', label: 'Cover image' }],
};

function metadataFieldsFor(mediaType: MediaType): { key: string; label: string }[] {
  return [...mediaType.fields.map((f) => ({ key: f.key, label: f.label })), ...(BESPOKE_FIELD_KEYS[mediaType.id] ?? [])];
}

/** "A, B and 3 others" once past `max` items, so the convert-confirm
 * summary stays a one-liner even between types with very different
 * field sets (e.g. Book has 4 fields, Comic Issues has 13). */
function formatFieldList(labels: string[], max = 3): string {
  if (labels.length <= max) return labels.join(', ');
  const shown = labels.slice(0, max);
  const rest = labels.length - max;
  return `${shown.join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`;
}

/**
 * Edit Entry — visually identical to Add Entry, pre-populated, with
 * Delete and Duplicate actions and a list of previous entries sharing
 * the same title (UI & UX Specification, section 7).
 */
export default function EditEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // The Library filters/tab that were active when the user tapped into
  // this entry — handed back to Library on every exit path below so
  // Save/Back/Delete all return to the same filtered scenario, not a
  // reset Library. Duplicate deliberately does NOT use this — it takes
  // you to the new copy for editing, not back to Library, so there's
  // nothing to restore.
  const incomingFilters = location.state as LibraryFilterRequest | null;
  const entry = useMediaEntry(id);
  const mediaTypes = useMediaTypes();
  const tvMode = useTvTrackingMode();
  const defaultStatus = useDefaultEntryStatus();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Any type can convert to any other, via a role-based field mapping
  // (src/utils/entryConversion.ts) rather than one-off pairs — see chat.
  // convertMenuAnchor drives the type-picker menu; convertTargetId
  // (once chosen) drives the confirmation dialog with its dynamic
  // carried/renamed/dropped/blank summary.
  const [convertMenuAnchor, setConvertMenuAnchor] = useState<HTMLElement | null>(null);
  const [convertTargetId, setConvertTargetId] = useState<string | null>(null);

  // Derive these unconditionally (before any early returns) so hooks
  // are always called in the same order — Rules of Hooks.
  const rawMediaType = mediaTypes?.find((type) => type.id === entry?.mediaType);
  const effectiveMediaType = useMemo(() => {
    if (!rawMediaType || rawMediaType.id !== 'tv') return rawMediaType;
    return {
      ...rawMediaType,
      fields: rawMediaType.fields.filter((field) =>
        tvMode === 'episode'
          ? true
          : field.key !== 'episodeStart' && field.key !== 'episodeEnd',
      ),
    };
  }, [rawMediaType, tvMode]);

  const previousEntries = useLiveQuery(async () => {
    if (!entry) return [];
    const all = await listEntries({}, 'completedDateDesc');
    return all.filter(
      (candidate) => candidate.id !== entry.id && candidate.title.toLowerCase() === entry.title.toLowerCase(),
    );
  }, [entry?.id, entry?.title]);

  if (!id) {
    return (
      <PagePlaceholder
        title="Entry not found"
        description="This entry may have been deleted. Head back to the Library to find what you're looking for."
      />
    );
  }

  if (mediaTypes === undefined) {
    return <LoadingIndicator />;
  }

  // `useMediaEntry` can't distinguish "still loading" from "no such
  // id" (see hooks/useMediaEntry.ts) — both render the same not-found
  // state here, which in practice means a brief flash on slow devices
  // rather than a stuck spinner on a genuinely missing entry.
  if (entry === undefined) {
    return (
      <PagePlaceholder
        title="Entry not found"
        description="This entry may have been deleted. Head back to the Library to find what you're looking for."
      />
    );
  }

  if (!effectiveMediaType) {
    return (
      <PagePlaceholder
        title="Media type unavailable"
        description="This entry's media type has been disabled in Settings, so it can't be edited right now."
      />
    );
  }

  const handleDelete = async () => {
    await deleteEntry(entry.id);
    navigate(ROUTES.library, { state: incomingFilters });
  };

  // "Log a Rewatch/Reread/Replay" (see chat) — hands core metadata
  // (title, genre, tags, creator/franchise fields, poster/cover) to
  // Add Entry as a pre-fill, same mechanism as the existing shared-link
  // pre-fill. Rating, notes, dates and status deliberately start fresh
  // rather than carrying over — this is a new experience of the thing,
  // not a copy of the old one. repeatConsumption starts true since
  // that's literally what this is. The "imported from X" tag is
  // dropped since re-logging is a manual action, not an import.
  const handleRelog = () => {
    const relogValues: NewMediaEntryInput = {
      title: entry.title,
      mediaType: entry.mediaType,
      status: defaultStatus,
      startedDate: undefined,
      completedDate: defaultStatus === 'completed' ? todayIso() : undefined,
      rating: undefined,
      notes: '',
      repeatConsumption: true,
      tags: (entry.tags ?? []).filter((tag) => !tag.trim().toLowerCase().startsWith(IMPORTED_TAG_PREFIX)),
      genres: entry.genres ?? [],
      metadata: entry.metadata,
    };
    const state: RelogNavigationState = { relogValues };
    navigate(ROUTES.addEntry, { state });
  };

  // Bug fix (kept from the original Book<->Audiobook feature): only
  // offer conversion targets that are currently enabled in Settings >
  // Manage Media Types — `mediaTypes` is already the enabled-only list
  // (useMediaTypes), so filtering against it instead of a hardcoded
  // pair avoids offering a conversion that immediately locks the entry
  // behind "Media type unavailable" (see placeholder above).
  const convertCandidates = mediaTypes.filter((t) => t.id !== entry.mediaType);
  const convertTargetType = convertTargetId ? mediaTypes.find((t) => t.id === convertTargetId) : undefined;

  const conversionPreview =
    rawMediaType && convertTargetType
      ? convertMetadata(
          rawMediaType.id,
          convertTargetType.id,
          entry.metadata,
          metadataFieldsFor(convertTargetType).map((f) => f.key),
        )
      : undefined;

  const sourceFieldLabels = rawMediaType
    ? Object.fromEntries(metadataFieldsFor(rawMediaType).map((f) => [f.key, f.label]))
    : {};
  const targetFieldLabels = convertTargetType
    ? Object.fromEntries(metadataFieldsFor(convertTargetType).map((f) => [f.key, f.label]))
    : {};

  const handleConvert = async () => {
    if (!convertTargetType || !conversionPreview) return;
    await updateEntry(entry.id, { mediaType: convertTargetType.id, metadata: conversionPreview.metadata });
    setConvertTargetId(null);
  };

  return (
    // key={id} forces a full remount when navigating between entries
    // on this same route (e.g. via a Wishlist recommendation or
    // "Previous Entries with This Title") — see chat. Without it,
    // EntryForm's react-hook-form state (seeded from `initialValues`
    // only on mount) stays frozen on the entry that was being edited
    // when the page first mounted, while everything else on the page
    // (header, delete dialog, share sheet) correctly reflects the new
    // one. Remounting also cleanly resets unrelated local state
    // (delete/convert dialogs left open) from the previous entry.
    <Box key={id} sx={{ px: 2, pt: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton aria-label="Back to library" onClick={() => navigate(ROUTES.library, { state: incomingFilters })}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="h1" fontWeight={600}>
          Edit {effectiveMediaType.displayName}
        </Typography>
        <IconButton aria-label="Share entry" onClick={() => setShareOpen(true)}>
          <ShareOutlinedIcon />
        </IconButton>
      </Stack>

      <EntryForm
        mediaType={effectiveMediaType}
        initialValues={{
          title: entry.title,
          mediaType: entry.mediaType,
          status: entry.status ?? 'completed',
          startedDate: entry.startedDate,
          completedDate: entry.completedDate,
          rating: entry.rating,
          notes: entry.notes,
          repeatConsumption: entry.repeatConsumption,
          tags: entry.tags ?? [],
          genres: entry.genres ?? [],
          metadata: entry.metadata,
        }}
        submitLabel="Save Changes"
        stickySubmit
        onSubmit={async (values) => {
          await updateEntry(entry.id, values);
          navigate(ROUTES.library, { state: incomingFilters });
        }}
        secondaryActions={
          <Stack spacing={2}>
            {entry.status !== 'wishlist' && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ReplayIcon />}
                onClick={handleRelog}
              >
                {relogButtonLabel(effectiveMediaType.id)}
              </Button>
            )}

            <NextInSeriesSection entry={entry} />

            <WishlistRecommendationsSection entry={entry} mediaTypes={mediaTypes} />

            <Divider />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              {convertCandidates.length > 0 && (
                <Button
                  startIcon={<SwapHorizIcon />}
                  onClick={(e) => setConvertMenuAnchor(e.currentTarget)}
                  color="inherit"
                >
                  Convert
                </Button>
              )}
              <Button
                startIcon={<DeleteOutlineIcon />}
                onClick={() => setDeleteOpen(true)}
                color="error"
              >
                Delete
              </Button>
            </Stack>

            {previousEntries !== undefined && previousEntries.length > 0 && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Previous Entries with This Title
                </Typography>
                <List dense disablePadding>
                  {previousEntries.map((previous) => (
                    <ListItemButton
                      key={previous.id}
                      onClick={() => navigate(editEntryPath(previous.id))}
                      sx={{ borderRadius: 2 }}
                    >
                      <ListItemText
                        primary={previous.completedDate}
                        secondary={
                          previous.rating !== undefined ? `Rated ${previous.rating}/10` : 'Not rated'
                        }
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            )}
          </Stack>
        }
      />

      <Menu
        anchorEl={convertMenuAnchor}
        open={Boolean(convertMenuAnchor)}
        onClose={() => setConvertMenuAnchor(null)}
      >
        {convertCandidates.map((type) => (
          <MenuItem
            key={type.id}
            onClick={() => {
              setConvertTargetId(type.id);
              setConvertMenuAnchor(null);
            }}
          >
            <ListItemIcon>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: type.colour }} />
            </ListItemIcon>
            <ListItemText>{type.displayName}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={Boolean(convertTargetType)} onClose={() => setConvertTargetId(null)}>
        <DialogTitle>Convert to {convertTargetType?.displayName}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            Title, dates, rating, tags and genres carry over unchanged.
          </DialogContentText>
          {conversionPreview && (
            <Stack spacing={0.75}>
              {conversionPreview.carried.map(({ targetKey }) => (
                <Typography key={targetKey} variant="body2" color="text.secondary">
                  {targetFieldLabels[targetKey] ?? targetKey} carries over as-is
                </Typography>
              ))}
              {conversionPreview.renamed.map(({ targetKey, sourceKey }) => (
                <Typography key={targetKey} variant="body2" color="text.secondary">
                  {sourceFieldLabels[sourceKey] ?? sourceKey} becomes {targetFieldLabels[targetKey] ?? targetKey}
                </Typography>
              ))}
              {conversionPreview.dropped.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {formatFieldList(conversionPreview.dropped.map((key) => sourceFieldLabels[key] ?? key))} won't
                  carry over
                </Typography>
              )}
              {conversionPreview.blank.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {formatFieldList(conversionPreview.blank.map((key) => targetFieldLabels[key] ?? key))} start
                  {conversionPreview.blank.length === 1 ? 's' : ''} blank
                </Typography>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertTargetId(null)}>Cancel</Button>
          <Button onClick={handleConvert}>Convert</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete this entry?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes “{entry.title}” from your library. This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <ShareEntrySheet
        open={shareOpen}
        entry={entry}
        mediaType={effectiveMediaType}
        onClose={() => setShareOpen(false)}
      />
    </Box>
  );
}
