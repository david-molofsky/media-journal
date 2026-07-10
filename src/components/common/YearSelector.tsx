import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';

interface YearSelectorProps {
  /** `null` means "All" — every year combined. */
  year: number | null;
  years: number[];
  onChange: (year: number | null) => void;
}

/** Sentinel used only as the underlying MUI Select value — never
 * leaves this component (the public API speaks `number | null`). */
const ALL_VALUE = 'all';

/** Year selector used by both the Dashboard header and the Statistics
 * screen, including an "All" option for all-time totals. Always
 * includes the currently-selected year even if it has no entries yet,
 * so a freshly-created year stays selectable. */
export function YearSelector({ year, years, onChange }: YearSelectorProps) {
  const options = year !== null && !years.includes(year) ? [year, ...years].sort((a, b) => b - a) : years;

  return (
    <FormControl size="small">
      <Select
        value={year === null ? ALL_VALUE : year}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === ALL_VALUE ? null : Number(raw));
        }}
      >
        <MenuItem value={ALL_VALUE}>All</MenuItem>
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
