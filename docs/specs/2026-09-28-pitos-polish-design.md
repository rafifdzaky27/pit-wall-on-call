# Pit Wall On-Call: PitOS Polish Design Spec

- **Status:** Approved (#18) and implemented in M1.5.1, 2026-09-28. Deviations are recorded as R1–R13 in the plan.
- **Parent spec:** `2026-09-28-pitos-desktop-design.md` (decisions S1–S10). This spec adds S11–S24 and overrides the parent where they conflict.
- **Inputs:** Rafif's play session on production (2026-09-28) and the persona walkthrough in `docs/research/2026-09-28-m1.5-persona-walkthrough.md`
- **Delivery:** milestone **M1.5.1**. M1.5 closes when M1.5.1 ships.

## 1. Purpose

M1.5 put the game inside a desktop, but the desktop does not yet feel like a real computer:
- It never goes full screen, and the dock sits on top of windows.
- Windows cannot be resized and pile up in one spot.
- Menus overlap, and almost nothing is animated.
- The pager makes no sound.
- Chat and the store look like wireframes.
- On a 1366×768 laptop the service map, the main investigation surface, is not visible at all.

M1.5.1 raises every app to the attention to detail a real OS and real apps have, and fixes the layout at common laptop sizes. It also removes the "about Rafif" fun facts, which read as cringe on the live site.

## 2. Decisions

| # | Decision | Choice | Rejected |
|---|---|---|---|
| S11 | M1.5 exit gate | A **persona walkthrough and heuristic evaluation** (done 2026-09-28) replaces the 5-person test. Testing with real people moves to "After launch" research. | Wait for 5 participants (no time available) |
| S12 | Fun facts | **Removed**: `about-rafif.txt`, the `fortune` widget, `content/aboutRafif.ts` and the lockscreen link. Home holds realistic files instead (section 9). | Keep a personality card |
| S13 | Full screen | **Start shift requests full screen** (it is a user gesture). Settings → "Full screen on Start shift" (default on) turns this off. The System menu has a Full screen toggle. | Button only |
| S14 | Dock | **Intellihide:** the dock hides while a window covers its area, and appears when the pointer touches the bottom edge, on a swipe up, in the overview, or when it receives keyboard focus. Maximized and snapped windows reach the bottom of the screen. | Always visible; always hidden |
| S15 | Windows | **Resizable** from 8 handles. New windows cascade. Sizes are remembered per app for the session. | Fixed size |
| S16 | Motion | A full motion catalogue (section 5) using shared tokens, all turned off by reduce motion | Opening animation only |
| S17 | Top bar menus | Only one menu is open at a time. The System menu becomes GNOME-style quick settings. Clicking the clock opens a calendar with the notification list. | Independent popovers |
| S18 | Sound | **Synthesized with WebAudio**, with no audio files: pager, chat ping, notification, ack and resolve. Volume and mute live in quick settings and Settings. Pulled forward from M1.6. | Audio files; no sound until M1.6 |
| S19 | Chat | **Slack's layout and behaviour** under PitOS's own identity: the name "Chat", its own colours, and no Slack name, logo or aubergine. **Emoji are allowed as in-world message content** (reactions, messages). PitOS's own interface stays free of emoji. | Near-copy of Slack (trade dress); text-only reactions |
| S20 | Store images | **Unsplash photos** (Unsplash License), 3 products and 1 banner per brand (16 photos), WebP at about 25 kB each, loaded only when the Browser opens. Credits are in `apps/web/public/store/CREDITS.md`. | Own SVG illustrations |
| S21 | Browser | A Chromium-like browser with its own identity. The store becomes a complete storefront for each city's archetype, and the Network panel follows DevTools' layout. | Current wireframe |
| S22 | Files and Settings | Files follows Nautilus, and Settings follows GNOME Settings (libadwaita rows) | Current lists |
| S23 | Monitoring layout | The console fits every window content height from 480 px to 1100 px with the service map fully visible. Below 480 px it scrolls. | Fixed row heights |
| S24 | Layering | One z-index scale for the whole shell, and every overlay closes with Esc or an outside click | Per-component z-index |

## 3. Full screen and the dock

**Full screen (S13):**
- **Start shift** calls `document.documentElement.requestFullscreen()` when the setting is on. If the API is missing or the request is refused, play continues in the window with no error.
- Quick settings shows "Full screen" as a toggle that reflects `document.fullscreenElement`.
- Leaving full screen (Esc or F11) never pauses the incident.

**Intellihide (S14):**
- The work area runs from under the top bar to the bottom of the viewport. Maximized and snapped windows fill it.
- The dock is **hidden** when any non-minimized window overlaps the dock's rectangle, and **shown** otherwise. The pure helper `dockHidden(frames, dockRect)` decides this.
- **Reveal:**
  - the pointer stays in the bottom 4 px of the screen for 150 ms
  - a touch swipe up from the bottom 24 px
  - keyboard focus enters the dock
  - the overview is open, as in GNOME
  - a window is being dragged
- The dock hides again 400 ms after the pointer leaves it, unless it holds keyboard focus.
- The dock's badge counts stay visible in the overview. While the dock is hidden, an unread count or a page still shows in the top bar: the Phone badge, the Paged pill, and a dot on the clock for unread notifications.

## 4. Windows

- **Resize (S15):**
  - Handles are 6 px edges and 12 px corners, with the matching resize cursors.
  - Resizing uses pointer capture and commits through the existing `resize` action, extended to a new `setBounds` action so that left and top edges can move the origin.
  - Resizing a maximized or snapped window first restores it to normal mode at its current frame.
- **Minimum sizes** are set per app and clamped to the work area:

  | App | Minimum size |
  |---|---|
  | Monitoring | 760×480 |
  | Browser | 640×420 |
  | Chat | 560×400 |
  | Files | 480×320 |
  | Settings | 560×400 |
  | Postmortem | 480×360 |

- **Cascade:** a new normal window opens 32 px right of and below the last opened one, and wraps to the start when it would leave the work area. Monitoring still opens maximized.
- **Memory:** closing and reopening an app within a session restores its last normal bounds. Nothing is persisted across reloads.
- **Double-clicking** the title bar toggles maximize. Dragging a maximized window's title bar restores it under the pointer, as in GNOME.

## 5. Motion (S16)

Tokens go in DESIGN.md §9:
- `--motion-fast` 120 ms
- `--motion-base` 180 ms
- `--motion-slow` 240 ms
- `--ease-out` `cubic-bezier(0.2, 0, 0, 1)`
- `--ease-in` `cubic-bezier(0.3, 0, 1, 1)`

Only `transform` and `opacity` are animated.

| Element | Motion |
|---|---|
| Window open | Fade in and scale from 0.96, `--motion-base`, ease-out |
| Window close | Fade out and scale to 0.96, `--motion-fast`, ease-in; unmount after it ends |
| Minimize | Scale and translate toward the app's dock icon, `--motion-slow`; restoring reverses it |
| Maximize, restore, snap | FLIP: the frame changes instantly, then a transform animates from the old rectangle, `--motion-base` |
| Overview | Windows scale into the grid, and the scrim fades in, `--motion-slow` |
| Dock | Slides in and out by `translateY`, `--motion-base` |
| Menus and popovers | Fade in and move 4 px down, `--motion-fast` |
| Notification banner | Slides down from the top bar, `--motion-base`; auto-hide slides up |
| Chat message | A new message fades in; "is typing…" appears 1.5 s before a scheduled message |
| Phone | Shakes while paging (existing) |
| Browser | A thin progress bar under the toolbar while a page loads; the reload icon becomes a stop icon while loading |

Reduce motion (system setting or Settings) turns every one of these into an instant change. The typing indicator still shows as text.

## 6. Top bar, notifications and layering

**One menu at a time (S17):**
- `OsProvider` holds `openMenu: "phone" | "system" | "calendar" | null`.
- Opening a menu closes any other. Esc, an outside click and focusing a window close it too.
- Menus anchor under their button and keep 8 px from the screen edge.

**Quick settings (the System menu):**
- A volume slider with a mute button.
- Dark and Light as a segmented control that spans the full panel width, fixing the empty space on the right.
- A Full screen toggle.
- Settings, Lock, and "About PitOS".

**Calendar (the clock):**
- A month grid for the current month.
- The notification list: past banners with their time and actions, and "Clear". An empty list says "No notifications".
- A dot next to the clock marks unread notifications.

**Banners:**
- Non-critical banners hide after 8 s, pausing while hovered or focused, and move to the list.
- "Shift ready" follows the same rule. Start shift stays reachable from the list and from Monitoring.
- The critical page stays until it is acknowledged.
- Dock tooltips hide when their item is clicked and when the pointer leaves the dock.

**Z-index scale (S24),** added to DESIGN.md §9, lowest first:

| Layer | Value |
|---|---|
| wallpaper and widgets | 0 |
| desktop icons | 1 |
| windows | 10–999 |
| dock | 1000 |
| top bar | 1100 |
| banners | 1200 |
| menus | 1300 |
| overview | 1400 |
| paused overlay | 1500 |
| lockscreen | 1600 |

## 7. Sound (S18)

- **`os/sound.ts`** creates one `AudioContext` lazily on the first user gesture and exposes `play(name)`. Every sound is built from oscillators and gain envelopes, with no files. If the context cannot start, `play` does nothing and the visual cue still happens.

  | Sound | Shape | When |
  |---|---|---|
  | `pager` | Two-tone 880/660 Hz bursts, 3 pulses, repeated every 2.5 s | While paging, until ack |
  | `ack` | Short rising chirp | Acknowledge |
  | `message` | Soft two-note ping | A new DM or mention while Chat is not focused |
  | `notify` | Single soft tone | A non-critical banner |
  | `resolved` | Three-note major arpeggio | The incident resolves |
  | `dnf` | Low descending two-note tone | The error budget runs out |

- **Controls:**
  - `prefs.volume` (0–100, default 70) and `prefs.muted` (default false) live in the prefs store.
  - Both appear in quick settings and in Settings → Sound, and are persisted with try/catch.
- **Silence rules:**
  - No sound plays while the incident is paused or the tab is hidden.
  - The pager resumes when either ends.
  - WCAG 1.4.2 is met because the pager stops on ack and the volume control is one click away.

## 8. Apps

### Monitoring (S23)

The console grid inside the window:
- **Rows:** 56 px header; `minmax(0, 1fr)` main; logs `clamp(120px, 24%, 220px)`.
- **Center column:**
  - service map `minmax(180px, 1.2fr)`
  - metrics row `minmax(140px, 1fr)`, where each sparkline fills its panel's remaining height
- **Side columns:** Alerts, Noticed and actions scroll inside their panels.
- **Map scaling:** the map scales its nodes to the available box and preserves their aspect ratio.
- **Metric history:** sparklines start with 2 minutes of pre-incident baseline history (a presentation-only seeded stream), so the first frame shows a line and not a dot.
- **Test:** an end-to-end test asserts that every service node is fully inside the map at 1366×768, 1440×900, 1866×882 and 1920×1080, with and without full screen.

### Chat (S19)

**Sidebar:**
- The workspace name (the brand) with the player's name and a green presence dot.
- Sections for Channels, Direct messages and Apps.
- A presence dot per person.
- Bold for unread and a count badge for mentions and DMs.

**Channel header:**
- `#name`, its topic, a member count and a pinned count.
- Buttons for members and details (visual only).

**Messages:**
- A "Today" date divider, and a "New messages" divider above the first unread message.
- A message whose author posted within 5 minutes collapses under the previous one, with the time shown on hover.
- Avatars are initials on a colour derived from the name.
- Bots carry an "APP" badge. The deploy bot posts an attachment card with the repository, commit SHA, author, `v142 → production` and a status.
- Log snippets appear in code blocks.
- Reactions show an emoji with a count and a tooltip listing who reacted.
- Threads show "3 replies · last reply 2 min ago"; opening one shows the thread in a read-only side pane.

**Composer:**
- A "Message #channel" placeholder and a formatting toolbar.
- Sending posts the player's message locally into the channel. Sent messages do not affect scoring.

**Content:**
- Each channel gets 4–8 background messages before the shift, such as standup notes and a design-review link, so it reads like a lived-in workspace.
- Clue messages stay in the same channels as in M1.5.
- Opening a channel still records its `inspect` hotspot.

### Browser (S20, S21)

**Chrome:**
- A tab strip with a favicon, title and close button.
- Back, forward and reload (reload becomes stop while loading), plus home.
- An omnibox with a lock icon and the URL, with the path in muted text.
- A loading bar.
- "Network" opens a DevTools-style panel docked at the bottom.

**Store, per city archetype,** with copy in the city's language:
- A header with the wordmark, a search field, category navigation and a cart button with a count.
- A promotional banner photo.
- A product grid. Each card has a photo, name, rating ("4.8 · 2,1 rb terjual" style for Indonesian marketplaces, localized per city), price, and a struck-through original price where discounted.
- A footer with links.
- A cart drawer and a checkout page with prefilled fictional address, shipping and payment choices.
- "Place order" shows a spinner. Once the incident has started, it ends in the error page after the scenario's failure time.

**Network panel:**
- A toolbar with filter chips (All, Fetch/XHR, Doc, JS, CSS, Img), "Preserve log" and "Disable cache". The chips and "Preserve log" work; "Disable cache" is visual only.
- Columns: Name, Status, Type, Initiator, Size, Time and Waterfall.
- A summary footer: "N requests · X kB transferred · Finish: Y s".
- Selecting a row keeps the M1.5 detail: the reason phrase and a plain-language line.

### Files (S22)

**Nautilus layout:**
- A header bar with back and forward, a path bar, and a list or grid toggle.
- A Places sidebar: Home, Documents, Downloads, Pictures, Trash.
- A list view with Name, Size and Modified columns, and icons by file type.

**Home contents:**
- `README.md` (how to play)
- `Documents/on-call-handover.md`: the previous shift's handover. It is flavour only, with no clue about the incident.
- `Downloads/grafana-dashboard-export.json`
- `Pictures/` with the four city wallpapers, opened in an image viewer

**Trash:** keeps the M1.5 joke files and the refusal on "Empty Trash".

### Settings (S22)

A GNOME Settings layout: a searchable sidebar, and libadwaita-style grouped rows with switches, sliders and radios.

| Page | Contents |
|---|---|
| Appearance | Theme and wallpaper |
| Sound | Volume and mute, with a "Test" button per sound |
| Accessibility | Reduce motion, larger text, system cursor and single-key shortcuts |
| Full screen | "Full screen on Start shift" |
| Keyboard | The shortcut list |
| About | PitOS version, the licence and credits, including the Unsplash photographers |

### Widgets and lockscreen

- The desktop keeps the sticky note and the world clock. The `fortune` widget is removed.
- The lockscreen loses its about-rafif link.

## 9. Architecture changes

- **`wm.ts`:**
  - `setBounds` (origin and size together, for top and left edges)
  - `openCascade` positioning, handled inside `open` when no bounds are given
  - per-app `minSize` from `apps/meta`
  - a `lastBounds` map for session memory
- **`os/shell/dock.ts`:** `dockHidden(frames, dockRect)`.
- **`OsProvider`:** gains `openMenu` and the notification list (`notifications: {id, at, title, body, actions, read}[]`).
- **`os/sound.ts`:** the synth. `useSoundCues()` in `Desktop` maps incident phase changes and chat arrivals to `play()`.
- **`os/fullscreen.ts`:** thin wrappers around the Fullscreen API with feature detection.
- **Prefs:** gain `volume`, `muted` and `fullscreenOnStart`, with defaults for old stored prefs.
- **Content:**
  - Chat background messages and bot cards live in `packages/scenarios/src/slow-leak.desktop.ts`.
  - Localized store catalogues move to `packages/world/src/catalog.ts` (product names, prices, ratings, image keys per city).
- **Assets:** `apps/web/public/store/<city>-<key>.webp` with `CREDITS.md`. `NOTICE.md` states that these photos are under the Unsplash License and outside both the AGPL and the "content reserved" clause.
- **Budget:** the main chunk stays under the 120 kB gzip budget. Chat, Browser, Files and Settings stay lazy. Photos are not part of any chunk.

## 10. Testing

- **Unit:**
  - wm: `setBounds` from each edge, min-size clamps, cascade wrap, bounds memory, and drag-restoring a maximized window
  - `dockHidden`
  - sound scheduling against a fake `AudioContext` (pager repeats until ack; silent while paused or muted)
  - prefs migration from M1.5 stored prefs
  - Chat grouping (5-minute rule, "New messages" divider position)
  - Network summary totals
  - the store catalogue for every city (4 entries, images exist)
- **Component:**
  - one menu at a time
  - Esc and outside click close menus
  - banner auto-hide pauses on hover
  - the notification list
  - Chat composer posts locally
  - Settings sound "Test" buttons
- **End-to-end (Playwright):**
  - the service map is fully visible at four viewports
  - the dock hides under a maximized window and appears at the bottom edge
  - resizing a window by its corner
  - Start shift requests full screen (the API is stubbed)
  - existing flows still pass
- **Manual:** the persona walkthrough script is re-run on the preview build before the pull request.

## 11. Out of scope

- The café, hard mode and the terminal (M1.6 and later)
- Persisting window layouts across reloads
- Real Slack, GitHub or PagerDuty integration
- Right-click context menus
- Multiple workspaces
