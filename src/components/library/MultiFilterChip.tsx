import { useState, type MouseEvent } from 'react';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { alpha } from '@mui/material/styles';
import type { FilterChipOption } from '@/components/library/FilterChip';

/** Tri-state selection for one MultiFilterChip: every option is either
 * untouched, in `include`, or in `exclude` — never both at once. */
export interface TriStateSelection {
  include: string[];
  exclude: string[];
}

interface MultiFilterChipProps {
  label: string;
  value: TriStateSelection;
  options: FilterChipOption[];
  onChange: (value: TriStateSelection) => void;
}

type RowState = 'off' | 'include' | 'exclude';

function rowState(optionValue: string, value: TriStateSelection): RowState {
  if (value.include.includes(optionValue)) return 'include';
  if (value.exclude.includes(optionValue)) return 'exclude';
  return 'off';
}

/** Tapping a row cycles it off -> include -> exclude -> off (see chat,
 * Aug 2026 — chosen over a separate +/- control pair as the smallest
 * change to the existing checkbox menu). */
function cycle(optionValue: string, value: TriStateSelection): TriStateSelection {
  const state = rowState(optionValue, value);
  if (state === 'off') {
    return { include: [...value.include, optionValue], exclude: value.exclude };
  }
  if (state === 'include') {
    return {
      include: value.include.filter((v) => v !== optionValue),
      exclude: [...value.exclude, optionValue],
    };
  }
  return {
    include: value.include,
    exclude: value.exclude.filter((v) => v !== optionValue),
  };
}

/** "A, −B" for 2, "A, −B +N" for 3+ — included options render plain,
 * excluded ones prefixed with "−", so the chip stays a one-liner
 * regardless of how many options are selected. */
function formatChipLabel(
  label: string,
  includeSelected: FilterChipOption[],
  excludeSelected: FilterChipOption[],
): string {
  const parts = [
    ...includeSelected.map((s) => s.label),
    ...excludeSelected.map((s) => `−${s.label}`),
  ];
  if (parts.length === 0) return label;
  if (parts.length <= 2) return `${label}: ${parts.join(', ')}`;
  const extra = parts.length - 2;
  return `${label}: ${parts.slice(0, 2).join(', ')} +${extra}`;
}

/** The tri-state indicator shown at the start of each menu row, in
 * place of a plain Checkbox — a small square that's empty (off),
 * filled primary with a check (include), or filled error with a cross
 * (exclude). */
function StateBox({ state }: { state: RowState }) {
  if (state === 'off') {
    return (
      <Box
        sx={{
          width: 18,
          height: 18,
          borderRadius: '4px',
          border: '1.5px solid',
          borderColor: 'action.disabled',
          flexShrink: 0,
        }}
      />
    );
  }
  const isInclude = state === 'include';
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: '4px',
        flexShrink: 0,
        bgcolor: isInclude ? 'primary.main' : 'error.main',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {isInclude ? (
        <CheckIcon sx={{ fontSize: 14, color: '#fff' }} />
      ) : (
        <CloseIcon sx={{ fontSize: 14, color: '#fff' }} />
      )}
    </Box>
  );
}

/**
 * A tri-state Library filter chip (Type / Source / Genre / Tag).
 * Same visual language as the single-select FilterChip, but the menu
 * lists every option with a tap-to-cycle state (off / include /
 * exclude) instead of a checkbox. Matching entryService.ts's
 * `passesCategory`: an entry passes if it has none of the Excluded
 * values, and — only when at least one value is Included — has at
 * least one of them too. Year/Month remain single-select (FilterChip)
 * by design; only these four category-style filters support
 * include/exclude (see chat, Aug 2026).
 */
export function MultiFilterChip({
  label,
  value,
  options,
  onChange,
}: MultiFilterChipProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const includeSelected = options.filter((option) =>
    value.include.includes(option.value),
  );
  const excludeSelected = options.filter((option) =>
    value.exclude.includes(option.value),
  );
  const hasSelection = includeSelected.length > 0 || excludeSelected.length > 0;

  return (
    <>
      <Chip
        label={formatChipLabel(label, includeSelected, excludeSelected)}
        onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
        onDelete={hasSelection ? () => onChange({ include: [], exclude: [] }) : undefined}
        color={
          includeSelected.length > 0
            ? 'primary'
            : excludeSelected.length > 0
              ? 'error'
              : 'default'
        }
        variant={hasSelection ? 'filled' : 'outlined'}
      />
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {options.map((option) => {
          const state = rowState(option.value, value);
          return (
            <MenuItem
              key={option.value}
              onClick={() => onChange(cycle(option.value, value))}
              dense
              sx={
                state === 'exclude'
                  ? { bgcolor: (theme) => alpha(theme.palette.error.main, 0.08) }
                  : undefined
              }
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <StateBox state={state} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    sx={
                      state === 'exclude' ? { textDecoration: 'line-through' } : undefined
                    }
                  >
                    {option.label}
                  </Typography>
                }
              />
            </MenuItem>
          );
        })}
        {options.length > 0 && (
          <Box>
            <Divider />
            <Box
              sx={{
                px: 2,
                py: 0.75,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {hasSelection
                  ? [
                      includeSelected.length > 0
                        ? `${includeSelected.length} include`
                        : null,
                      excludeSelected.length > 0
                        ? `${excludeSelected.length} exclude`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'None selected'}
              </Typography>
              {hasSelection && (
                <Link
                  component="button"
                  variant="caption"
                  onClick={() => onChange({ include: [], exclude: [] })}
                  underline="hover"
                >
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
