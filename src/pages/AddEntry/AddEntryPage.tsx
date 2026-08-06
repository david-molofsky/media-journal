import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useTvTrackingMode } from '@/hooks/useTvTrackingMode';
import { useDefaultEntryStatus } from '@/hooks/useDefaultEntryStatus';
import { useNumberSetting } from '@/hooks/useNumberSetting';
import { MediaTypePicker } from '@/components/forms/MediaTypePicker';
import { EntryForm } from '@/components/forms/EntryForm';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { createEntry, normalizeWishlistOrder, jumpWishlistOrder } from '@/services/database/entryService';
import { getFilmDetails, getTVDetails } from '@/services/metadata/tmdbService';
import { getBookDetailsByKey } from '@/services/metadata/openLibraryService';
import { ROUTES } from '@/routes/paths';
import { SETTINGS_KEYS } from '@/models';
import type { MediaType, NewMediaEntryInput } from '@/models';

/** Mirrors MediaTypePicker's TIP_MAX_SHOWS — a save counts as one of
 * the 2 shows just like an explicit dismissal (see chat). */
const TIP_MAX_SHOWS = 2;

/** New entries saved as Wishlist default to this position rather than
 * the very top — jumpWishlistOrder already clamps to the list's
 * length, so this naturally lands at the end if the Wishlist has
 * fewer than 11 items (see chat). */
const DEFAULT_WISHLIST_POSITION = 11;

/** Media types a shared "add to journal" link can resolve, and the
 * metadata key their source id is persisted under. Kept in sync with
 * shareMessageService's SHARED_LINK_ID_KEY and MetadataSearch's
 * getSourceIdKey. */
const SHARED_ID_KEY: Record<string, string> = {
  film: 'tmdbId',
  tv: 'tmdbId',
  book: 'openLibraryKey',
  audiobook: 'openLibraryKey',
};

/** Navigation state Edit Entry's "Log a Rewatch/Reread/Replay" button
 * (see chat) hands to Add Entry — a full set of values ready to hand
 * straight to EntryForm as `initialValues`, same mechanism as the
 * existing shared-link pre-fill below. */
export interface RelogNavigationState {
  relogValues: NewMediaEntryInput;
}

export default function AddEntryPage() {
  const mediaTypes = useMediaTypes();
  const tvMode = useTvTrackingMode();
  const defaultStatus = useDefaultEntryStatus();
  const [selectedType, setSelectedType] = useState<MediaType | null>(null);
  const [tipShownCount, setTipShownCount] = useNumberSetting(
    SETTINGS_KEYS.addEntryTipShownCount,
    0,
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Re-log pre-fill (from Edit Entry's "Log a Rewatch/Reread/Replay").
  // Dismissed the same way a shared link is abandoned — the arrow-back
  // button on the type-picker screen clears it rather than it
  // reappearing after the user chooses a different type manually.
  const relogValues = (location.state as RelogNavigationState | null)?.relogValues;
  const [relogDismissed, setRelogDismissed] = useState(false);

  // Shared "add to journal" link support (see shareMessageService's
  // buildEntryLink). `type`/`id` in the URL identify a source record
  // to fetch and pre-fill — only present when someone opens a link
  // shared from another entry.
  const sharedType = searchParams.get('type');
  const sharedId = searchParams.get('id');
  const isSharedLink = Boolean(sharedType && sharedId && SHARED_ID_KEY[sharedType]);

  const [sharedValues, setSharedValues] = useState<NewMediaEntryInput | null>(null);
  const [sharedError, setSharedError] = useState(false);

  // The type named in the link, once media types have loaded — derived
  // rather than synced into state via an effect.
  const sharedMediaType = useMemo(() => {
    if (!isSharedLink || !mediaTypes) return null;
    return mediaTypes.find((mt) => mt.id === sharedType) ?? null;
  }, [isSharedLink, mediaTypes, sharedType]);

  // The link named a type that doesn't exist (e.g. a custom type the
  // user later deleted) — falls through to the manual picker. Derived,
  // not state: true once media types are loaded but no match was found.
  const sharedTypeMissing = isSharedLink && Boolean(mediaTypes) && !sharedMediaType;

  // The type named by a re-log, once media types have loaded — mirrors
  // sharedMediaType above. Ignored once the user has dismissed the
  // pre-fill via the back button.
  const relogMediaType = useMemo(() => {
    if (!relogValues || relogDismissed || !mediaTypes) return null;
    return mediaTypes.find((mt) => mt.id === relogValues.mediaType) ?? null;
  }, [relogValues, relogDismissed, mediaTypes]);

  // Manual picks (selectedType) take priority; otherwise fall back to
  // whatever the shared link resolved to, then a re-log pre-fill.
  const activeType = selectedType ?? sharedMediaType ?? relogMediaType;

  // Only apply the re-log values once the resolved type actually
  // matches — guards against a stale pre-fill being applied after the
  // user manually picks a different type.
  const relogInitialValues =
    relogMediaType && activeType?.id === relogMediaType.id ? relogValues : undefined;

  const sharedLoading =
    isSharedLink && !sharedTypeMissing && !sharedValues && !sharedError && Boolean(mediaTypes);

  // Resolve the shared id into pre-filled values once the type is known.
  useEffect(() => {
    if (!isSharedLink || !sharedMediaType || sharedValues || sharedError) return;
    if (!sharedType || !sharedId) return;
    // isSharedLink already guarantees this key exists for sharedType.
    const idKey = SHARED_ID_KEY[sharedType];
    if (!idKey) return;

    let cancelled = false;

    (async () => {
      try {
        let title = '';
        let fields: Record<string, string> = {};
        let genres: string[] | undefined;

        if (sharedType === 'film') {
          ({ title, fields, genres } = await getFilmDetails(sharedId));
        } else if (sharedType === 'tv') {
          ({ title, fields, genres } = await getTVDetails(sharedId));
        } else {
          ({ title, fields, genres } = await getBookDetailsByKey(sharedId));
        }

        if (cancelled) return;
        setSharedValues({
          title,
          mediaType: sharedMediaType.id,
          status: 'wishlist',
          startedDate: undefined,
          completedDate: undefined,
          rating: undefined,
          notes: '',
          repeatConsumption: false,
          tags: [],
          genres: genres ?? [],
          metadata: {
            ...Object.fromEntries(sharedMediaType.fields.map((f) => [f.key, undefined])),
            ...fields,
            [idKey]: sharedId,
          },
        });
      } catch {
        if (!cancelled) setSharedError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSharedLink, sharedMediaType, sharedType, sharedId, sharedValues, sharedError]);

  /** Drops the shared-link query params and lets the user carry on
   * manually — used by the fallback screen's "Start a blank entry". */
  const abandonSharedLink = () => {
    setSharedError(false);
    setSearchParams({}, { replace: true });
  };

  /**
   * Strip or include TV episode fields depending on the tracking mode.
   * The TV media type in the DB always carries all three fields so the
   * migration only needs to run once; the form just sees a filtered
   * view of them. This means switching modes takes effect immediately
   * without any re-migration.
   */
  const effectiveMediaType = useMemo((): MediaType | null => {
    if (!activeType || activeType.id !== 'tv') return activeType;
    return {
      ...activeType,
      fields: activeType.fields.filter((field) =>
        tvMode === 'episode'
          ? true
          : field.key !== 'episodeStart' && field.key !== 'episodeEnd',
      ),
    };
  }, [activeType, tvMode]);

  if (mediaTypes === undefined) {
    return <LoadingIndicator />;
  }

  if (isSharedLink && !sharedTypeMissing && sharedLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          minHeight: '50vh',
        }}
      >
        <CircularProgress aria-label="Fetching shared entry details" />
        <Typography variant="body2" color="text.secondary">
          Fetching details…
        </Typography>
      </Box>
    );
  }

  if (isSharedLink && sharedError) {
    return (
      <Box sx={{ px: 2, pt: 6, textAlign: 'center' }}>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Couldn't fetch details for this link.
        </Typography>
        <Button variant="outlined" onClick={abandonSharedLink}>
          Start a blank entry
        </Button>
      </Box>
    );
  }

  if (!activeType || !effectiveMediaType) {
    return <MediaTypePicker mediaTypes={mediaTypes} onSelect={setSelectedType} />;
  }

  return (
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          aria-label="Back to media type selection"
          onClick={() => {
            setSelectedType(null);
            if (isSharedLink) abandonSharedLink();
            if (relogValues) setRelogDismissed(true);
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="h1" fontWeight={600}>
          New {effectiveMediaType.displayName}
        </Typography>
      </Stack>
      {sharedValues && (
        <Alert icon={<LinkOutlinedIcon fontSize="inherit" />} severity="info" sx={{ mb: 2 }}>
          Filled in from a shared link — review and save.
        </Alert>
      )}
      {relogInitialValues && (
        <Alert icon={<ReplayIcon fontSize="inherit" />} severity="info" sx={{ mb: 2 }}>
          Pre-filled from your previous entry — review and save.
        </Alert>
      )}
      <EntryForm
        key={`${effectiveMediaType.id}-${tvMode}-${defaultStatus}-${sharedValues ? 'shared' : relogInitialValues ? 'relog' : 'manual'}`}
        mediaType={effectiveMediaType}
        initialValues={sharedValues ?? relogInitialValues ?? undefined}
        defaultStatus={defaultStatus}
        submitLabel="Save Entry"
        onSubmit={async (values) => {
          const entry = await createEntry(values);
          if (entry.status === 'wishlist') {
            await normalizeWishlistOrder();
            await jumpWishlistOrder(entry.id, DEFAULT_WISHLIST_POSITION);
          }
          if (tipShownCount < TIP_MAX_SHOWS) setTipShownCount(tipShownCount + 1);
          navigate(ROUTES.library);
        }}
      />
    </Box>
  );
}
