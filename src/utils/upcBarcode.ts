/**
 * Normalises a detected barcode to a digit string suitable for the UPC
 * lookup services (UPCMDB, UPCitemdb — both general GTIN databases
 * that accept either UPC-A or EAN-13 lookups). Shared by
 * UpcScanDialog.tsx (Films) and ComicUpcScanDialog.tsx (Comics single
 * issues) — both scan for the same barcode symbologies and need the
 * same normalisation, so this lives in one place rather than being
 * duplicated per dialog.
 *
 * Validates by digit shape (12 digits, or 13 digits) rather than
 * trusting `barcode.format`. Real-world BarcodeDetector implementations
 * report that field inconsistently across Android OEMs/WebView
 * vendors — a previous version gated on an exact
 * `format === 'upc_a'`/`'ean_13'` string match, which silently
 * rejected correctly-scanned codes on devices that labelled the
 * symbology differently. The `formats` filter passed to
 * `new BarcodeDetector(...)` already restricts what gets detected in
 * the first place, so re-deriving validity from the digits themselves
 * here is safe and far more portable.
 *
 * A 13-digit code starting with "0" is a North American UPC-A code
 * zero-padded into EAN-13 form, so it's un-padded back to 12 digits
 * (matches how UPCMDB indexes those). Any other 13-digit code is a
 * genuine EAN-13 — the norm on UK/European retail media, which is NOT
 * a padded UPC-A and must be passed through at full length rather than
 * rejected (see chat: a previous version only accepted the two UPC-A
 * shapes, silently discarding every real EAN-13 scan).
 */
export function normalizeBarcode(barcode: { rawValue: string; format: string }): string | null {
  const raw = barcode.rawValue;
  if (/^\d{12}$/.test(raw)) return raw;
  if (/^0\d{12}$/.test(raw)) return raw.slice(1);
  if (/^\d{13}$/.test(raw)) return raw;
  return null;
}
