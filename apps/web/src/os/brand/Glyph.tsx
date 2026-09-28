const PATHS = {
  minimize: "M6 12h12",
  maximize: "M6.5 6.5h11v11h-11z",
  restore: "M8.5 9.5h9v9h-9zM6.5 14.5v-9h9",
  close: "M7 7l10 10M17 7L7 17",
  back: "M14.5 6l-6 6 6 6",
  forward: "M9.5 6l6 6-6 6",
  reload: "M18 12a6 6 0 1 1-1.8-4.3M18.5 5v4h-4",
  home: "M5 11.5l7-6 7 6M7 10v8.5h10V10",
  lock: "M7.5 11h9v7.5h-9zM9.5 11V8.5a2.5 2.5 0 0 1 5 0V11",
  search: "M10.5 5.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10zM14.2 14.2l4.3 4.3",
  volume: "M5 9.5h3l4-3.5v12l-4-3.5H5zM15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10",
  mute: "M5 9.5h3l4-3.5v12l-4-3.5H5zM16 10l4 4M20 10l-4 4",
  power: "M12 4.5v7M7.8 7.5a6.5 6.5 0 1 0 8.4 0",
} as const;

export type GlyphName = keyof typeof PATHS;

/** Functional control glyphs (window, tray and toolbar controls). Always paired with an accessible name. */
export function Glyph({ name, size = 16 }: { name: GlyphName; size?: number }) {
  return (
    <svg className="glyph" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
