import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import SubscriptionsOutlinedIcon from '@mui/icons-material/SubscriptionsOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useSubscriptionSources } from '@/hooks/useSubscriptionSources';
import {
  setSubscriptionSourceFlag,
  isSubscriptionSource,
} from '@/services/subscriptions/subscriptionSourcesService';

/** Groups of media type ids shown together in this UI — matches the
 * grouping used by the Subscription Value cards on the Statistics
 * page (Film/TV/Anime combined into one pool there; grouped here too
 * so a toggle's effect is obvious). */
const GROUPS: { label: string; mediaTypeIds: string[] }[] = [
  { label: 'Film, TV & Anime', mediaTypeIds: ['film', 'tv', 'anime'] },
  { label: 'Podcasts', mediaTypeIds: ['podcast'] },
  { label: 'Audiobooks', mediaTypeIds: ['audiobook'] },
  { label: 'Books', mediaTypeIds: ['book'] },
];

function AddSourceRow({ onAdd }: { onAdd: (value: string) => void }) {
  const [value, setValue] = useState('');
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={() => setEditing(true)}
        sx={{
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1.5,
          px: 1.5,
          py: 1,
          cursor: 'pointer',
          color: 'text.secondary',
        }}
      >
        <AddIcon fontSize="small" />
        <Typography variant="body2">Add a source we missed</Typography>
      </Stack>
    );
  }

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue('');
    setEditing(false);
  };

  return (
    <Stack direction="row" spacing={1}>
      <TextField
        size="small"
        autoFocus
        fullWidth
        placeholder="Source name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') {
            setValue('');
            setEditing(false);
          }
        }}
        onBlur={submit}
      />
    </Stack>
  );
}

/**
 * Settings > Subscriptions — marks which `metadata.source` values
 * count as a paid subscription, feeding the Statistics > Subscription
 * Value feature. Placed low on the Settings page, per David's
 * preference (see chat) — it's a one-time setup step most people
 * won't need to revisit often.
 */
export function SubscriptionsSection() {
  const data = useSubscriptionSources();

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <SubscriptionsOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Box>
          <Typography variant="body1" fontWeight={500}>
            Subscriptions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Mark which Source values are paid subscriptions, so Statistics can tell them
            apart from things like Theatrical or Physical Media.
          </Typography>
        </Box>
      </Stack>

      <Alert severity="info" sx={{ fontSize: 13 }}>
        We pre-selected the usual subscription services based on what&apos;s common for
        each type. Flip any toggle to change it, or add a source we missed.
      </Alert>

      {data === undefined ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : (
        GROUPS.map((group) => (
          <Stack key={group.label} spacing={1}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ textTransform: 'uppercase', letterSpacing: 0.3 }}
            >
              {group.label}
            </Typography>

            {group.mediaTypeIds.flatMap((mediaTypeId) =>
              (data.sourcesByMediaType[mediaTypeId] ?? []).map((source) => (
                <Stack
                  key={`${mediaTypeId}-${source}`}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1.5,
                    pl: 1.5,
                    pr: 0.5,
                    py: 0.25,
                  }}
                >
                  <Typography variant="body2">
                    {source}
                    {group.mediaTypeIds.length > 1 && (
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        {mediaTypeId}
                      </Typography>
                    )}
                  </Typography>
                  <Switch
                    size="small"
                    checked={isSubscriptionSource(data.config, mediaTypeId, source)}
                    onChange={(_, checked) =>
                      setSubscriptionSourceFlag(mediaTypeId, source, checked)
                    }
                    inputProps={{ 'aria-label': `Toggle ${source} as a subscription` }}
                  />
                </Stack>
              )),
            )}

            <AddSourceRow
              onAdd={(value) => {
                // A manually-added source always applies to the first
                // media type in the group — for single-type groups
                // (Podcasts, Audiobooks, Books) that's the only
                // sensible choice; for Film/TV/Anime it lands on Film,
                // which is fine since Statistics matches on the exact
                // string regardless of which of the three types it was
                // logged under.
                const targetMediaTypeId = group.mediaTypeIds[0];
                if (targetMediaTypeId)
                  setSubscriptionSourceFlag(targetMediaTypeId, value, true);
              }}
            />
          </Stack>
        ))
      )}
    </Stack>
  );
}
