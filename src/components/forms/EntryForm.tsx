import { type ReactNode, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { mediaEntrySchema, getMetadataSchema } from '@/services/validation/entrySchemas';
import { comicIssueCount } from '@/utils/comicIssues';
import { todayIso } from '@/utils/dateUtils';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { RatingInput } from './RatingInput';
import type { EntryMetadata, MediaType, NewMediaEntryInput } from '@/models';

/**
 * Form state matches `NewMediaEntryInput` exactly (rather than a
 * bespoke shape) so the same object can be handed straight to
 * `createEntry`/`updateEntry` without remapping. This is also what
 * keeps this component reusable for a future "To Watch / To Read"
 * list (deferred requirement): that feature only needs
 * `completedDate` to become optional and a different submit target —
 * the form itself, its fields and its validation flow stay the same.
 */
type EntryFormValues = NewMediaEntryInput;

interface EntryFormProps {
  mediaType: MediaType;
  /** Pre-fills the form for Edit Entry. Omit for Add Entry. */
  initialValues?: EntryFormValues;
  submitLabel: string;
  onSubmit: (values: EntryFormValues) => Promise<void>;
  /** Extra actions shown beneath the form — Delete/Duplicate on Edit
   * Entry (UI & UX Specification, section 7). */
  secondaryActions?: ReactNode;
}

function emptyMetadata(mediaType: MediaType): EntryMetadata {
  return Object.fromEntries(mediaType.fields.map((field) => [field.key, undefined]));
}

function buildDefaultValues(mediaType: MediaType, initialValues?: EntryFormValues): EntryFormValues {
  return (
    initialValues ?? {
      title: '',
      mediaType: mediaType.id,
      startedDate: undefined,
      completedDate: todayIso(),
      rating: undefined,
      notes: '',
      repeatConsumption: false,
      metadata: emptyMetadata(mediaType),
    }
  );
}

export function EntryForm({
  mediaType,
  initialValues,
  submitLabel,
  onSubmit,
  secondaryActions,
}: EntryFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const Icon = getMediaTypeIcon(mediaType.icon);

  const defaultValues = useMemo(
    () => buildDefaultValues(mediaType, initialValues),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaType.id],
  );

  const {
    control,
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(mediaEntrySchema),
    defaultValues,
  });

  const issueStart = watch('metadata.issueStart' as 'metadata');
  const issueEnd = watch('metadata.issueEnd' as 'metadata');

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);

    // The common schema validates structure only; metadata is
    // type-specific and checked separately (Database Schema & Data
    // Model, section 7), with any failures surfaced on the relevant
    // dynamic field rather than as a generic error.
    const metadataResult = getMetadataSchema(mediaType.id).safeParse(values.metadata);
    if (!metadataResult.success) {
      for (const issue of metadataResult.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string') {
          setError(`metadata.${key}` as keyof EntryFormValues & string, {
            message: issue.message,
          });
        }
      }
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        mediaType: mediaType.id,
        metadata: metadataResult.data as EntryMetadata,
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Stack spacing={3}>
        <Chip
          icon={<Icon sx={{ color: `${mediaType.colour} !important` }} />}
          label={mediaType.displayName}
          variant="outlined"
          sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
        />

        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">
            General Information
          </Typography>
          <TextField
            label="Title"
            required
            fullWidth
            autoFocus
            {...register('title')}
            error={Boolean(errors.title)}
            helperText={errors.title?.message}
          />
        </Stack>

        {mediaType.fields.length > 0 && (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              Media Details
            </Typography>
            {mediaType.fields.map((field) => (
              <Controller
                key={field.key}
                name={`metadata.${field.key}` as 'metadata'}
                control={control}
                render={({ field: controllerField, fieldState }) => (
                  <TextField
                    label={field.label}
                    required={field.required}
                    type={field.type === 'number' ? 'number' : 'text'}
                    fullWidth
                    value={controllerField.value ?? ''}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (field.type === 'number') {
                        controllerField.onChange(raw === '' ? undefined : Number(raw));
                      } else {
                        controllerField.onChange(raw);
                      }
                    }}
                    onBlur={controllerField.onBlur}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            ))}
            {mediaType.id === 'comic' &&
              typeof issueStart === 'number' &&
              typeof issueEnd === 'number' &&
              issueEnd >= issueStart && (
                <Alert severity="info" variant="outlined">
                  Issues {issueStart}–{issueEnd} count as{' '}
                  {comicIssueCount(issueStart, issueEnd)} issue
                  {comicIssueCount(issueStart, issueEnd) === 1 ? '' : 's'}.
                </Alert>
              )}
          </Stack>
        )}

        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Dates
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Started"
              type="date"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('startedDate')}
              error={Boolean(errors.startedDate)}
              helperText={errors.startedDate?.message}
            />
            <TextField
              label="Completed"
              type="date"
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              {...register('completedDate')}
              error={Boolean(errors.completedDate)}
              helperText={errors.completedDate?.message}
            />
          </Stack>
        </Stack>

        <Divider />

        <Controller
          name="rating"
          control={control}
          render={({ field }) => (
            <RatingInput value={field.value ?? undefined} onChange={field.onChange} />
          )}
        />

        <Controller
          name="repeatConsumption"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Switch checked={field.value} onChange={field.onChange} />}
              label="Re-read / Re-watch"
            />
          )}
        />

        <Stack spacing={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Personal Notes
          </Typography>
          <TextField
            label="Notes"
            multiline
            minRows={3}
            fullWidth
            {...register('notes')}
            error={Boolean(errors.notes)}
            helperText={errors.notes?.message}
          />
        </Stack>

        {submitError && <Alert severity="error">{submitError}</Alert>}

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button type="submit" variant="contained" size="large" disabled={submitting}>
            {submitLabel}
          </Button>
        </Stack>

        {secondaryActions}
      </Stack>
    </Box>
  );
}
