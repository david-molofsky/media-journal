import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import { useAvailableTags } from '@/hooks/useAvailableTags';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/**
 * Freeform multi-tag input. Tags are:
 *   • Auto-lowercased and trimmed on commit, so "Sci-Fi" and "sci-fi"
 *     are always stored as the same tag and autocomplete suggestions
 *     don't produce near-duplicates.
 *   • Added by pressing Enter or Tab, or by selecting from the
 *     autocomplete dropdown (which shows all tags already used
 *     elsewhere in the library).
 *   • Removed by clicking the × on the chip.
 *
 * Title-case is intentionally NOT applied here — tags are
 * organisational labels where user-defined casing would be fighting
 * the lowercase normalisation anyway.
 */
export function TagInput({ value, onChange }: TagInputProps) {
  const suggestions = useAvailableTags();

  const normalise = (raw: string) => raw.trim().toLowerCase();

  const handleChange = (_: unknown, newValue: (string | string[])[]) => {
    // Autocomplete with freeSolo can yield strings or the whole array;
    // normalise each item and deduplicate.
    const flat = newValue.flatMap((item) =>
      typeof item === 'string' ? [item] : item,
    );
    const normalised = Array.from(new Set(flat.map(normalise).filter(Boolean)));
    onChange(normalised);
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      options={suggestions.filter((tag) => !value.includes(tag))}
      value={value}
      onChange={handleChange}
      renderTags={(tagValues, getTagProps) =>
        tagValues.map((tag, index) => (
          <Chip
            {...getTagProps({ index })}
            label={tag}
            size="small"
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Tags"
          placeholder={value.length === 0 ? 'Add tags…' : undefined}
          helperText="Press Enter or Tab to add · tags are lowercased automatically"
        />
      )}
    />
  );
}
