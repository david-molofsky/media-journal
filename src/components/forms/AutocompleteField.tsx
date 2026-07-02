import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

interface AutocompleteFieldProps {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onBlur: () => void;
  required?: boolean;
  error?: boolean;
  helperText?: string;
}

/**
 * Single-value freeform autocomplete — e.g. "Source" (Netflix, Disney+,
 * Audible, Libby…). Unlike `TagInput`, this stores exactly one string
 * rather than an array, so it's used for fields like Source/Streaming
 * Service rather than multi-value fields like Tags.
 *
 * Deliberately does not apply `toTitleCase` on blur the way plain text
 * fields do: suggested values are already correctly cased brand names
 * (e.g. "Disney+", "HBO Max"), and title-casing free-typed custom values
 * would fight the user's own casing choices for names that don't follow
 * standard title-case rules.
 */
export function AutocompleteField({
  label,
  options,
  value,
  onChange,
  onBlur,
  required = false,
  error = false,
  helperText,
}: AutocompleteFieldProps) {
  return (
    <Autocomplete
      freeSolo
      options={options}
      value={value ?? null}
      onChange={(_, newValue) => {
        onChange(typeof newValue === 'string' && newValue !== '' ? newValue : undefined);
      }}
      onInputChange={(_, newInputValue, reason) => {
        // Keep free-typed text in sync as the user types, not just on
        // selection from the dropdown — otherwise a value typed but
        // never explicitly selected/committed would be lost on submit.
        if (reason === 'input') {
          onChange(newInputValue !== '' ? newInputValue : undefined);
        }
      }}
      onBlur={onBlur}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
        />
      )}
    />
  );
}
