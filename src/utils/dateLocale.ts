/**
 * Maps the existing Region setting (Settings > Region, used for
 * TMDB/JustWatch streaming lookups — see RegionSection.tsx) to a
 * dayjs locale for date *display/input* formatting, per David's
 * instruction: US gets MM/DD, everywhere else gets DD/MM. No separate
 * setting — deliberately reuses `watchProviderRegion` rather than
 * introducing a second region control.
 *
 * Only affects the one MUI X `DatePicker` in the app (EntryDatePicker,
 * via LocalizationProvider in App.tsx) — every other date field is
 * either a native `<input type="date">` (already locale-correct via
 * the OS/browser, outside the app's control) or an explicitly-written
 * string like "4 Aug 2026" (already unambiguous regardless of locale).
 */
export function dayjsLocaleForRegion(regionCode: string): 'en-us' | 'en-gb' {
  return regionCode === 'US' ? 'en-us' : 'en-gb';
}
