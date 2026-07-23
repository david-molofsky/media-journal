import { useState } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SubscriptionsOutlinedIcon from '@mui/icons-material/SubscriptionsOutlined';
import AddIcon from '@mui/icons-material/Add';
import { useSubscriptionSources } from '@/hooks/useSubscriptionSources';
import {
  setSubscriptionSourceFlag,
  isSubscriptionSource,
} from '@/services/subscriptions/subscriptionSourcesService';
import { SUBSCRIPTION_VALUE_GROUPS } from '@/services/statistics/subscriptionValueService';
import { CollapsibleSection } from '@/components/settings/CollapsibleSection';

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
 *
 * Categories (`SUBSCRIPTION_VALUE_GROUPS` — shared with the
 * Statistics page's Subscription Value cards, so the two can't drift
 * apart) render as collapsible accordions, collapsed by default, to
 * keep the settings page short. Each service is listed once per
 * category (deduplicated across that category's media types) and the
 * toggle is global — flipping "Disney+" on covers every entry logged
 * with that Source, across Film, TV, and Anime alike, since the flag
 * is no longer scoped to a single media type. See chat (Settings >
 * Subscriptions redesign) and subscriptionSourcesService.ts.
 */
export function SubscriptionsSection() {
  const data = useSubscriptionSources();
  const [expanded, setExpanded] = useState<string | false>(
    SUBSCRIPTION_VALUE_GROUPS[0]?.title ?? false,
  );

  return (
    <CollapsibleSection title="Subscriptions" icon={SubscriptionsOutlinedIcon}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Mark which Source values are paid subscriptions, so Statistics can tell them apart
        from things like Theatrical or Physical Media.
      </Typography>

      <Alert severity="info" sx={{ fontSize: 13, mb: 2 }}>
        Each service is listed once and applies everywhere it&apos;s used — marking
        Disney+ here covers it for Film, TV, and Anime entries alike. We pre-selected the
        usual subscription services; flip any toggle to change it, or add a source we
        missed.
      </Alert>

      {data === undefined ? (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      ) : (
        SUBSCRIPTION_VALUE_GROUPS.map((group) => {
          const sources = data.sourcesByGroup[group.title] ?? [];
          const subscriptionCount = sources.filter((source) =>
            isSubscriptionSource(data.config, source),
          ).length;

          return (
            <Accordion
              key={group.title}
              expanded={expanded === group.title}
              onChange={(_, isExpanded) => setExpanded(isExpanded ? group.title : false)}
              disableGutters
              sx={{ '&:before': { display: 'none' } }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack>
                  <Typography variant="body2" fontWeight={600}>
                    {group.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sources.length} service{sources.length === 1 ? '' : 's'} ·{' '}
                    {subscriptionCount === 0
                      ? 'none marked as subscriptions'
                      : `${subscriptionCount} marked as subscription${subscriptionCount === 1 ? '' : 's'}`}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  {sources.map((source) => (
                    <Stack
                      key={source}
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
                      <Typography variant="body2">{source}</Typography>
                      <Switch
                        size="small"
                        checked={isSubscriptionSource(data.config, source)}
                        onChange={(_, checked) => setSubscriptionSourceFlag(source, checked)}
                        inputProps={{ 'aria-label': `Toggle ${source} as a subscription` }}
                      />
                    </Stack>
                  ))}

                  <AddSourceRow onAdd={(value) => setSubscriptionSourceFlag(value, true)} />
                </Stack>
              </AccordionDetails>
            </Accordion>
          );
        })
      )}
    </CollapsibleSection>
  );
}
