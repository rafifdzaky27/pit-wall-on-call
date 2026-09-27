export async function fetchApiVersion(): Promise<string> {
  const res = await fetch("/api/version");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body: unknown = await res.json();
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { version?: unknown }).version !== "string"
  ) {
    throw new Error("unexpected response");
  }
  return (body as { version: string }).version;
}
