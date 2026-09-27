# Pit Wall On-Call

A browser game about being on call. The pager goes off, checkout is failing, and the loudest service is not necessarily the one at fault. You acknowledge the page, read the alerts, metrics and logs, act under a real-time clock, and then read a postmortem-style debrief showing where your error budget went.

**Play:** [pitwall.rafifdzaky.com](https://pitwall.rafifdzaky.com) (desktop browser, 1024 px or wider)

## What a run looks like

1. **Before the page.** A short, free moment to look around. Some of what you notice turns out to be a clue, and some of it does not.
2. **The page.** The incident clock starts. Every second before you acknowledge burns budget, and after 60 s the secondary on-call gets paged.
3. **The console.** A service map, focused metrics, a log stream and per-service actions. Actions take time, the player can run one at a time, and some of them make things worse.
4. **The debrief.** Budget burned, when you mitigated, whether you found the root cause, how fast you acknowledged, the burn broken down by cause, a timeline with a verdict on each action, and one lesson.

## How it works

- **A deterministic engine** (`packages/engine`) simulates the incident in fixed 100 ms ticks from a seed. All randomness comes from a seeded PRNG with separate streams for dynamics, metric noise and logs, and scoring uses integer math only. A lint rule forbids `Math.random`, `Date` and `performance` in the engine.
- **Scores come from replays, not from the client.** A run is its seed plus its action log. The server (M2) replays that log with the same engine and stores the score it computes. An action the player could not have taken at that tick is rejected.
- **Scenarios are content** (`packages/scenarios`). Each is a typed `defineScenario()` config with its services, dynamics, metrics, logs, alerts, actions and lessons. Golden-player tests check that the perfect player resolves under par on 50 seeds, that doing nothing ends in a DNF, and that chasing the red herring always scores worse.
- **The web app** (`apps/web`, React + Vite) drives the engine in real time and pauses it when the tab is hidden.

```
packages/engine      deterministic simulation, scoring, replay
packages/scenarios   scenario content and golden-player tests
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
```

## Delivery

Every pull request runs lint, typecheck, tests, the deploy-script tests and Docker builds. Merging to `main` builds images tagged with the commit SHA, pushes them to GHCR, and deploys them to a homelab VM over Tailscale. The deploy script smoke-tests the new version and rolls back automatically if the check fails. The site is served through a Cloudflare Tunnel. Details are in [`docs/runbooks/srv-pitwall-01.md`](docs/runbooks/srv-pitwall-01.md).

## Documentation

- [Design spec](docs/specs/2026-09-27-pit-wall-on-call-design.md) and [cold open spec](docs/specs/2026-09-28-cold-open-design.md)
- [Roadmap](docs/plans/2026-09-27-roadmap.md)
- [Design system](docs/DESIGN.md)

## License

The code is licensed under [AGPL-3.0-only](LICENSE). Game content, names and art are all rights reserved; see [`NOTICE.md`](NOTICE.md).
