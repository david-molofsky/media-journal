import { useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import { useAvailableRecommendedBy } from '@/hooks/useAvailableRecommendedBy';
import { dedupePersonNames, normalisePersonName } from '@/utils/personNameInput';

interface RecommendedByInputProps {
  value: string[];
  onChange: (names: string[]) => void;
}

/**
 * Freeform multi-name input for who recommended an entry. Same
 * interaction model as `WatchedWithInput` — see its doc comment — but
 * its label never varies by media type, so it's hardcoded here rather
 * than passed in.
 */
export function RecommendedByInput({ value, onChange }: RecommendedByInputProps) {
  const suggestions = useAvailableRecommendedBy();
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
          label="Recommended By"
          placeholder={value.length === 0 ? 'Add a name…' : undefined}
          helperText="Press Enter or Tab to add"
        />
      )}
    />
  );
}
