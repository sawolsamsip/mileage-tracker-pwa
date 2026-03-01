/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
  export function registerSW(options?: { onOfflineReady?: () => void }): Promise<void>
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_TESLA_CLIENT_ID: string
  readonly VITE_TESLA_REDIRECT_URI: string
  readonly VITE_SMARTCAR_CLIENT_ID: string
  readonly VITE_SMARTCAR_REDIRECT_URI: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
