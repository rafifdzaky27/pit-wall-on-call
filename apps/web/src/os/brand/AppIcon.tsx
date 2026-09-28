import type { ReactNode } from "react";
import type { AppId } from "../apps/ids";
import { LOGO_GLYPH } from "./Logo";

export type IconName = AppId | "phone" | "home";

// Original line glyphs on a squircle (DESIGN.md §9). Functional app icons, not decoration.
const GLYPHS: Record<IconName, ReactNode> = {
  monitoring: LOGO_GLYPH,
  browser: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M5.5 12h13M12 5.5c1.9 2 2.8 4.2 2.8 6.5s-.9 4.5-2.8 6.5c-1.9-2-2.8-4.2-2.8-6.5s.9-4.5 2.8-6.5z" />
    </>
  ),
  chat: (
    <>
      <path d="M6 7.5A2 2 0 0 1 8 5.5h8a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2h-5l-3.5 3v-3H8a2 2 0 0 1-2-2z" />
      <path d="M9.5 10.3h5" />
    </>
  ),
  files: (
    <>
      <path d="M5 8a1.5 1.5 0 0 1 1.5-1.5h3.3l1.7 1.7h6A1.5 1.5 0 0 1 19 9.7v7.3a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17z" />
      <path d="M5 10.5h14" />
    </>
  ),
  settings: (
    <>
      <path d="M5.5 8.5h13M5.5 15.5h13" />
      <circle cx="9.5" cy="8.5" r="1.9" />
      <circle cx="14.5" cy="15.5" r="1.9" />
    </>
  ),
  trash: (
    <>
      <path d="M6.5 8h11M10 8V6.3h4V8" />
      <path d="M7.8 8l.9 10.2h6.6L16.2 8" />
    </>
  ),
  postmortem: (
    <>
      <path d="M7.5 5h6.5l3 3v11h-9.5z" />
      <path d="M14 5v3h3M9.8 12h5M9.8 15h5" />
    </>
  ),
  phone: (
    <>
      <rect x="8.2" y="4.5" width="7.6" height="15" rx="1.8" />
      <path d="M11 16.8h2" />
    </>
  ),
  home: (
    <>
      <path d="M5.5 11.5L12 6l6.5 5.5" />
      <path d="M7.5 10v8h9v-8M10.5 18v-4h3v4" />
    </>
  ),
};

export function AppIcon({ app, size = 40 }: { app: IconName; size?: number }) {
  return (
    <svg className={`app-icon app-${app}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <rect className="app-icon-bg" x="0" y="0" width="24" height="24" rx="5.5" />
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[app]}
      </g>
    </svg>
  );
}
