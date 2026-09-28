import type { CityId } from "@pitwall/world";

export type FileKind = "markdown" | "text" | "json" | "yaml" | "csv" | "sql" | "image";

export interface VFile {
  kind: FileKind;
  name: string;
  /** Text content; may use world tokens such as {infra} and {domain}. */
  content?: string;
  /** Shown instead of the content when the file is empty. */
  note?: string;
  /** Pictures: which wallpaper the image viewer shows. */
  city?: CityId;
  /** Size for files without text content. */
  bytes?: number;
  daysAgo: number;
}

export interface VDir {
  kind: "folder";
  name: string;
  children: VNode[];
  daysAgo: number;
}

export type VNode = VFile | VDir;

const README = `# Pit Wall On-Call

## How to play
1. Start a shift from the notification or from Monitoring. The screen goes full screen; Settings → Display turns that off.
2. Before the page you have a few free seconds. Look around: Chat and the phone may hold clues.
3. When the pager goes off, the incident clock starts. Acknowledge fast (A).
4. Investigate in Monitoring. Every action takes time, and some make things worse.
5. The run ends when the fix holds for 10 seconds, or when time runs out.
6. Read the postmortem: where the error budget went, and one lesson.

## Keyboard
O overview · M maximize · [ and ] snap · X close · A acknowledge · P pause
Settings → Accessibility turns single-key shortcuts off.
`;

const HANDOVER = `# On-call handover

Outgoing: {infra} · Incoming: you

## Open items
- search-api: the p99 alert flapped twice overnight (SEV4). Threshold tuned to 900 ms; revisit Thursday.
- TLS certificate for *.{domain} renewed. Next expiry in 60 days.
- Staging alerts from payments are noisy while the provider fixes their sandbox. Production is fine.

## Quiet
- No pages after 02:10.
- Status page drafts are pinned in #incidents.
`;

const PM212 = `# PM-212: search-api latency

- Severity: SEV3 · Duration: 14 min
- Impact: search results slower than 800 ms (p99) for about 9 % of requests.

## What happened
A cache TTL change in search-api v88 made most lookups miss the cache.

## What went well
- The alert fired within two minutes.
- The change was easy to find in #deploys.

## Follow-ups
- Load-test cache settings before production.
`;

const DASHBOARD = `{
  "title": "checkout-api overview",
  "uid": "chk-ovw",
  "time": { "from": "now-6h", "to": "now" },
  "panels": [
    { "type": "timeseries", "title": "Requests per second", "expr": "sum(rate(http_requests_total{service=\\"checkout-api\\"}[1m]))" },
    { "type": "timeseries", "title": "5xx rate", "expr": "sum(rate(http_requests_total{service=\\"checkout-api\\",code=~\\"5..\\"}[1m]))" },
    { "type": "stat", "title": "p99 latency", "expr": "histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{service=\\"checkout-api\\"}[5m])))" }
  ]
}
`;

export const HOME: VDir = {
  kind: "folder",
  name: "Home",
  daysAgo: 0,
  children: [
    {
      kind: "folder",
      name: "Documents",
      daysAgo: 1,
      children: [
        { kind: "markdown", name: "on-call-handover.md", content: HANDOVER, daysAgo: 0 },
        { kind: "markdown", name: "pm-212-search-latency.md", content: PM212, daysAgo: 1 },
      ],
    },
    { kind: "folder", name: "Downloads", daysAgo: 3, children: [{ kind: "json", name: "checkout-dashboard.json", content: DASHBOARD, daysAgo: 3 }] },
    {
      kind: "folder",
      name: "Pictures",
      daysAgo: 12,
      children: [
        { kind: "image", name: "jakarta.png", city: "jakarta", bytes: 1_240_000, daysAgo: 12 },
        { kind: "image", name: "yogyakarta.png", city: "yogyakarta", bytes: 1_180_000, daysAgo: 12 },
        { kind: "image", name: "tokyo.png", city: "tokyo", bytes: 1_310_000, daysAgo: 12 },
        { kind: "image", name: "melbourne.png", city: "melbourne", bytes: 1_270_000, daysAgo: 12 },
      ],
    },
    { kind: "markdown", name: "README.md", content: README, daysAgo: 0 },
  ],
};

export const TRASH: VDir = {
  kind: "folder",
  name: "Trash",
  daysAgo: 0,
  children: [
    { kind: "yaml", name: "final_final_v3.yaml", content: 'replicas: 1        # was 3, "temporarily"\ntimeout: 0         # infinite is a kind of fast\nretries: 1000000   # it will work eventually\n', daysAgo: 2 },
    { kind: "sql", name: "prod-backup.sql", content: "", note: "0 bytes. Last night's backup job reported success anyway.", daysAgo: 1 },
    { kind: "markdown", name: "postmortem-draft-DO-NOT-READ.md", content: "## Root cause\nIt was DNS.\n\n## Actually\nIt was not DNS. It is never DNS.\n\n## Actually actually\nIt was DNS.\n", daysAgo: 5 },
    { kind: "text", name: "nginx.conf.bak.bak", content: "# a backup of a backup of the config that worked once\nworker_connections 4;    # plenty\nkeepalive_timeout 0;     # nobody stays\n", daysAgo: 9 },
  ],
};

export const TRASH_REFUSALS: readonly string[] = [
  "Empty Trash refused: final_final_v3.yaml is load-bearing.",
  "Empty Trash refused: someone might still need prod-backup.sql. It is 0 bytes, but still.",
  "Empty Trash refused: nginx.conf.bak.bak might be the only copy that ever worked.",
];

export function sizeLabel(node: VNode): string {
  if (node.kind === "folder") return node.children.length === 1 ? "1 item" : `${node.children.length} items`;
  const n = node.bytes ?? new TextEncoder().encode(node.content ?? "").length;
  if (n < 1000) return `${n} bytes`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)} kB`;
  return `${(n / 1_000_000).toFixed(1)} MB`;
}

export function modifiedLabel(daysAgo: number, now: number): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(now - daysAgo * 86_400_000);
}
