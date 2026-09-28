import type { Context } from "hono";

/**
 * Cloudflare sets CF-Connecting-IP at the edge, and the API is reachable only through the tunnel and
 * Caddy, which rewrites X-Forwarded-For to the cloudflared container (M2 plan P5).
 */
export function clientIp(c: Context): string {
  const cf = c.req.header("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}
