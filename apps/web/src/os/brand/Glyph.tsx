const PATHS = {
  minimize: "M6 12h12",
  maximize: "M6.5 6.5h11v11h-11z",
  restore: "M8.5 9.5h9v9h-9zM6.5 14.5v-9h9",
  close: "M7 7l10 10M17 7L7 17",
  back: "M14.5 6l-6 6 6 6",
  reload: "M18 12a6 6 0 1 1-1.8-4.3M18.5 5v4h-4",
} as const;

export type GlyphName = keyof typeof PATHS;

/** Functional control glyphs (window controls). Always paired with an accessible name. */
export function Glyph({ name }: { name: GlyphName }) {
  return (
    <svg className="glyph" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
