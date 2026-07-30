/**
 * Feature detection for UPC barcode scanning. Two media types, two
 * different lookup flows behind the same button pattern:
 *   - film: UPC -> UPCMDB -> IMDb id -> TMDB (see upcmdbService.ts)
 *   - comic: UPC -> UPCitemdb -> fuzzy match against ComicVine (see
 *     upcitemdbService.ts) — single issues only; trades/graphic novels
 *     use the ISBN scan button instead (isbnScanSupport.ts).
 * Same no-polyfill approach as isbnScanSupport.ts: on unsupported
 * browsers the scan button simply doesn't render.
 */

const UPC_BARCODE_MEDIA_TYPES = new Set(['film', 'comic']);

export function hasUpcScan(mediaTypeId: string): boolean {
  return UPC_BARCODE_MEDIA_TYPES.has(mediaTypeId);
}

/** Checks both that BarcodeDetector exists at all, and that this
 * specific device/browser's implementation actually supports UPC-A —
 * some platforms expose the API but only support a subset of formats.
 * ean_13 is checked too: some BarcodeDetector implementations report a
 * scanned UPC-A code as a 13-digit EAN-13 value with a leading zero
 * rather than as format "upc_a" (see normalizeBarcode in
 * upcBarcode.ts). */
export async function isUpcScanAvailable(): Promise<boolean> {
  if (!('BarcodeDetector' in window) || !window.BarcodeDetector) return false;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('upc_a') || formats.includes('ean_13');
  } catch {
    return false;
  }
}
