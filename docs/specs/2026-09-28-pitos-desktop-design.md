# Pit Wall On-Call: PitOS Desktop Design Spec

- **Status:** Approved in design review, 2026-09-28
- **Parent spec:** `2026-09-27-pit-wall-on-call-design.md` (decisions D17–D22)
- **Related:** `2026-09-28-cold-open-design.md`. The café scene moves to M1.6 and zooms out of this desktop.
- **Delivery:** milestone **M1.5**
- **Revised by:** `2026-09-28-pitos-polish-design.md` (S11–S24, milestone M1.5.1)

## 1. Purpose

The game runs inside a playable computer. Opening the site shows the desktop of **PitOS**, a fictional Linux distribution in the style of GNOME. The player's apps live on it: Monitoring (the incident console), Browser, Chat, Files and Settings. An incident moves through these apps the way a real one does. The customer-facing site breaks in the browser, a colleague's deploy message sits in chat, and the pager goes off on the phone.

This replaces the M1 landing page, which reads as a generic template, and gives the product a playful identity that is still grounded in how SREs actually work.

## 2. Decisions

| # | Decision | Choice | Rejected |
|---|---|---|---|
| S1 | OS style | Linux in the GNOME style, with an original identity ("PitOS"), original icons and cursors | macOS-like, Windows-like (trade dress risk, less "ops"); tiling WM (unfriendly to juniors) |
| S2 | Entry point | **The desktop is the landing page.** Below 1024 px, an on-call phone lockscreen. A light text page remains for SEO and link previews. | Marketing landing → desktop; boot sequence → desktop |
| S3 | Café relation | The desktop is "home". Start shift zooms out to the café (M1.6), the pager rings, and the camera zooms back into this laptop | Desktop only; café always visible around the laptop |
| S4 | Apps (M1.5) | Monitoring, Browser, Chat, Files, Settings, Trash, plus toys (sticky notes, world clock). Terminal arrives with hard mode. | — |
| S5 | Windows | GNOME-like: open maximized, can unmaximize, drag and resize, snap left/right, Activities overview | Always maximized; free floating only |
| S6 | Dock | Bottom center (dash-to-dock style) | Left dock (Ubuntu style) |
| S7 | Localization | The seed picks a city; everyone shares the daily's city. Launch cities: **Jakarta, Tokyo, Melbourne, Yogyakarta** | Player location; fixed city per scenario |
| S8 | Brands | Recreate each city's **archetypes** (menus, prices, cups, receipts, local apps) accurately, with **original names and visuals**. No near-copies of real trademarks or trade dress. | Real brands with a few letters changed |
| S9 | Implementation | Own React window manager (DOM, pointer events, a pure reducer), with an app registry | react-rnd based shell; canvas/WebGL desktop |
| S10 | No runbooks | Files contains no runbooks, because they would hand out the answer | A `runbooks/` folder |

## 3. Proto-personas

These are assumptions. The M1.5 usability test (section 10) checks them.

| Persona | Situation | Needs | Design consequence |
|---|---|---|---|
| **Dina, 24**, junior DevOps at a Jakarta startup | Just joined the on-call rotation and dreads a 3 AM page. Plays on a work laptop at lunch. | Realism, a safe space to fail, a debrief that teaches | No tutorial wall; the page and ack are self-explanatory; the postmortem teaches one lesson |
| **Arif, 21**, student or bootcamp grad preparing for SRE interviews | Needs "a time I handled an incident" story | Clear affordances, shareable results, not overwhelming | Obvious first step (the sticky note), shareable debrief, plain-language HTTP explanations in the browser |
| **Maya, 33**, senior SRE and team lead in Melbourne | Plays the daily for the leaderboard; may use it for team drills | Depth, speed, no hand-holding, keyboard control | Keyboard-first shell, snap layouts, hard mode later, team mode as the B2B hypothesis |

Not the target: casual non-technical players.

## 4. The shell

- **Top bar:**
  - Left: **Activities** (overview).
  - Center: the local clock and date.
  - Right tray: the on-call status pill ("On call · Primary"), the phone widget, the volume (active from M1.6), a quick theme switch, and the power menu. "Lock" returns to the lockscreen, and "About PitOS" shows version and credits.
- **Dock:** bottom center. It holds Monitoring, Browser, Chat, Files, Settings and Trash, and shows a running indicator under open apps.
- **Desktop:**
  - A wallpaper per city, as original flat-vector art.
  - Home and Trash icons.
  - A sticky note on first visit: "Start here → Monitoring".
- **Notifications:** GNOME-style banners at the top center. On the first visit: "Daily #N · <city> is ready" with a **Start shift** button (a practice seed until the daily ships in M3). The page is a critical notification that stays until acknowledged.
- **Overview (Activities or O):** every window scaled into a grid of buttons. Enter focuses one and Esc closes the overview.
- **Keyboard:** a web page cannot capture Super, Alt+Tab or Ctrl+W (the host OS or browser takes them), so PitOS uses single keys, like Gmail:

  | Key | Action |
  |---|---|
  | O | Overview |
  | Tab / Shift+Tab inside the overview | Move between windows |
  | M | Maximize or restore the focused window |
  | [ / ] | Snap the focused window left or right |
  | X | Close the focused window |
  | A | Acknowledge a page |
  | P | Pause or resume |
  | 1–9, Esc | Console shortcuts (M1) |

  Single-key shortcuts are ignored while focus is in a text field (sticky notes, the address bar, the future terminal) and whenever Ctrl, Cmd or Alt is held. **Settings → Accessibility → "Single-key shortcuts"** can turn them off (WCAG 2.1.4). Every action is also reachable through visible controls.
- **Cursors:** an original SVG set (arrow, pointer, text, grab, grabbing, resize in four directions, busy), each with an exact hotspot and a native fallback. Settings offers "Use system cursor".
- **Lockscreen (below 1024 px, and after "Lock"):**
  - the clock and the city wallpaper
  - the Daily notification card
  - a leaderboard preview (from M2)
  - "Play on a laptop or desktop, 1024 px or wider"
  - a link to about-rafif

  No horizontal scroll at 375 px.

## 5. Apps

### Monitoring
The M1 console, unchanged inside a window. Before the page, it shows a calm "All systems normal" state with green services and flat metrics. It opens maximized and focused on the ack.

### Browser
- Tabs, back and reload buttons, and an address bar showing the brand's fictional domain.
- **Store page:** the city brand's storefront, with products, prices in the local currency and a cart. It works during the pre-page.
- **Error pages:** during the incident, reloading the page or pressing Checkout shows a realistic error page for the scenario's symptom. Each page carries the status code, the reason phrase and the server's default look:

  | Code | Page | Used by |
  |---|---|---|
  | 502 Bad Gateway | nginx default page | The Slow Leak |
  | 504 Gateway Timeout | nginx default page | timeouts in later scenarios |
  | 503 Service Unavailable | maintenance/overload page | Disk Full, Cache Stampede candidates |
  | 500 Internal Server Error | framework error page | later scenarios |
  | 429 Too Many Requests | rate-limit page | Cache Stampede candidate |
  | 403 Forbidden | WAF/CDN block page | later scenarios |

  Error pages imitate generic server software (nginx, a generic framework, a generic CDN). They never use a real CDN vendor's branding.
- **Network panel** (DevTools-like, opened with a "Network" button in the browser toolbar; F12 is left to the real browser): a live list of requests with method, path, **status code**, time and size, coloured by class (2xx, 3xx, 4xx, 5xx) and always labelled with the number. Selecting a row shows the reason phrase and one plain-language line, for example "502: the gateway got an invalid response from the service behind it". Rows are generated from the engine snapshot's error rate using the web app's own seeded stream (presentation only).

### Chat
- A Slack-like team chat under the generic name "Chat". Channels #deploys, #infra and #incidents, plus DMs.
- The scenario schedules messages before the page, at the page, and at engine events (for example an alert firing).
- **Opening a channel or DM that holds a hotspot records `inspect:<hotspotId>`**, for example opening #deploys records `laptop.slack.deploys`. The "Ask secondary on-call" action's finding also arrives as a DM from the secondary.
- Unread counts appear in the dock and the channel list.

### Phone widget
A phone icon in the tray opens a small panel with notifications, including the mention (`phone.mention`, `appearsAt: incident_start`) and the pager itself. The page vibrates the icon (a CSS shake, disabled under reduced motion) and raises the critical notification.

### Files
- Home contains `about-rafif.txt`, a `photos/` folder, `README.md` (how to play) and `Downloads/`.
- **about-rafif** content is supplied by Rafif as `content/about-rafif.md` before the task that builds Files. It is public, so it contains only what he chooses to share.
- A read-only text viewer and an image viewer.

### Settings
Pages for Appearance (theme, wallpaper), Accessibility (reduce motion, larger text, use system cursor) and About. A game-mode selector appears only once hard mode ships.

### Trash and toys
- **Trash** holds joke files, for example `final_final_v3.yaml`, `prod-backup.sql` (0 bytes) and `postmortem-draft-DO-NOT-READ.md`. Opening them shows short gags, and "Empty Trash" is refused with a joke.
- **Sticky notes** can be edited and are stored in `localStorage` (try/catch; the page works without storage).
- **World clock** is a desktop widget showing the on-call zones of the four cities.
- A lo-fi music player arrives with audio in M1.6.

## 6. Incident flow on the desktop

1. **Home:** the desktop with the Daily notification. The player clicks **Start shift** (or opens Monitoring and presses Start).
2. **Pre-page (18 s, free):** the Browser opens on the working store, and Chat has unread messages. Inspects are recorded at tick 0, as in M1. *(M1.6 inserts the café zoom-out here.)*
3. **Page (tick 0 of the incident clock):**
   - the phone vibrates and the critical banner appears
   - the Browser shows the error page and new 5xx rows
   - Monitoring shows the alerts
4. **Ack** comes from **A**, the banner or Monitoring. Monitoring maximizes and gains focus. Other apps stay usable and can be snapped side by side.
5. **Resolved or DNF:** the debrief opens as **`postmortem.md`** in a document window with the same content as the M1 debrief. Closing it returns to the desktop, and the notification offers "Play again".

**Clue accounting:** only hotspots that the current build can reach count toward "Clues found". In M1.5 those are the `laptop.*` and `phone.*` hotspots. `table.*` and `wall.*` become reachable with the café in M1.6. The count is computed by a pure `reachableHotspots(scenario, surfaces)` helper, not hard-coded.

## 7. Visual identity

- **Product logo:** a wordmark in IBM Plex Sans semibold plus one symbol. Three symbol concepts go to Rafif for a choice during implementation. The logo drives the favicon, the Monitoring app icon and the 1200×630 social preview image.
- **App icons:** an original set on a 24 px grid, flat, one token colour per app on a GNOME-style squircle, drawn as SVG components. No emoji and no stock icon packs. These icons are functional, so they are consistent with D14.
- **Wallpapers:** one flat-vector wallpaper per city, in the same art style as the M1.6 café.
- **Fonts:** IBM Plex throughout, so the OS and the console read as one product.
- **Tokens:** `docs/DESIGN.md` gains a "Shell" section with top bar, dock, window chrome, notification and lockscreen tokens and states. It is written before any shell UI is built.

## 8. World (cities and brands)

`packages/world` (new) exposes a pure, deterministic `resolveWorld(seed)` that returns:
- the city
- the brand: name, domain, palette, storefront products with prices, currency format
- the wallpaper id
- colleague names for Chat
- the timezone for the clock

Cities for M1.5:

| City | Café archetype (M1.6) | Product that breaks (M1.5) | Currency |
|---|---|---|---|
| Jakarta | Kopi susu gula aren chain, app ordering, takeaway cups | Local marketplace/e-commerce | Rp, "Rp 22K" style |
| Yogyakarta | Modern joglo coffee house near campus | Marketplace for small local sellers (UMKM) | Rp |
| Tokyo | Kissaten: siphon coffee, velvet seats, handwritten menu | Japanese online retailer | ¥ |
| Melbourne | Specialty café, flat white, chalkboard | Local fintech/checkout startup | A$ |

Every brand is fictional. A content checklist in the plan requires searching each brand name and domain to confirm no real company uses it in that market. `packages/world` replaces the `packages/scenes` unit named in the cold-open spec. The café scene data joins it in M1.6.

## 9. Architecture

| Unit | Responsibility |
|---|---|
| `packages/world` | `resolveWorld(seed)`; city and brand data |
| `packages/scenarios` | Adds `desktop` content per scenario: the Chat schedule, the symptom status code (from `coldOpen.symptom.kind`, for example `http_502`) and request patterns for the Network panel |
| `apps/web/src/os/wm` | Pure window reducer: open, close, focus, minimize, maximize, restore, snap, move, resize, z-order. Serializable state. |
| `apps/web/src/os/shell` | Top bar, dock, desktop icons, notifications, overview, lockscreen, cursors |
| `apps/web/src/os/apps` | App registry `{ id, title, icon, component, defaultBounds, singleInstance }` with Monitoring, Browser, Chat, Files, Settings, Trash and the postmortem viewer |
| `apps/web/src/os/widgets` | Phone, world clock, sticky notes |
| `apps/web/src/incident` | `IncidentProvider`: owns the `Run`, the run loop and the pause state, and exposes `snapshot`, `dispatch` and `phase` to every app. It replaces `screens/Incident`. |

- The engine does not change. Hotspot ids map to desktop surfaces through a table in the web app: `laptop.slack.<channel>` → a Chat channel, `phone.*` → the phone widget.
- Apps other than Monitoring are lazy-loaded.
- **Budget:** the shell and the apps add at most 120 KB gzip, wallpapers are inline SVG, and there is no new runtime dependency.

## 10. Accessibility, performance and research

**Accessibility:**
- Each window is a labelled region, and focus moves to the active window.
- The dock, overview, notifications and every app work with the keyboard alone, and all shortcuts are listed in Settings → About.
- Reduce motion turns off window animations, the phone shake and the overview zoom.
- Status keeps its text labels, including HTTP codes, which always show the number.

**Performance:** window drag and resize stay at 60 fps on a mid-range laptop (transforms only, no layout thrash). Nothing runs while the tab is hidden.

**Usability test (exit gate for M1.5; replaced by a persona walkthrough, see S11 in the polish spec):**
- **Participants:** 5 people covering the three personas.
- **Task:** "Play one incident", with no help.
- **Measures:** time to the first ack, whether the incident resolved, where the participant hesitated or got lost (think-aloud), and a SUS questionnaire.
- **Output:** findings are written to a dated file in `docs/research/` (named `<test date>-m1.5-usability.md`), and they feed M1.6 and M2.

## 11. Testing

- **Unit:**
  - the wm reducer (every transition; the focus and z-order invariants; snap geometry)
  - `resolveWorld` (deterministic per seed; all four cities reachable; currency formatting)
  - the error page per status code (code and reason phrase present)
  - Chat scheduling (the message due at the page appears at tick 0)
  - `reachableHotspots`
- **Component:**
  - the dock and overview keyboard paths; single-key shortcuts are ignored in text fields and when turned off
  - notification actions
  - opening #deploys dispatches `inspect:laptop.slack.deploys`
  - the lockscreen below 1024 px
- **Playwright (introduced in M1.5, runs in CI):** desktop → Start shift → pre-page → page → ack → Monitoring visible; the Browser shows the 502 page; the lockscreen at 375 px.

## 12. Out of scope for M1.5

- The café scene and zoom, and audio (M1.6)
- The terminal app and hard mode (their own milestone)
- Accounts
- Multiple monitors or workspaces
- A real file system or persistence beyond sticky notes, theme and wallpaper
- Right-click context menus beyond the desktop wallpaper menu (change wallpaper)
