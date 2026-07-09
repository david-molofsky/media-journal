import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useTimelineEntries } from '@/hooks/useTimelineEntries';
import { packTimelineBars } from '@/utils/timelinePacking';
import { TimelineChart } from '@/components/timeline/TimelineChart';
import { TimelineTypeFilter } from '@/components/timeline/TimelineTypeFilter';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES, editEntryPath } from '@/routes/paths';
import { TIMELINE_ZOOM_ORDER, TIMELINE_ZOOM_LEVELS, type TimelineZoomLevel } from '@/utils/timelineZoom';

/**
 * Timeline — horizontally-scrollable Gantt-style view of everything
 * completed, showing how different media overlapped in time. Reached
 * via a link from Statistics rather than the bottom nav, which is
 * already at its five-item limit.
 */
export default function TimelinePage() {
  const navigate = useNavigate();
  const mediaTypes = useMediaTypes();
  const entries = useTimelineEntries();
  const [zoom, setZoom] = useState<TimelineZoomLevel>('month');
  // Tracks exclusions rather than inclusions so "all types on" needs no
  // initialization once mediaTypes loads, and always starts empty (all
  // on) each visit — no persistence across sessions, per chat.
  const [excludedTypeIds, setExcludedTypeIds] = useState<Set<string>>(new Set());

  const allTypeIds = useMemo(() => new Set(mediaTypes?.map((mt) => mt.id) ?? []), [mediaTypes]);

  // Filtering happens before packing (not after) so hiding a type
  // re-packs the remaining bars tighter into fewer rows, rather than
  // leaving gaps where the hidden rows used to be — see chat.
  const bars = useMemo(() => {
    if (!entries) return undefined;
    const filtered = entries.filter((e) => !excludedTypeIds.has(e.mediaType));
    return packTimelineBars(filtered);
  }, [entries, excludedTypeIds]);

  if (mediaTypes === undefined || entries === undefined || bars === undefined) {
    return <LoadingIndicator />;
  }

  const toggleType = (mediaTypeId: string) => {
    setExcludedTypeIds((prev) => {
      const next = new Set(prev);
      if (next.has(mediaTypeId)) next.delete(mediaTypeId);
      else next.add(mediaTypeId);
      return next;
    });
  };

  const soloType = (mediaTypeId: string) => {
    const isAlreadySolo = allTypeIds.size - excludedTypeIds.size === 1 && !excludedTypeIds.has(mediaTypeId);
    setExcludedTypeIds(
      isAlreadySolo ? new Set() : new Set([...allTypeIds].filter((id) => id !== mediaTypeId)),
    );
  };

  return (
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton aria-label="Back to Statistics" onClick={() => navigate(ROUTES.statistics)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" component="h1" fontWeight={600}>
          Timeline
        </Typography>
      </Stack>

      {entries.length === 0 ? (
        <PagePlaceholder
          title="Nothing to show yet"
          description="Once you've completed a few entries, they'll show up here as an overlapping timeline."
        />
      ) : (
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
            <ToggleButtonGroup
              value={zoom}
              exclusive
              size="small"
              onChange={(_event, value: TimelineZoomLevel | null) => {
                if (value) setZoom(value);
              }}
            >
              {TIMELINE_ZOOM_ORDER.map((level) => (
                <ToggleButton key={level} value={level}>
                  {TIMELINE_ZOOM_LEVELS[level].label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">
              Pinch, or ctrl/⌘ + scroll, to zoom freely
            </Typography>
          </Stack>

          <TimelineTypeFilter
            mediaTypes={mediaTypes}
            excludedTypeIds={excludedTypeIds}
            onToggle={toggleType}
            onSolo={soloType}
          />

          {bars.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No entries match the selected types.
            </Typography>
          ) : (
            <TimelineChart
              bars={bars}
              zoom={zoom}
              mediaTypes={mediaTypes}
              onOpenEntry={(entryId) => navigate(editEntryPath(entryId))}
            />
          )}

          <Typography variant="caption" color="text.secondary">
            A dot means no start date was recorded for that entry, so only the day it was
            completed is shown. Tap a type above to hide it, double-tap to solo it.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
