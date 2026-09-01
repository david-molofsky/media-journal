import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import type { FieldCount } from '@/hooks/useSelectionFieldCounts';

interface RemoveFieldSelectProps {
  label: string;
  placeholder: string;
  options: FieldCount[];
  value: string[];
  onChange: (values: string[]) => void;
  totalSelected: number;
}

/**
 * Multi-select for Remove mode in BulkActionBar's Genre/Tag dialogs.
 * Deliberately NOT freeSolo (unlike GenreInput/TagInput used for Add
 * mode) — removing a value that isn't already on any selected entry
 * would always be a no-op, so only values actually present are
 * offered, each annotated with "(N of M)" so it's clear how many
 * entries it'll affect.
 */
export function RemoveFieldSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  totalSelected,
}: RemoveFieldSelectProps) {
  return (
    <Autocomplete
      multiple
      options={options.map((o) => o.value)}
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      getOptionLabel={(option) => option}
      renderOption={(props, option) => {
        const match = options.find((o) => o.value === option);
        return (
          <li {...props} key={option}>
            {option}
            {match && (
              <span style={{ marginLeft: 8, opacity: 0.6, fontSize: 12 }}>
                {match.count} of {totalSelected}
              </span>
            )}
          </li>
        );
      }}
      renderTags={(values, getTagProps) =>
        values.map((option, index) => (
          <Chip {...getTagProps({ index })} label={option} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? placeholder : undefined}
        />
      )}
      noOptionsText="No matches to remove"
    />
  );
}
