/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GIT_SHA?: string;
  /** The e2e build only: pins practice shifts to one incident. */
  readonly VITE_PIN_INCIDENT?: string;
  /** Umami website id; analytics loads only when it is set at build time. */
  readonly VITE_UMAMI_WEBSITE_ID?: string;
}
