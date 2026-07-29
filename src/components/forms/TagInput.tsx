import { useState } from 'react';
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
 *   • Auto-lowercased and trimmed on commit.
 *   • Added by pressing Enter or Tab, selecting from the dropdown,
 *     or simply moving focus away from the field (onBlur commit).
 *   • Removed by clicking the × on the chip.
 *
 * The input text is a controlled `inputValue` state rather than left to
 * MUI's own internal reset — that internal reset doesn't reliably fire
 * once a custom onKeyDown (below) is attached, which previously left the
 * committed tag's text sitting in the field after Enter.
 */
export function TagInput({ value, onChange }: TagInputProps) {
  const suggestions = useAvailableTags();
  const [inputValue, setInputValue] = useState('');

  const normalise = (raw: string) => raw.trim().toLowerCase();

  const handleChange = (_: unknown, newValue: unknown[]) => {
    const strings = newValue.flatMap((item) =>
      typeof item === 'string' ? [item] : [],
    );
    const normalised = Array.from(new Set(strings.map(normalise).filter(Boolean)));
    onChange(normalised);
    setInputValue('');
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      options={suggestions.filter((tag) => !value.includes(tag))}
      value={value}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={(_, newInputValue, reason) => {
        // 'reset' fires on commit/blur/clear — we own that case
        // explicitly (via handleChange/onBlur below) so it doesn't
        // fight with our controlled state.
        if (reason !== 'reset') {
          setInputValue(newInputValue);
        }
      }}
      // Stop Enter from bubbling to the parent <form> element.
      // Without this, pressing Enter to commit a tag simultaneously
      // triggers form submission before RHF can register the new tag.
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
        }
      }}
      // Commit any text still in the input when focus leaves the field.
      // Handles the case where the user types a tag then clicks Save
      // without pressing Enter first.
      onBlur={(e) => {
        const pending = (e.target as HTMLInputElement).value.trim().toLowerCase();
        if (pending && !value.includes(pending)) {
          onChange([...value, pending]);
        }
        setInputValue('');
      }}
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
