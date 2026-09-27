# Pit Wall On-Call: Design System

- **Status:** v1, 2026-09-28. Source of truth for every UI task (roadmap: "UI quality bar").
- **Direction:** decision D14, "variant 1": a neutral observability console. IBM Plex, Grafana-like slate, one blue accent. Dark is the default, with a light theme.
- **Not this:** no motorsport or F1 theming, no emoji, no decorative icons, no gradients or glow. The product name is only a name.

## 1. Principles

1. **It should feel like a real tool.** Players should recognize an incident console they could use at work. Anything decorative has to earn its place as information.
2. **Status is always text.** Every state has a word: `Crit`, `Warn`, `Healthy`, `Degraded`, `Critical`, `Resolved`. Color adds to the word and never replaces it, so the UI is colorblind-safe.
3. **Density with hierarchy.** The console is dense. Each panel has one job, and panels line up on a 12 px grid.
4. **Nothing is unexplained.** A disabled control has a visible reason nearby, and an empty panel says why it is empty.

## 2. Color tokens

Tokens live in `apps/web/src/styles/tokens.css`. Components use tokens only, never raw hex values.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#111217` | `#f4f5f7` | Page background |
| `--panel` | `#181b1f` | `#ffffff` | Panels and cards |
| `--raised` | `#1f2329` | `#f8f9fb` | Buttons, map nodes |
| `--sunken` | `#0d0e12` | `#eef0f3` | Meters, inputs, kbd |
| `--border` | `#2a2f36` | `#dce0e5` | Panel borders, dividers |
| `--border-strong` | `#3a414b` | `#c3c9d1` | Control borders, edges |
| `--text` | `#d8dee9` | `#1f2329` | Primary text |
| `--muted` | `#8e97a5` | `#5a6270` | Secondary text, timestamps, labels |
| `--faint` | `#5f6875` | `#8a929e` | Non-text only (disabled strokes, grid lines) |
| `--accent` | `#3d71d9` | `#2f5fc4` | Primary action, selection, focus ring |
| `--accent-hover` | `#4f82e6` | `#264fa6` | Primary hover |
| `--accent-soft` | 16% accent | 10% accent | Selected chips, info tags |
| `--accent-text` | `#8ab4ff` | `#2f5fc4` | Accent-colored text |
| `--crit` | `#f2495c` | `#c9283b` | Critical status |
| `--warn` | `#ff9830` | `#b85c12` | Warning status |
| `--ok` | `#73bf69` | `#2a7d34` | Healthy and resolved |
| `--info` | `#5cc8ff` | `#0a73a8` | Informational log level |

Each status color has a `-soft` background (about 12% alpha) for tags. The light `--ok` is darkened from the prototype's `#2f8a3a` so tag text reaches 4.5:1.

**Contrast rule:** body text and timestamps use `--text` or `--muted` (at least 4.5:1 on `--bg` and `--panel` in both themes). `--faint` is never used for text.

## 3. Typography

- **Sans:** IBM Plex Sans 400/500/600, for UI text. **Mono:** IBM Plex Mono 400/500, for numbers, clocks, logs and values. Both are self-hosted through `@fontsource` (no third-party font requests).
- Every number that changes over time uses `font-variant-numeric: tabular-nums`, so digits don't jitter.

| Token | Size | Use |
|---|---|---|
| `--fs-xs` | 11px | Panel headers (uppercase, 0.06em tracking), tags, hints |
| `--fs-sm` | 12px | Buttons, log lines |
| `--fs` | 13px | Console body text |
| `--fs-md` | 15px | Landing and debrief body, large buttons |
| `--fs-lg` | 20px | Card titles |
| `--fs-xl` | 28px | Clock, metric values, debrief tiles |
| `--fs-2xl` | 40px | Landing and debrief headlines |

Copy is sentence case. Panel headers are the only uppercase text.

## 4. Space, radius, layout

- Spacing scale: 4, 8, 12, 16, 24, 32, 48 px (`--space-1` … `--space-7`). The console gap is 12 px.
- Radius: 8 px for panels and cards, 6 px for buttons, 4 px for tags and kbd.
- **Console (≥1024 px):** a 56 px top bar; three columns (280 px alerts and notes · flexible map and metrics · 320 px actions); a 220 px log stream at the bottom. Nothing scrolls the page; panels scroll inside themselves.
- **Landing and debrief:** single column, max 880 px, 16 px side gutters, no horizontal scroll at 375 px.
- Below 1024 px, the console is not offered. The landing explains why in plain text instead of hiding the start button without a reason.

## 5. Components and states

Every interactive component covers: default, hover, pressed (`:active` moves it down 1 px), focus-visible (2 px accent outline, 2 px offset), disabled (42% opacity, `not-allowed` cursor, with the reason shown nearby), and, where relevant, selected or running.

| Component | Notes |
|---|---|
| Button | `.btn` secondary, `.btn.primary` for the single most important action on a screen, `.btn-lg` on landing and debrief. |
| Tag | `.tag.crit / .warn / .ok / .info`: 11px, 600 weight, uppercase, always a word. |
| Segmented control | `.seg` for the theme switch; `aria-pressed` marks the active option. |
| Panel | `.panel` with `.ph` (header), `.pb` (scrolling body), `.pf` (footer). |
| Service node | An HTML button over an SVG edge layer. Shows name, detail, a health word and its number key. Selected nodes get an accent border and `aria-pressed="true"`. |
| Metric panel | Label, current value (mono, 28px, colored at warn and crit thresholds and tagged), and a 2-minute sparkline with dashed threshold lines. |
| Action button | Label plus its duration. While running it shows a 2 px progress bar, and the panel shows "Running: <action> · N s left". |
| Log line | Time · level · service · message, all mono. Findings from the player's own actions are highlighted and labeled `FOUND`. |
| Budget meter | 6 px bar with marks at 50% and 80%. The value is text next to it. |
| Overlay | Pause and error states: a scrim, a centered card, focus on its primary button. |

## 6. Keyboard

| Key | Where | Action |
|---|---|---|
| `A` | Page | Acknowledge |
| `1`–`9` | Console | Select a service (in map order) |
| `Esc` | Console | Clear the log filter |
| `P` | Page and console | Pause or resume |
| `Tab` / `Enter` | Everywhere | Every control is a real button or link |

Shortcuts ignore key presses with Ctrl, Cmd or Alt held, and are shown as `<kbd>` hints next to their controls.

## 7. Motion

- Motion is functional only: 120 ms hover and press transitions, a progress bar on running actions, and a dashed flow on edges into a critical service.
- `prefers-reduced-motion: reduce` turns off all transitions and animations. Nothing in the game depends on motion.

## 8. Accessibility checklist (per UI task)

- Every control can be reached and used with the keyboard, with a visible focus ring.
- Status is conveyed by text, not color alone.
- The alert feed is an `aria-live="polite"` region. The page card is an `alertdialog`. The pause and error cards are dialogs whose primary button gets focus.
- Every state is designed: empty (no alerts, no logs, nothing noted), running, paused, resolved, DNF and error.

## 9. Shell (PitOS, M1.5)

The desktop follows decision D17 and `docs/specs/2026-09-28-pitos-desktop-design.md`.

### Layout tokens

| Token | Value | Use |
|---|---|---|
| `--topbar-h` | 32px | Top bar height |
| `--dock-h` | 72px | Space reserved for the dock (a 56px bar plus an 8px margin above and below) |
| `--titlebar-h` | 36px | Window title bar |
| `--radius-window` | 10px | Windows, notifications and the dock (0 when maximized) |
| `--shadow-window` | layered shadow | Focused window elevation. Unfocused windows use `--shadow-window-rest`. |
| `--topbar-bg` / `--topbar-text` | `#0b0c0f` / `#e6e9ee` | The top bar is near-black in both themes, as in GNOME |
| `--app-*` | one colour per app | App icon squircles: monitoring blue, browser teal, chat violet, files amber, settings slate, trash grey, phone green |

### Components and states

| Component | States |
|---|---|
| Top bar | Activities (pressed while the overview is open), clock, tray: on-call pill (`On call · Primary`, or `Paged` in crit colour while paging), Phone button with a count badge, System menu |
| Dock | Item: default, hover (raised 2px), pressed, focus ring, running (4px accent dot), badge (count on crit background, also in the accessible name). A tooltip with the app name appears on hover and focus. |
| Window | Focused (title in `--text`, strong border, `--shadow-window`), unfocused (title in `--muted`, rest shadow), maximized (no radius or shadow), snapped left/right, minimized (hidden, still mounted). Controls: minimize, maximize/restore, close, each a labelled button with a line glyph. |
| Notification | Default (dismissable), critical (3px crit left border, not dismissable, `alertdialog`). Actions are buttons. |
| Overview | Scrim plus a grid of window cards (icon, title, "minimized" state). Empty: "No windows open. Pick an app from the dock." |
| Widgets | `fortune`, world clock, sticky note: panels at 85% opacity over the wallpaper |
| Lockscreen | Wallpaper, a 64px mono clock, and cards at 85% opacity. At 375px the cards take the full width minus 16px gutters. |

### Cursors

`apps/web/public/cursors/*.svg` holds an original set (arrow, pointer, text, grab, grabbing, resize, wait), used when `data-cursor="pitos"`. With "Use system cursor" on, `data-cursor="system"` uses the browser's own cursors.

### Motion

Windows open with a 120ms fade and scale from 0.98. The phone shakes while paging. Both are turned off by `prefers-reduced-motion` or Settings → Reduce motion (`data-motion="reduce"`).

### Text size

Settings → Larger text sets `data-text="large"`, which raises the type scale by 2px per step.
