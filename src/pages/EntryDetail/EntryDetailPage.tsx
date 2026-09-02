import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import dayjs from 'dayjs';
import { useMediaEntry } from '@/hooks/useMediaEntry';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useTvTrackingMode } from '@/hooks/useTvTrackingMode';
import { ShareEntrySheet } from '@/components/entry/ShareEntrySheet';
import { MarkFinishedDialog } from '@/components/entry/MarkFinishedDialog';
import { NextInSeriesSection } from '@/components/entry/NextInSeriesSection';
import { WishlistRecommendationsSection } from '@/components/entry/WishlistRecommendationsSection';
import { RatingInput } from '@/components/forms/RatingInput';
import { EntryDatePicker } from '@/components/forms/EntryDatePicker';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { getEntryImageUrl } from '@/utils/entryImage';
import { getMediaTypeIcon } from '@/utils/mediaTypeIcon';
import { todayIso } from '@/utils/dateUtils';
import {
  updateEntryStatus,
  updateEntryRating,
  updateEntryDate,
} from '@/services/database/entryService';
import { ROUTES, editEntryPath } from '@/routes/paths';
import { watchedWithLabel, RECOMMENDED_BY_LABEL } from '@/utils/companionFieldLabels';
import type { EntryStatus, FieldInputType } from '@/models';
import type { LibraryFilterRequest } from '@/pages/Library/LibraryPage';

/** Bespoke metadata keys — present in the per-type Zod schema but not
 * in defaultMediaTypes.ts's `fields[]`, so the generic Media Details
 * loop below never sees them (see chat, Aug 2026 — this is why Film/TV
 * Summaries went missing on this page). `posterPath`/`coverImagePath`
 * already surface as the cover image and `imdbUrl` as the IMDb chip,
 * so only `overview` needs its own display row here. */
const OVERVIEW_MEDIA_TYPES = new Set(['film', 'tv']);

const STATUS_META: Record<
  EntryStatus,
  { label: string; Icon: typeof CheckCircleOutlineIcon }
> = {
  wishlist: { label: 'Wishlist', Icon: StarBorderIcon },
  in_progress: { label: 'In Progress', Icon: PlayArrowIcon },
  completed: { label: 'Completed', Icon: CheckCircleOutlineIcon },
};

function formatFieldValue(raw: unknown, type: FieldInputType): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (type === 'date' && typeof raw === 'string') return dayjs(raw).format('D MMM YYYY');
  return String(raw);
}

/**
 * Read-only condensed view of an entry — the default landing page when
 * tapping an entry from Library/Timeline/Dashboard/Statistics (see
 * chat, Aug 2026). Blank metadata fields, Notes, and Genres are hidden
 * entirely rather than shown empty; Tags, Rating, and the Dates
 * section are exceptions — they keep the exact same visibility rules
 * the edit form already uses (e.g. Rating only for Completed status)
 * regardless of whether a value is actually set.
 *
 * The pencil icon opens the full EntryForm at the existing
 * `/entry/:id` route — this page deliberately doesn't duplicate any
 * editing capability, Delete/Convert/Re-log/Previous-entries stay
 * edit-only. Back and the pencil both carry the incoming Library
 * filter state through, same passthrough convention EditEntryPage
 * already uses, so returning to Library lands back on the right tab/
 * filter/scroll position either way.
 */
export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingFilters = location.state as LibraryFilterRequest | null;
  const entry = useMediaEntry(id);
  const mediaTypes = useMediaTypes();
  const tvMode = useTvTrackingMode();
  const [shareOpen, setShareOpen] = useState(false);
  // Quick-action "Mark finished" dialog — same combined Completed
  // Date + Rating confirmation as the Library card's equivalent
  // action (see chat, Aug 2026), via the shared MarkFinishedDialog.
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishDate, setFinishDate] = useState(todayIso());
  const [finishRating, setFinishRating] = useState<number | undefined>(undefined);
  // Live-drag value for the inline Rating slider — RatingInput's
  // `value` prop must update on every drag tick for the thumb to
  // track the touch/cursor responsively; only onChangeCommitted
  // actually persists (see chat, Aug 2026). Re-seeded from the entry
  // whenever it changes underneath (e.g. after the commit itself, or
  // an edit made elsewhere) via the effect below.
  const [liveRating, setLiveRating] = useState<number | undefined>(entry?.rating);

  // Derive unconditionally (before any early returns) — Rules of Hooks.
  const rawMediaType = mediaTypes?.find((type) => type.id === entry?.mediaType);
  const effectiveMediaType =
    rawMediaType && rawMediaType.id === 'tv'
      ? {
          ...rawMediaType,
          fields: rawMediaType.fields.filter((field) =>
            tvMode === 'episode'
              ? true
              : field.key !== 'episodeStart' && field.key !== 'episodeEnd',
          ),
        }
      : rawMediaType;
  const Icon = effectiveMediaType ? getMediaTypeIcon(effectiveMediaType.icon) : null;

  useEffect(() => {
    (() => {
      setLiveRating(entry?.rating);
    })();
  }, [entry?.rating]);

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
        description="This entry's media type has been disabled in Settings, so it can't be viewed right now."
      />
    );
  }

  const status: EntryStatus = entry.status ?? 'completed';
  const statusMeta = STATUS_META[status];
  const StatusIcon = statusMeta.Icon;
  const imageUrl = getEntryImageUrl(entry, 'poster');

  const imdbUrl = entry.metadata.imdbUrl;
  const showImdbLink =
    (effectiveMediaType.id === 'film' || effectiveMediaType.id === 'tv') &&
    typeof imdbUrl === 'string' &&
    imdbUrl;

  // Media Details — only fields with an actual value; this is the
  // whole point of the condensed view. No pairing/range formatting
  // here (unlike the edit form's FIELD_PAIRS) — each non-blank field
  // just gets its own cell in a simple responsive grid, which reads
  // fine at this density without needing pair-specific formatting.
  const detailRows = effectiveMediaType.fields
    .map((field) => ({
      label: field.label,
      value: formatFieldValue(entry.metadata[field.key], field.type),
    }))
    .filter((row): row is { label: string; value: string } => row.value !== undefined);

  const showDates = status !== 'wishlist';
  const showCompletedDate = status !== 'in_progress';
  const showRating = status === 'completed';

  // Bug fix (see chat, Aug 2026): Overview is a bespoke field, not in
  // effectiveMediaType.fields[], so detailRows above never included
  // it — Film/TV summaries were silently missing from this page.
  const overview = entry.metadata.overview;
  const showOverview =
    OVERVIEW_MEDIA_TYPES.has(effectiveMediaType.id) &&
    typeof overview === 'string' &&
    overview;

  // Quick-action status buttons — same actions and same conditions as
  // the Library card's onStartTracking/onMoveToWishlist/onMarkFinished
  // (EntryCard.tsx), so a Completed entry deliberately shows neither
  // (matches Library exactly — confirmed in chat, Aug 2026).
  const handleStartTracking = () => void updateEntryStatus(entry.id, 'in_progress');
  const handleMoveToWishlist = () => void updateEntryStatus(entry.id, 'wishlist');
  const openFinishDialog = () => {
    setFinishDate(todayIso());
    setFinishRating(undefined);
    setFinishOpen(true);
  };
  const handleMarkFinished = async () => {
    await updateEntryStatus(
      entry.id,
      'completed',
      finishDate || todayIso(),
      finishRating,
    );
    setFinishOpen(false);
  };

  return (
    <Box key={id} sx={{ px: 2, pt: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton
          aria-label="Back to library"
          onClick={() => navigate(ROUTES.library, { state: incomingFilters })}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="h1" fontWeight={600} noWrap sx={{ flex: 1 }}>
          {entry.title}
        </Typography>
        <IconButton aria-label="Share entry" onClick={() => setShareOpen(true)}>
          <ShareOutlinedIcon />
        </IconButton>
        <IconButton
          aria-label="Edit entry"
          onClick={() => navigate(editEntryPath(entry.id), { state: incomingFilters })}
        >
          <EditOutlinedIcon />
        </IconButton>
      </Stack>

      <Stack spacing={3}>
        <Stack direction="row" spacing={2}>
          {imageUrl ? (
            <Box
              component="img"
              src={imageUrl}
              alt=""
              sx={{
                width: 84,
                height: 126,
                borderRadius: 1.5,
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <Box
              sx={{
                width: 84,
                height: 126,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line react-hooks/static-components */}
              {Icon && <Icon sx={{ color: effectiveMediaType.colour, fontSize: 32 }} />}
            </Box>
          )}
          <Stack spacing={1} sx={{ pt: 0.5 }}>
            <Typography variant="h6" fontWeight={600}>
              {entry.title}
            </Typography>
            <Chip
              icon={<StatusIcon sx={{ fontSize: '16px !important' }} />}
              label={statusMeta.label}
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            />
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
                  alignSelf: 'flex-start',
                  bgcolor: '#F5C518',
                  color: '#000',
                  fontWeight: 700,
                  '& .MuiChip-icon': { color: '#000' },
                }}
              />
            )}
          </Stack>
        </Stack>

        {(status === 'wishlist' || status === 'in_progress') && (
          <Stack direction="row" spacing={1}>
            {status === 'wishlist' && (
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={handleStartTracking}
              >
                ▶ Start Tracking
              </Button>
            )}
            {status === 'in_progress' && (
              <Button
                fullWidth
                variant="outlined"
                size="small"
                onClick={handleMoveToWishlist}
              >
                ☆ Move to Wishlist
              </Button>
            )}
            <Button fullWidth variant="outlined" size="small" onClick={openFinishDialog}>
              ✓ Mark Finished
            </Button>
          </Stack>
        )}

        {showOverview && (
          <>
            <Divider />
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                gutterBottom
              >
                Summary
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {overview}
              </Typography>
            </Box>
          </>
        )}

        {detailRows.length > 0 && (
          <>
            <Divider />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                columnGap: 2,
                rowGap: 1.5,
              }}
            >
              {detailRows.map((row) => (
                <Box key={row.label}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {row.label}
                  </Typography>
                  <Typography variant="body2">{row.value}</Typography>
                </Box>
              ))}
            </Box>
          </>
        )}

        {entry.notes && (
          <>
            <Divider />
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                gutterBottom
              >
                Notes
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {entry.notes}
              </Typography>
            </Box>
          </>
        )}

        {entry.genres && entry.genres.length > 0 && (
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              gutterBottom
            >
              Genres
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {entry.genres.map((genre) => (
                <Chip key={genre} label={genre} size="small" />
              ))}
            </Stack>
          </Box>
        )}

        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            gutterBottom
          >
            Tags
          </Typography>
          {entry.tags && entry.tags.length > 0 ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {entry.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" variant="outlined" />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" fontStyle="italic">
              No tags yet
            </Typography>
          )}
        </Box>

        {/* Watched/Read With and Recommended By — hidden entirely when
            empty, same as Genres above, rather than showing an empty
            placeholder (unlike Tags, which always has a section since
            it's core to the app). Chips use color="primary" to read as
            people, distinct from Genre's filled and Tag's outlined
            neutral chips. */}
        {entry.watchedWith && entry.watchedWith.length > 0 && (
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              gutterBottom
            >
              {watchedWithLabel(entry.mediaType)}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {entry.watchedWith.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}

        {entry.recommendedBy && entry.recommendedBy.length > 0 && (
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              gutterBottom
            >
              {RECOMMENDED_BY_LABEL}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {entry.recommendedBy.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}

        {showRating && (
          <RatingInput
            value={liveRating}
            onChange={setLiveRating}
            onChangeCommitted={(value) => void updateEntryRating(entry.id, value)}
          />
        )}

        {showDates && (
          <Stack spacing={2}>
            <EntryDatePicker
              label="Started"
              value={entry.startedDate}
              onChange={(value) => void updateEntryDate(entry.id, 'startedDate', value)}
            />
            {showCompletedDate && (
              <EntryDatePicker
                label="Completed"
                value={entry.completedDate}
                onChange={(value) =>
                  void updateEntryDate(entry.id, 'completedDate', value)
                }
              />
            )}
          </Stack>
        )}

        <NextInSeriesSection entry={entry} />

        <WishlistRecommendationsSection entry={entry} mediaTypes={mediaTypes} />
      </Stack>

      <ShareEntrySheet
        open={shareOpen}
        entry={entry}
        mediaType={effectiveMediaType}
        onClose={() => setShareOpen(false)}
      />

      <MarkFinishedDialog
        entryTitle={entry.title}
        open={finishOpen}
        date={finishDate}
        onDateChange={setFinishDate}
        rating={finishRating}
        onRatingChange={setFinishRating}
        onCancel={() => setFinishOpen(false)}
        onConfirm={() => void handleMarkFinished()}
      />
    </Box>
  );
}
