import { useState, type MouseEvent } from 'react';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

export interface FilterChipOption {
  label: string;
  value: string;
}

interface FilterChipProps {
  label: string;
  value: string | undefined;
  options: FilterChipOption[];
  onChange: (value: string | undefined) => void;
}

/**
 * A single Library filter chip (Year / Month / Media Type). Opens a
 * menu of choices and shows a delete (×) affordance once a value is
 * selected, per UI & UX Specification, section 5: "Filter chips...
 * Multiple filters can be active simultaneously."
 */
export function FilterChip({ label, value, options, onChange }: FilterChipProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Chip
        label={selected ? `${label}: ${selected.label}` : label}
        onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
        onDelete={selected ? () => onChange(undefined) : undefined}
        color={selected ? 'primary' : 'default'}
        variant={selected ? 'filled' : 'outlined'}
      />
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === value}
            onClick={() => {
              onChange(option.value);
              setAnchorEl(null);
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
