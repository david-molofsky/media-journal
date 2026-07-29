import dayjs, { type Dayjs } from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

interface EntryDatePickerProps {
  label: string;
  /** ISO `yyyy-mm-dd`, matching the rest of the app's date convention
   * (see `dateUtils.ts`). */
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onBlur?: () => void;
  error?: boolean;
  helperText?: string;
  required?: boolean;
}

/** Year range is dynamic — current year ± this span — rather than
 * fixed, so it never goes stale (Date Selector Year Picker spec,
 * confirmed 2026-07-25). */
const YEAR_RANGE_SPAN = 50;

/**
 * Entry start/end date field. Replaces the previous native
 * `<input type="date">`, whose OS-rendered calendar couldn't be
 * customised with a tap-to-scroll year list.
 *
 * `views={['year', 'day']}` is what gives the approved Variant A
 * behaviour for free: tapping the "March 2026"-style header swaps the
 * day grid for a scrollable year list (MUI X's built-in year view,
 * auto-scrolled to the current selection), and tapping a year returns
 * to the day grid with that year applied. `openTo="day"` keeps the
 * default landing view as the day grid, matching the original
 * calendar-first spec — the year list is opt-in via the header tap,
 * not the default view.
 *
 * Scoped to Entry start/end dates only — Library/Statistics filters
 * and import-dialog date fields are untouched native inputs.
 */
export function EntryDatePicker({
  label,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required,
}: EntryDatePickerProps) {
  const minDate = dayjs().subtract(YEAR_RANGE_SPAN, 'year').startOf('year');
  const maxDate = dayjs().add(YEAR_RANGE_SPAN, 'year').endOf('year');

  return (
    <DatePicker
      label={label}
      views={['year', 'day']}
      openTo="day"
      minDate={minDate}
      maxDate={maxDate}
      value={value ? dayjs(value) : null}
      onChange={(newValue: Dayjs | null) => {
        onChange(newValue && newValue.isValid() ? newValue.format('YYYY-MM-DD') : undefined);
      }}
      slotProps={{
        textField: {
          fullWidth: true,
          required,
          error,
          helperText,
          onBlur,
        },
      }}
    />
  );
}
