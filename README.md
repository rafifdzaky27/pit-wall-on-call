<p><img src="apps/web/public/favicon.svg" width="48" height="48" alt="Pit Wall On-Call logo"></p>

# Pit Wall On-Call

A browser game about being on call. The game runs inside **PitOS**, a small made-up Linux desktop. The pager goes off, checkout is failing, and the loudest service is not necessarily the one at fault. You acknowledge the page, dig through chat, the failing site and your monitoring, act under a real-time clock, and then read a postmortem showing where your error budget went.

**Play:** [pitwall.rafifdzaky.com](https://pitwall.rafifdzaky.com) (desktop browser, 1024 px or wider)

![The PitOS desktop](docs/media/desktop.png)

## What a run looks like

1. **Before the page.** Your shift starts on the desktop, in a city picked by the seed: Jakarta, Yogyakarta, Tokyo or Melbourne. You get a few free seconds. Chat's `#deploys` and `#infra` channels, and later a mention on your phone, may hold clues, or may not.
2. **The page.** The phone buzzes and a critical notification appears. The Browser shows what customers see: a real `502 Bad Gateway` page, and a DevTools-style Network panel that lists every request with its status code. The incident clock starts, every second before you acknowledge (`A`) burns budget, and after 60 s the secondary on-call gets paged.
3. **Monitoring.** A service map, focused metrics, a log stream and per-service actions. Actions take time, you can run one at a time, and some of them make things worse.
4. **The postmortem.** It opens as `postmortem.md` and shows budget burned, when you mitigated, whether you found the root cause, how fast you acknowledged, the clues you found, the burn broken down by cause, a timeline with a verdict on each action, and one lesson.

![Monitoring during an incident](docs/media/monitoring.png)

Windows open, snap and maximize like on a GNOME desktop, and single-key shortcuts (`O` overview, `M` maximize, `[` `]` snap, `X` close, `A` acknowledge, `P` pause) can be turned off in Settings. On screens narrower than 1024 px, the site shows an on-call lockscreen instead.

<p><img src="docs/media/lockscreen.png" width="240" alt="The lockscreen on a phone"></p>

## How it works

- **A deterministic engine** (`packages/engine`) simulates the incident in fixed 100 ms ticks from a seed. All randomness comes from a seeded PRNG with separate streams for dynamics, metric noise and logs, and scoring uses integer math only. A lint rule forbids `Math.random`, `Date` and `performance` in the engine.
- **Scores come from replays, not from the client.** A run is its seed plus its action log. The server (M2) replays that log with the same engine and stores the score it computes. An action the player could not have taken at that tick is rejected.
- **Scenarios are content** (`packages/scenarios`). Each is a typed `defineScenario()` config with its services, dynamics, metrics, logs, alerts, actions and lessons. Golden-player tests check that the perfect player resolves under par on 50 seeds, that doing nothing ends in a DNF, and that chasing the red herring always scores worse.
- **The web app** (`apps/web`, React + Vite) is the PitOS desktop. A pure window-manager reducer handles windows, and one incident provider feeds every app (Monitoring, Browser, Chat, the phone). It drives the engine in real time and pauses when the tab is hidden.

```
packages/engine      deterministic simulation, scoring, replay
packages/scenarios   scenario content, desktop chat schedule, golden-player tests
packages/world       seeded cities, fictional local brands, prices
apps/web             React client
apps/api             Hono API (runs, leaderboard, daily incident)
infra/               Docker Compose, Caddy, deploy script with automatic rollback
docs/                specs, plans, runbooks, design system
```

## Running locally

Requirements: Node 22 and pnpm 10.12.2.

```bash
pnpm install
pnpm --filter @pitwall/web dev
```

Then open http://localhost:5173.

```bash
pnpm test        # every package
pnpm typecheck
pnpm lint
pnpm build
pnpm e2e         # Playwright, builds and serves the web app itself
```

## Delivery

Every pull request runs lint, typecheck, tests, the deploy-script tests and Docker builds. Merging to `main` builds images tagged with the commit SHA, pushes them to GHCR, and deploys them to a homelab VM over Tailscale. The deploy script smoke-tests the new version and rolls back automatically if the check fails. The site is served through a Cloudflare Tunnel. Details are in [`docs/runbooks/srv-pitwall-01.md`](docs/runbooks/srv-pitwall-01.md).

## Documentation

- [Design spec](docs/specs/2026-09-27-pit-wall-on-call-design.md) and [cold open spec](docs/specs/2026-09-28-cold-open-design.md)
- [Roadmap](docs/plans/2026-09-27-roadmap.md)
- [PitOS desktop spec](docs/specs/2026-09-28-pitos-desktop-design.md) and [usability test protocol](docs/research/m1.5-usability-protocol.md)
- [Design system](docs/DESIGN.md)

## License

The code is licensed under [AGPL-3.0-only](LICENSE). Game content, names and art are all rights reserved; see [`NOTICE.md`](NOTICE.md).
