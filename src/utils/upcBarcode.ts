/**
 * Normalises a detected barcode to a 12-digit UPC-A string. Shared by
 * UpcScanDialog.tsx (Films) and ComicUpcScanDialog.tsx (Comics single
 * issues) — both scan for the same barcode symbologies and need the
 * same normalisation, so this lives in one place rather than being
 * duplicated per dialog.
 *
 * Some BarcodeDetector implementations report a UPC-A code under
 * format "upc_a" directly; others report it as a 13-digit "ean_13"
 * value with a leading zero (UPC-A is a strict subset of EAN-13).
 * Anything else returns null — both dialogs only open from forms where
 * a UPC is the expected barcode type, so no ISBN-style prefix
 * filtering is needed, but a barcode of the wrong length shouldn't be
 * sent to a lookup as if it were a valid UPC.
 */
export function toUpc12(barcode: { rawValue: string; format: string }): string | null {
  if (barcode.format === 'upc_a' && barcode.rawValue.length === 12) return barcode.rawValue;
  if (barcode.format === 'ean_13' && barcode.rawValue.length === 13 && barcode.rawValue.startsWith('0')) {
    return barcode.rawValue.slice(1);
  }
  return null;
}
