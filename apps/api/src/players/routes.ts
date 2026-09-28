import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { players } from "../db/schema";
import { readJson } from "../http/body";
import { clientIp } from "../http/clientIp";
import { enforce, type AppEnv, type RouteContext } from "../http/context";
import { ApiError } from "../http/errors";
import { requirePlayer, type Player } from "./auth";
import { checkHandle } from "./handle";
import { hashToken, newToken, tagOf } from "./token";

const view = (p: Player) => ({ playerId: p.id, handle: p.handle, tag: tagOf(p.id) });

function handleFrom(body: unknown): string {
  const raw = typeof body === "object" && body !== null ? (body as { handle?: unknown }).handle : undefined;
  const checked = checkHandle(typeof raw === "string" ? raw : "");
  if (checked.ok) return checked.handle;
  if (checked.code === "handle_rejected") throw new ApiError(400, "handle_rejected", "Pick a different handle.");
  throw new ApiError(400, "schema", "Use 3 to 20 letters, numbers, - or _.");
}

const tooLarge = bodyLimit({
  maxSize: 4 * 1024,
  onError: () => {
    throw new ApiError(413, "payload_too_large", "The body is too large.");
  },
});

/** Anonymous players (spec §8, M2 spec §3). */
export function playersRoutes(ctx: RouteContext) {
  const r = new Hono<AppEnv>();

  r.post("/players", tooLarge, async (c) => {
    enforce(ctx, "players", clientIp(c), ctx.limits.playersPerIp);
    const handle = handleFrom(await readJson(c));
    const token = newToken();
    const [player] = await ctx.db.insert(players).values({ tokenHash: hashToken(token), handle }).returning();
    return c.json({ ...view(player!), token }, 201);
  });

  r.get("/players/me", async (c) => c.json(view(await requirePlayer(ctx, c))));

  r.patch("/players/me", tooLarge, async (c) => {
    const player = await requirePlayer(ctx, c);
    enforce(ctx, "rename", player.id, ctx.limits.renamePerToken);
    const handle = handleFrom(await readJson(c));
    const [renamed] = await ctx.db.update(players).set({ handle }).where(eq(players.id, player.id)).returning();
    return c.json(view(renamed!));
  });

  return r;
}
