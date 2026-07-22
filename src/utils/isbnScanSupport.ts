/**
 * Feature detection for ISBN barcode scanning (Book/Audiobook/Comic
 * entry forms). No polyfill — on unsupported browsers the scan button
 * simply doesn't render (see EntryForm.tsx), matching the backlog
 * decision that Android/Chrome-only is acceptable given this app's
 * TWA distribution.
 */

const ISBN_BARCODE_MEDIA_TYPES = new Set(['book', 'audiobook', 'comic']);

export function hasIsbnScan(mediaTypeId: string): boolean {
  return ISBN_BARCODE_MEDIA_TYPES.has(mediaTypeId);
}

/** Checks both that BarcodeDetector exists at all, and that this
 * specific device/browser's implementation actually supports EAN-13
 * (the symbology ISBNs are encoded as) — some platforms expose the
 * API but only support a subset of formats. */
export async function isIsbnScanAvailable(): Promise<boolean> {
  if (!('BarcodeDetector' in window) || !window.BarcodeDetector) return false;
  try {
    const formats = await window.BarcodeDetector.getSupportedFormats();
    return formats.includes('ean_13');
  } catch {
    return false;
  }
}
