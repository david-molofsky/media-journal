# Media Journal

Media Journal is a personal, offline-first archive for everything you read, watch and listen to. It combines a journal, wishlist, goals, statistics, recommendations, podcast subscriptions and import tools in one installable web app.

## What it tracks

Media Journal supports books, audiobooks, comics, films, television seasons, podcasts and user-defined media types. Entries can include completion dates, ratings, notes, genres, tags, creators, sources and format-specific metadata.

## Key features

- A unified journal and wishlist with search, filters and yearly views
- Offline storage using IndexedDB
- Custom media types and metadata fields
- Goals, statistics, series tracking and recommendations
- Podcast subscriptions and episode imports
- Imports from supported CSV formats and connected services
- Optional connections to MyAnimeList, Trakt, Audiobookshelf, Jellyfin and Plex
- Versioned local backups and optional Google Drive backup
- Installable PWA support, including the Android Trusted Web Activity release

## Data and privacy

Journal data is stored locally in the browser using IndexedDB. Media Journal does not require an account. Data leaves the device only when the user deliberately uses an external lookup, import, connection, export or backup feature.

Version 2 backups include entries, media-type definitions, podcast subscriptions and safe preferences. Authentication tokens, server credentials and device-specific settings are excluded. Older Version 1 backups remain importable with the restrictions shown by the restore preview.

See the published [privacy policy](public/privacy.html) for details about external services and data handling.

## Development

Requirements:

- Node.js 22
- npm

Install dependencies and start the local development server:

```bash
npm ci
npm run dev
```

The production site uses the `/media-journal/` base path. Local Vite development supplies the appropriate development URL automatically.

## Quality checks

Run the same core checks used for pull requests:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run build
```

The GitHub Actions workflows in `.github/workflows` run pull-request checks and deploy the production build to GitHub Pages.

## Project structure

- `src/components` — reusable interface components
- `src/pages` — route-level screens
- `src/services/database` — IndexedDB schema, migrations and persistence
- `src/services/importExport` — backup and import workflows
- `src/services/metadata` — external metadata and connected-service clients
- `src/services/podcasts` — podcast discovery and feed processing
- `src/models` — application data types
- `src/utils` — shared utilities
- `public` — static assets, OAuth callback and privacy policy

Application TypeScript belongs under `src`; root-level TypeScript files are reserved for build configuration.

## Versioning

`package.json` is the authoritative application version. Vite injects that value into the app at build time, so the version shown in Settings and service client identification stay aligned.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch, commit and pull-request conventions.

## Production

- Web app: [david-molofsky.github.io/media-journal](https://david-molofsky.github.io/media-journal/)
- Repository: [github.com/david-molofsky/media-journal](https://github.com/david-molofsky/media-journal)
