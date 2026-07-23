import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useSubscriptionValue } from '@/hooks/useSubscriptionValue';
import type { SubscriptionValueRow } from '@/services/statistics/subscriptionValueService';

const WINDOW_OPTIONS = [3, 6, 12, 24] as const;

function SubscriptionRow({
  row,
  rank,
}: {
  row: SubscriptionValueRow;
  rank: number | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
        opacity: row.belowThreshold ? 0.6 : 1,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        onClick={() => setOpen((v) => !v)}
        sx={{ px: 1.5, py: 1, cursor: 'pointer' }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ width: 16, fontWeight: 700 }}
        >
          {rank ?? '–'}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            sx={{ mb: 0.5 }}
          >
            <Typography variant="body2" fontWeight={600} noWrap>
              {row.source}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {row.queuedCount > 0 && (
                <Chip
                  size="small"
                  icon={<InventoryOutlinedIcon sx={{ fontSize: 14 }} />}
                  label={`${row.queuedCount} queued`}
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
              <Typography variant="caption" color="success.main" fontWeight={700}>
                Score {row.score}
              </Typography>
            </Stack>
          </Stack>
          <Box
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'action.hover',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${row.score}%`,
                borderRadius: 3,
                bgcolor: row.belowThreshold ? 'text.disabled' : 'success.main',
              }}
            />
          </Box>
        </Box>
        <ExpandMoreIcon
          fontSize="small"
          sx={{
            color: 'text.secondary',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: '0.15s',
          }}
        />
      </Stack>
      <Collapse in={open}>
        <Box
          sx={{
            px: 1.5,
            pb: 1.5,
            pl: 5,
            borderTop: '1px solid',
            borderColor: 'divider',
            pt: 1,
          }}
        >
          <Stack direction="row" spacing={3} sx={{ mb: 1 }}>
            <Box>
              <Typography variant="body1" fontWeight={700} lineHeight={1.2}>
                {row.watchedCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                completed
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight={700} lineHeight={1.2}>
                {row.avgRating !== null ? row.avgRating.toFixed(1) : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                avg rating
              </Typography>
            </Box>
            <Box>
              <Typography variant="body1" fontWeight={700} lineHeight={1.2}>
                {row.queuedCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                in queue
              </Typography>
            </Box>
          </Stack>
          {row.topTitles.length > 0 && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: 'block',
                  mb: 0.5,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                }}
              >
                Top rated on {row.source}
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {row.topTitles.map((t) => (
                  <Chip key={t.title} size="small" label={`${t.title} — ${t.rating}`} />
                ))}
              </Stack>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

interface SubscriptionValueCardProps {
  title: string;
  colour: string;
  mediaTypeIds: string[];
  defaultWindowMonths?: number;
}

/**
 * One Statistics > Subscription Value card for a group of media types
 * (e.g. Film+TV+Anime combined, or Podcasts alone). Renders a
 * 3/6/12/24-month window toggle and the ranked source list from
 * `useSubscriptionValue` — see that hook and
 * subscriptionValueService.ts for how the ranking itself works.
 */
export function SubscriptionValueCard({
  title,
  colour,
  mediaTypeIds,
  defaultWindowMonths = 12,
}: SubscriptionValueCardProps) {
  const [windowMonths, setWindowMonths] = useState<number>(defaultWindowMonths);
  const data = useSubscriptionValue(mediaTypeIds, windowMonths);

  if (data === undefined) return null;
  if (data.rows.length === 0 && data.excludedCount === 0) return null;

  const ranked = data.rows.filter((r) => !r.belowThreshold);
  const unranked = data.rows.filter((r) => r.belowThreshold);

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: 0.5,
            bgcolor: colour,
            flexShrink: 0,
          }}
        />
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
      </Stack>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={windowMonths}
        onChange={(_, value) => value !== null && setWindowMonths(value)}
        sx={{ mb: 2, width: '100%' }}
      >
        {WINDOW_OPTIONS.map((months) => (
          <ToggleButton
            key={months}
            value={months}
            sx={{ flex: 1, py: 0.5, fontSize: 12, textTransform: 'none' }}
          >
            {months}mo
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {data.rows.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: data.excludedCount > 0 ? 1.5 : 0 }}
        >
          Nothing logged on a subscription source in this window.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {ranked.map((row, i) => (
            <SubscriptionRow key={row.source} row={row} rank={i + 1} />
          ))}
          {unranked.length > 0 && (
            <>
              <Divider label="Fewer than 3 completed — score not yet reliable" />
              {unranked.map((row) => (
                <SubscriptionRow key={row.source} row={row} rank={null} />
              ))}
            </>
          )}
        </Stack>
      )}

      {data.excludedCount > 0 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mt: 1.5,
            p: 1,
            borderRadius: 1,
            bgcolor: 'action.hover',
            alignItems: 'flex-start',
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary', mt: 0.2 }} />
          <Typography variant="caption" color="text.secondary">
            {data.excludedCount} entr{data.excludedCount === 1 ? 'y' : 'ies'} in this
            window aren&apos;t shown here — their Source isn&apos;t marked as a
            subscription. Manage this in Settings &gt; Subscriptions.
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          fontSize: 10,
        }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
    </Stack>
  );
}
