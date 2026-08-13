/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_RECIPE_IMPORT_WORKER_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
