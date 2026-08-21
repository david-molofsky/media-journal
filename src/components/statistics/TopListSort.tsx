import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { TopListItem } from '@/components/statistics/TopList';

export type TopListSortMode = 'countDesc' | 'countAsc' | 'ratingDesc' | 'ratingAsc';

const SORT_LABELS: Record<TopListSortMode, string> = {
  countDesc: 'Most watched',
  countAsc: 'Least watched',
  ratingDesc: 'Highest rated',
  ratingAsc: 'Lowest rated',
};

/** Sorts a TopList's items by the chosen mode. Items with no rating
 * sort to the bottom for both rating modes (an unrated item isn't
 * meaningfully "highest" or "lowest" rated), rather than clustering at
 * whichever end the raw undefined-as-0 comparison would happen to put
 * them. */
export function sortTopListItems(items: TopListItem[], mode: TopListSortMode): TopListItem[] {
  const sorted = [...items];
  switch (mode) {
    case 'countDesc':
      sorted.sort((a, b) => b.count - a.count);
      break;
    case 'countAsc':
      sorted.sort((a, b) => a.count - b.count);
      break;
    case 'ratingDesc':
      sorted.sort((a, b) => (b.rating ?? -Infinity) - (a.rating ?? -Infinity));
      break;
    case 'ratingAsc':
      sorted.sort((a, b) => (a.rating ?? Infinity) - (b.rating ?? Infinity));
      break;
  }
  return sorted;
}

interface TopListSortSelectProps {
  value: TopListSortMode;
  onChange: (value: TopListSortMode) => void;
}

/** Compact "Most watched / Least watched / Highest rated / Lowest
 * rated" sort dropdown, shared by the Sources and People sections
 * (see chat, Aug 2026). */
export function TopListSortSelect({ value, onChange }: TopListSortSelectProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as TopListSortMode)}
      size="small"
      variant="standard"
      sx={{ fontSize: 13 }}
    >
      {(Object.keys(SORT_LABELS) as TopListSortMode[]).map((mode) => (
        <MenuItem key={mode} value={mode} sx={{ fontSize: 13 }}>
          {SORT_LABELS[mode]}
        </MenuItem>
      ))}
    </Select>
  );
}
