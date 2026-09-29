import { TICKS_PER_SECOND, type RunResult, type ScenarioDef, type State, type Verdict } from "@pitwall/engine";
import { formatBp } from "./format";

// The squares are in-world content, pasted into someone else's chat, not PitOS chrome (parent spec §7).
const SQUARE: Record<Verdict, string> = { useful: "🟩", wasted: "🟨", harmful: "🟥" };

const clock = (ticks: number) => {
  const s = Math.floor(ticks / TICKS_PER_SECOND);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The spoiler-free share text: one square per action the player took, in order. A daily names its number and links to it (M3 spec Y12). */
export function shareText(scenario: ScenarioDef<State>, result: RunResult, url: string, daily?: { number: number }): string {
  const verdicts = new Map(scenario.actions.map((a) => [a.id, a.verdict]));
  const squares = result.timeline.flatMap((e) => (e.kind === "action_start" && verdicts.has(e.actionId) ? [SQUARE[verdicts.get(e.actionId)!]] : [])).join("");
  const mitigated = result.outcome === "resolved" && result.mitigatedAtTick !== null ? clock(result.mitigatedAtTick) : "out of time";
  return [
    daily ? `Pit Wall On-Call · Daily #${daily.number}` : `Pit Wall On-Call · ${scenario.title}`,
    `Budget burned: ${formatBp(result.budgetBurnedBp)}   Mitigated: ${mitigated}`,
    `${squares}  root cause ${result.rootCauseFound ? "✔" : "✘"}`,
    daily ? `${url}/daily` : url,
  ].join("\n");
}
