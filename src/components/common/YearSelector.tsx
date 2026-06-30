import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';

interface YearSelectorProps {
  year: number;
  years: number[];
  onChange: (year: number) => void;
}

/** Year selector used by both the Dashboard header (UI & UX
 * Specification, section 4) and the Statistics screen. Always
 * includes the currently-selected year even if it has no entries yet,
 * so a freshly-created year stays selectable. */
export function YearSelector({ year, years, onChange }: YearSelectorProps) {
  const options = years.includes(year) ? years : [year, ...years].sort((a, b) => b - a);

  return (
    <FormControl size="small">
      <Select value={year} onChange={(event) => onChange(Number(event.target.value))}>
        {options.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
