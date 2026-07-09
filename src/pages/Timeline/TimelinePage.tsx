import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useMediaTypes } from '@/hooks/useMediaTypes';
import { useTimelineBars } from '@/hooks/useTimelineBars';
import { TimelineChart } from '@/components/timeline/TimelineChart';
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
  const bars = useTimelineBars();
  const [zoom, setZoom] = useState<TimelineZoomLevel>('month');

  if (mediaTypes === undefined || bars === undefined) {
    return <LoadingIndicator />;
  }

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

      {bars.length === 0 ? (
        <PagePlaceholder
          title="Nothing to show yet"
          description="Once you've completed a few entries, they'll show up here as an overlapping timeline."
        />
      ) : (
        <Stack spacing={2}>
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

          <TimelineChart
            bars={bars}
            zoom={zoom}
            mediaTypes={mediaTypes}
            onOpenEntry={(entryId) => navigate(editEntryPath(entryId))}
          />

          <Stack direction="row" flexWrap="wrap" gap={1.5}>
            {mediaTypes.map((mt) => (
              <Stack key={mt.id} direction="row" alignItems="center" spacing={0.5}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: mt.colour }} />
                <Typography variant="caption" color="text.secondary">
                  {mt.displayName}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            A dot means no start date was recorded for that entry, so only the day it was
            completed is shown.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
