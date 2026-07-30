import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useTimelineEntries } from '@/hooks/useTimelineEntries';
import { packTimelineBars } from '@/utils/timelinePacking';
import { TimelineChart } from '@/components/timeline/TimelineChart';
import { TimelineTypeFilter } from '@/components/timeline/TimelineTypeFilter';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { EmptyStateTip } from '@/components/common/EmptyStateTip';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { editEntryPath } from '@/routes/paths';
import { TIMELINE_ZOOM_ORDER, TIMELINE_ZOOM_LEVELS, type TimelineZoomLevel } from '@/utils/timelineZoom';
import { SETTINGS_KEYS } from '@/models';

/**
 * Timeline — horizontally-scrollable Gantt-style view of everything
 * completed, showing how different media overlapped in time. A
 * primary bottom-nav tab (see chat — it replaced Settings there, which
 * remains reachable via AppHeader's gear icon on every page).
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
      <Typography variant="h6" component="h1" fontWeight={600} sx={{ mb: 2 }}>
        Timeline
      </Typography>

      {entries.length === 0 ? (
        <>
          <EmptyStateTip
            message="Timeline shows entries by date once you've added a few."
            dismissedKey={SETTINGS_KEYS.timelineTipDismissed}
          />
          <PagePlaceholder
            title="Nothing to show yet"
            description="Once you've completed a few entries, they'll show up here as an overlapping timeline."
          />
        </>
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
            completed is shown. A fading edge with an arrow means it's still in progress, running
            through to today. Tap a type above to hide it, double-tap to solo it.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
