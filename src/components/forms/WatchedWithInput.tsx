import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import { useAvailableWatchedWith } from '@/hooks/useAvailableWatchedWith';
import { dedupePersonNames, normalisePersonName } from '@/utils/personNameInput';

interface WatchedWithInputProps {
  value: string[];
  onChange: (names: string[]) => void;
  /** Per-media-type label — "Watched With", "Listened With", "Read
   * With", or "Played With" — see `companionFieldLabels.ts`. */
  label: string;
}

/**
 * Freeform multi-name input for who an entry was watched/listened
 * to/read/played with. Same interaction model as TagInput/GenreInput
 * (Enter/Tab/blur to commit, × to remove, freeSolo for anyone not in
 * the suggestion list), but names are left as typed rather than
 * lowercased or Title Cased — see `personNameInput.ts`.
 */
export function WatchedWithInput({ value, onChange, label }: WatchedWithInputProps) {
  const suggestions = useAvailableWatchedWith();
  const [inputValue, setInputValue] = useState('');

  const handleChange = (_: unknown, newValue: unknown[]) => {
    const strings = newValue.flatMap((item) => (typeof item === 'string' ? [item] : []));
    onChange(dedupePersonNames(strings));
    setInputValue('');
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      options={suggestions.filter((name) => !value.includes(name))}
      value={value}
      onChange={handleChange}
      inputValue={inputValue}
      onInputChange={(_, newInputValue, reason) => {
        if (reason !== 'reset') {
          setInputValue(newInputValue);
        }
      }}
      // Stop Enter from bubbling to the parent <form> element — same
      // reasoning as TagInput.
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
        }
      }}
      onBlur={(e) => {
        const pending = normalisePersonName((e.target as HTMLInputElement).value);
        if (pending && !value.some((v) => v.toLowerCase() === pending.toLowerCase())) {
          onChange([...value, pending]);
        }
        setInputValue('');
      }}
      renderTags={(nameValues, getTagProps) =>
        nameValues.map((name, index) => (
          <Chip {...getTagProps({ index })} label={name} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={value.length === 0 ? 'Add a name…' : undefined}
          helperText="Press Enter or Tab to add"
        />
      )}
    />
  );
}
