import type { Variant } from "./scenario";

const id6 = (r: { int(n: number): number }) => `${100_000 + r.int(900_000)}`;

/** An analytics report on the primary; the cart reads from the replica, so checkout hits a version conflict. */
export const analytics: Variant = {
  key: "",
  title: "Replica Lag Shows Old Carts",
  summary: "Carts show old items and checkout fails for some customers. The data looks right on the primary. Why does the site not see it?",
  symptom: { kind: "http_500", surface: "checkout" },
  page: { severity: "SEV2", title: "Checkout returning 500 and carts out of date", body: "Customers of {brand} see items vanish from their cart and checkout fails at the pay step. You are the primary on-call." },
  labels: { edge: "edge-gateway", api: "cart-api", cache: "cart-cache", primary: "postgres-primary", replica: "postgres-replica-1", batch: "reporting" },
  apiVersion: "v207",
  edgeLine: (r) => `POST /checkout 500 ${180 + r.int(120)}ms, upstream "cart-api:8080" returned an unhandled version conflict, client 10.0.${r.int(256)}.${r.int(256)}`,
  apiLine: (r) => `cart ${id6(r)}: version conflict, read v${10 + r.int(30)} from the read replica but the cart is at v${41 + r.int(30)}, aborting checkout`,
  apiOk: (r) => `GET /cart/${id6(r)} 200 ${22 + r.int(30)}ms`,
  batchLine: (r) => `quarterly_revenue_by_sku: scanned ${40 + r.int(50)}M of 610M order lines, still running`,
  batchDetail: "1 long query",
  findCommand: "SELECT pid, usename, now() - xact_start AS running, left(query, 60) FROM pg_stat_activity WHERE state <> 'idle' ORDER BY xact_start;",
  findReveal: (pid) => `pg_stat_activity: pid ${pid}, user bi_reporting, running 58 min: a quarterly revenue query over the whole order_lines table (a full scan and a huge sort). Nothing else on the primary has run longer than a few seconds`,
  stopLabel: "Terminate the report query",
  stopCommand: "SELECT pg_terminate_backend(<pid of the long query>);",
  stopReveal: (pid) => `pid ${pid} terminated; the primary's write volume is back to normal and the replica is catching up`,
  deployReveal: `cart-api v207 by {deployer}, 4 h ago: "show tax in the cart total"; it ran without errors for hours afterwards. v206 ran 8 days`,
  asks: {
    deployer: "v207 only adds the tax line to the cart total. It does read carts from the replica, it has for years and that was never a problem.",
    infra: "it's the cache, I'm pretty sure: stale cart entries. Flush redis and it should sort itself out. Replica lag alert has been flapping, it always does when the nightly stuff runs.",
    support: "customers say an item they added disappears from the cart and then comes back, and the pay button gives an error page. The first messages came in about an hour ago, right when the finance team's quarterly numbers were due.",
    secondary: "the replica is healthy, it is just seconds behind and getting worse. Whatever is making the primary write that much is what I would look for.",
  },
  hotspots: {
    "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "the postgres-replica-1 lag alert keeps flapping for the last hour, ignoring it until it stays red" },
    "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "deployer", text: "cart-api v207 is out: tax line in the cart total, no data model change" },
    "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} I added a jacket to my cart twice and it keeps disappearing, then checkout throws an error??", appearsAt: "incident_start" },
    "table.neighbours": { kind: "clue", label: "The next table", text: "My cart shows the old stuff, then the new stuff, then the old stuff again. Then I pay and it fails." },
    "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand}: SUMMER SALE ENDS SUNDAY" },
  },
  lessons: {
    dnf: "A quarterly report query had run for an hour on the primary and flooded the replica's replay. Carts read from the replica, so customers saw old data and checkout hit version conflicts. Listing the long-running statements on the primary finds it; ending it lets the replica catch up.",
    flush: "Flushing the cache hid the stale carts for a few minutes, but the replica was still far behind, so the next reads were stale again. When data is old at the source, clearing copies of it does not help.",
    failover: "Failing over to the lagging replica promoted a server that had missed recent writes, so committed orders were lost, and the report simply started again on the new primary. A lagging replica is not a safe place to fail over to.",
    route: "Routing reads to the primary hid the stale data, but the primary was already carrying the long query and slowed down under the extra reads. It buys time, not a fix; the load on the primary was the cause.",
    default: "Stale reads after a write usually mean a replica is behind. The question is what makes the primary write so much: a long-running statement shows up in the primary's activity list, and ending it lets the replica catch up.",
  },
  hints: [
    "Are the writes wrong, or are the reads looking at an older copy?",
    "If a replica is far behind, what could be making the primary produce more changes than it can ship?",
    "If clearing or routing around it helps for a few minutes, what is still running underneath?",
  ],
};

/** A backfill migration on the primary; the account order-history page reads from the replica and cannot find fresh orders. */
export const migration: Variant = {
  key: "migration",
  title: "Replica Lag: The Backfill",
  summary: "Customers cannot see their new orders and the order history page fails. The orders exist. Why can the page not find them?",
  symptom: { kind: "http_502", surface: "order history" },
  page: { severity: "SEV2", title: "Order history returning 502", body: "Customers of {brand} who just placed an order get an error on their order history page. You are the primary on-call." },
  labels: { edge: "edge-gateway", api: "accounts-api", cache: "session-cache", primary: "orders-primary", replica: "orders-replica-2", batch: "migrator" },
  apiVersion: "v88",
  edgeLine: (r) => `GET /account/orders 502 ${90 + r.int(80)}ms, upstream "accounts-api:8080" closed the connection, client 10.0.${r.int(256)}.${r.int(256)}`,
  apiLine: (r) => `order ${id6(r)}: placed ${2 + r.int(6)} s ago on the primary but not found on the read replica, the history page could not render`,
  apiOk: (r) => `GET /account/profile 200 ${20 + r.int(30)}ms`,
  batchLine: (r) => `orders_v2_backfill: batch ${1200 + r.int(300)} of 4800 committed inside one open transaction`,
  batchDetail: "1 backfill running",
  findCommand: "SELECT pid, usename, application_name, now() - xact_start AS running FROM pg_stat_activity WHERE state <> 'idle' ORDER BY xact_start;",
  findReveal: (pid) => `pg_stat_activity: pid ${pid}, application migrator, open 47 min: the orders_v2 backfill is rewriting 190M rows in one giant transaction, generating WAL as fast as the disks allow. It started with the maintenance window`,
  stopLabel: "Pause the backfill job",
  stopCommand: "CALL backfill.pause('orders_v2'); SELECT pg_cancel_backend(<pid of the backfill>);",
  stopReveal: (pid) => `backfill paused and pid ${pid} cancelled; the primary's write volume is back to normal and the replica is catching up`,
  deployReveal: `accounts-api v88 by {deployer}, 5 h ago: "paginate order history"; it served the page fine for hours afterwards. v87 ran 11 days`,
  asks: {
    deployer: "v88 only paginates the history list. That page reads from the replica like it always has, the change did not touch that.",
    infra: "the replica must be broken, honestly. Fail over to it and we get a fresh server. The lag graph is ugly but the migration is not something I would touch mid-window.",
    support: "customers who just ordered say their order is not on the history page, and the page sometimes gives an error. It started about 50 minutes ago, around when the maintenance window began.",
    secondary: "the replica is not broken, it is just behind, and it is falling further behind. Look at what the primary is busy doing before you touch the replica.",
  },
  hotspots: {
    "laptop.slack.infra": { kind: "clue", label: "Laptop: Slack #infra", author: "infra", text: "orders-replica-2 is showing a lot of lag since the maintenance window opened, I'll look after lunch" },
    "laptop.slack.deploys": { kind: "herring", label: "Laptop: Slack #deploys", author: "deployer", text: "accounts-api v88 is out: paginated order history, no schema change" },
    "phone.mention": { kind: "clue", label: "Phone: new mention", text: "@{brand} I ordered ten minutes ago and my order history is empty and then it just errors", appearsAt: "incident_start" },
    "table.neighbours": { kind: "clue", label: "The next table", text: "I placed an order and the history page says I have none. Then I refresh and it is there. Then it errors." },
    "wall.poster": { kind: "herring", label: "Poster on the wall", text: "{brand}: NEW AUTUMN RANGE IN STORE" },
  },
  lessons: {
    dnf: "The orders backfill ran as one huge transaction on the primary and flooded the replica's replay. The history page reads from the replica, so new orders were missing and the page failed. Pausing the backfill lets the replica catch up; finish the migration in small batches.",
    flush: "Flushing the cache hid the stale pages for a while, but the replica was still far behind, so the next reads were stale again. Clearing copies does not fix an old source.",
    failover: "Failing over to the lagging replica promoted a server that had missed recent writes, so committed orders were lost, and the backfill restarted on the new primary. Do not fail over to a replica that is far behind.",
    route: "Routing reads to the primary hid the missing orders, but the primary was already saturated by the backfill and slowed down under the extra reads. It buys time, not a fix.",
    default: "A migration that rewrites a whole table in one transaction can flood the replicas. The primary's activity list shows what is running; pausing it lets the replicas catch up, and the migration can resume in small batches.",
  },
  hints: [
    "Are the new orders missing, or is the page looking at an older copy of the data?",
    "What could make the primary write faster than a replica can replay?",
    "If the page works again after you route around it, what is still running on the primary?",
  ],
};

export const VARIANTS: readonly Variant[] = [analytics, migration];
