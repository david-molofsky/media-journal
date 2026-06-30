/**
 * Centralised colour tokens.
 *
 * Media-type accent colours are defined here (rather than inline in
 * components) so that charts, badges and summary cards can all reference
 * the same source of truth. When new media types are introduced in
 * `mediaTypes` configuration (see services/database), a matching entry
 * should be added here.
 */
export const mediaTypeColours: Record<string, string> = {
  book: '#1976D2', // Blue
  audiobook: '#7B1FA2', // Purple
  film: '#D32F2F', // Red
  tv: '#388E3C', // Green
  comic: '#F57C00', // Orange
};

export const fallbackMediaColour = '#616161';

export function getMediaTypeColour(mediaTypeId: string): string {
  return mediaTypeColours[mediaTypeId] ?? fallbackMediaColour;
}
