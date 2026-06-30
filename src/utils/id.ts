/** Generates a unique identifier for new records. */
export function generateId(): string {
  return crypto.randomUUID();
}
