# Pit Wall On-Call: Cold Open Design Spec

- **Status:** Approved in design review, 2026-09-28. The M1.6 refresh was approved in #20 and is implemented in M1.6. The execution rulings are in `docs/plans/2026-09-28-m1.6-cafe-cold-open.md`.
- **Parent spec:** `2026-09-27-pit-wall-on-call-design.md` (decisions D14–D16)
- **Delivery:** engine rules in **M1**; café scene, audio and transitions in **M1.6** (after the PitOS desktop in M1.5 and its polish in M1.5.1); more scenes in **M4**
- **Revision 2026-09-28:** the game now runs inside the PitOS desktop (`2026-09-28-pitos-desktop-design.md`, D17). Start shift on the desktop zooms out to the café, and the ack zooms back into the laptop. The `laptop.*` hotspots live in the desktop Chat app. `packages/scenes` is folded into `packages/world`, and brands and cities come from `resolveWorld(seed)` (D19).
- **Revision 2026-09-28, M1.6 refresh:** rewritten against PitOS as shipped in M1.5.1.
  - Decisions C7–C11 are new.
  - Audio (§7) builds on the existing `os/sound.ts` and adds a lo-fi radio generated in the browser. Music is no longer out of scope.
  - New §12 describes how the café and PitOS fit together.
  - New §13 lists the fixes carried into M1.6: three bugs found in production after #19, the fix-hold countdown, and the minors deferred from M1.5 and M1.5.1.

## 1. Purpose

Every incident opens with a short, playable scene. The player's product is working, then it breaks, and the pager goes off wherever the player happens to be. The cold open is **part of gameplay**, not decoration:
- It teaches that incidents start from **user impact**, not from dashboards.
- Attentive players **find clues** before the console opens.
- **Acknowledge time** is scored, as it is in real on-call.

## 2. Decisions

| # | Decision | Choice | Rejected |
|---|---|---|---|
| C1 | Role | Gameplay: clues, ack time and escalation affect the result | Pure atmosphere; cinematic only |
| C2 | Art direction | **Flat vector**: limited palette, soft planes, SVG generated in code | Pixel art; isometric 3D |
| C3 | Interaction | **Light**: a living scene of about 18 s with clickable hotspots | Watch only; full point-and-click exploration |
| C4 | Audio | **Hybrid**: CC0 recordings for ambience, Web Audio synthesis for UI and pager cues | All synthesized; all recorded |
| C5 | Rendering | **Scenes as data + an SVG renderer in React**, with an optional small `<canvas>` layer for particles only | Canvas/PixiJS; Lottie or video |
| C6 | Delivery | Engine paging rules in M1 with a minimal ack UI; full scene, audio and transitions in M1.6 | All in M1; defer to M4 |
| C7 | The 10 s fix hold | **Shown as a countdown.** Monitoring shows "Fix holding · 7 s" with a progress bar, and the postmortem shows the time it was mitigated and the time it was confirmed. Engine rules are unchanged. | Shorten the hold to 5 s (an engine change); leave it silent |
| C8 | Music | **A lo-fi radio generated in the browser** with Web Audio: seeded chords, a swung drum kit and vinyl crackle. No files and no licences. Off by default. | CC0 tracks; no music |
| C9 | Ambience sources | **About 4 CC0 or public-domain recordings** (café murmur, rain, phone vibrating on wood), 1.5 MB or less in total. Claude lists the candidates (source, licence, size) and Rafif approves them before download. Everything else is synthesized. | Everything synthesized |
| C10 | The page while the player is on the laptop | **The camera stays on the laptop.** The page shows in PitOS as it does now, and the phone on the café table buzzes behind it. After the ack, Monitoring opens. **Look up** goes back to the café at any time. | Pull out to the café on every page |
| C11 | Fixes | The production bugs found after #19 and every deferred minor ship in M1.6 (§13), each with a test. | A separate hotfix release; leave them deferred |

## 3. Flow and rules

```
Start shift → PRE-PAGE (~18 s) → PAGE → ACK → transition → CONSOLE → FIX HOLDS (10 s) → RESOLVED → COLD CLOSE + postmortem
```

1. **Start shift** is the first click. It also unlocks browser audio and, by default, enters full screen (M1.5.1).
2. **Pre-page is free.** For about 18 s the scene is alive, the incident clock is stopped, and hotspots can be opened at no cost.
3. **The incident clock starts when the pager fires** (engine tick 0). Burn until the ack is tagged `unacknowledged`.
4. **Hotspots remain available after the page**, but the clock is running.
5. **Escalation:** 60 s without an ack produces the event "Paging secondary". There is no extra score penalty (burn continues), and the debrief records it.
6. **Skip to the page** jumps straight to the page. Pre-page clues become unavailable. Skip never bypasses the ack.
7. **The fix hold is visible** (C7, §13 F2). Once the resolve condition holds, Monitoring counts down the 10 s. If the condition breaks, the countdown clears and the log says "Fix did not hold".
8. **Cold close:** after resolve, or when the run ends without a fix, the camera pulls out to the café. The scene state depends on the incident duration:
   - under 3 min: the coffee still steams
   - 3–8 min: the steam is gone
   - over 8 min: the neighbouring table is empty, the rain has stopped, and it is dark

   The laptop screen shows the Postmortem window. A caption reads, for example, "Checkout is back. Resolved in 4:12." Clicking the laptop, or pressing Enter, zooms back in to read the postmortem. The share card stays text as in the parent spec; an image card built from a scene snapshot is M4 scope.

## 4. Engine contract (M1)

- Action `ack` must be the first scoring action. Console actions before `ack` are rejected with `422` on replay, and are disabled in the UI.
- Action `inspect:<hotspotId>` is allowed at tick 0 before the ack (pre-page; it costs no ticks) and at any tick afterwards.
- A new burn cause tag, `unacknowledged`, covers the ticks between the page and the ack.
- Event `escalated` fires at tick 600 (60 s) if there is no ack.
- The result gains `ackTick`, `escalated: boolean` and `cluesFound: string[]` (the clue hotspot ids that were inspected).
- **Determinism is unchanged:** pre-page inspects are recorded at tick 0 in click order, and replay treats them like any other action.
- **M1.6 addition:** the snapshot exposes `stableSinceTick: number | null`, the tick from which the resolve condition has held, so the UI can show the hold. This is read only. Scoring, replay and `ENGINE_VERSION` do not change, and the golden scores must stay identical.

## 5. Scenario contract (M1)

Each scenario declares a `coldOpen`:
```ts
coldOpen: {
  scene: "cafe",
  symptom: { kind: "http_502", surface: "checkout" },
  hotspots: {
    "laptop.slack.deploys": { kind: "clue",    text: "Dimas: shipping the checkout refactor (v142), heading home" },
    "laptop.slack.infra":   { kind: "herring", text: "reminder: DB maintenance window tomorrow" },
    "phone.mention":        { kind: "clue",    text: "@{brand} checkout just errors out??", appearsAt: "incident_start" },
    "table.neighbours":     { kind: "clue",    text: "their site keeps giving me some gateway error" },
    "wall.poster":          { kind: "herring", text: "{brand} FLASH SALE 50% today" }
  }
}
```
Each scenario must have **1–3 clues and 1–2 herrings**. A golden test asserts that every hotspot id exists in the named scene.

## 6. The café scene (M1.6)

- **Layers**, with light cursor parallax:
  - the street outside: passers-by with umbrellas, and headlights sweeping the window
  - the window: rain streaks when the weather is rain
  - the interior: a barista counter with a steaming espresso machine, a small radio on the counter, and 2–3 patrons with small idle loops
  - the foreground table: laptop, phone, steaming cup, notebook
- **Hotspots:**
  - **Laptop:** zooms into PitOS, where the `laptop.*` clues are in Chat.
  - **Phone:** a close-up of the phone, showing the same notifications as the PitOS phone widget.
  - **Neighbouring table:** the overheard conversation.
  - **Wall poster.**
  - **Counter radio:** turns the lo-fi radio (§7) on and off. It is not a clue.

  Each hotspot is a real `<button>` over its SVG region.
- **Seeded variation:** each is a palette or data swap, with no new art.
  - the city (from `resolveWorld(seed)`): signage language and the street outside
  - time of day: morning, afternoon, dusk or night
  - weather: clear, overcast or rain
  - patron arrangement: 2–3 variants
  - the product brand on the laptop and in the mention
- **The page:** the phone vibrates and slides slightly, and its screen shows "SEV2 · Checkout returning 5xx". Clicking the phone, or pressing **A**, acknowledges the page. The camera then pushes into the laptop screen, and PitOS comes back with Monitoring open and focused. If the player is already on the laptop when the page fires, see C10 and §12.

## 7. Audio (M1.6)

- **Engine:** the existing `os/sound.ts` synth grows into an `AudioEngine`: one Web Audio context with four buses, **ambience**, **music**, **sfx** and **ui**.
  - Settings → Sound already has master volume and mute (M1.5.1). It gains three sliders, one each for ambience, music, and alerts (sfx and ui).
  - All settings persist in prefs.
- **Cues:**
  - **Café:** café murmur and rain (recordings, C9; rain only when it is raining), plus synthesized cup clinks and an espresso hiss.
  - **The page:** the phone vibrating on wood (a recording). Also the existing synthesized pager, which gets louder every 10 s until the ack.
  - **Escalation:** a more urgent tone.
  - **Transitions:** zooming into the laptop **muffles** the café (a low-pass filter) with a low swell. Looking up brings it back clear.
  - **Console:** alert fired and resolved, action start and done, a hint chime, and one soft tick per second of the fix hold.
  - **Error budget:** a low pulse at the 50% and 80% thresholds.
  - **Resolved:** a relief chord, and the café sound comes back clear for the cold close.
- **Lo-fi radio (C8):**
  - **Music:** a generative loop at 70–85 BPM. Four-bar progressions of seventh chords are picked by a seeded RNG from a small set. Drums (kick, snare and hat) are synthesized with swing, with vinyl crackle from filtered noise and a low-pass filter over the mix.
  - **Controls:** play/pause, next (a new progression and tempo) and volume, both from the café radio and from a "Lo-fi radio" row in PitOS quick settings.
  - **Behaviour:** the radio ducks while the pager rings. It is off by default and remembers whether it was on.
  - **Determinism:** it uses its own RNG and never touches the engine's.
- **Rules:**
  - **No audio-only information.** Every cue has a visual equivalent.
  - **Recordings:** MP3, mono, 64 kbps, 1.5 MB or less in total. They load lazily after Start shift. If they fail to load, the café plays with synthesized sound only.
  - **Licences:** CC0 or public domain only, credited in `public/audio/CREDITS.md` and `NOTICE.md`.
  - **Reduce audio intensity:** this option turns off the pulses, the escalation stinger and the fix-hold ticks.
  - **Pausing:** everything stops while paused, while locked, and while the tab is hidden (the M1.5.1 rule for the pager, now for every bus).

## 8. Architecture

| Unit | Milestone | Responsibility |
|---|---|---|
| `packages/engine` | M1; M1.6 | Paging phase (§4); M1.6 exposes `stableSinceTick` in the snapshot |
| `packages/scenarios` | M1 | `coldOpen` data (§5) |
| `packages/world` | M1.6 | `defineScene()`, and a pure, deterministic `resolveScene(scene, seed, coldOpen)` that returns a render model (palette, weather, patrons, hotspot content) |
| `apps/web/src/cafe` | M1.6 | `CafeScene` (SVG renderer), `Hotspot`, `PhoneCloseup`, `CameraRig`, `ColdClose`. It is lazy-loaded on Start shift. |
| `apps/web/src/os/audio` | M1.6 | `AudioEngine` (context, buses, low-pass duck, persisted levels), synthesized cues, `LofiRadio`, and the ambience loader. It replaces `os/sound.ts`, and callers keep the same `play(cue)` API. |

**Data flow:** scenario + seed → `resolveScene` → render. Hotspot clicks and the ack become engine actions in the same action log the console uses, so replay, anti-cheat and the debrief all see them.

## 9. Accessibility and performance

- Hotspots are DOM buttons with accessible names, with Tab/Enter and a visible focus. The ack also works with **A**. **L** is Look up / back to the laptop, and it follows the single-key shortcuts setting.
- **In the café:** PitOS is `inert`, so Tab reaches only the café hotspots and the café controls.
- **On the laptop:** the café is `inert` and hidden from assistive technology.
- `prefers-reduced-motion`, or the PitOS reduce-motion setting, turns off camera moves, parallax and particles, and uses cuts instead. The scene and gameplay remain.
- **Budgets:**
  - scene code and SVG: under 150 KB gzip, in the lazy café chunk; the main chunk grows by no more than 3 KB gzip
  - audio: 1.5 MB or less, lazy-loaded
  - 60 fps on a mid-range laptop
  - particles: capped at 300
  - everything pauses while the tab is hidden
- **Failure:** if the café chunk or its assets fail, a minimal fallback (a plain backdrop and the phone) keeps the game playable.

## 10. Testing

- **engine (M1):**
  - ack must come first
  - `unacknowledged` burn is tagged
  - escalation fires at tick 600
  - inspects are free before the page and cost time after it
  - `cluesFound` is correct
- **engine (M1.6):**
  - `stableSinceTick` follows the resolve condition and resets when it breaks
  - golden scores are unchanged
- **scenarios (M1):** a golden test that hotspot ids exist in the scene, and clue/herring counts are within range.
- **world (M1.6):**
  - `resolveScene` is deterministic per seed
  - the palette follows the time of day
  - cold-close thresholds at 3 and 8 min
- **web (M1.6):**
  - hotspot accessible names and keyboard use
  - `inert` switches with the camera
  - reduced motion disables camera animation
  - `AudioEngine` with a mocked AudioContext: buses, ducking and persisted levels
  - `LofiRadio` is deterministic per seed, and off by default
  - fix-hold countdown and "Fix did not hold"
  - each fix in §13 has its own test
- **Playwright:**
  - Start shift → café → open the laptop → ack → the console is visible
  - the skip path
  - Look up and back
  - play to resolve → countdown → cold close → postmortem
  - asset failure → fallback
- **Persona walkthrough (process):** it plays every persona to the end of the run, through the hold, the cold close and the postmortem.

## 11. Out of scope for M1.6

Office and 3 AM bedroom scenes (M4, with scenarios 2 and 3); the VPN/MFA "getting on" beat; voice lines; recorded music; proactive self-detection before the page.

## 12. The café and PitOS together (M1.6)

- **Camera states:** **laptop** (PitOS fills the screen, as now) and **café** (the café scene fills the screen, and PitOS is drawn inside the laptop's screen by scaling it down).
  - PitOS keeps running while it is small. The store and Chat stay live on the laptop screen.
  - A zoom is one transform animation (`--motion-slow` or longer), and a cut under reduced motion.
- **Before Start shift:** PitOS as it is now. There is no café.
- **Start shift:** full screen (if on), then zoom out to the café. The pre-page runs in the café, with Browser already open on the laptop (M1.5.1 behaviour).
- **Pre-page:** the café hotspots, the laptop (zoom in) and the existing "Skip to the page" action (shown in the café too).
- **Look up:** a text button in the PitOS top bar, plus the **L** key. It is available in every phase after Start shift. It returns to the café without moving the clock.
- **The page:** if the player is in the café, the phone on the table buzzes (§6). If the player is on the laptop, the camera stays (C10), PitOS shows the page as it does now, and the café phone buzzes behind it. Acking in either place zooms into the laptop with Monitoring focused.
- **After the ack:** the neighbouring table and the wall poster stay reachable through Look up, and the clock runs.
- **Cold close:** as in §3, step 8. The postmortem is the existing Postmortem app.
- **Lockscreen and pause:** both work in either camera state. The café freezes while paused.

## 13. Fixes carried into M1.6

Each fix gets a test that fails before the change.

| # | Problem | Fix | Test |
|---|---|---|---|
| F1 | Opening a Chat channel with a "New messages" marker (for example #infra the first time, or Chat after Start shift) shifted the whole page up. The top bar was cut off and nothing could scroll it back. The cause is `scrollIntoView`, which scrolls every ancestor, including the `overflow: hidden` desktop root. | Scroll the message list's own `scrollTop` to the marker. Never call `scrollIntoView` inside PitOS; a lint rule enforces it. | e2e at 1366×657: open #infra and Chat after Start shift; the page and desktop root stay at scroll 0, and the top bar is visible |
| F2 | After a fix, the postmortem appeared about 10 s later with no feedback, and the resolved time (1:08) looked earlier than what the player saw (1:09). | The countdown from C7. The postmortem shows "Mitigated 1:08 · Confirmed 1:18". | unit tests for the countdown and for the fix breaking; e2e play to resolve |
| F3 | The dock's hot zone covered the bottom resize handle of snapped windows. | Snapped windows resize only on their inner edge, and maximized windows have no resize handles (as in GNOME). The hot zone covers only the dock's width. | Window and dock unit tests |
| F4 | The store's category bar and footer links looked clickable but did nothing. | Categories filter the product grid. Footer links open short in-world pages (Help, Shipping, About) in the store's locale. | browser unit test |
| F5 | Store photos total about 790 kB on disk, over the spec's 400 kB estimate. | Budget ruling: no more than 300 kB loaded per shift (the current figure is about 250 kB). The size on disk is not budgeted. The e2e test asserts the per-shift figure. | e2e transfer-size check |
| F6 | **A** acknowledged the page while the game was paused. | A and the pager controls do nothing while paused or locked. | shortcut unit test |
| F7 | Console digit keys acted while Monitoring was minimized. | Digit keys act only while Monitoring is the focused window and not minimized. | shortcut unit test |
| F8 | Findings scrolled away in the log stream. | Findings are pinned in a strip above the log (newest first, up to 3) until the run ends. They also stay in the stream. | LogStream unit test |
