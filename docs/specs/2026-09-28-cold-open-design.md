# Pit Wall On-Call: Cold Open Design Spec

- **Status:** Approved in design review, 2026-09-28
- **Parent spec:** `2026-09-27-pit-wall-on-call-design.md` (decisions D14–D16)
- **Delivery:** engine rules in **M1**; scene, audio and transitions in **M1.5**; more scenes in **M4**

## 1. Purpose

Every incident opens with a short, playable scene: the player's product is working, it breaks, and the pager goes off wherever the player happens to be. The cold open is **part of gameplay**, not decoration:
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
| C6 | Delivery | Engine paging rules in M1 with a minimal ack UI; full scene, audio and transitions in M1.5 | All in M1; defer to M4 |

## 3. Flow and rules

```
Start shift → PRE-PAGE (~18 s) → PAGE → ACK → transition → CONSOLE → RESOLVED → COLD CLOSE + debrief
```

1. **Start shift** is the first click. It also unlocks browser audio.
2. **Pre-page is free.** For about 18 s the scene is alive, the incident clock is stopped, and hotspots can be opened at no cost.
3. **The incident clock starts when the pager fires** (engine tick 0). Burn until the ack is tagged `unacknowledged`.
4. **Hotspots remain available after the page**, but the clock is running.
5. **Escalation:** 60 s without an ack produces the event "Paging secondary". There is no extra score penalty (burn continues), and the debrief records it.
6. **Skip intro** jumps straight to the page. Pre-page clues become unavailable. Skip never bypasses the ack.
7. **Cold close:** after resolve, the camera returns to the scene, whose state depends on the incident duration:
   - under 3 min: the coffee still steams
   - 3–8 min: the steam is gone
   - over 8 min: the neighbouring table is empty, the rain has stopped, and it is dark

   The debrief overlays the scene. The share card stays text as in the parent spec; an image card built from a scene snapshot is M4 scope.

## 4. Engine contract (M1)

- Action `ack` must be the first scoring action. Console actions before `ack` are rejected with `422` on replay, and are disabled in the UI.
- Action `inspect:<hotspotId>` is allowed at tick 0 before the ack (pre-page; it costs no ticks) and at any tick afterwards.
- A new burn cause tag, `unacknowledged`, covers the ticks between the page and the ack.
- Event `escalated` fires at tick 600 (60 s) if there is no ack.
- The result gains `ackTick`, `escalated: boolean` and `cluesFound: string[]` (the clue hotspot ids that were inspected).
- **Determinism is unchanged:** pre-page inspects are recorded at tick 0 in click order, and replay treats them like any other action.

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
Each scenario must have **1–2 clues and 1–2 herrings**. A golden test asserts that every hotspot id exists in the named scene.

## 6. The café scene (M1.5)

- **Layers**, with light cursor parallax:
  - the street outside: passers-by with umbrellas, and headlights sweeping the window
  - the window: rain streaks when the weather is rain
  - the interior: a barista counter with a steaming espresso machine, and 2–3 patrons with small idle loops
  - the foreground table: laptop, phone, steaming cup, notebook
- **Hotspots:** laptop (Slack channels), phone (notifications), neighbouring table (overheard conversation), wall poster. Each hotspot is a real `<button>` over its SVG region.
- **Seeded variation:** each is a palette or data swap, with no new art.
  - time of day: morning, afternoon, dusk or night
  - weather: clear, overcast or rain
  - patron arrangement: 2–3 variants
  - the product brand on the laptop and in the mention
- **The page:** the phone vibrates and slides slightly, and its screen shows "SEV2 · Checkout returning 5xx". Click the phone (or press **A**) to acknowledge. The camera then pushes into the laptop screen, which becomes the console.

## 7. Audio (M1.5)

- One Web Audio context with three buses: **ambience**, **sfx** and **ui**. Master volume and mute persist per browser.
- **Cues:**
  - café murmur and cup clinks (CC0 loop); rain (CC0 loop, when raining)
  - phone vibration on wood (CC0), and a synthesized ringtone that gets louder every 10 s until the ack
  - a more urgent escalation tone
  - the transition: café sound **muffles** (low-pass) with a low swell
  - console: alert fired and resolved, action start and done, hint chime
  - error budget thresholds at 50% and 80%: a low pulse
  - resolved: a relief chord, and the café sound comes back clear
- **Rules:**
  - **No audio-only information.** Every cue has a visual equivalent.
  - Recordings total under 1.5 MB (Opus/OGG), lazy-loaded after Start shift. If they fail to load, the game plays silently.
  - CC0 only, credited in `CREDITS.md`.
  - A "reduce audio intensity" option disables the pulses and escalation stingers.

## 8. Architecture

| Unit | Milestone | Responsibility |
|---|---|---|
| `packages/engine` | M1 | Paging phase (section 4) |
| `packages/scenarios` | M1 | `coldOpen` data (section 5) |
| `packages/scenes` (new) | M1.5 | `defineScene()`, and a pure, deterministic `resolveScene(scene, seed, coldOpen)` that returns a render model (palette, weather, patrons, hotspot content) |
| `apps/web/cold-open` | M1 minimal / M1.5 full | M1: an ack card over a dimmed backdrop. M1.5: `SceneRenderer`, `Hotspot`, `PhonePager`, `CameraRig`, `ColdClose` |
| `apps/web/audio` | M1.5 | `AudioEngine` (context, buses, low-pass duck, persisted mute), synthesized cues, ambience loader |

**Data flow:** scenario + seed → `resolveScene` → render. Hotspot clicks and the ack become engine actions in the same action log the console uses, so replay, anti-cheat and the debrief all see them.

## 9. Accessibility and performance

- Hotspots are DOM buttons with accessible names, with Tab/Enter and a visible focus. The ack also works with **A**.
- `prefers-reduced-motion` turns off camera moves, parallax and particles, and uses cuts instead. The scene and gameplay remain.
- **Budgets:** scene code and SVG under 150 KB gzip; audio under 1.5 MB lazy-loaded; 60 fps on a mid-range laptop; particles capped at 300; everything pauses while the tab is hidden.
- **Failure:** if scene assets fail, a minimal fallback (plain backdrop and the phone) keeps the game playable.

## 10. Testing

- **engine (M1):**
  - ack must come first
  - `unacknowledged` burn is tagged
  - escalation fires at tick 600
  - inspects are free before the page and cost time after it
  - `cluesFound` is correct
- **scenarios (M1):** a golden test that hotspot ids exist in the scene, and clue/herring counts are within range.
- **scenes (M1.5):**
  - `resolveScene` is deterministic per seed
  - the palette follows the time of day
  - cold-close thresholds at 3 and 8 min
- **web (M1.5):**
  - hotspot accessible names and keyboard use
  - reduced motion disables camera animation
  - `AudioEngine` with a mocked AudioContext: buses and persisted mute
- **Playwright:** Start shift → open the laptop hotspot → ack → the console is visible; the skip path.

## 11. Out of scope for M1.5

Office and 3 AM bedroom scenes (M4, with scenarios 2 and 3); the VPN/MFA "getting on" beat; voice lines; music; proactive self-detection before the page.
