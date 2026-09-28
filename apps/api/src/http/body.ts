import type { Context } from "hono";
import { ApiError } from "./errors";

/** The request body as JSON, or a 400 schema error. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(400, "schema", "The body must be JSON.");
  }
}
