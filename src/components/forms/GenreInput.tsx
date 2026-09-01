import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import { useAvailableGenres } from '@/hooks/useAvailableGenres';

interface GenreInputProps {
  value: string[];
  onChange: (genres: string[]) => void;
}

/** Shown even before any entry has used them, so the list isn't empty
 * on a fresh install. Once a genre has been used on an entry it also
 * appears via `useAvailableGenres` — duplicates are deduped below. */
const STARTER_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mystery', 'Non-Fiction', 'Romance', 'Sci-Fi', 'Superhero', 'Thriller',
  'Biography',
];

/**
 * Freeform multi-genre input. Same interaction model as TagInput
 * (Enter/Tab/blur to commit, × to remove, freeSolo for anything not in
 * the suggestion list) but genres are Title Cased rather than
 * lowercased, since that reads more naturally for things like "Sci-Fi".
 */
export function GenreInput({ value, onChange }: GenreInputProps) {
  const available = useAvailableGenres();
  const suggestions = Array.from(new Set([...STARTER_GENRES, ...available])).sort();

  // Splits on both spaces AND hyphens (capturing the separators so
  // they're preserved) — a plain \s+ split treated "Sci-Fi" as one
  // single word, capitalizing only the leading S and lowercasing
  // everything after it (including the F), so "Sci-Fi" always
  // silently became "Sci-fi" no matter how it was typed. See chat,
  // Sept 2026 — this is what produced the Sci-Fi/Sci-fi duplicate
  // genre pair in the first place, not a one-off typo.
  const normalise = (raw: string) =>
    raw
      .trim()
      .replace(/\s+/g, ' ')
      .split(/([ -])/)
      .map((token) =>
        token === ' ' || token === '-'
          ? token
          : token.charAt(0).toUpperCase() + token.slice(1).toLowerCase(),
      )
      .join('');

  const handleChange = (_: unknown, newValue: unknown[]) => {
    const strings = newValue.flatMap((item) =>
      typeof item === 'string' ? [item] : [],
    );
    const normalised = Array.from(new Set(strings.map(normalise).filter(Boolean)));
    onChange(normalised);
  };

  return (
    <Autocomplete
      multiple
      freeSolo
      options={suggestions.filter((genre) => !value.includes(genre))}
      value={value}
      onChange={handleChange}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
        }
      }}
      onBlur={(e) => {
        const pending = normalise((e.target as HTMLInputElement).value);
        if (pending && !value.includes(pending)) {
          onChange([...value, pending]);
        }
      }}
      renderTags={(genreValues, getTagProps) =>
        genreValues.map((genre, index) => (
          <Chip
            {...getTagProps({ index })}
            label={genre}
            size="small"
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label="Genres"
          placeholder={value.length === 0 ? 'Add genres…' : undefined}
          helperText="Press Enter or Tab to add · pick from suggestions or type your own"
        />
      )}
    />
  );
}
