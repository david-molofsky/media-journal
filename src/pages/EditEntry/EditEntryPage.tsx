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
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMediaEntry } from '@/hooks/useMediaEntry';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useTvTrackingMode } from '@/hooks/useTvTrackingMode';
import { EntryForm } from '@/components/forms/EntryForm';
import { ShareEntrySheet } from '@/components/entry/ShareEntrySheet';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import {
  updateEntry,
  deleteEntry,
  duplicateEntry,
  listEntries,
} from '@/services/database/entryService';
import { ROUTES, editEntryPath } from '@/routes/paths';
import type { LibraryFilterRequest } from '@/pages/Library/LibraryPage';

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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Book <-> Audiobook only, per David's request — they share identical
  // fields and the exact same Zod schema (see entrySchemas.ts, where
  // `audiobook: bookMetadataSchema`), so converting never needs to
  // remap or drop anything: it's purely a `mediaType` change.
  const [convertOpen, setConvertOpen] = useState(false);

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

  const handleDuplicate = async () => {
    const copy = await duplicateEntry(entry.id);
    navigate(editEntryPath(copy.id));
  };

  const convertTarget = entry.mediaType === 'book' ? 'audiobook' : entry.mediaType === 'audiobook' ? 'book' : undefined;
  const convertTargetLabel = mediaTypes.find((t) => t.id === convertTarget)?.displayName ?? convertTarget;

  const handleConvert = async () => {
    if (!convertTarget) return;
    await updateEntry(entry.id, { mediaType: convertTarget });
    setConvertOpen(false);
  };

  return (
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
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
            <Divider />
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                startIcon={<ContentCopyIcon />}
                onClick={handleDuplicate}
                color="inherit"
              >
                Duplicate Entry
              </Button>
              {convertTarget && (
                <Button
                  startIcon={<SwapHorizIcon />}
                  onClick={() => setConvertOpen(true)}
                  color="inherit"
                >
                  Convert to {convertTargetLabel}
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

      <Dialog open={convertOpen} onClose={() => setConvertOpen(false)}>
        <DialogTitle>Convert to {convertTargetLabel}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This changes the entry's icon, colour, and grouping in Library and Statistics. Every
            field — Author, Series, Volume, Source, tags, genres, dates, rating — carries over
            unchanged.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertOpen(false)}>Cancel</Button>
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
