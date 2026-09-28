import { perfectRun, PERFECT_EXPECTED } from "./fixtures";

/**
 * The deploy smoke test's replay (parent spec §10, CD step 4): a dry run through Caddy, so the whole
 * path (web → api → engine) is exercised and nothing is stored (M2 spec L7).
 */
export async function runSmoke(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`${baseUrl}/api/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(perfectRun({ dryRun: true })),
  });
  if (res.status !== 200) throw new Error(`smoke replay got HTTP ${res.status}`);
  const { score } = (await res.json()) as { score: typeof PERFECT_EXPECTED };
  if (score.budgetBurnedBp !== PERFECT_EXPECTED.budgetBurnedBp || score.outcome !== PERFECT_EXPECTED.outcome) {
    throw new Error(`smoke replay scored ${score.budgetBurnedBp} bp, expected ${PERFECT_EXPECTED.budgetBurnedBp} bp`);
  }
}
