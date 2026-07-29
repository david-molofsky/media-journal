/**
 * Normalises a detected barcode to a 12-digit UPC-A string. Shared by
 * UpcScanDialog.tsx (Films) and ComicUpcScanDialog.tsx (Comics single
 * issues) — both scan for the same barcode symbologies and need the
 * same normalisation, so this lives in one place rather than being
 * duplicated per dialog.
 *
 * Validates by digit shape (12 digits, or 13 digits with a leading
 * zero — UPC-A is a strict subset of EAN-13) rather than trusting
 * `barcode.format`. Real-world BarcodeDetector implementations report
 * that field inconsistently across Android OEMs/WebView vendors — a
 * previous version gated on an exact `format === 'upc_a'`/`'ean_13'`
 * string match, which silently rejected correctly-scanned codes on
 * devices that labelled the symbology differently. The `formats`
 * filter passed to `new BarcodeDetector(...)` already restricts what
 * gets detected in the first place, so re-deriving validity from the
 * digits themselves here is safe and far more portable.
 */
export function toUpc12(barcode: { rawValue: string; format: string }): string | null {
  const raw = barcode.rawValue;
  if (/^\d{12}$/.test(raw)) return raw;
  if (/^0\d{12}$/.test(raw)) return raw.slice(1);
  return null;
}
