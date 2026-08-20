import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import { useAllMediaTypes } from '@/hooks/useAllMediaTypes';
import {
  setMediaTypeEnabled,
  deleteMediaType,
  isDefaultMediaType,
} from '@/services/database/mediaTypeService';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';
import { AddMediaTypeDialog } from './AddMediaTypeDialog';
import type { MediaType } from '@/models';

export function MediaTypeManager() {
  const mediaTypes = useAllMediaTypes();
  const [addOpen, setAddOpen] = useState(false);
  const [editingType, setEditingType] = useState<MediaType | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MediaType | null>(null);

  const handleDelete = async () => {
    if (pendingDelete) {
      await deleteMediaType(pendingDelete.id);
    }
    setPendingDelete(null);
  };

  const enabledCount = (mediaTypes ?? []).filter((mt) => mt.enabled).length;
  const totalCount = (mediaTypes ?? []).length;

  return (
    <CollapsibleSection
      title="Manage media types"
      icon={CategoryOutlinedIcon}
      badge={`${enabledCount}/${totalCount} enabled`}
    >
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add type
        </Button>
      </Stack>

      <List disablePadding>
        {(mediaTypes ?? []).map((mediaType) => {
          const Icon = getMediaTypeIcon(mediaType.icon);
          const isDefault = isDefaultMediaType(mediaType.id);
          return (
            <ListItem
              key={mediaType.id}
              disablePadding
              sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}
              secondaryAction={
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  {isDefault ? (
                    // Spacer so the Switch stays aligned with custom rows
                    <Box sx={{ width: 36 }} />
                  ) : (
                    <>
                      <Tooltip title="Edit type">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${mediaType.displayName}`}
                          onClick={() => setEditingType(mediaType)}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete type">
                        <IconButton
                          size="small"
                          aria-label={`Delete ${mediaType.displayName}`}
                          onClick={() => setPendingDelete(mediaType)}
                          color="error"
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                  <Switch
                    checked={mediaType.enabled}
                    onChange={(event) =>
                      setMediaTypeEnabled(mediaType.id, event.target.checked)
                    }
                    inputProps={{ 'aria-label': `Toggle ${mediaType.displayName}` }}
                  />
                </Stack>
              }
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon sx={{ color: mediaType.colour }} />
              </ListItemIcon>
              <ListItemText
                primary={mediaType.displayName}
                secondary={
                  isDefault
                    ? `Built-in · ${mediaType.fields.length} field${mediaType.fields.length === 1 ? '' : 's'}`
                    : `Custom · ${mediaType.fields.length} field${mediaType.fields.length === 1 ? '' : 's'}`
                }
              />
            </ListItem>
          );
        })}
      </List>

      <AddMediaTypeDialog
        open={addOpen || Boolean(editingType)}
        existingIds={(mediaTypes ?? []).map((type) => type.id)}
        editingType={editingType}
        onClose={() => {
          setAddOpen(false);
          setEditingType(null);
        }}
        onCreated={() => {
          setAddOpen(false);
          setEditingType(null);
        }}
      />

      <Dialog open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)}>
        <DialogTitle>Delete "{pendingDelete?.displayName}"?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes the media type. Existing library entries that use it will
            remain but their type label won't resolve until you recreate the type with the same
            id. This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </CollapsibleSection>
  );
}
