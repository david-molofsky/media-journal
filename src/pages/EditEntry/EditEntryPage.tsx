import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { useLiveQuery } from 'dexie-react-hooks';
import { useMediaEntry } from '@/hooks/useMediaEntry';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { EntryForm } from '@/components/forms/EntryForm';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import {
  updateEntry,
  deleteEntry,
  duplicateEntry,
  listEntries,
} from '@/services/database/entryService';
import { ROUTES, editEntryPath } from '@/routes/paths';

/**
 * Edit Entry — visually identical to Add Entry, pre-populated, with
 * Delete and Duplicate actions and a list of previous entries sharing
 * the same title (UI & UX Specification, section 7).
 */
export default function EditEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const entry = useMediaEntry(id);
  const mediaTypes = useMediaTypes();
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  const mediaType = mediaTypes.find((type) => type.id === entry.mediaType);
  if (!mediaType) {
    return (
      <PagePlaceholder
        title="Media type unavailable"
        description="This entry's media type has been disabled in Settings, so it can't be edited right now."
      />
    );
  }

  const handleDelete = async () => {
    await deleteEntry(entry.id);
    navigate(ROUTES.library);
  };

  const handleDuplicate = async () => {
    const copy = await duplicateEntry(entry.id);
    navigate(editEntryPath(copy.id));
  };

  return (
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton aria-label="Back to library" onClick={() => navigate(ROUTES.library)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="h1" fontWeight={600}>
          Edit {mediaType.displayName}
        </Typography>
      </Stack>

      <EntryForm
        mediaType={mediaType}
        initialValues={{
          title: entry.title,
          mediaType: entry.mediaType,
          startedDate: entry.startedDate,
          completedDate: entry.completedDate,
          rating: entry.rating,
          notes: entry.notes,
          repeatConsumption: entry.repeatConsumption,
          metadata: entry.metadata,
        }}
        submitLabel="Save Changes"
        onSubmit={async (values) => {
          await updateEntry(entry.id, values);
          navigate(ROUTES.library);
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
    </Box>
  );
}
