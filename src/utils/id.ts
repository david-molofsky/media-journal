/**
 * Generates a unique identifier for new records.
 *
 * Prefers `crypto.randomUUID()` (available in Safari 15.4+, all modern
 * browsers). Falls back to a manual implementation using
 * `crypto.getRandomValues()` (available since Safari 7 / iOS 7) for
 * older devices that support IndexedDB but not randomUUID().
 */
export function generateId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  // RFC 4122 v4 UUID fallback via getRandomValues.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version 4 and variant bits — non-null assertions are safe
  // because Uint8Array indices 6 and 8 are always defined for length 16.
  (bytes as Uint8Array)[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  (bytes as Uint8Array)[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
