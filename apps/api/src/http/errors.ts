import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorCode =
  | "schema"
  | "handle_rejected"
  | "unauthorized"
  | "stale_version"
  | "impossible_actions"
  | "not_the_daily"
  | "payload_too_large"
  | "rate_limited"
  | "not_found"
  | "internal";

/** An expected failure with its status and code; `app.onError` turns it into the JSON error body. */
export class ApiError extends Error {
  name = "ApiError";
  readonly status: ContentfulStatusCode;
  readonly code: ErrorCode;
  readonly headers: Record<string, string>;

  constructor(status: ContentfulStatusCode, code: ErrorCode, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export const errorBody = (code: ErrorCode, message: string, requestId: string) => ({ error: { code, message, requestId } });
