import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useSubscriptionCostData } from '@/hooks/useSubscriptionCostData';
import { setSubscriptionTier, setSubscriptionPriceOverride } from '@/services/subscriptions/subscriptionCostService';
import { PRICING_CURRENCY_SYMBOL } from '@/services/subscriptions/subscriptionPricing';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES } from '@/routes/paths';
import type { SubscriptionCostRow } from '@/services/subscriptions/subscriptionCostService';

/** Deterministic-but-arbitrary badge colour per source, for the small
 * logo circle — real brand colours for the 9 hardcoded services (so
 * the calculator's cards visually match the confirmed wireframe),
 * falling back to a neutral grey circle with the source's first
 * letter for anything else (self-hosted sources, custom names). */
const BRAND_COLOURS: Record<string, string> = {
  Netflix: '#E50914',
  'Disney+': '#113CCF',
  'Amazon Prime Video': '#00A8E1',
  Spotify: '#1DB954',
  Audible: '#F8991C',
  'Apple TV+': '#000000',
  Max: '#002BE7',
  Hulu: '#1CE783',
  'NOW TV': '#00A0E4',
};

const VALUE_LABEL: Record<'Good' | 'Fair' | 'Poor', { text: string; colour: 'success' | 'warning' | 'error' }> = {
  Good: { text: 'Good value', colour: 'success' },
  Fair: { text: 'Fair value', colour: 'warning' },
  Poor: { text: 'Poor value', colour: 'error' },
};

function scoreLabel(row: SubscriptionCostRow): { text: string; colour: 'success' | 'warning' | 'error' | 'default' } {
  if (row.belowThreshold) return { text: 'Not enough data yet', colour: 'default' };
  if (row.score >= 60) return VALUE_LABEL.Good;
  if (row.score >= 40) return VALUE_LABEL.Fair;
  return VALUE_LABEL.Poor;
}

interface PriceEditDialogProps {
  open: boolean;
  source: string;
  currentOverride: number | null;
  currencySymbol: string;
  onClose: () => void;
}

function PriceEditDialog({ open, source, currentOverride, currencySymbol, onClose }: PriceEditDialogProps) {
  const [value, setValue] = useState(currentOverride !== null ? String(currentOverride) : '');

  const handleSave = async () => {
    const parsed = Number(value);
    if (value.trim() && Number.isFinite(parsed) && parsed >= 0) {
      await setSubscriptionPriceOverride(source, parsed);
    }
    onClose();
  };

  const handleClear = async () => {
    await setSubscriptionPriceOverride(source, null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Set price for {source}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Monthly price"
          type="text"
          inputProps={{ inputMode: 'decimal' }}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
          InputProps={{ startAdornment: <Box sx={{ mr: 0.5 }}>{currencySymbol}</Box> }}
          sx={{ mt: 1 }}
          helperText="Overrides the tier price above, if this source has one."
        />
      </DialogContent>
      <DialogActions>
        {currentOverride !== null && (
          <Button onClick={() => void handleClear()} color="inherit">
            Clear override
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => void handleSave()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface SubscriptionCardProps {
  row: SubscriptionCostRow;
  currencySymbol: string;
}

function SubscriptionCard({ row, currencySymbol }: SubscriptionCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const colour = BRAND_COLOURS[row.source] ?? '#616161';
  const label = scoreLabel(row);
  const hasTiers = row.tiers && row.tiers.length > 0;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        p: 2,
        mb: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            bgcolor: colour,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          {row.source.charAt(0)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {row.source}
          </Typography>
          {!hasTiers && (
            <Typography variant="caption" color="text.secondary">
              No price table available — manual entry only
            </Typography>
          )}
        </Box>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="subtitle1" fontWeight={700}>
            {row.effectivePrice !== null
              ? `${currencySymbol}${row.effectivePrice.toFixed(2)}/mo`
              : 'Set price'}
          </Typography>
          <IconButton size="small" onClick={() => setEditOpen(true)}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {hasTiers && (
        <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
          <Select
            value={row.selectedTierId ?? ''}
            onChange={(e) => void setSubscriptionTier(row.source, e.target.value)}
            disabled={row.isOverridden}
          >
            {row.tiers?.map((tier) => (
              <MenuItem key={tier.id} value={tier.id}>
                {tier.label} — {currencySymbol}
                {tier.monthlyPrice.toFixed(2)}
              </MenuItem>
            ))}
          </Select>
          {row.isOverridden && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              Manual price override is active — clear it to use the tier price again.
            </Typography>
          )}
        </FormControl>
      )}

      <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          {row.watchedCount.toLocaleString()} item{row.watchedCount === 1 ? '' : 's'} watched
          {row.queuedCount > 0 ? ` · ${row.queuedCount} queued` : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {row.hoursThisYear !== null
            ? `${row.hoursThisYear.toFixed(1)} hrs (Film/TV) this year`
            : 'Hours not tracked for this type'}
        </Typography>
      </Stack>

      <Chip
        size="small"
        label={label.text}
        color={label.colour === 'default' ? undefined : label.colour}
        variant="outlined"
        sx={{ mt: 1 }}
      />

      <PriceEditDialog
        open={editOpen}
        source={row.source}
        currentOverride={row.isOverridden ? (row.effectivePrice ?? null) : null}
        currencySymbol={currencySymbol}
        onClose={() => setEditOpen(false)}
      />
    </Box>
  );
}

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const data = useSubscriptionCostData();

  if (data === undefined) return <LoadingIndicator />;

  if (data.rows.length === 0) {
    return (
      <PagePlaceholder
        title="No subscriptions flagged yet"
        description="Head to Settings > Subscriptions and flag the sources you pay for — Netflix, Spotify, and so on — to start tracking their cost and value here."
      />
    );
  }

  const currencySymbol = data.pricingRegion ? PRICING_CURRENCY_SYMBOL[data.pricingRegion] : '';

  return (
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <Typography variant="h6" component="h1" fontWeight={600} sx={{ mb: 2 }}>
        Subscriptions
      </Typography>

      {!data.pricingRegion && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Your Region setting isn't US or UK, so hardcoded price tiers aren't available — every
          source below needs a manual price via the pencil icon.
        </Alert>
      )}

      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          p: 2,
          mb: 2,
        }}
      >
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Monthly spend
          </Typography>
          <Typography variant="subtitle1" fontWeight={700}>
            {currencySymbol}
            {data.monthlySpend.toFixed(2)}
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Annual spend
          </Typography>
          <Typography variant="subtitle1" fontWeight={700}>
            {currencySymbol}
            {data.annualSpend.toFixed(2)}
          </Typography>
        </Stack>
        {data.overallValueLabel && (
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Overall value
            </Typography>
            <Typography variant="subtitle1" fontWeight={700} color={`${VALUE_LABEL[data.overallValueLabel].colour}.main`}>
              {data.overallValueLabel}
            </Typography>
          </Stack>
        )}
        {(data.bestValueSource || data.worstValueSource) && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
            {data.bestValueSource && (
              <Chip size="small" color="success" variant="outlined" label={`Best value: ${data.bestValueSource}`} />
            )}
            {data.worstValueSource && (
              <Chip size="small" color="warning" variant="outlined" label={`Worst value: ${data.worstValueSource}`} />
            )}
          </Stack>
        )}
      </Box>

      <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Flagged as subscriptions · {data.rows.length}
      </Typography>

      {data.rows.map((row) => (
        <SubscriptionCard key={row.source} row={row} currencySymbol={currencySymbol} />
      ))}

      <Button
        fullWidth
        variant="text"
        startIcon={<SettingsOutlinedIcon />}
        onClick={() => navigate(ROUTES.settings)}
        sx={{ mt: 1 }}
      >
        Manage which sources count as subscriptions
      </Button>
    </Box>
  );
}
