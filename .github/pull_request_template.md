## What

<!-- One or two sentences: what changes for the player or the operator? -->

## Why

<!-- Link the spec/plan section, issue, alert or incident that motivates this. -->

## How it was verified

<!-- Commands run and what they showed. "Tests pass" alone is not evidence. -->

## Checklist

- [ ] Tests written first and seen failing, now passing (`pnpm test`)
- [ ] `pnpm lint` and `pnpm typecheck` are clean
- [ ] UI changes follow `docs/DESIGN.md` and cover loading, empty, error and disabled states
- [ ] No secrets, tokens or internal hostnames in code, logs or screenshots
- [ ] Docs and runbook updated if behaviour or operations changed
