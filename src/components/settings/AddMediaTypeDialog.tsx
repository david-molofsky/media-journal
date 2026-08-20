import { useEffect } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { ICON_OPTIONS } from '@/utils/mediaTypeIcon';
import { upsertMediaType } from '@/services/database/mediaTypeService';
import type { MediaType } from '@/models';

const mediaTypeFormSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Required')
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only'),
  displayName: z.string().trim().min(1, 'Required').max(60),
  icon: z.string().min(1, 'Required'),
  colour: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Enter a valid colour'),
  fields: z.array(
    z.object({
      key: z
        .string()
        .trim()
        .min(1, 'Required')
        .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscores only'),
      label: z.string().trim().min(1, 'Required'),
      type: z.enum(['text', 'number', 'date']),
      required: z.boolean(),
    }),
  ),
});

type MediaTypeFormValues = z.infer<typeof mediaTypeFormSchema>;

const DEFAULT_VALUES: MediaTypeFormValues = {
  id: '',
  displayName: '',
  icon: ICON_OPTIONS[0]?.key ?? 'menu_book',
  colour: '#1976D2',
  fields: [],
};

interface AddMediaTypeDialogProps {
  open: boolean;
  existingIds: string[];
  /** When set, the dialog edits this media type instead of creating a
   * new one — pre-filled from its current values, Id locked (entries
   * reference it by id, so it can't be changed), title/button text
   * adjusted accordingly. See chat, Aug 2026. */
  editingType?: MediaType | null;
  onClose: () => void;
  onCreated: (mediaType: MediaType) => void;
}

function valuesFromMediaType(mediaType: MediaType): MediaTypeFormValues {
  return {
    id: mediaType.id,
    displayName: mediaType.displayName,
    icon: mediaType.icon,
    colour: mediaType.colour,
    fields: mediaType.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type === 'number' || f.type === 'date' ? f.type : 'text',
      required: f.required,
    })),
  };
}

/**
 * "Add/Edit media type" form (Settings, Milestone 7). Per Database Schema &
 * Data Model section 5, a new media type is just a new `mediaTypes`
 * row — this form is the UI for writing exactly that row, with no
 * code-level branching for what gets created. Editing an existing
 * custom type (added Aug 2026, see chat) reuses the same form,
 * pre-filled, since `upsertMediaType` is already a `put` — saving
 * with the same id just updates the row in place.
 */
export function AddMediaTypeDialog({
  open,
  existingIds,
  editingType,
  onClose,
  onCreated,
}: AddMediaTypeDialogProps) {
  const isEditing = Boolean(editingType);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<MediaTypeFormValues>({
    resolver: zodResolver(mediaTypeFormSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'fields' });

  useEffect(() => {
    if (open) reset(editingType ? valuesFromMediaType(editingType) : DEFAULT_VALUES);
  }, [open, editingType, reset]);

  const submit = handleSubmit(async (values) => {
    // Id uniqueness only matters when creating — when editing, the id
    // is locked to the type's own existing id, so it's expected to
    // already be present in existingIds.
    if (!isEditing && existingIds.includes(values.id)) {
      setError('id', { message: 'A media type with this id already exists' });
      return;
    }
    const created = await upsertMediaType({ ...values, enabled: editingType?.enabled ?? true });
    onCreated(created);
    onClose();
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isEditing ? 'Edit media type' : 'New media type'}</DialogTitle>
      <Box component="form" onSubmit={submit} noValidate>
        <DialogContent>
          <Stack spacing={2}>
            <TextField
              label="Display name"
              fullWidth
              {...register('displayName')}
              error={Boolean(errors.displayName)}
              helperText={errors.displayName?.message}
            />
            <TextField
              label="Id"
              placeholder="e.g. board-game"
              fullWidth
              disabled={isEditing}
              {...register('id')}
              error={Boolean(errors.id)}
              helperText={
                errors.id?.message ??
                (isEditing
                  ? 'Cannot be changed — entries reference the type by this id'
                  : 'Lowercase, used internally — cannot be changed later')
              }
            />
            <Controller
              name="icon"
              control={control}
              render={({ field }) => (
                <TextField select label="Icon" fullWidth {...field}>
                  {ICON_OPTIONS.map((option) => (
                    <MenuItem key={option.key} value={option.key}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="colour"
              control={control}
              render={({ field }) => (
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                    Accent colour
                  </Typography>
                  <input
                    type="color"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    style={{ width: 40, height: 32, border: 'none', background: 'none' }}
                  />
                </Stack>
              )}
            />

            <Stack spacing={1}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Fields
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    append({ key: '', label: '', type: 'text', required: false })
                  }
                >
                  Add field
                </Button>
              </Stack>
              {fields.map((field, index) => (
                <Stack key={field.id} direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    label="Label"
                    size="small"
                    {...register(`fields.${index}.label`)}
                    error={Boolean(errors.fields?.[index]?.label)}
                  />
                  <TextField
                    label="Key"
                    size="small"
                    {...register(`fields.${index}.key`)}
                    error={Boolean(errors.fields?.[index]?.key)}
                  />
                  <Controller
                    name={`fields.${index}.type`}
                    control={control}
                    render={({ field: typeField }) => (
                      <TextField select label="Type" size="small" {...typeField} sx={{ minWidth: 90 }}>
                        <MenuItem value="text">Text</MenuItem>
                        <MenuItem value="number">Number</MenuItem>
                        <MenuItem value="date">Date</MenuItem>
                      </TextField>
                    )}
                  />
                  <IconButton aria-label="Remove field" onClick={() => remove(index)} sx={{ mt: 0.5 }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
