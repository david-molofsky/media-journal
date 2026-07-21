import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  base: '/media-journal/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Media Journal',
        short_name: 'Media Journal',
        description:
          'A personal, offline-first archive for everything you read, watch and listen to.',
        theme_color: '#2E7D32',
        background_color: '#FFFBFE',
        display: 'standalone',
        start_url: '/media-journal/',
        scope: '/media-journal/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the app shell; all user data lives in IndexedDB, not in the
        // service worker cache, so this only ever needs to cache static assets.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        // oauth-callback.html (MAL/Trakt OAuth return target) must be
        // served as the actual static file, not redirected to the SPA
        // shell — without this, the service worker's default
        // navigate-to-index.html fallback intercepts the provider's
        // redirect back and boots the app fresh at its default route
        // instead of running the callback-handling script, silently
        // dropping the `code`/`state` params and breaking every OAuth
        // connection (see chat).
        navigateFallbackDenylist: [/^\/media-journal\/oauth-callback\.html$/],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
