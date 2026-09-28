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
  | "status-page";

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
];

export function glossaryEntry(id: GlossaryId): GlossaryEntry {
  return GLOSSARY.find((e) => e.id === id)!;
}
