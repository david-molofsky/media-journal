import { useState, type MouseEvent } from 'react';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import type { FilterChipOption } from '@/components/library/FilterChip';

interface MultiFilterChipProps {
  label: string;
  values: string[];
  options: FilterChipOption[];
  onChange: (values: string[]) => void;
}

/** "A, B" for 2, "A, B +N" for 3+, so the chip stays a one-liner
 * regardless of how many options are selected. */
function formatChipLabel(label: string, selected: FilterChipOption[]): string {
  if (selected.length === 0) return label;
  const names = selected.map((s) => s.label);
  if (names.length <= 2) return `${label}: ${names.join(', ')}`;
  const extra = names.length - 2;
  return `${label}: ${names.slice(0, 2).join(', ')} +${extra}`;
}

/**
 * A multi-select Library filter chip (Type / Source / Genre / Tag).
 * Same visual language as the single-select FilterChip, but the menu
 * uses checkboxes, stays open across toggles, and matches OR-style —
 * an entry passes if it has any of the selected values. Year/Month
 * remain single-select (FilterChip) by design; only these four
 * category-style filters support multi-select.
 */
export function MultiFilterChip({ label, values, options, onChange }: MultiFilterChipProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const selected = options.filter((option) => values.includes(option.value));

  const toggle = (value: string) => {
    if (values.includes(value)) {
      onChange(values.filter((v) => v !== value));
    } else {
      onChange([...values, value]);
    }
  };

  return (
    <>
      <Chip
        label={formatChipLabel(label, selected)}
        onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
        onDelete={selected.length > 0 ? () => onChange([]) : undefined}
        color={selected.length > 0 ? 'primary' : 'default'}
        variant={selected.length > 0 ? 'filled' : 'outlined'}
      />
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {options.map((option) => {
          const checked = values.includes(option.value);
          return (
            <MenuItem key={option.value} onClick={() => toggle(option.value)} dense>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox edge="start" checked={checked} tabIndex={-1} disableRipple size="small" />
              </ListItemIcon>
              <ListItemText primary={option.label} />
            </MenuItem>
          );
        })}
        {options.length > 0 && (
          <Box>
            <Divider />
            <Box sx={{ px: 2, py: 0.75, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {selected.length > 0 ? `${selected.length} selected` : 'None selected'}
              </Typography>
              {selected.length > 0 && (
                <Link component="button" variant="caption" onClick={() => onChange([])} underline="hover">
                  Clear
                </Link>
              )}
            </Box>
          </Box>
        )}
      </Menu>
    </>
  );
}
