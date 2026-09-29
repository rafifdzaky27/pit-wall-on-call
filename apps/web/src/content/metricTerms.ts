import type { GlossaryId } from "./glossary";

/**
 * The part of a metric label that is a glossary term (M2.5 spec §4, M4.5 N2). First match wins. A term is
 * only matched where its definition cannot give an incident's cause away (glossary.test, PR 31 review).
 */
const METRIC_TERMS: readonly [RegExp, GlossaryId][] = [
  [/^5xx/i, "5xx"],
  [/^p99/i, "p99"],
  [/^Pool/, "connection-pool"],
  [/^Consumer lag/i, "consumer-lag"],
  [/^Replication lag/i, "replica-lag"],
  [/^Cache hit (rate|ratio)/i, "cache-hit-ratio"],
  [/^Hit (rate|ratio)/i, "cache-hit-ratio"],
  [/^WAL/, "wal"],
  [/^(Data|WAL) volume/i, "disk-volume"],
];

export function metricTerm(label: string): { id: GlossaryId; match: string } | null {
  for (const [re, id] of METRIC_TERMS) {
    const m = re.exec(label);
    if (m) return { id, match: m[0] };
  }
  return null;
}
