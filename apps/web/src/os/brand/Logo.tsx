import type { ReactNode } from "react";

/** The concept Rafif chose in Task 13 (replace the paths with that concept's glyph). */
export const LOGO_GLYPH: ReactNode = (
  <>
    <path d="M4.5 14.5h4l1.8-6.5 2.4 9.5 1.8-3h5" />
    <circle cx="10.3" cy="8" r="1.4" fill="#f2495c" stroke="none" />
  </>
);

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo-mark" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Pit Wall On-Call">
      <rect x="0" y="0" width="24" height="24" rx="5.5" fill="#3d71d9" />
      <g fill="none" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {LOGO_GLYPH}
      </g>
    </svg>
  );
}
