import { useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { FieldSelectedSections } from '@mui/x-date-pickers/models';

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

  // Tracks which section is currently selected so the very first tap
  // into an unfocused field can be forced onto Day (see below) — `null`
  // means "unfocused", matching MUI's own convention for this prop.
  const [selectedSections, setSelectedSections] = useState<FieldSelectedSections>(null);

  return (
    <DatePicker
      label={label}
      views={['year', 'day']}
      openTo="day"
      minDate={minDate}
      maxDate={maxDate}
      value={value ? dayjs(value) : null}
      onChange={(newValue: Dayjs | null) => {
        // Only propagate a genuine clear (`null`, e.g. the field's own
        // clear button) or a fully-typed, valid date. A date that's
        // merely mid-edit — some sections filled in, others not yet —
        // also comes through as non-null-but-invalid on every keystroke;
        // previously that was treated the same as a clear and wiped the
        // field back to blank underneath whatever the user had already
        // typed (see chat, Aug 2026 — "Completed dates not being
        // accepted/input properly"). Silently ignoring that transient
        // state instead leaves `value` (and therefore what's displayed)
        // untouched until typing actually finishes.
        if (newValue === null) {
          onChange(undefined);
          return;
        }
        if (newValue.isValid()) {
          onChange(newValue.format('YYYY-MM-DD'));
        }
      }}
      selectedSections={selectedSections}
      onSelectedSectionsChange={(newSections) => {
        // MUI's own default lands the very first tap into an unfocused
        // field on the Year section rather than Day (confirmed via
        // screen recording, Aug 2026 — happens on both empty and
        // already-filled fields). Override just that one transition:
        // unfocused (`null`) -> newly selecting something that isn't
        // Day. A direct, explicit tap on a specific section while the
        // field is already focused is a later, separate change and is
        // left alone, so re-editing e.g. just the year still works
        // normally once you're in the field.
        if (selectedSections === null && newSections !== null && newSections !== 'day') {
          setSelectedSections('day');
          return;
        }
        setSelectedSections(newSections);
      }}
      slotProps={{
        textField: {
          fullWidth: true,
          required,
          error,
          helperText,
          onBlur: () => {
            // Unfocusing resets the "just focused" tracking above, so
            // the next tap into the field is treated as a fresh focus
            // again rather than as a continuation of this session.
            setSelectedSections(null);
            onBlur?.();
          },
        },
      }}
    />
  );
}
