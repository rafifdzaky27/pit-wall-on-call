import { createHash, randomBytes } from "node:crypto";

/** A bearer token: `pw_` and 32 random bytes. Only its hash is stored (spec §8). */
export function newToken(): string {
  return `pw_${randomBytes(32).toString("base64url")}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Handles are not unique; `handle#tag` tells players apart (spec §8). */
export function tagOf(playerId: string): string {
  return playerId.slice(-4);
}
