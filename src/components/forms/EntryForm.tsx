import { type ReactNode, useMemo, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { mediaEntrySchema, getMetadataSchema } from '@/services/validation/entrySchemas';
import { comicIssueCount } from '@/utils/comicIssues';
import { todayIso } from '@/utils/dateUtils';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { toTitleCase } from '@/utils/toTitleCase';
import { RatingInput } from './RatingInput';
import { TagInput } from './TagInput';
import { GenreInput } from './GenreInput';
import { MetadataSearch } from './MetadataSearch';
import { AutocompleteField } from './AutocompleteField';
import { hasMetadataSearch } from '@/utils/metadataSearchSupport';
import type { EntryMetadata, EntryStatus, MediaType, NewMediaEntryInput } from '@/models';

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
  /** Status a brand-new entry should start on (ignored when
   * `initialValues` is set, i.e. on Edit Entry). Lets Add Entry default
   * to whichever Library tab — Completed / In Progress / Wishlist —
   * the user came from. Defaults to `'completed'` if omitted. */
  defaultStatus?: EntryStatus;
  submitLabel: string;
  onSubmit: (values: EntryFormValues) => Promise<void>;
  /** Extra actions shown beneath the form — Delete/Duplicate on Edit
   * Entry (UI & UX Specification, section 7). */
  secondaryActions?: ReactNode;
  /** When true, the submit button renders in a footer bar pinned to
   * the bottom of the viewport instead of inline at the end of the
   * form. Used on Edit Entry; Add Entry leaves this off. */
  stickySubmit?: boolean;
}

function emptyMetadata(mediaType: MediaType): EntryMetadata {
  return Object.fromEntries(mediaType.fields.map((field) => [field.key, undefined]));
}

function buildDefaultValues(
  mediaType: MediaType,
  initialValues?: EntryFormValues,
  defaultStatus: EntryStatus = 'completed',
): EntryFormValues {
  return (
    initialValues ?? {
      title: '',
      mediaType: mediaType.id,
      status: defaultStatus,
      startedDate: undefined,
      // Matches the toggle's own onChange behaviour: completedDate only
      // makes sense to pre-fill when starting out as Completed.
      completedDate: defaultStatus === 'completed' ? todayIso() : undefined,
      rating: undefined,
      notes: '',
      repeatConsumption: false,
      tags: [],
      genres: [],
      metadata: emptyMetadata(mediaType),
    }
  );
}

export function EntryForm({
  mediaType,
  initialValues,
  defaultStatus,
  submitLabel,
  onSubmit,
  secondaryActions,
  stickySubmit = false,
}: EntryFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const Icon = getMediaTypeIcon(mediaType.icon);

  const defaultValues = useMemo(
    () => buildDefaultValues(mediaType, initialValues, defaultStatus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaType.id],
  );

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<EntryFormValues>({
    resolver: zodResolver(mediaEntrySchema) as unknown as Resolver<EntryFormValues>,
    defaultValues,
  });

  const status = watch('status') as EntryStatus | undefined;
  const issueStart = watch('metadata.issueStart' as 'metadata');
  const issueEnd = watch('metadata.issueEnd' as 'metadata');
  const episodeStart = watch('metadata.episodeStart' as 'metadata');
  const episodeEnd = watch('metadata.episodeEnd' as 'metadata');
  // Poster only ever renders here, in Edit Entry — never in the Library
  // card or grid (Settings > Metadata auto-fill explains why). Also only
  // relevant for Film/TV, the only types TMDB auto-fill touches.
  const posterPath = watch('metadata.posterPath' as 'metadata');
  const showPoster =
    (mediaType.id === 'film' || mediaType.id === 'tv') && typeof posterPath === 'string' && posterPath;

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
        status: (values.status ?? 'completed') as EntryStatus,
        tags: values.tags ?? [],
        mediaType: mediaType.id,
        metadata: metadataResult.data as EntryMetadata,
      } as NewMediaEntryInput);
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
          {/* Optional metadata search — pre-fills title and type-specific
              fields from Open Library (books) or TMDB (films/TV). The user
              can ignore this and fill the form manually. Autofocused when
              available, since starting a search is the fastest path for
              most entries; Title below falls back to autofocus when no
              search source exists for this media type. */}
          <MetadataSearch
            mediaTypeId={mediaType.id}
            onFill={(title, fields, genres) => {
              setValue('title', toTitleCase(title), { shouldValidate: true });
              for (const [key, value] of Object.entries(fields)) {
                setValue(
                  `metadata.${key}` as 'metadata',
                  toTitleCase(value) as unknown as EntryMetadata,
                );
              }
              if (genres && genres.length > 0) {
                const existing = getValues('genres') ?? [];
                const merged = Array.from(new Set([...existing, ...genres]));
                setValue('genres', merged, { shouldValidate: true });
              }
            }}
          />
          {showPoster && (
            <Box
              component="img"
              src={`https://image.tmdb.org/t/p/w154${posterPath}`}
              alt=""
              sx={{ width: 56, height: 84, borderRadius: 1, objectFit: 'cover', alignSelf: 'flex-start' }}
            />
          )}
          <TextField
            label="Title"
            required
            fullWidth
            autoFocus={!hasMetadataSearch(mediaType.id)}
            {...register('title')}
            onBlur={(event) => {
              setValue('title', toTitleCase(event.target.value), { shouldValidate: true });
            }}
            error={Boolean(errors.title)}
            helperText={errors.title?.message}
          />

          {/* Status toggle — Completed / In Progress / Wishlist. Sits
              right below Title so it's the next thing filled in after
              naming the entry. */}
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <ToggleButtonGroup
                value={field.value ?? 'completed'}
                exclusive
                onChange={(_, v) => {
                  if (!v) return;
                  field.onChange(v);
                  // Clear completedDate when switching away from completed
                  if (v !== 'completed') setValue('completedDate', undefined as unknown as string);
                  // Restore today when switching back to completed
                  if (v === 'completed') setValue('completedDate', todayIso());
                }}
                size="small"
                fullWidth
                aria-label="Entry status"
              >
                <ToggleButton value="completed">✓ Completed</ToggleButton>
                <ToggleButton value="in_progress">▶ In Progress</ToggleButton>
                <ToggleButton value="wishlist">★ Wishlist</ToggleButton>
              </ToggleButtonGroup>
            )}
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
                render={({ field: controllerField, fieldState }) =>
                  field.type === 'autocomplete' ? (
                    <AutocompleteField
                      label={field.label}
                      options={field.options ?? []}
                      required={field.required}
                      value={
                        typeof controllerField.value === 'string' ? controllerField.value : undefined
                      }
                      onChange={(newValue) => controllerField.onChange(newValue)}
                      onBlur={controllerField.onBlur}
                      error={Boolean(fieldState.error)}
                      helperText={fieldState.error?.message}
                    />
                  ) : (
                    <TextField
                      label={field.label}
                      required={field.required}
                      // Deliberately NOT type="number" — native number
                      // inputs have a well-documented mobile Safari bug
                      // where a leading digit can't be backspaced out
                      // once more digits follow it (David hit this on
                      // Season Number). Using a plain text input with a
                      // numeric keyboard hint sidesteps the native
                      // number-input parsing entirely; digit-filtering
                      // below does the actual validation instead.
                      type="text"
                      slotProps={
                        field.type === 'number'
                          ? { htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }
                          : undefined
                      }
                      fullWidth
                      value={controllerField.value ?? ''}
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (field.type === 'number') {
                          const digitsOnly = raw.replace(/[^0-9]/g, '');
                          controllerField.onChange(digitsOnly === '' ? undefined : Number(digitsOnly));
                        } else {
                          controllerField.onChange(raw);
                        }
                      }}
                      onBlur={() => {
                        if (field.type === 'text' && typeof controllerField.value === 'string') {
                          controllerField.onChange(toTitleCase(controllerField.value));
                        }
                        controllerField.onBlur();
                      }}
                      error={Boolean(fieldState.error)}
                      helperText={fieldState.error?.message}
                    />
                  )
                }
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
            {mediaType.id === 'tv' &&
              typeof episodeStart === 'number' &&
              typeof episodeEnd === 'number' &&
              episodeEnd >= episodeStart && (() => {
                const count = (episodeEnd as number) - (episodeStart as number) + 1;
                return (
                  <Alert severity="info" variant="outlined">
                    Episodes {episodeStart}–{episodeEnd} count as {count} episode
                    {count === 1 ? '' : 's'}.
                  </Alert>
                );
              })()}
            {/* Overview sits at the bottom of Media Details, after
                Director/Cast/Source and the new Runtime/Production
                company/Series/Status fields — deliberately not in
                mediaType.fields so it gets a multiline layout instead of
                the generic single-line TextField loop above. */}
            {(mediaType.id === 'film' || mediaType.id === 'tv') && (
              <Controller
                name={'metadata.overview' as 'metadata'}
                control={control}
                render={({ field: controllerField, fieldState }) => (
                  <TextField
                    label="Overview"
                    multiline
                    minRows={3}
                    fullWidth
                    value={typeof controllerField.value === 'string' ? controllerField.value : ''}
                    onChange={(event) => controllerField.onChange(event.target.value)}
                    onBlur={controllerField.onBlur}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            )}
          </Stack>
        )}

        {/* Dates — completedDate only shown for completed; startedDate
            shown for completed and in_progress; hidden for wishlist */}
        {status !== 'wishlist' && (
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
              {status !== 'in_progress' && (
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
              )}
            </Stack>
          </Stack>
        )}

        {(!status || status === 'completed') && (
          <>
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
          </>
        )}

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

        <Controller
          name="tags"
          control={control}
          render={({ field }) => (
            <TagInput value={field.value ?? []} onChange={field.onChange} />
          )}
        />

        <Controller
          name="genres"
          control={control}
          render={({ field }) => (
            <GenreInput value={field.value ?? []} onChange={field.onChange} />
          )}
        />

        {submitError && <Alert severity="error">{submitError}</Alert>}

        {stickySubmit ? (
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              left: 0,
              right: 0,
              mx: -2,
              px: 2,
              py: 1.5,
              pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              bgcolor: 'background.paper',
              borderTop: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
              zIndex: 1,
            }}
          >
            <Button type="submit" variant="contained" size="large" disabled={submitting} fullWidth>
              {submitLabel}
            </Button>
          </Box>
        ) : (
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitLabel}
            </Button>
          </Stack>
        )}

        {secondaryActions}
      </Stack>
    </Box>
  );
}
