/**
 * Plain-language definitions for Help and the dotted terms in Monitoring (M2.5 spec §4).
 * Engineers come first, but someone curious about DevOps must be able to follow (decision Q4).
 */
export type GlossaryId =
  | "error-budget"
  | "5xx"
  | "502"
  | "p99"
  | "connection-pool"
  | "idle-in-transaction"
  | "rollback"
  | "failover"
  | "max-connections"
  | "sev2"
  | "ack"
  | "on-call"
  | "secondary"
  | "mitigation-vs-fix"
  | "status-page"
  | "replication-slot"
  | "wal"
  | "replica-lag"
  | "dead-letter-queue"
  | "consumer-lag"
  | "offset"
  | "circuit-breaker"
  | "retries-backoff"
  | "cache-hit-ratio"
  | "request-coalescing"
  | "tls-certificate"
  | "config-rollback"
  | "waf-rule"
  | "disk-volume"
  | "log-level"
  | "deploy-vs-config"
  | "severity"
  | "alert-level";

export interface GlossaryEntry {
  id: GlossaryId;
  term: string;
  definition: string;
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  { id: "error-budget", term: "Error budget", definition: "How many requests may fail before the service breaks its promise to customers. Every failed request spends some of it." },
  { id: "5xx", term: "5xx", definition: "Web errors whose code starts with 5. They mean the server failed, not the customer." },
  { id: "502", term: "502", definition: "Bad gateway: the front door got no good answer from the service behind it." },
  { id: "p99", term: "p99", definition: "The time the slowest 1 in 100 requests takes. It shows what the unluckiest customers feel." },
  { id: "connection-pool", term: "Connection pool", definition: "A fixed set of database connections an app shares. When all are taken, new requests wait, then fail." },
  { id: "idle-in-transaction", term: "Idle in transaction", definition: "A connection that started some database work and then went quiet without finishing, so it is never given back." },
  { id: "rollback", term: "Rollback", definition: "Putting the previous version of an app back in place, undoing a recent release." },
  { id: "failover", term: "Failover", definition: "Switching to a standby copy of a system, such as a database replica, when the main one is in trouble." },
  { id: "max-connections", term: "max_connections", definition: "The most connections the database will accept at once. Beyond it, new ones are refused." },
  { id: "sev2", term: "SEV2", definition: "Severity 2: a serious incident that hurts customers, but not a total outage. Someone must act now." },
  { id: "ack", term: "Ack", definition: "Short for acknowledge: telling the pager you have taken the page, so it stops ringing and the team knows you are on it." },
  { id: "on-call", term: "On-call", definition: "The engineer who answers pages for a service during a shift, day or night." },
  { id: "secondary", term: "Secondary", definition: "The backup on-call engineer. They get paged if the primary does not answer, and can be asked for help." },
  { id: "mitigation-vs-fix", term: "Mitigation versus fix", definition: "A mitigation eases the symptoms for now; a fix removes the cause. Mitigate first if it helps, but the incident ends with the fix." },
  { id: "status-page", term: "Status page", definition: "A public page where the company tells customers what is broken and what is being done about it." },
  { id: "replication-slot", term: "Replication slot", definition: "A marker on a database that remembers how far a copy of it has read, so the database keeps the changes that copy still needs." },
  { id: "wal", term: "WAL", definition: "Write-ahead log: the running record of every change a database makes, written before the change itself. Copies of the database replay it to stay current." },
  { id: "replica-lag", term: "Replica lag", definition: "How far behind a database copy is compared with the main one. Readers of the copy see older data the further behind it falls." },
  { id: "dead-letter-queue", term: "Dead-letter queue", definition: "A side queue where messages that could not be processed are set aside, so they do not hold up the ones behind them." },
  { id: "consumer-lag", term: "Consumer lag", definition: "How many messages are waiting that a reader of a queue has not yet processed. It grows when readers are slower than writers." },
  { id: "offset", term: "Offset", definition: "In Kafka, the position of a message in a log. A reader keeps its offset to remember where it stopped." },
  { id: "circuit-breaker", term: "Circuit breaker", definition: "A guard that stops calling a struggling service for a while, so callers fail fast instead of piling up waiting." },
  { id: "retries-backoff", term: "Retries and backoff", definition: "Trying a failed call again, and waiting a little longer before each new try, so repeated tries do not add to the load." },
  { id: "cache-hit-ratio", term: "Cache hit ratio", definition: "The share of requests answered from a fast store of recent results instead of going to the slower source. Higher is better." },
  { id: "request-coalescing", term: "Request coalescing", definition: "Merging many identical requests into one, and sharing the single answer with everyone who asked." },
  { id: "tls-certificate", term: "TLS certificate", definition: "A digital ID a server shows so browsers can trust the connection and know who they are talking to. It has an end date." },
  { id: "config-rollback", term: "Config rollback", definition: "Putting the previous settings back in place, undoing a recent settings change without touching the code." },
  { id: "waf-rule", term: "WAF rule", definition: "A rule in a web application firewall, the filter at the front door, that decides which web requests to let through or refuse." },
  { id: "disk-volume", term: "Disk volume", definition: "A slice of storage attached to a server. It has a fixed size, and when it fills up nothing more can be saved to it." },
  { id: "log-level", term: "Log level", definition: "How serious a log line is. ERROR means something failed, WARN means something looks wrong, INFO is routine news." },
  { id: "deploy-vs-config", term: "Deploy versus config change", definition: "A deploy ships new code. A settings change alters how the code behaves while the code itself stays the same. Either can change how a service behaves." },
  { id: "severity", term: "Severity (SEV1–3)", definition: "How serious an incident is. SEV1 is the worst, a major outage. SEV2 is serious. SEV3 is minor. Higher severity means a faster, wider response." },
  { id: "alert-level", term: "Alert level", definition: "Warn means a measure has crossed a line worth watching. Critical means it has crossed the line where customers are likely feeling it." },
];

export function glossaryEntry(id: GlossaryId): GlossaryEntry {
  return GLOSSARY.find((e) => e.id === id)!;
}
