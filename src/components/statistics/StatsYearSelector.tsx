import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import type { StatsYearScope } from '@/services/statistics/statisticsService';

interface StatsYearSelectorProps {
  year: StatsYearScope;
  years: number[];
  onChange: (year: StatsYearScope) => void;
}

/** Sentinels used only as the underlying MUI Select value — never
 * leave this component (the public API speaks `StatsYearScope`). */
const ALL_VALUE = 'all';
const LAST_12_VALUE = 'last12';

/**
 * Year selector for the Statistics page only — adds a "Last 12
 * months" option on top of specific years and "All time", so every
 * section on the page (including Subscription Value) can share one
 * rolling window without needing its own separate time control. See
 * chat (Statistics page filters applying to Subscription Value).
 *
 * Deliberately a separate component from the shared `YearSelector`
 * (Dashboard + Statistics) rather than adding this option there —
 * Dashboard has no rolling-window concept to serve and shouldn't
 * gain a third state it has no use for.
 */
export function StatsYearSelector({ year, years, onChange }: StatsYearSelectorProps) {
  const options =
    typeof year === 'number' && !years.includes(year) ? [year, ...years].sort((a, b) => b - a) : years;

  const selectValue = year === null ? ALL_VALUE : year === 'last12' ? LAST_12_VALUE : year;

  return (
    <FormControl size="small">
      <Select
        value={selectValue}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === ALL_VALUE) {
            onChange(null);
          } else if (raw === LAST_12_VALUE) {
            onChange('last12');
          } else {
            onChange(Number(raw));
          }
        }}
      >
        <MenuItem value={ALL_VALUE}>All time</MenuItem>
        <MenuItem value={LAST_12_VALUE}>Last 12 months</MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
