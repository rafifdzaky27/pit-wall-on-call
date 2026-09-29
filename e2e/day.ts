/**
 * The calendar day the e2e API stands on (apps/api/src/e2eServe.ts, through E2E_DAY), and the day the
 * daily specs put the browser's clock on. Its daily is the Slow Leak, so the specs play a known incident
 * whatever the real date's daily is (M4: the daily rotates across incidents).
 */
export const E2E_DAY = "2026-09-30";
/** Mid-morning UTC on that day, for page.clock.install. */
export const E2E_NOW = new Date(`${E2E_DAY}T10:00:00Z`);
