/**
 * Minimal RFC4180 CSV parser — handles quoted fields (with embedded
 * commas, newlines, and escaped "" quotes), which Letterboxd's export
 * relies on for the Tags column. Deliberately hand-rolled rather than
 * a dependency: the input shape here is narrow (a handful of known
 * export formats), so a small parser is easier to reason about than
 * pulling in a general-purpose CSV library for one use case.
 *
 * Returns an array of row objects keyed by the header row. Rows with
 * a different column count than the header are skipped rather than
 * thrown, so one malformed line doesn't abort the whole file.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];

  const header = rows[0];
  if (!header) return [];

  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length !== header.length) continue;
    const record: Record<string, string> = {};
    for (let col = 0; col < header.length; col++) {
      const key = header[col];
      const value = row[col];
      if (key !== undefined) record[key] = value ?? '';
    }
    records.push(record);
  }
  return records;
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Normalize line endings so \r\n inside/outside quotes behaves the same.
  const input = text.replace(/\r\n/g, '\n');

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  // Final field/row (files don't always end with a trailing newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}
