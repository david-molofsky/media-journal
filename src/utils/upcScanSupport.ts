/**
 * Feature detection for UPC barcode scanning (Film entry form only —
 * see chat: Comics single-issue UPC scanning is a separate, lower-
 * priority backlog item using a different lookup service/fuzzy-match
 * flow, not this one). Same no-polyfill approach as isbnScanSupport.ts:
 * on unsupported browsers the scan button simply doesn't render.
 */

const UPC_BARCODE_MEDIA_TYPES = new Set(['film']);

export function hasUpcScan(mediaTypeId: string): boolean {
  return UPC_BARCODE_MEDIA_TYPES.has(mediaTypeId);
}

/** Checks both that BarcodeDetector exists at all, and that this
 * specific device/browser's implementation actually supports UPC-A —
 * some platforms expose the API but only support a subset of formats.
 * ean_13 is checked too: some BarcodeDetector implementations report a
 * scanned UPC-A code as a 13-digit EAN-13 value with a leading zero
 * rather than as format "upc_a" (see toUpc12 in UpcScanDialog.tsx). */
export async function isUpcScanAvailable(): Promise<boolean> {
  if (!('BarcodeDetector' in window) || !window.BarcodeDetector) return false;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('upc_a') || formats.includes('ean_13');
  } catch {
    return false;
  }
}
