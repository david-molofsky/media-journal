import { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

export type ManualCodeType = 'isbn' | 'upc';

interface ManualCodeEntryProps {
  codeType: ManualCodeType;
  /** Lifts the current input value up so the dialog's Search button
   * (in DialogActions, outside this component) can read it and decide
   * whether it's enabled. Kept as a controlled value rather than this
   * component owning its own Search button, since every dialog already
   * has its own DialogActions layout to fit into. */
  value: string;
  onChange: (value: string) => void;
}

/** True if `raw` (after stripping spaces/hyphens) is a plausible ISBN:
 * 10 digits, or 13 digits starting with 978/979 (ISBN-13's registered
 * Bookland prefixes) — mirrors IsbnScanDialog's own isIsbnPrefix check
 * for the 13-digit case, and additionally accepts the older 10-digit
 * form since a person typing from the back cover may have either. */
function isValidIsbn(raw: string): boolean {
  if (/^\d{10}$/.test(raw)) return true;
  if (/^(978|979)\d{10}$/.test(raw)) return true;
  return false;
}

/** True if `raw` (after stripping spaces/hyphens) is a plausible UPC —
 * 12 digits (UPC-A), or 13 digits (EAN-13, the UK/European norm — see
 * normalizeBarcode's comment in upcBarcode.ts for why both are valid
 * inputs to the same lookup services). */
function isValidUpc(raw: string): boolean {
  return /^\d{12}$/.test(raw) || /^\d{13}$/.test(raw);
}

/** Strips spaces and hyphens a person might type/paste from a printed
 * code, leaving just digits for validation and lookup. */
export function cleanManualCode(input: string): string {
  return input.replace(/[\s-]/g, '');
}

export function isValidManualCode(codeType: ManualCodeType, input: string): boolean {
  const cleaned = cleanManualCode(input);
  return codeType === 'isbn' ? isValidIsbn(cleaned) : isValidUpc(cleaned);
}

const COPY: Record<ManualCodeType, { label: string; placeholder: string; helper: string }> = {
  isbn: {
    label: 'ISBN-10 or ISBN-13',
    placeholder: 'e.g. 9780306475722',
    helper: 'Enter the number printed under the barcode.',
  },
  upc: {
    label: 'UPC-A (12 digits)',
    placeholder: 'e.g. 025192123024',
    helper: 'Enter the number printed under the barcode.',
  },
};

/**
 * Manual code entry field, shared by IsbnScanDialog, UpcScanDialog
 * (Films) and ComicUpcScanDialog. Reused rather than duplicated across
 * all three since the field, validation and copy are identical — only
 * the code type (and therefore regex/labels) differs. See chat: wireframe
 * confirmed 2026-09-01.
 *
 * Deliberately has no Search button of its own — each dialog's own
 * DialogActions renders that, gated on isValidManualCode(codeType,
 * value), so the button styling/placement matches that dialog's
 * existing action row exactly.
 */
export function ManualCodeEntry({ codeType, value, onChange }: ManualCodeEntryProps) {
  const [touched, setTouched] = useState(false);
  const copy = COPY[codeType];
  const cleaned = cleanManualCode(value);
  const valid = value.length > 0 && isValidManualCode(codeType, value);
  const showError = touched && value.length > 0 && !valid;

  return (
    <Stack spacing={1}>
      <TextField
        autoFocus
        fullWidth
        label={copy.label}
        placeholder={copy.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        error={showError}
        inputProps={{ inputMode: 'numeric' }}
      />
      {showError ? (
        <Typography variant="caption" color="error">
          {codeType === 'isbn'
            ? 'ISBN codes are 10 or 13 digits.'
            : cleaned.length > 0 && cleaned.length < 12
              ? 'UPC codes are 12 digits — this is too short.'
              : 'UPC codes are 12 or 13 digits.'}
        </Typography>
      ) : (
        <Typography variant="caption" color="text.secondary">
          {value.length > 0 && valid ? 'Looks good — tap Search to look this up.' : copy.helper}
        </Typography>
      )}
    </Stack>
  );
}
