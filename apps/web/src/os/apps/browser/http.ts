export const REASON: Record<number, string> = {
  200: "OK",
  201: "Created",
  304: "Not Modified",
  403: "Forbidden",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

export const EXPLAIN: Record<number, string> = {
  200: "the request succeeded.",
  201: "the request succeeded and created something new.",
  304: "not an error: the browser's cached copy is still fresh, so the server sent nothing back.",
  403: "the server understood the request but refuses it, often because of a WAF or permission rule.",
  429: "the client sent too many requests and is being rate limited.",
  500: "the application crashed or threw an error while handling the request.",
  502: "the gateway got an invalid response, or none at all, from the service behind it.",
  503: "the service is up but cannot take requests right now, because it is overloaded or in maintenance.",
  504: "the gateway gave up waiting for the service behind it.",
};

export function statusClass(code: number): "ok" | "redirect" | "client" | "server" {
  if (code >= 500) return "server";
  if (code >= 400) return "client";
  if (code >= 300) return "redirect";
  return "ok";
}

export function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

export function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  return n >= 1024 ? `${(n / 1024).toFixed(1)} kB` : `${n} B`;
}
