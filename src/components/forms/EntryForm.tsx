import { type ReactNode, useEffect, useMemo, useState } from 'react';
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
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import CachedOutlinedIcon from '@mui/icons-material/CachedOutlined';
import { mediaEntrySchema, getMetadataSchema } from '@/services/validation/entrySchemas';
import { getIssueDetails } from '@/services/metadata/comicVineService';
import {
  reSearchEntry,
  hasReSearch,
  reSearchSourceLabel,
} from '@/services/metadata/reSearchService';
import { computeReSearchDiffs, type ReSearchDiffSet } from '@/utils/reSearchDiff';
import type { ReSearchResult } from '@/services/metadata/reSearchService';
import { comicIssueCount } from '@/utils/comicIssues';
import { todayIso, isMoreThanSixMonthsAgo } from '@/utils/dateUtils';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { toTitleCase } from '@/utils/toTitleCase';
import { RatingInput } from './RatingInput';
import { TagInput } from './TagInput';
import { EntryDatePicker } from './EntryDatePicker';
import { GenreInput } from './GenreInput';
import { WatchedWithInput } from './WatchedWithInput';
import { RecommendedByInput } from './RecommendedByInput';
import { watchedWithLabel } from '@/utils/companionFieldLabels';
import { MetadataSearch } from './MetadataSearch';
import { IsbnScanDialog } from './IsbnScanDialog';
import { UpcScanDialog } from './UpcScanDialog';
import { ComicUpcScanDialog } from './ComicUpcScanDialog';
import { AddCoverImageDialog } from './AddCoverImageDialog';
import { AutocompleteField } from './AutocompleteField';
import { ReSearchDialog } from './ReSearchDialog';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { hasMetadataSearch } from '@/utils/metadataSearchSupport';
import { FIELD_PAIRS } from '@/utils/fieldPairs';
import { hasIsbnScan, isIsbnScanAvailable } from '@/utils/isbnScanSupport';
import { hasUpcScan, isUpcScanAvailable } from '@/utils/upcScanSupport';
import type {
  EntryMetadata,
  EntryStatus,
  FieldDefinition,
  MediaType,
  NewMediaEntryInput,
} from '@/models';

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
      watchedWith: [],
      recommendedBy: [],
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
  // Raw, in-progress text for `type: 'number'` metadata fields while the
  // user is actively editing them — see the Controller render below for why.
  const [numberFieldDrafts, setNumberFieldDrafts] = useState<Record<string, string>>({});
  // Carries the ComicVine series id from the search step (MetadataSearch)
  // to the later "Fetch issue details" step below. Persisted on the
  // entry itself too now (see entrySchemas.ts comment) for the shared
  // "add to journal" link — this local copy remains the source of truth
  // while the form is open, seeded from the saved value on edit so
  // "Fetch issue details" keeps working after reopening a comic entry.
  const [comicVineVolumeId, setComicVineVolumeId] = useState<string | null>(
    (initialValues?.metadata?.comicVineVolumeId as string | undefined) ?? null,
  );
  const [fetchingIssueDetails, setFetchingIssueDetails] = useState(false);
  const [issueFetchError, setIssueFetchError] = useState<string | null>(null);
  // Whether the most recently auto-filled `pageCount` is a
  // cross-edition median (Open Library title search) rather than an
  // exact per-edition count (ISBN lookup, Google Books) — purely a
  // this-session display hint for the helper text below the Page
  // Count field, never persisted. Resets to false on any fill that
  // doesn't carry the sentinel, e.g. re-searching and landing on an
  // ISBN match after an initial title-search match. See chat, Sept
  // 2026 — Longest Book backlog follow-up.
  const [pageCountApprox, setPageCountApprox] = useState(false);
  const Icon = getMediaTypeIcon(mediaType.icon);

  // ISBN barcode scanning (Book/Audiobook/Comic only) — see
  // isbnScanSupport.ts. Availability is resolved asynchronously since
  // BarcodeDetector.getSupportedFormats() itself returns a Promise;
  // the button stays hidden until this resolves true, rather than
  // showing then disappearing.
  const [scanAvailable, setScanAvailable] = useState(false);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  useEffect(() => {
    if (!hasIsbnScan(mediaType.id)) return;
    (async () => {
      setScanAvailable(await isIsbnScanAvailable());
    })();
  }, [mediaType.id]);

  // UPC barcode scanning (Film only, for now — see upcScanSupport.ts).
  // Deliberately separate state/effect from the ISBN scan above rather
  // than merged into one generic "scan" flag: the two never apply to
  // the same media type today, but Comics UPC scanning (single issues)
  // is a separate backlog item that would need both buttons available
  // simultaneously on the Comic form once it lands.
  const [upcScanAvailable, setUpcScanAvailable] = useState(false);
  const [upcScanDialogOpen, setUpcScanDialogOpen] = useState(false);
  useEffect(() => {
    if (!hasUpcScan(mediaType.id)) return;
    (async () => {
      setUpcScanAvailable(await isUpcScanAvailable());
    })();
  }, [mediaType.id]);

  // "Re-search" (Edit Entry only — see chat, Aug 2026): re-runs the
  // per-type metadata search using the entry's current title + role
  // fields (reSearchEntry, entryConversion.ts's fieldRolesFor) and
  // offers to update only whichever fields actually differ from what's
  // already saved. Never shown on Add Entry — MetadataSearch above
  // already covers that case there.
  const reSearchAvailable = Boolean(initialValues) && hasReSearch(mediaType.id);
  const [reSearchDialogOpen, setReSearchDialogOpen] = useState(false);
  const [reSearching, setReSearching] = useState(false);
  const [reSearchError, setReSearchError] = useState<string | null>(null);
  const [reSearchResult, setReSearchResult] = useState<ReSearchResult | null>(null);
  const [reSearchDiffSet, setReSearchDiffSet] = useState<ReSearchDiffSet | null>(null);
  const [reSearchSelectedKeys, setReSearchSelectedKeys] = useState<Set<string>>(
    new Set(),
  );
  const [reSearchToast, setReSearchToast] = useState<string | null>(null);

  const handleReSearch = async () => {
    setReSearchDialogOpen(true);
    setReSearching(true);
    setReSearchError(null);
    setReSearchResult(null);
    setReSearchDiffSet(null);
    try {
      const title = getValues('title') ?? '';
      const metadata = (getValues('metadata') ?? {}) as Record<string, unknown>;
      const result = await reSearchEntry(mediaType.id, title, metadata);
      if (!result) {
        setReSearchDialogOpen(false);
        setReSearchToast('No match found.');
        return;
      }
      const genres = getValues('genres') ?? [];
      const diffs = computeReSearchDiffs(mediaType, title, metadata, genres, result);
      if (!diffs.hasDiffs) {
        setReSearchDialogOpen(false);
        setReSearchToast('Already up to date — no changes found.');
        return;
      }
      const initialSelected = new Set<string>();
      if (diffs.titleDiff) initialSelected.add('title');
      diffs.fieldDiffs.forEach((diff) => initialSelected.add(diff.key));
      if (diffs.genreAdds.length > 0) initialSelected.add('genres');
      setReSearchResult(result);
      setReSearchDiffSet(diffs);
      setReSearchSelectedKeys(initialSelected);
    } catch {
      setReSearchError("Couldn't reach the source — try again in a moment.");
    } finally {
      setReSearching(false);
    }
  };

  const handleToggleReSearchKey = (key: string) => {
    setReSearchSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCancelReSearch = () => {
    setReSearchDialogOpen(false);
    setReSearchResult(null);
    setReSearchDiffSet(null);
    setReSearchError(null);
  };

  const handleApplyReSearch = () => {
    if (!reSearchResult || !reSearchDiffSet) return;
    if (reSearchDiffSet.titleDiff && reSearchSelectedKeys.has('title')) {
      setValue('title', reSearchDiffSet.titleDiff.newValue, { shouldValidate: true });
    }
    const visibleKeys = new Set(mediaType.fields.map((f) => f.key));
    for (const [key, value] of Object.entries(reSearchResult.fields)) {
      // comicVineVolumeId rides along purely to reach the later "Fetch
      // issue details" step — same handling as applyMetadataFill, and
      // now also persisted into form metadata for the same reason.
      if (key === 'comicVineVolumeId') {
        setComicVineVolumeId(value);
        setValue(
          'metadata.comicVineVolumeId' as 'metadata',
          value as unknown as EntryMetadata,
          {
            shouldValidate: true,
          },
        );
        continue;
      }
      // A visible field the user unchecked in the dialog — skip it.
      // Bespoke keys (overview, posterPath, tmdbId, ...) aren't in
      // visibleKeys at all, so they always apply silently, exactly
      // like a normal MetadataSearch fill.
      if (visibleKeys.has(key) && !reSearchSelectedKeys.has(key)) continue;
      const fieldDef = mediaType.fields.find((f) => f.key === key);
      const skipTitleCase =
        key === 'overview' ||
        key === 'posterPath' ||
        key === 'coverImagePath' ||
        key === 'imdbUrl';
      const nextValue: unknown =
        fieldDef?.type === 'number'
          ? Number(value)
          : skipTitleCase
            ? value
            : toTitleCase(value);
      setValue(`metadata.${key}` as 'metadata', nextValue as EntryMetadata, {
        shouldValidate: true,
      });
    }
    if (reSearchDiffSet.genreAdds.length > 0 && reSearchSelectedKeys.has('genres')) {
      const existing = getValues('genres') ?? [];
      const merged = Array.from(new Set([...existing, ...reSearchDiffSet.genreAdds]));
      setValue('genres', merged, { shouldValidate: true });
    }
    setReSearchDialogOpen(false);
    setReSearchResult(null);
    setReSearchDiffSet(null);
    setReSearchToast('Updated from source.');
  };

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
    (mediaType.id === 'film' || mediaType.id === 'tv') &&
    typeof posterPath === 'string' &&
    posterPath;
  // Cover image only ever renders here, in Edit Entry — never in the
  // Library card or grid, same reasoning as the Film/TV poster above.
  // Unlike posterPath (a TMDB path fragment), coverImagePath already
  // holds a full hosted image URL (ComicVine for Comic, Open Library
  // for Book/Audiobook — and now also any type's manual "Find cover
  // image" search/paste result, see chat), so it's used as-is. Shown
  // for any media type that has one set, not just the three original
  // auto-fill sources — `showPoster` above still wins when both are
  // somehow set, matching getEntryImageUrl's (entryImage.ts)
  // posterPath-first precedence.
  const coverImagePath = watch('metadata.coverImagePath' as 'metadata');
  const showCoverImage =
    !showPoster && typeof coverImagePath === 'string' && coverImagePath;
  // Tracks a src that failed to load (e.g. an Open Library cover_i
  // that no longer resolves to a real image — see chat, the
  // "A Rare Book of Cunning Device" broken-icon report). Same pattern
  // as EntryCard.tsx/ShareEntrySheet.tsx's `failedImageUrl` — this was
  // the one image-rendering spot in the app missing it, which is why
  // a dead cover URL showed the browser's raw broken-image icon here
  // instead of gracefully falling back like everywhere else.
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  // Read-only — see chat. Only film/tv carry this (schema-only on
  // those two types), auto-filled via TMDB's external_ids alongside
  // credits/watch-providers. Never an editable TextField: there's
  // nothing for the user to usefully type here, and a free-text URL
  // field would just invite a broken link.
  const imdbUrl = watch('metadata.imdbUrl' as 'metadata');
  const showImdbLink =
    (mediaType.id === 'film' || mediaType.id === 'tv') &&
    typeof imdbUrl === 'string' &&
    imdbUrl;

  // "Add cover image" (see chat) — icon only appears once *both*
  // fields are empty, for every media type, not just the ones
  // TMDB/Open Library/ComicVine auto-fill touch. Deliberately reads
  // the same two watched values as the previews above rather than
  // getEntryImageUrl (entryImage.ts), since that helper works off a
  // saved MediaEntry, not live, unsaved form state.
  //
  // Originally paired with a Google Custom Search image grid, hence
  // the title/author-based query built below — dropped (see chat:
  // Google closed the Custom Search API to new customers/projects in
  // 2024, so it could never actually work), leaving just the manual
  // URL paste dialog.
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  // A value is stored (showPoster/showCoverImage) but its image failed
  // to actually load — still offers "Change cover image" (there IS
  // something to fix), just renders the dashed placeholder box instead
  // of a broken <img>.
  const activeCoverSrc = showPoster
    ? `https://image.tmdb.org/t/p/w154${posterPath}`
    : showCoverImage
      ? (coverImagePath as unknown as string)
      : undefined;
  const coverImageFailed = Boolean(activeCoverSrc) && activeCoverSrc === failedImageUrl;
  const hasCoverValue = Boolean(showPoster || showCoverImage);
  const showAddCoverButton = !hasCoverValue;

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
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  });

  // Shared by MetadataSearch (typed search) and IsbnScanDialog (barcode
  // scan) — both hand off a result in the exact same shape, so the form
  // doesn't need to know or care which one produced it.
  const applyMetadataFill = (
    title: string,
    fields: Record<string, string>,
    genres?: string[],
  ) => {
    setValue('title', toTitleCase(title), { shouldValidate: true });
    // comicVineVolumeId rides along in `fields` from searchSeries
    // (comicVineService.ts). It's captured into local state for the
    // "Fetch issue details" step, and also written into the form's
    // metadata so it's persisted on save (see entrySchemas.ts comment
    // — needed for the shared "add to journal" link).
    const {
      comicVineVolumeId: volumeId,
      pageCountApprox: approxFlag,
      ...restFields
    } = fields;
    if (volumeId) {
      setComicVineVolumeId(volumeId);
      setValue(
        'metadata.comicVineVolumeId' as 'metadata',
        volumeId as unknown as EntryMetadata,
        {
          shouldValidate: true,
        },
      );
    }
    setPageCountApprox(approxFlag === 'true');
    setIssueFetchError(null);
    for (const [key, value] of Object.entries(restFields)) {
      // Bug fix: every auto-filled field was being run through
      // toTitleCase and written as a string, including `runtime`
      // (needs to be a number per entrySchemas.ts — writing it as a
      // string failed Zod validation with "Invalid input", even
      // though the value displayed looked correct) and
      // `overview`/`posterPath` (prose and a URL fragment
      // respectively, neither of which should be title-cased —
      // toTitleCase is meant for short proper-noun-style fields like
      // Director or Cast).
      const fieldDef = mediaType.fields.find((f) => f.key === key);
      const skipTitleCase =
        key === 'overview' || key === 'posterPath' || key === 'coverImagePath';
      const nextValue: unknown =
        fieldDef?.type === 'number'
          ? Number(value)
          : skipTitleCase
            ? value
            : toTitleCase(value);
      setValue(`metadata.${key}` as 'metadata', nextValue as EntryMetadata, {
        shouldValidate: true,
      });
    }
    if (genres && genres.length > 0) {
      const existing = getValues('genres') ?? [];
      const merged = Array.from(new Set([...existing, ...genres]));
      setValue('genres', merged, { shouldValidate: true });
    }
  };

  // Renders one metadata field's Controller — extracted out of the
  // Media Details loop so a paired row (see FIELD_PAIRS above) can
  // call it twice, once per side, instead of duplicating this whole
  // block. Behaviour is unchanged from before the extraction.
  const renderMetadataField = (field: FieldDefinition) => (
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
              typeof controllerField.value === 'string'
                ? controllerField.value
                : undefined
            }
            onChange={(newValue) => controllerField.onChange(newValue)}
            onBlur={controllerField.onBlur}
            error={Boolean(fieldState.error)}
            helperText={fieldState.error?.message}
          />
        ) : field.type === 'date' ? (
          <EntryDatePicker
            label={field.label}
            required={field.required}
            value={
              typeof controllerField.value === 'string'
                ? controllerField.value
                : undefined
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
            // Deliberately NOT type="number" — native number inputs
            // have a well-documented mobile Safari bug where a
            // leading digit can't be backspaced out once more digits
            // follow it (David hit this on Season Number). Using a
            // plain text input with a numeric keyboard hint sidesteps
            // the native number-input parsing entirely; digit-
            // filtering below does the actual validation instead.
            //
            // While typing, the displayed value comes from
            // numberFieldDrafts (the raw filtered digits) rather than
            // round-tripping through Number() and back on every
            // keystroke — that round-trip was the actual cause of the
            // "first digit/can't clear" bug, since re-deriving the
            // display string from a coerced number each keystroke
            // could desync from the cursor position. The draft is
            // committed to the form's real (numeric) value live so
            // watchers elsewhere stay in sync, and is cleared on blur.
            type="text"
            slotProps={
              field.type === 'number'
                ? { htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }
                : undefined
            }
            fullWidth
            value={
              field.type === 'number'
                ? (numberFieldDrafts[field.key] ?? controllerField.value ?? '')
                : (controllerField.value ?? '')
            }
            onChange={(event) => {
              const raw = event.target.value;
              if (field.type === 'number') {
                const digitsOnly = raw.replace(/[^0-9]/g, '');
                setNumberFieldDrafts((prev) => ({ ...prev, [field.key]: digitsOnly }));
                controllerField.onChange(
                  digitsOnly === '' ? undefined : Number(digitsOnly),
                );
              } else {
                controllerField.onChange(raw);
              }
            }}
            onBlur={() => {
              if (field.type === 'text' && typeof controllerField.value === 'string') {
                controllerField.onChange(toTitleCase(controllerField.value));
              }
              if (field.type === 'number') {
                setNumberFieldDrafts((prev) => {
                  if (!(field.key in prev)) return prev;
                  const next = { ...prev };
                  delete next[field.key];
                  return next;
                });
              }
              controllerField.onBlur();
            }}
            error={Boolean(fieldState.error)}
            helperText={
              fieldState.error?.message ??
              (field.key === 'pageCount' && pageCountApprox
                ? 'Approximate — median across editions. Edit if you know the exact count.'
                : undefined)
            }
          />
        )
      }
    />
  );

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Stack spacing={3}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Chip
            icon={<Icon sx={{ color: `${mediaType.colour} !important` }} />}
            label={mediaType.displayName}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
          <Stack direction="row" spacing={1}>
            {reSearchAvailable && (
              <Button
                onClick={() => void handleReSearch()}
                disabled={reSearching}
                size="small"
                variant="outlined"
                startIcon={<CachedOutlinedIcon fontSize="small" />}
                sx={{ borderRadius: 4, textTransform: 'none', fontWeight: 600 }}
              >
                Re-search
              </Button>
            )}
            {scanAvailable && (
              <Button
                onClick={() => setScanDialogOpen(true)}
                size="small"
                variant="outlined"
                startIcon={<MenuBookOutlinedIcon fontSize="small" />}
                sx={{ borderRadius: 4, textTransform: 'none', fontWeight: 600 }}
              >
                ISBN
              </Button>
            )}
            {upcScanAvailable && (
              <Button
                onClick={() => setUpcScanDialogOpen(true)}
                size="small"
                variant="outlined"
                startIcon={
                  mediaType.id === 'comic' ? (
                    <AutoStoriesOutlinedIcon fontSize="small" />
                  ) : (
                    <QrCodeScannerOutlinedIcon fontSize="small" />
                  )
                }
                sx={{ borderRadius: 4, textTransform: 'none', fontWeight: 600 }}
              >
                UPC
              </Button>
            )}
          </Stack>
        </Stack>

        <ReSearchDialog
          open={reSearchDialogOpen}
          loading={reSearching}
          error={reSearchError}
          sourceLabel={reSearchSourceLabel(mediaType.id)}
          newTitle={reSearchResult?.title ?? getValues('title') ?? ''}
          diffSet={reSearchDiffSet}
          selectedKeys={reSearchSelectedKeys}
          onToggle={handleToggleReSearchKey}
          onApply={handleApplyReSearch}
          onCancel={handleCancelReSearch}
        />
        <Snackbar
          open={reSearchToast !== null}
          autoHideDuration={4000}
          onClose={() => setReSearchToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity="success"
            variant="filled"
            onClose={() => setReSearchToast(null)}
          >
            {reSearchToast}
          </Alert>
        </Snackbar>

        <IsbnScanDialog
          open={scanDialogOpen}
          onClose={() => setScanDialogOpen(false)}
          onFill={applyMetadataFill}
        />
        {mediaType.id === 'film' && (
          <UpcScanDialog
            open={upcScanDialogOpen}
            onClose={() => setUpcScanDialogOpen(false)}
            onFill={applyMetadataFill}
          />
        )}
        {mediaType.id === 'comic' && (
          <ComicUpcScanDialog
            open={upcScanDialogOpen}
            onClose={() => setUpcScanDialogOpen(false)}
            onFill={applyMetadataFill}
          />
        )}

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
          {/* Title field, doubled as metadata search for supported
              types (book/audiobook/film/tv/comic) — same field the
              user types into whether they're searching or just typing
              a title directly, so nothing needs re-entering if a
              search comes up empty (see chat, Aug 2026). Non-searchable
              types fall back to a plain Title TextField further down. */}
          {hasMetadataSearch(mediaType.id) && (
            <Controller
              name="title"
              control={control}
              render={({ field, fieldState }) => (
                <MetadataSearch
                  mediaTypeId={mediaType.id}
                  onFill={applyMetadataFill}
                  onAuthorTyped={(value) => {
                    // Comic's real field is 'writer', not 'author' — see
                    // chat, Aug 2026. Everything else that shows the
                    // Author search box (Book, Audiobook) uses 'author'.
                    // Deliberately NOT run through toTitleCase here —
                    // Title itself only cases on blur, not on every
                    // keystroke (see onTitleBlur below); doing it live
                    // here would fight with normal typing the same way.
                    // A manually-typed author's exact casing is left
                    // as-is, same tradeoff Title accepts before blur.
                    const key = mediaType.id === 'comic' ? 'writer' : 'author';
                    setValue(
                      `metadata.${key}` as 'metadata',
                      value as unknown as EntryMetadata,
                      {
                        shouldValidate: true,
                      },
                    );
                  }}
                  initialAuthor={
                    (mediaType.id === 'comic'
                      ? getValues('metadata.writer' as 'metadata')
                      : getValues('metadata.author' as 'metadata')) as unknown as
                      string | undefined
                  }
                  titleValue={field.value ?? ''}
                  onTitleChange={field.onChange}
                  onTitleBlur={() => {
                    field.onBlur();
                    setValue('title', toTitleCase(getValues('title') ?? ''), {
                      shouldValidate: true,
                    });
                  }}
                  required
                  error={Boolean(fieldState.error)}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          )}
          {/* ComicVine credits/cover date/cover image need a specific
              issue number, which isn't known at search time (the
              search box above only resolves the series) — so this is
              a deliberate second step, enabled once both a series has
              been selected via search and an issue number is typed
              further down in Media Details. Positioned just above the
              cover image (David's instruction, Aug 2026) rather than
              at the bottom of the form, since fetching is what fills
              the cover image shown right below it. */}
          {mediaType.id === 'comic' && (
            <Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  fetchingIssueDetails ? (
                    <CircularProgress size={14} />
                  ) : (
                    <DownloadOutlinedIcon fontSize="small" />
                  )
                }
                disabled={
                  !comicVineVolumeId ||
                  typeof issueStart !== 'number' ||
                  fetchingIssueDetails
                }
                onClick={async () => {
                  if (!comicVineVolumeId || typeof issueStart !== 'number') return;
                  setFetchingIssueDetails(true);
                  setIssueFetchError(null);

                  // Split into two try/catches deliberately: only a
                  // failure in the actual network call should produce
                  // the "Could not reach ComicVine" message. A prior
                  // version wrapped the setValue loop below in the
                  // same catch, so any error while writing fetched
                  // fields into the form got mislabeled as a
                  // connectivity problem even when the fetch itself
                  // succeeded (confirmed via Network tab: both
                  // ComicVine calls returned 200).
                  let fields: Record<string, string>;
                  try {
                    const result = await getIssueDetails(
                      comicVineVolumeId,
                      String(issueStart),
                    );
                    fields = result.fields;
                  } catch (err) {
                    console.error('ComicVine issue detail fetch failed:', err);
                    setIssueFetchError(
                      'Could not reach ComicVine. Check your connection and try again.',
                    );
                    setFetchingIssueDetails(false);
                    return;
                  }

                  if (Object.keys(fields).length === 0) {
                    setIssueFetchError(
                      `No ComicVine match found for issue #${issueStart} in this series.`,
                    );
                    setFetchingIssueDetails(false);
                    return;
                  }

                  try {
                    // ComicVine's own values (creator names, issue
                    // title) are already correctly cased — unlike the
                    // TMDB onFill path above, this doesn't run values
                    // through toTitleCase.
                    for (const [key, value] of Object.entries(fields)) {
                      setValue(
                        `metadata.${key}` as 'metadata',
                        value as unknown as EntryMetadata,
                        {
                          shouldValidate: true,
                        },
                      );
                    }
                  } catch (err) {
                    console.error(
                      'ComicVine issue detail fetch succeeded, but filling the form failed:',
                      err,
                    );
                    setIssueFetchError(
                      'ComicVine details were fetched, but something went wrong filling in the form. Check the console for details.',
                    );
                  } finally {
                    setFetchingIssueDetails(false);
                  }
                }}
              >
                Fetch issue details from ComicVine
              </Button>
              {/* Two distinct prompts depending on what's missing — a
                  series (search box directly above) or an issue number
                  (Issue Start field, further down in Media Details,
                  since the button now sits above the cover image
                  rather than next to that field). Previously this only
                  ever mentioned the series, so someone who'd already
                  searched but not yet typed an issue number saw no
                  explanation at all for why the button stayed
                  disabled. */}
              {!comicVineVolumeId ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  Search for the series above to enable this.
                </Typography>
              ) : (
                typeof issueStart !== 'number' && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 0.5 }}
                  >
                    Enter an issue number in Media Details below, then come back up here
                    to fetch.
                  </Typography>
                )
              )}
              {issueFetchError && (
                <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
                  {issueFetchError}
                </Alert>
              )}
            </Box>
          )}
          {(hasCoverValue || showAddCoverButton) && (
            <Stack direction="row" alignItems="center" spacing={1}>
              {hasCoverValue && !coverImageFailed ? (
                <Box
                  component="img"
                  src={activeCoverSrc}
                  alt=""
                  onError={() => setFailedImageUrl(activeCoverSrc ?? null)}
                  sx={{
                    width: 56,
                    height: 84,
                    borderRadius: 1,
                    objectFit: 'cover',
                    alignSelf: 'flex-start',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 56,
                    height: 84,
                    borderRadius: 1,
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                />
              )}
              <Stack spacing={1} alignItems="flex-start">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddPhotoAlternateOutlinedIcon fontSize="small" />}
                  onClick={() => setCoverDialogOpen(true)}
                  sx={{ textTransform: 'none' }}
                >
                  {hasCoverValue ? 'Change cover image' : 'Add cover image'}
                </Button>
                {coverImageFailed && (
                  <Typography variant="caption" color="text.secondary">
                    This cover image link isn&apos;t loading — try replacing it.
                  </Typography>
                )}
                {showImdbLink && (
                  <Chip
                    component="a"
                    href={imdbUrl as unknown as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    clickable
                    size="small"
                    icon={<OpenInNewOutlinedIcon fontSize="small" />}
                    label="IMDb"
                    sx={{
                      bgcolor: '#F5C518',
                      color: '#000',
                      fontWeight: 700,
                      '& .MuiChip-icon': { color: '#000' },
                    }}
                  />
                )}
              </Stack>
            </Stack>
          )}
          <AddCoverImageDialog
            open={coverDialogOpen}
            onClose={() => setCoverDialogOpen(false)}
            mediaTypeId={mediaType.id}
            initialTitle={watch('title') ?? ''}
            initialAuthor={
              typeof (watch('metadata') as Record<string, unknown> | undefined)
                ?.author === 'string'
                ? ((watch('metadata') as Record<string, unknown>).author as string)
                : ''
            }
            onSelect={(url) => {
              // A pasted replacement always lands in coverImagePath —
              // if the entry currently shows a TMDB `posterPath`
              // instead, that has to be cleared too, or
              // getEntryImageUrl (entryImage.ts)'s posterPath-first
              // precedence would keep showing the old TMDB poster
              // forever regardless of what gets pasted here.
              if (showPoster) {
                setValue(
                  'metadata.posterPath' as 'metadata',
                  undefined as unknown as EntryMetadata,
                  {
                    shouldValidate: true,
                  },
                );
              }
              setValue(
                'metadata.coverImagePath' as 'metadata',
                url as unknown as EntryMetadata,
                {
                  shouldValidate: true,
                },
              );
              // A fresh replacement deserves a fresh attempt to load —
              // otherwise if the new URL happens to equal a previously
              // failed one (unlikely, but free to guard against) the
              // placeholder would never clear.
              setFailedImageUrl(null);
              setCoverDialogOpen(false);
            }}
          />
          {!hasMetadataSearch(mediaType.id) && (
            <TextField
              label="Title"
              required
              fullWidth
              autoFocus
              {...register('title')}
              // MUI normally shrinks the label by detecting a native
              // `input`/`change` DOM event. Search autofill sets this
              // field via RHF's setValue(), which writes the DOM value
              // directly without dispatching one — so MUI never noticed
              // and the label sat resting on top of the filled-in title.
              // Watching the field and driving shrink explicitly covers
              // both that path and normal typing.
              slotProps={{ inputLabel: { shrink: Boolean(watch('title')) } }}
              onBlur={(event) => {
                setValue('title', toTitleCase(event.target.value), {
                  shouldValidate: true,
                });
              }}
              error={Boolean(errors.title)}
              helperText={errors.title?.message}
            />
          )}

          {/* Status toggle — Wishlist / In Progress / Completed, left to
              right matching the entry's natural progression (same order
              as the Library status tabs — see chat, Sept 2026). Sits
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
                  if (v !== 'completed')
                    setValue('completedDate', undefined as unknown as string);
                  // Restore today when switching back to completed
                  if (v === 'completed') setValue('completedDate', todayIso());
                  // In Progress needs a start date to place it on the
                  // Timeline (it renders as running from start to today
                  // — see TimelineChart) — default to today rather than
                  // leaving it blank, without clobbering a date the
                  // person already entered.
                  if (v === 'in_progress' && !getValues('startedDate')) {
                    setValue('startedDate', todayIso());
                  }
                }}
                size="small"
                fullWidth
                aria-label="Entry status"
              >
                <ToggleButton value="wishlist">★ Wishlist</ToggleButton>
                <ToggleButton value="in_progress">▶ In Progress</ToggleButton>
                <ToggleButton value="completed">✓ Completed</ToggleButton>
              </ToggleButtonGroup>
            )}
          />
        </Stack>

        {mediaType.fields.length > 0 && (
          <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
              Media Details
            </Typography>
            {(() => {
              const pairs = FIELD_PAIRS[mediaType.id] ?? [];
              const secondOfPair = new Map(pairs.map(([a, b]) => [a, b]));
              const consumedAsSecond = new Set(pairs.map(([, b]) => b));
              const fieldByKey = new Map(mediaType.fields.map((f) => [f.key, f]));

              return mediaType.fields.map((field) => {
                if (consumedAsSecond.has(field.key)) return null; // rendered as part of its pair below
                const pairedKey = secondOfPair.get(field.key);
                const pairedField = pairedKey ? fieldByKey.get(pairedKey) : undefined;
                if (pairedField) {
                  return (
                    <Stack key={field.key} direction="row" spacing={2}>
                      <Box sx={{ flex: 1 }}>{renderMetadataField(field)}</Box>
                      <Box sx={{ flex: 1 }}>{renderMetadataField(pairedField)}</Box>
                    </Stack>
                  );
                }
                return renderMetadataField(field);
              });
            })()}
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
              episodeEnd >= episodeStart &&
              (() => {
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
                the generic single-line TextField loop above. Reused for
                Podcasts as "Show Notes" (same metadata.overview key,
                populated from itunes:summary/<description> instead of
                TMDB — see chat) rather than a separate field, since the
                underlying need (a free-text multiline blurb, auto-filled
                but editable) is identical. Extended to Book/Audiobook
                Aug 2026 — populated from Google Books' `description`
                when a search result is selected (see
                googleBooksService.ts); Open Library's search index
                doesn't return a description at all, so this stays empty
                for an Open Library-only match, same as it would for any
                manually-typed entry. */}
            {(mediaType.id === 'film' ||
              mediaType.id === 'tv' ||
              mediaType.id === 'podcast' ||
              mediaType.id === 'book' ||
              mediaType.id === 'audiobook') && (
              <Controller
                name={'metadata.overview' as 'metadata'}
                control={control}
                render={({ field: controllerField, fieldState }) => (
                  <TextField
                    label={
                      mediaType.id === 'podcast'
                        ? 'Show Notes'
                        : mediaType.id === 'book' || mediaType.id === 'audiobook'
                          ? 'Description'
                          : 'Overview'
                    }
                    multiline
                    minRows={3}
                    fullWidth
                    value={
                      typeof controllerField.value === 'string'
                        ? controllerField.value
                        : ''
                    }
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
              <Controller
                name="startedDate"
                control={control}
                render={({ field, fieldState }) => (
                  <EntryDatePicker
                    label="Started"
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      // A Started date more than 6 months ago is almost
                      // certainly being backfilled after the fact, so
                      // default Completed to match it instead of
                      // leaving it blank/today (David's instruction,
                      // Aug 2026). Only fills a still-empty Completed
                      // date — never overwrites one already typed in —
                      // and only while status is Completed, since
                      // that's the only status showing a Completed
                      // field at all.
                      if (
                        value &&
                        status === 'completed' &&
                        !getValues('completedDate') &&
                        isMoreThanSixMonthsAgo(value)
                      ) {
                        setValue('completedDate', value, { shouldValidate: true });
                      }
                    }}
                    onBlur={field.onBlur}
                    error={Boolean(fieldState.error)}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              {status !== 'in_progress' && (
                <Controller
                  name="completedDate"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntryDatePicker
                      label="Completed"
                      required
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={Boolean(fieldState.error)}
                      helperText={fieldState.error?.message}
                    />
                  )}
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

        <Controller
          name="watchedWith"
          control={control}
          render={({ field }) => (
            <WatchedWithInput
              value={field.value ?? []}
              onChange={field.onChange}
              label={watchedWithLabel(mediaType.id)}
            />
          )}
        />

        <Controller
          name="recommendedBy"
          control={control}
          render={({ field }) => (
            <RecommendedByInput value={field.value ?? []} onChange={field.onChange} />
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
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              fullWidth
            >
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
