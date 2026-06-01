/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute base URL of the Tracker backend API, e.g. https://api.tracker.xasanboy.dev/api/v1.
   *  Unset in dev → the app falls back to the relative '/api/v1' (reverse-proxied by Vite/nginx). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
