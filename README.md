<p><img src="apps/web/public/favicon.svg" width="48" height="48" alt="Pit Wall On-Call logo"></p>

# Pit Wall On-Call

A browser game about being on call. The game runs inside **PitOS**, a small made-up Linux desktop. The pager goes off, checkout is failing, and the loudest service is not necessarily the one at fault. You acknowledge the page, dig through chat, the failing site and your monitoring, act under a real-time clock, and then read a postmortem showing where your error budget went.

Start shift goes full screen and the pager rings (synthesized with WebAudio, no audio files). Every app is modelled on the real thing: a Slack-style chat, a Chromium-style browser with DevTools, a Nautilus-style file manager and GNOME-style Settings.

**Play:** [pitwall.rafifdzaky.com](https://pitwall.rafifdzaky.com) (desktop browser, 1024 px or wider)

![The PitOS desktop](docs/media/desktop.png)

## What a run looks like

0. **Training.** The first visit offers a three-minute guided shift: the secondary coaches you step by step, with Show me pointing at the control to use. Press `?` any time for Help: how to play, an incident checklist that ticks itself, a plain-language glossary, and what each tool is for.
1. **Before the page.** Start shift pulls the camera back from your laptop: you're in a café in a city picked by the seed (Jakarta, Yogyakarta, Tokyo or Melbourne), at a time of day and in weather picked by the same seed. You get a few free seconds. The next table, a poster on the wall, Chat's `#deploys` and `#infra` channels on the laptop, and later a mention on your phone may hold clues, or may not.
2. **The page.** Your phone buzzes on the table and PitOS shows a critical notification. The Browser shows what customers see: a real `502 Bad Gateway` page, and a DevTools-style Network panel that lists every request with its status code. The incident clock starts, every second before you acknowledge (`A`) burns budget, and after 60 s the secondary on-call gets paged.
3. **Monitoring and the tools.** Acknowledging takes you into the laptop. Monitoring has a service map, focused metrics, a log stream with pinned findings, and dashboard checks. The rest of the work happens where an SRE would do it, one "Open in" link away:
   - **Logs:** search and saved queries.
   - **Deploys:** version history, rollback and restart.
   - **DB console:** the database, as psql commands.
   - **Incident:** the status, a checklist, the timeline, the status page, and paging your secondary.
   - **Chat:** ask teammates with a suggested question or `/ask`. They answer a while later, sometimes wrongly, and you keep working meanwhile. Post updates with `/status`.

   Actions take time, you can run one at a time, and some of them make things worse. `L` looks up at the café at any time. The clock keeps running.
4. **The fix holds.** A fix has to hold for 10 seconds, and the status in the top bar counts them down. If you only hid the symptom (a restart or a failover resets the pool), the status says "Mitigated · cause still active", and your secondary points it out.
5. **The cold close and the postmortem.** The camera pulls back to the café. The coffee has gone cold, or the rain has stopped and it is night, depending on how long it took. Then `postmortem.md` shows:
   - the budget burned
   - when the fix went in and when it was confirmed
   - whether you found the root cause
   - how fast you acknowledged
   - the clues you found
   - the burn broken down by cause
   - a timeline with a verdict on each action
   - one lesson
6. **The shift report and the leaderboard.** The report opens by itself over the café, like Wordle's: your score, your rank and a spoiler-free Share. The first time, it asks for a handle. The shift is posted, the server replays it and stores its own score, and you see your place on the practice leaderboard (each player's best shift). Later shifts are posted automatically. The board opens as a site in the PitOS Browser; handles change in Settings → Account.

![A rainy evening in a Tokyo café, the page ringing on the phone](docs/media/cafe.png)

![Chat before the page: the deploy that started it](docs/media/chat.png)

![Monitoring during an incident](docs/media/monitoring.png)

The café has recorded ambience (CC0 and public-domain recordings, credited in [`apps/web/public/audio/CREDITS.md`](apps/web/public/audio/CREDITS.md)), and a lo-fi radio on the counter that is generated in the browser. Every other sound is synthesized. Windows open, snap and maximize like on a GNOME desktop, and single-key shortcuts (`O` overview, `M` maximize, `[` `]` snap, `X` close, `A` acknowledge, `P` pause) can be turned off in Settings. On screens narrower than 1024 px, the site shows an on-call lockscreen instead.

<p><img src="docs/media/lockscreen.png" width="240" alt="The lockscreen on a phone"></p>

## How it works

- **A deterministic engine** (`packages/engine`) simulates the incident in fixed 100 ms ticks from a seed. All randomness comes from a seeded PRNG with separate streams for dynamics, metric noise and logs, and scoring uses integer math only. A lint rule forbids `Math.random`, `Date` and `performance` in the engine.
- **Scores come from replays, not from the client.** A run is its seed plus its action log. The API replays that log with the same engine and stores the score it computes. An action the player could not have taken at that tick is rejected (422), a client on an older engine gets 409, and a fix faster than a person could make is kept off the board until reviewed.
- **The API** (`apps/api`, Hono + Drizzle + Postgres) has anonymous players with bearer tokens (only a hash is stored), `POST /api/runs`, a practice leaderboard, rate limits, JSON logs with request IDs, and Prometheus metrics. Every deploy migrates first and replays a known run through the whole stack as a smoke test.
- **Scenarios are content** (`packages/scenarios`). Each is a typed `defineScenario()` config with its services, dynamics, metrics, logs, alerts, actions and lessons. Golden-player tests check that the perfect player resolves under par on 50 seeds, that doing nothing ends in a DNF, and that chasing the red herring always scores worse.
- **The web app** (`apps/web`, React + Vite) is the PitOS desktop. A pure window-manager reducer handles windows, and one incident provider feeds every app (Monitoring, Logs, Deploys, DB console, Incident, Browser, Chat, the phone). It drives the engine in real time and pauses when the tab is hidden.

```
packages/engine      deterministic simulation, scoring, replay
packages/scenarios   scenario content, desktop chat schedule, golden-player tests
packages/world       seeded cities, fictional local brands, prices
apps/web             React client
apps/api             Hono API: players, run replay, leaderboard, migrations
infra/               Docker Compose, Caddy, deploy script with automatic rollback
docs/                specs, plans, runbooks, design system
```

## Running locally

Requirements: Node 22, pnpm 10.12.2, and Docker (for Postgres).

```bash
pnpm install
pnpm db:up                                   # Postgres 17 on localhost:54329
DATABASE_URL=postgres://pitwall:pitwall@localhost:54329/pitwall pnpm --filter @pitwall/api migrate
DATABASE_URL=postgres://pitwall:pitwall@localhost:54329/pitwall pnpm --filter @pitwall/api dev
pnpm --filter @pitwall/web dev
```

Then open http://localhost:5173. The web dev server proxies `/api` to the API on port 8787. The game plays without the API; only posting and the leaderboard need it.

```bash
pnpm test        # every package; API tests need pnpm db:up
pnpm typecheck
pnpm lint
pnpm build
pnpm e2e         # Playwright: starts the API on a fresh pitwall_e2e database and serves the web build
```

| API | |
|---|---|
| `POST /api/players` | `{ handle }` → a player and its bearer token |
| `GET`, `PATCH /api/players/me` | read or change the handle |
| `POST /api/runs` | `{ scenarioId, seed, mode, engineVersion, runKey, actions }` → the server's score and board place |
| `GET /api/leaderboard?scenario=<id>` | the practice board: top 50, plus your own row |

## Delivery

Every pull request runs lint, typecheck, tests, the deploy-script tests and Docker builds. Merging to `main` builds images tagged with the commit SHA, pushes them to GHCR, and deploys them to a homelab VM over Tailscale. The deploy script smoke-tests the new version and rolls back automatically if the check fails. The site is served through a Cloudflare Tunnel. Details are in [`docs/runbooks/srv-pitwall-01.md`](docs/runbooks/srv-pitwall-01.md).

## Documentation

- [Design spec](docs/specs/2026-09-27-pit-wall-on-call-design.md) and [cold open spec](docs/specs/2026-09-28-cold-open-design.md)
- [Roadmap](docs/plans/2026-09-27-roadmap.md)
- [PitOS desktop spec](docs/specs/2026-09-28-pitos-desktop-design.md), [polish spec](docs/specs/2026-09-28-pitos-polish-design.md), [persona walkthrough](docs/research/2026-09-28-m1.5-persona-walkthrough.md) and [usability test protocol](docs/research/m1.5-usability-protocol.md)
- [Café cold open walkthrough (M1.6)](docs/research/2026-09-28-m1.6-walkthrough.md)
- [Runs API and leaderboard spec (M2)](docs/specs/2026-09-28-runs-api-leaderboard-design.md) and [walkthrough](docs/research/2026-09-28-m2-walkthrough.md)
- [Design system](docs/DESIGN.md)

## License

The code is licensed under [AGPL-3.0-only](LICENSE). Game content, names and art are all rights reserved; see [`NOTICE.md`](NOTICE.md). The store photos are from Unsplash under the Unsplash License; credits are in [`apps/web/public/store/CREDITS.md`](apps/web/public/store/CREDITS.md).
