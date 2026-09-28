import type { Db } from "../db/client";

export interface BoardPosition {
  rank: number | null;
  total: number;
  best: boolean;
}

/** Where the player stands on the practice board after posting `runId` (Task 6 fills this in). */
export async function boardPosition(...args: [db: Db, scenarioId: string, playerId: string, runId: string]): Promise<BoardPosition | null> {
  void args;
  return null;
}
