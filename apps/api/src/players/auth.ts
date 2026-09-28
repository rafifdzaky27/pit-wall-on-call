import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { players } from "../db/schema";
import type { AppContext, RouteContext } from "../http/context";
import { ApiError } from "../http/errors";
import { hashToken } from "./token";

export type Player = typeof players.$inferSelect;

const BEARER = /^Bearer (pw_[A-Za-z0-9_-]{43})$/;

export async function playerFromToken(db: Db, header: string | undefined): Promise<Player | null> {
  const token = header?.match(BEARER)?.[1];
  if (!token) return null;
  const [player] = await db.select().from(players).where(eq(players.tokenHash, hashToken(token))).limit(1);
  return player ?? null;
}

export async function requirePlayer(ctx: RouteContext, c: AppContext): Promise<Player> {
  const player = await playerFromToken(ctx.db, c.req.header("authorization"));
  if (player) return player;
  ctx.metrics.rejections.inc({ reason: "unauthorized" });
  throw new ApiError(401, "unauthorized", "Unknown or missing token.");
}
