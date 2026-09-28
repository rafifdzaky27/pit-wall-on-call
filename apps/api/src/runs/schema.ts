import { ACK, ENGINE_VERSION, INSPECT_PREFIX, type ActionRecord } from "@pitwall/engine";
import { getScenario } from "@pitwall/scenarios";
import { z } from "zod";
import { ApiError } from "../http/errors";

export const MAX_ACTIONS = 200;

const Body = z.object({
  scenarioId: z.string().max(64),
  seed: z
    .number()
    .int()
    .min(0)
    .max(2 ** 32 - 1),
  mode: z.literal("practice"),
  engineVersion: z.string(),
  runKey: z.uuid(),
  actions: z
    .array(z.object({ tick: z.number().int().min(0), actionId: z.string().max(100) }))
    .min(1)
    .max(MAX_ACTIONS),
  dryRun: z.boolean().optional(),
});

export interface RunBody {
  scenarioId: string;
  seed: number;
  mode: "practice";
  engineVersion: string;
  runKey: string;
  actions: ActionRecord[];
  dryRun: boolean;
}

/** Thrown before the full schema so a stale client gets 409 even when its actions no longer exist (M2 spec §3). */
export class StaleVersion extends ApiError {
  constructor(clientVersion: string) {
    super(409, "stale_version", `This server runs engine ${ENGINE_VERSION}; the run was played on ${clientVersion}. Refresh to update.`);
  }
}

const schemaError = (message: string) => new ApiError(400, "schema", message);

/** Steps 3 and 4 of the validation pipeline: engine version, then the schema (M2 spec §3). */
export function parseRunBody(json: unknown): RunBody {
  if (typeof json !== "object" || json === null || Array.isArray(json)) throw schemaError("The body must be a JSON object.");
  const version = (json as { engineVersion?: unknown }).engineVersion;
  if (typeof version !== "string") throw schemaError("engineVersion is required.");
  if (version !== ENGINE_VERSION) throw new StaleVersion(version);

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw schemaError(`${issue?.path.join(".") || "body"}: ${issue?.message ?? "invalid"}`);
  }
  const body = parsed.data;
  const scenario = getScenario(body.scenarioId);
  if (!scenario) throw schemaError(`Unknown scenario ${body.scenarioId}.`);
  if (scenario.training) throw schemaError("Training shifts are not posted.");

  const known = new Set<string>([ACK, ...scenario.actions.map((a) => a.id), ...Object.keys(scenario.coldOpen.hotspots).map((h) => `${INSPECT_PREFIX}${h}`)]);
  let last = 0;
  for (const [i, a] of body.actions.entries()) {
    if (!known.has(a.actionId)) throw schemaError(`actions.${i}: unknown action ${a.actionId}.`);
    if (a.tick < last) throw schemaError(`actions.${i}: ticks must not decrease.`);
    last = a.tick;
  }
  return {
    scenarioId: body.scenarioId,
    seed: body.seed,
    mode: body.mode,
    engineVersion: body.engineVersion,
    runKey: body.runKey,
    actions: body.actions.map(({ tick, actionId }) => ({ tick, actionId })),
    dryRun: body.dryRun ?? false,
  };
}
