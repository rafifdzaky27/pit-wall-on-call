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

## 9. Shell (PitOS, M1.5 and M1.5.1)

The desktop follows decision D17, `docs/specs/2026-09-28-pitos-desktop-design.md` and its revision `docs/specs/2026-09-28-pitos-polish-design.md`.

### Layout tokens

| Token | Value | Use |
|---|---|---|
| `--topbar-h` | 32px | Top bar height |
| `--titlebar-h` | 36px | Window title bar |
| `--radius-window` | 10px | Windows, notifications, menus and the dock (0 when maximized or snapped) |
| `--shadow-window` | layered shadow | Focused window elevation. Unfocused windows use `--shadow-window-rest`. |
| `--topbar-bg` / `--topbar-text` | `#0b0c0f` / `#e6e9ee` | The top bar is near-black in both themes, as in GNOME |
| `--app-*` | one colour per app | App icon squircles: monitoring blue, browser teal, chat violet, files amber, settings slate, trash grey, phone green, logs steel blue, deploys rust, DB console raspberry, incident red |
| `--avatar-1` … `--avatar-8` | muted hues | Chat avatars, picked per name |

Windows use the whole screen below the top bar; the dock (a 56px bar with an 8px margin, 64px in all) floats over them and hides when covered.

### Layers

| Layer | z-index |
|---|---|
| Windows | 10–999, by rank in the stack |
| Dock | 1000 (1450 while the overview is open) |
| Banners | 1200 |
| Glossary tooltips (`--z-tip`) | 1250 |
| Top bar and its menus | 1300 |
| Overview | 1400 |
| Paused overlay | 1500 |
| Lockscreen | 1600 |

### Components and states

| Component | States |
|---|---|
| Top bar | Activities (pressed while the overview is open); clock with an unread dot, which opens the calendar; tray: on-call pill (`On call · Primary`, or `Paged` in crit colour while paging), Phone with a count badge, System (volume and power glyphs). Only one menu is open at a time; Esc or an outside click closes it. |
| Quick settings | Volume slider with mute, Dark/Light segmented control across the full width, Full screen toggle (only where supported), Settings, About PitOS, Lock |
| Calendar | Notification list (time, source, actions, Clear; "No notifications" when empty) and the month grid with today marked |
| Dock | Item: default, hover (raised 2px), pressed, focus ring, running (4px accent dot), badge (count on crit background, also in the accessible name). The tooltip shows on hover and focus and hides once the item is clicked. Intellihide: hidden while a window covers it; revealed by resting on the bottom edge (150 ms), a swipe up, keyboard focus, the overview or a window drag; hides again 400 ms after the pointer leaves. |
| Window | Focused, unfocused, maximized, snapped left/right, minimized (hidden, still mounted), closing (exit motion, then removed). Eight resize handles (6px edges, 14px corners) with matching cursors; a per-app minimum size; new windows cascade 32px from near the centre; dragging a maximized window restores it under the pointer. |
| Notification | Banner: slides in, hides after 8 s into the calendar list, held while hovered or focused, dismiss button. Critical page: 3px crit left border, `alertdialog`, never hides by itself. |
| Overview | Scrim plus a grid of window cards that scale in (icon, title, "minimized"). Empty: "No windows open. Pick an app from the dock." The dock shows above it. |
| Widgets | Sticky note, world clock: panels at 85% opacity over the wallpaper |
| Lockscreen | Wallpaper, a 64px mono clock, and the shift card at 88% opacity. At 375px the card takes the full width minus 16px gutters. |

App stylesheets live next to each app (`os/apps/<app>/<app>.css`) and load with its lazy chunk. Because they then apply to the whole page, an app only defines classes it alone uses; `os/apps/css-scope.test.ts` enforces this.

### Cursors

`apps/web/public/cursors/*.svg` holds an original set: arrow, pointer, text, grab, grabbing, wait, and resize in four directions (`resize` for nwse, `resize-ns`, `resize-ew`, `resize-nesw`). They are used when `data-cursor="pitos"`. With "Use system cursor" on, `data-cursor="system"` uses the browser's own cursors.

### Motion

| Token | Value |
|---|---|
| `--motion-fast` | 120ms |
| `--motion-base` | 180ms |
| `--motion-slow` | 240ms |
| `--ease-out` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--ease-in` | `cubic-bezier(0.3, 0, 1, 1)` |

Only `transform` and `opacity` animate. Window motion runs through the Web Animations API (`os/motion.ts`); everything else is CSS on these tokens.

| Element | Motion |
|---|---|
| Window open / close | Fade and scale from / to 0.96 (base, ease-out / fast, ease-in) |
| Minimize / restore | Shrink into / grow out of the app's dock icon (slow) |
| Maximize, restore, snap | FLIP from the old frame (base) |
| Overview | Scrim fades, cards scale in with a 30ms stagger (slow) |
| Dock | Slides by `translateY` (base) |
| Menus | Fade and move 4px (fast) |
| Banners | Slide down from the top bar (base) |
| Chat | New messages fade in; the thread pane slides in |
| Browser | A loading bar under the toolbar; reload becomes stop while loading |
| Phone | Shakes while paging |

Settings → Reduce motion (`data-motion="reduce"`) and `prefers-reduced-motion` set every duration to 0 and turn off the phone shake and the loading bar sweep.

### Sound

The audio lives in `os/audio/`: one Web Audio context with four buses (**ambience**, **music**, **sfx**, **ui**) under a master level.
- **Café filter:** ambience and music pass through a low-pass "café filter" that muffles the room while the camera is on the laptop.
- **Cues:** every cue is synthesized except the two café recordings. The cues are the pager (every 2.5 s, a step louder every 10 s), the phone vibration, ack, escalation, chat message, notification, the budget pulses at 50% and 80%, fix-hold ticks, action start and done, alert fired and cleared, resolved and budget exhausted.
- **Levels:** master volume, Ambience, Music and Alerts in Settings → Sound. Master and mute are also in quick settings.
- **Reduce audio intensity:** drops the pulses, the escalation tone and the fix-hold ticks.
- **Stopping:** nothing plays while paused, locked or with the tab hidden; the context is suspended.
- **Radio:** the lo-fi radio (`os/audio/lofi.ts`) loads only when switched on.
- **Visual equivalents:** no cue carries information that is not also on screen.

### Text size

Settings → Larger text sets `data-text="large"`, which raises the type scale by 2px per step.

## 10. Café (M1.6)

Spec: `docs/specs/2026-09-28-cold-open-design.md`, §6, §7 and §12.

### Camera
- **The Stage** (`src/cafe/Stage.tsx`) wraps PitOS and owns the camera: the **desktop** view, or the **café** view.
- **In the café:** the live desktop is scaled into the laptop's screen (`laptopFit`) and made `inert`. The café is `inert` while the camera is on the laptop.
- **A zoom** is one transform on `.stage-world`, `DUR.camera` = 700 ms with `EASE_IN_OUT`, or a cut under reduced motion. A new move cancels the last one.
- **Roots:** the PitOS roots (`.stage`, `.desktop`) use `overflow: clip`, so neither focus nor `scrollIntoView` can ever scroll them. `scrollIntoView` is also a lint error in `apps/web/src`.

### Layers
- **Inside the Stage:** café art (auto), then the new-shift curtain and the laptop screen (1), then the café UI (2): hotspots, captions, the phone close-up, the controls and the cold close.
- **Above the world:** the shift report (3), the training coach (4), "Fix confirmed" (5). They sit outside the world transform, so the viewport sizes them, not the scene.
- **Never animate a wrapper around café UI with a filled opacity or transform.** It makes a stacking context and traps the UI under the screen (M2.5, twice).
- **Paused overlay:** it belongs to the Stage, so it covers both views.

### Art
- **Drawing:** flat vector SVG on a 1600×900 canvas, covering the viewport (`xMidYMid slice`). Layers are the street through the window, the interior, the patrons and the foreground table.
- **Colours:** they come from the scene palette in `packages/world/src/scene.ts` (time of day × weather), not from the UI tokens. The café is in-world art.
- **Visibility:** everything a player must reach stays inside the scene's x 199–1399 band, the part visible at 4:3.
- **Particles:** 300 or fewer (rain lines 90 or fewer).
- **Motion:** only transform and opacity animate. Parallax moves the street 8 px and the room 4 px. The table never moves. Everything holds still while paused and under reduced motion.

### Hotspots and controls
- **Hotspots:** real buttons, transparent until hover or focus, then outlined and named. In Tab order: Laptop, Phone, The next table, Poster on the wall, Radio. Clues open a caption (Esc closes it). The phone opens a close-up with its own clock in the city's time zone.
- **Controls:** text buttons at the top right: "Skip to the page" before the page, "Back to laptop (L)" always.
- **Cold close:** a lower-third caption with "Read the postmortem", which takes focus.
- **Look up:** a text button in the PitOS tray, and the `L` key.

### Budgets
- **Main chunk:** grows 3 KB or less per milestone. The calendar, quick settings and the radio load lazily; the menus are fetched 2 s after boot.
- **Café:** the art, hotspots and ambience player are one lazy chunk (about 7.6 KB gzip).
- **Recordings:** 1.5 MB or less (currently 0.6 MB).

## 11. Leaderboard (M2)

Spec: `docs/specs/2026-09-28-runs-api-leaderboard-design.md`, §6.

### Postmortem
- **Placement:** a "Leaderboard" panel directly under the score tiles, so the rank sits next to the score.
- **States:** ask for a handle, not posted, posting, posted (new best, not a new best, held for review), a rejected handle, and the errors (409 Refresh, 422, 429 Try again, network or 5xx Try again with the request ID). The status line is a `role="status"` region; the exact copy is in the spec.
- **Handle field:** a label above, the rule as a hint below; the hint turns into the error (`aria-invalid`). The rule is checked before posting.

### The leaderboard site
- **In the Browser:** a second tab, "Leaderboard · Pit Wall On-Call", at this deployment's real address. A bookmarks bar under the toolbar holds the store and "Pit Wall leaderboard". Inactive tabs stay mounted and hidden, so the store keeps its page and DevTools rows.
- **The page** is in-world web content, like the store: a light page with its own `lb-` styles, not the PitOS tokens. It has the heading "Practice leaderboard" and a table (Rank, Player as `handle#tag`, Budget burned, Mitigated, Result). The caller's row is highlighted and marked "(you)", after a "…" gap row when it is outside the top 50. Numbers use tabular figures.
- **Below 1024 px:** the lock screen shows the same page under its card, loaded lazily. The table scrolls sideways inside its frame rather than widening the page.

### Settings → Account
- "Shown as `handle#tag`", "Change handle" (a field and Save, with its status beside it), and "Remove from this device", which forgets the token only.

### Shared fields
- `.field`, `.field-label`, `.text-input` and `.field-hint` in `base.css` are the one text-field style for PitOS chrome.

## 12. Flow and clarity (M2.5)

Spec: `docs/specs/2026-09-28-m2.5-clear-connected-alive-design.md`.

- **Status is always in words.** The top bar chip reads On call · Primary, then Paged · acknowledge, Investigating, Mitigated · cause still active, Fix holding · N s, and Resolved or Out of time. Colour only repeats the word. The Monitoring header adds "Cause still active" while only mitigated.
- **Help** (the "?" button or the `?` key) has four pages:
  - How to play;
  - Checklist, which ticks itself from the run;
  - Glossary, in plain language;
  - Tools.
  Glossary terms in the console carry a dotted underline and a tooltip, on hover and on focus.
- **The shift report** opens by itself 1.5 s after the cold close caption. It shows:
  - the score tiles;
  - the handle field or the posting status;
  - the top 5 plus you.
  Its buttons are New shift, Share, Full leaderboard and Read the postmortem, in a footer that never scrolls away.
- **Training:** the first visit leads with the training shift. A coach card (bottom left, above the dock) names one step at a time. Each step completes on what the player actually did; Show me outlines the control to use.
- **New shift** keeps the Stage, the camera and the café. Only the OS and its apps start over (`ShiftScope`). The camera goes back to an empty desktop, and the café's new city fades in behind a curtain.
- **After a deploy,** a stale tab gets a System notice between shifts ("A new version is out"). A missing chunk reloads once instead of showing the crash screen.

### Tools and teammates (M2.5 PR B)

- **One home per action.** Every action lives in exactly one tool, the one a real SRE would open (`ActionDef.tool`; a test checks every scenario):
  - Monitoring: alerts, the service map, metrics and dashboard checks.
  - Logs: a search box, a service filter, and level chips (ERROR, WARN, INFO, FOUND). Saved queries are the service's log actions. A version in a log line links to Deploys.
  - Deploys: each service's version, its deploy history (from Deploy Bot's cards), then rollback and restart.
  - DB console: a psql pane. Actions show as the command they stand for (`ActionDef.command`), and their findings as the output.
  - Incident: severity, status, checklist, timeline, the status page composer, and Page secondary. The status chip opens it.
  - Chat: questions to teammates, as suggested questions and `/ask`.
- **Links, not hunting.** The selected service in Monitoring shows "Open in Logs · Deploys · DB console · Incident". Each tool opens filtered to that service (`openTool`). Deploy cards in Chat have "Open in Deploys".
- **Teammates answer on their own clock.** Asking never blocks the console (asynchronous actions, engine 1.1.0). While they write, the DM shows "… is typing". Free text they cannot act on gets an honest "Not sure what you mean" after 5 s.
- **What you say is kept.** Status updates, pages and questions post into Chat from either Chat or Incident, and outlive the Chat window (`chatPosts` in the OS context).
- **The coach follows the tools.** Show me opens the tool that holds the control, filtered to the service, then outlines it once it renders. The coach sits above the OS on the Stage, so it reaches the OS through `OsBridge`.
- **Layout.** The four tools share one stylesheet (`os/apps/tools/tools.css`): a toolbar, a side column of actions, and a main pane. Each is its own lazy chunk of about 1–1.6 KB gzip.
