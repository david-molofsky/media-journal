/**
 * Media type configuration.
 *
 * Per the Database Schema & Data Model document (section 5), media
 * types are configuration, not code: adding a new media type should
 * require only a new row in the `mediaTypes` table, not a code change.
 * Forms (Milestone 3) render dynamically from `fields`, and dashboards
 * (Milestone 5) read `colour`/`icon` for styling — neither hard-codes
 * a specific media type.
 */

/** Supported input types for a dynamically-rendered metadata field. */
export type FieldInputType = 'text' | 'number' | 'date';

/** Describes a single metadata field belonging to a media type. */
export interface FieldDefinition {
  /** Key under which the value is stored in `MediaEntry.metadata`. */
  key: string;
  /** Label shown to the user in forms. */
  label: string;
  type: FieldInputType;
  required: boolean;
}

/** A configured media type (e.g. Book, Film, TV Season, Comic Issue). */
export interface MediaType {
  /** Stable identifier, also used as the value of `MediaEntry.mediaType`. */
  id: string;
  displayName: string;
  /** Material icon name (see Database Schema & Data Model, section 5). */
  icon: string;
  /** Accent colour used in charts, badges and summary cards. */
  colour: string;
  /** Whether this media type is currently selectable when adding entries. */
  enabled: boolean;
  /** Metadata fields specific to this media type, rendered dynamically. */
  fields: FieldDefinition[];
}

/** Shape used when creating or editing a media type via Settings (Milestone 7). */
export type MediaTypeInput = Omit<MediaType, 'enabled'> & { enabled?: boolean };
