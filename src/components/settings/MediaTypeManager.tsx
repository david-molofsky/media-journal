import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import { useAllMediaTypes } from '@/hooks/useAllMediaTypes';
import { setMediaTypeEnabled } from '@/services/database/mediaTypeService';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { AddMediaTypeDialog } from './AddMediaTypeDialog';

/**
 * Manage Media Types (Settings, Milestone 7). Existing types — built
 * in or custom — can be enabled or disabled; new ones are added via a
 * dedicated form. There's no edit/delete for existing types in v1:
 * disabling a type already removes it from new-entry selection while
 * keeping past entries intact, which covers the common case without
 * the added complexity of rewriting entries that reference a changed
 * or removed type.
 */
export function MediaTypeManager() {
  const mediaTypes = useAllMediaTypes();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Manage media types
        </Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add type
        </Button>
      </Stack>

      <List disablePadding>
        {(mediaTypes ?? []).map((mediaType) => {
          const Icon = getMediaTypeIcon(mediaType.icon);
          return (
            <ListItem
              key={mediaType.id}
              disablePadding
              sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}
              secondaryAction={
                <Switch
                  checked={mediaType.enabled}
                  onChange={(event) => setMediaTypeEnabled(mediaType.id, event.target.checked)}
                  inputProps={{ 'aria-label': `Toggle ${mediaType.displayName}` }}
                />
              }
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon sx={{ color: mediaType.colour }} />
              </ListItemIcon>
              <ListItemText
                primary={mediaType.displayName}
                secondary={`${mediaType.fields.length} field${mediaType.fields.length === 1 ? '' : 's'}`}
              />
            </ListItem>
          );
        })}
      </List>

      <AddMediaTypeDialog
        open={dialogOpen}
        existingIds={(mediaTypes ?? []).map((type) => type.id)}
        onClose={() => setDialogOpen(false)}
        onCreated={() => setDialogOpen(false)}
      />
    </Box>
  );
}
