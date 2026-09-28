import type { ActionRecord } from "@pitwall/engine";

/** A response from the API that is not a success (M2 spec §3). */
export class ApiError extends Error {
  name = "ApiError";
  readonly status: number;
  /** The API's error code, or `bad_response` when the body was not the API's JSON. */
  readonly code: string;
  readonly requestId: string | null;
  readonly retryAfterS: number | null;

  constructor(status: number, code: string, requestId: string | null, retryAfterS: number | null) {
    super(`HTTP ${status} ${code}`);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryAfterS = retryAfterS;
  }
}

/** The request never reached the API (offline, DNS, a dropped connection). */
export class NetworkError extends Error {
  name = "NetworkError";
}

export interface PlayerView {
  playerId: string;
  handle: string;
  tag: string;
}

export interface Score {
  outcome: "resolved" | "dnf";
  budgetBurnedBp: number;
  mitigatedAtTick: number | null;
  endTick: number;
}

export interface PostedRun {
  runId: string;
  mode: string;
  flagged: boolean;
  score: Score;
  board: { rank: number | null; total: number; best: boolean };
}

export interface RunPost {
  scenarioId: string;
  seed: number;
  mode: "practice";
  engineVersion: string;
  runKey: string;
  actions: ActionRecord[];
}

export interface BoardEntry {
  rank: number;
  handle: string;
  tag: string;
  budgetBurnedBp: number;
  mitigatedAtTick: number | null;
  outcome: "resolved" | "dnf";
  runId: string;
  you: boolean;
}

export interface Board {
  board: "practice";
  scenarioId: string;
  total: number;
  entries: BoardEntry[];
  you: BoardEntry | null;
}

async function request<T>(method: string, path: string, { body, token }: { body?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new NetworkError("The request did not reach the server.");
  }
  let parsed: unknown = undefined;
  try {
    parsed = await res.json();
  } catch {
    // A misrouted /api answers with the SPA's HTML; treat it as a bad response below.
  }
  const requestId = res.headers.get("x-request-id");
  if (!res.ok || parsed === undefined) {
    const code = (parsed as { error?: { code?: unknown } } | undefined)?.error?.code;
    const retry = Number(res.headers.get("retry-after"));
    throw new ApiError(res.status, typeof code === "string" ? code : "bad_response", requestId, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return parsed as T;
}

export const registerPlayer = (handle: string) => request<PlayerView & { token: string }>("POST", "/api/players", { body: { handle } });
export const renamePlayer = (token: string, handle: string) => request<PlayerView>("PATCH", "/api/players/me", { body: { handle }, token });
export const postRun = (token: string, run: RunPost) => request<PostedRun>("POST", "/api/runs", { body: run, token });
export const fetchLeaderboard = (scenarioId: string, token?: string) =>
  request<Board>("GET", `/api/leaderboard?scenario=${encodeURIComponent(scenarioId)}`, { token });
