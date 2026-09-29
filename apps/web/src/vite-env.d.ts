/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GIT_SHA?: string;
  /** The e2e build only: pins practice shifts to one incident. */
  readonly VITE_PIN_INCIDENT?: string;
}
