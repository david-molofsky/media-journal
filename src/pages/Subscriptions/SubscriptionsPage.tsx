import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { useSubscriptionCostData } from '@/hooks/useSubscriptionCostData';
import { useAvailableYears } from '@/hooks/useAvailableYears';
import { StatsYearSelector } from '@/components/statistics/StatsYearSelector';
import { BrandIcon } from '@/components/dashboard/BrandIcon';
import {
  SUBSCRIPTION_LOGO_SLUGS,
  SUBSCRIPTION_FALLBACK_COLOURS,
} from '@/utils/subscriptionBrandIcons';
import {
  setSubscriptionTier,
  setSubscriptionPriceOverride,
  setSubscriptionBillingCycle,
  setSubscriptionAnnualPrice,
  type SubscriptionBillingCycle,
} from '@/services/subscriptions/subscriptionCostService';
import { PRICING_CURRENCY_SYMBOL } from '@/services/subscriptions/subscriptionPricing';
import { PagePlaceholder } from '@/components/common/PagePlaceholder';
import { LoadingIndicator } from '@/components/common/LoadingIndicator';
import { ROUTES } from '@/routes/paths';
import type { SubscriptionCostRow } from '@/services/subscriptions/subscriptionCostService';
import type { GoodValueStatus } from '@/services/statistics/subscriptionValueService';
import type { StatsYearScope } from '@/services/statistics/statisticsService';

const VALUE_LABEL: Record<
  'Good' | 'Fair' | 'Poor',
  { text: string; colour: 'success' | 'warning' | 'error' }
> = {
  Good: { text: 'Good value', colour: 'success' },
  Fair: { text: 'Fair value', colour: 'warning' },
  Poor: { text: 'Poor value', colour: 'error' },
};

function scoreLabel(row: SubscriptionCostRow): {
  text: string;
  colour: 'success' | 'warning' | 'error' | 'default';
} {
  if (row.belowThreshold) return { text: 'Not enough data yet', colour: 'default' };
  if (row.score >= 60) return VALUE_LABEL.Good;
  if (row.score >= 40) return VALUE_LABEL.Fair;
  return VALUE_LABEL.Poor;
}

function scoreBarColour(
  row: SubscriptionCostRow,
): 'success.main' | 'warning.main' | 'error.main' | 'text.disabled' {
  if (row.belowThreshold) return 'text.disabled';
  if (row.score >= 60) return 'success.main';
  if (row.score >= 40) return 'warning.main';
  return 'error.main';
}

function formatMonth(monthKey: string): string {
  return dayjs(`${monthKey}-01`).format('MMMM YYYY');
}

/** Renders the "last month this qualified as good value" line — see
 * `getGoodValueHistory`'s doc comment for what each state means. */
function goodValueLine(status: GoodValueStatus): { text: string; muted: boolean } {
  if (status.state === 'current') {
    return {
      text: `Good value every month since ${formatMonth(status.month!)}`,
      muted: false,
    };
  }
  if (status.state === 'past') {
    return { text: `Last good value: ${formatMonth(status.month!)}`, muted: false };
  }
  return { text: 'Not yet good value in the tracked history', muted: true };
}

/** Real logo (same `<BrandIcon>` treatment as the welcome screen's
 * import-source boxes) when one exists for this source, otherwise the
 * previous colour-coded initial badge — see subscriptionBrandIcons.ts
 * for which sources have a real mark and which fall back. */
function SubscriptionLogo({ source }: { source: string }) {
  const slug = SUBSCRIPTION_LOGO_SLUGS[source];
  if (slug) {
    return <BrandIcon slug={slug} size={34} />;
  }
  const colour = SUBSCRIPTION_FALLBACK_COLOURS[source] ?? '#616161';
  return (
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
      {source.charAt(0)}
    </Box>
  );
}

interface PriceEditDialogProps {
  open: boolean;
  row: SubscriptionCostRow;
  currencySymbol: string;
  onClose: () => void;
}

function PriceEditDialog({ open, row, currencySymbol, onClose }: PriceEditDialogProps) {
  // MUI's Dialog unmounts its content on close by default (no
  // `keepMounted`), so these `useState` initializers re-run fresh
  // against the latest `row` every time it's reopened — no separate
  // reset-on-open effect needed.
  const [cycle, setCycle] = useState<SubscriptionBillingCycle>(row.billingCycle);
  const [monthlyValue, setMonthlyValue] = useState(
    row.billingCycle === 'monthly' && row.isOverridden && row.effectivePrice !== null
      ? String(row.effectivePrice)
      : '',
  );
  const [annualValue, setAnnualValue] = useState(
    row.annualBilling ? String(row.annualBilling.annualPrice) : '',
  );

  const hasOverride = row.isOverridden;
  // The "monthly plan" baseline to compare an annual price against —
  // the tier price (or existing monthly override) when one exists,
  // `null` for a custom source with neither, in which case there's
  // nothing to show savings against.
  const monthlyBaseline = row.annualBilling
    ? row.annualBilling.monthlyBaseline
    : row.effectivePrice;

  const parsedAnnual = Number(annualValue);
  const validAnnual =
    annualValue.trim() !== '' && Number.isFinite(parsedAnnual) && parsedAnnual >= 0;
  const monthlyEquivalent = validAnnual ? parsedAnnual / 12 : null;
  const savingsAmount =
    validAnnual && monthlyBaseline !== null ? monthlyBaseline * 12 - parsedAnnual : null;
  const savingsPercent =
    savingsAmount !== null && monthlyBaseline !== null && monthlyBaseline > 0
      ? (savingsAmount / (monthlyBaseline * 12)) * 100
      : null;

  const handleSave = async () => {
    await setSubscriptionBillingCycle(row.source, cycle);
    if (cycle === 'monthly') {
      const parsed = Number(monthlyValue);
      if (monthlyValue.trim() && Number.isFinite(parsed) && parsed >= 0) {
        await setSubscriptionPriceOverride(row.source, parsed);
      }
    } else if (validAnnual) {
      await setSubscriptionAnnualPrice(row.source, parsedAnnual);
    }
    onClose();
  };

  const handleClear = async () => {
    await setSubscriptionPriceOverride(row.source, null);
    await setSubscriptionAnnualPrice(row.source, null);
    await setSubscriptionBillingCycle(row.source, 'monthly');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Set price for {row.source}</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={cycle}
          onChange={(_e, value: SubscriptionBillingCycle | null) =>
            value && setCycle(value)
          }
          sx={{ mt: 1, mb: 2 }}
        >
          <ToggleButton value="monthly">Monthly</ToggleButton>
          <ToggleButton value="annual">Annual</ToggleButton>
        </ToggleButtonGroup>

        {cycle === 'monthly' ? (
          <TextField
            autoFocus
            fullWidth
            label="Monthly price"
            type="text"
            inputProps={{ inputMode: 'decimal' }}
            value={monthlyValue}
            onChange={(e) => setMonthlyValue(e.target.value.replace(/[^0-9.]/g, ''))}
            InputProps={{ startAdornment: <Box sx={{ mr: 0.5 }}>{currencySymbol}</Box> }}
            helperText="Overrides the tier price above, if this source has one."
          />
        ) : (
          <>
            <TextField
              autoFocus
              fullWidth
              label="Annual price"
              type="text"
              inputProps={{ inputMode: 'decimal' }}
              value={annualValue}
              onChange={(e) => setAnnualValue(e.target.value.replace(/[^0-9.]/g, ''))}
              InputProps={{
                startAdornment: <Box sx={{ mr: 0.5 }}>{currencySymbol}</Box>,
              }}
              helperText="What you're actually billed once a year — not a discount percentage."
            />
            {monthlyEquivalent !== null && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1 }}
              >
                = {currencySymbol}
                {monthlyEquivalent.toFixed(2)}/mo effective
                {savingsAmount !== null &&
                  savingsPercent !== null &&
                  savingsAmount > 0 && (
                    <>
                      <br />
                      <Box component="span" sx={{ color: 'success.main' }}>
                        Saves {currencySymbol}
                        {savingsAmount.toFixed(2)}/yr ({savingsPercent.toFixed(0)}%) vs
                        paying {currencySymbol}
                        {monthlyBaseline!.toFixed(2)} monthly
                      </Box>
                    </>
                  )}
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {(hasOverride || row.annualBilling) && (
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
  const [detailOpen, setDetailOpen] = useState(false);
  const label = scoreLabel(row);
  const hasTiers = row.tiers && row.tiers.length > 0;
  const hasPrice = row.effectivePrice !== null;
  const gv = goodValueLine(row.goodValueHistory);

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
        <SubscriptionLogo source={row.source} />
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
        <Stack alignItems="flex-end" spacing={0}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Typography variant="subtitle1" fontWeight={700}>
              {hasPrice
                ? `${currencySymbol}${row.effectivePrice!.toFixed(2)}/mo`
                : 'Set price'}
            </Typography>
            <IconButton size="small" onClick={() => setEditOpen(true)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Stack>
          {row.annualBilling && (
            <Typography variant="caption" color="success.main">
              billed annually
              {row.annualBilling.savingsPercent !== null &&
              row.annualBilling.savingsPercent > 0
                ? ` · saves ${row.annualBilling.savingsPercent.toFixed(0)}%`
                : ''}
            </Typography>
          )}
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
              {row.billingCycle === 'annual'
                ? 'Billed annually — clear it to use the tier price again.'
                : 'Manual price override is active — clear it to use the tier price again.'}
            </Typography>
          )}
        </FormControl>
      )}

      {/* Same score detail as Statistics > Subscription Score — see
          SubscriptionValueCard/SubscriptionRow, which this mirrors. */}
      <Box sx={{ mt: 1.5, cursor: 'pointer' }} onClick={() => setDetailOpen((v) => !v)}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="baseline"
          sx={{ mb: 0.5 }}
        >
          <Typography variant="caption" color="text.secondary">
            Score{' '}
            <Box component="span" sx={{ color: scoreBarColour(row), fontWeight: 700 }}>
              {row.score}
            </Box>
          </Typography>
          <ExpandMoreIcon
            fontSize="small"
            sx={{
              color: 'text.secondary',
              transform: detailOpen ? 'rotate(180deg)' : 'none',
              transition: '0.15s',
            }}
          />
        </Stack>
        <Box
          sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}
        >
          <Box
            sx={{
              height: '100%',
              width: `${row.score}%`,
              borderRadius: 3,
              bgcolor: scoreBarColour(row),
            }}
          />
        </Box>
      </Box>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        flexWrap="wrap"
        sx={{ mt: 1.25, rowGap: 1 }}
      >
        {hasPrice ? (
          <Chip
            size="small"
            label={label.text}
            color={label.colour === 'default' ? undefined : label.colour}
            variant="outlined"
          />
        ) : (
          <Chip size="small" variant="outlined" label="Add a price to see value" />
        )}
        {row.queuedCount > 0 && (
          <Chip
            size="small"
            icon={<InventoryOutlinedIcon sx={{ fontSize: 14 }} />}
            label={`${row.queuedCount} queued`}
          />
        )}
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
        {!gv.muted && (
          <EmojiEventsOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        )}
        <Typography
          variant="caption"
          color={gv.muted ? 'text.disabled' : 'text.secondary'}
        >
          {gv.text}
        </Typography>
      </Stack>

      <Collapse in={detailOpen}>
        <Box sx={{ mt: 1.5, pt: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
          <Stack
            direction="row"
            spacing={3}
            sx={{ mb: row.topTitles.length > 0 ? 1 : 0 }}
          >
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
            <Box>
              <Typography variant="body1" fontWeight={700} lineHeight={1.2}>
                {row.hoursThisYear !== null ? row.hoursThisYear.toFixed(1) : '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                hrs (Film/TV) last 12mo
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

      <PriceEditDialog
        open={editOpen}
        row={row}
        currencySymbol={currencySymbol}
        onClose={() => setEditOpen(false)}
      />
    </Box>
  );
}

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const availableYears = useAvailableYears();
  const [year, setYear] = useState<StatsYearScope>('last12');
  const data = useSubscriptionCostData(year);

  if (data === undefined || availableYears === undefined) return <LoadingIndicator />;

  if (data.rows.length === 0) {
    return (
      <PagePlaceholder
        title="No subscriptions flagged yet"
        description="Head to Settings > Subscriptions and flag the sources you pay for — Netflix, Spotify, and so on — to start tracking their cost and value here."
      />
    );
  }

  const currencySymbol = data.pricingRegion
    ? PRICING_CURRENCY_SYMBOL[data.pricingRegion]
    : '';

  // Priced rows are already sorted first by getSubscriptionCostSummary
  // — find where the priceless group starts so a divider can separate
  // them, same as Statistics does for "fewer than 3 completed".
  const firstPricelessIndex = data.rows.findIndex((r) => r.effectivePrice === null);

  return (
    <Box sx={{ px: 2, pt: 2, pb: 4 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" component="h1" fontWeight={600}>
          Subscriptions
        </Typography>
        <StatsYearSelector year={year} years={availableYears} onChange={setYear} />
      </Stack>

      {!data.pricingRegion && (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Your Region setting isn't US or UK, so hardcoded price tiers aren't available —
          every source below needs a manual price via the pencil icon.
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
            <Typography
              variant="subtitle1"
              fontWeight={700}
              color={`${VALUE_LABEL[data.overallValueLabel].colour}.main`}
            >
              {data.overallValueLabel}
            </Typography>
          </Stack>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 1 }}
        >
          Spend factors in each source's annual-billing discount where set. Score above is
          scoped to{' '}
          {year === 'last12' ? 'the last 12 months' : year === null ? 'all time' : year}.
        </Typography>
        {(data.bestValueSource || data.worstValueSource) && (
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
            {data.bestValueSource && (
              <Chip
                size="small"
                color="success"
                variant="outlined"
                label={`Best value: ${data.bestValueSource}`}
              />
            )}
            {data.worstValueSource && (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={`Worst value: ${data.worstValueSource}`}
              />
            )}
          </Stack>
        )}
      </Box>

      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', mb: 1 }}
      >
        Flagged as subscriptions · {data.rows.length}
      </Typography>

      {data.rows.map((row, i) => (
        <Box key={row.source}>
          {i === firstPricelessIndex && i > 0 && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ my: 1.5 }}>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ whiteSpace: 'nowrap' }}
              >
                No price set
              </Typography>
              <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
            </Stack>
          )}
          <SubscriptionCard row={row} currencySymbol={currencySymbol} />
        </Box>
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
