/** The steps of a first shift the guide watches (M4.5 spec N3), in the order a newcomer usually takes them. */
export const MILESTONES = ["acked", "monitoring", "service", "evidence", "changes", "fix"] as const;
export type Milestone = (typeof MILESTONES)[number];

/** How long with no new milestone before the guide speaks. */
export const QUIET_MS = 45_000;

export interface GuideState {
  done: readonly Milestone[];
  /** Milestones already hinted: at most one hint each. */
  hinted: readonly Milestone[];
  /** When the last milestone was reached (or the guide started). */
  lastAt: number;
}

export type Facts = Partial<Record<Milestone, boolean>>;

export const startGuide = (at: number): GuideState => ({ done: [], hinted: [], lastAt: at });

/** Folds what the player has done so far into the state. Milestones only ever get added. */
export function observe(state: GuideState, facts: Facts, at: number): GuideState {
  const fresh = MILESTONES.filter((m) => facts[m] === true && !state.done.includes(m));
  if (fresh.length === 0) return state;
  return { ...state, done: [...state.done, ...fresh], lastAt: at };
}

/** The first milestone still to reach, or null when all are done. */
export function nextMilestone(state: GuideState): Milestone | null {
  return MILESTONES.find((m) => !state.done.includes(m)) ?? null;
}

/** The milestone to hint at now, if the quiet spell has passed and it has not been hinted yet. */
export function due(state: GuideState, now: number, quietMs = QUIET_MS): Milestone | null {
  const next = nextMilestone(state);
  if (next === null || state.hinted.includes(next)) return null;
  return now - state.lastAt >= quietMs ? next : null;
}

export const markHinted = (state: GuideState, m: Milestone): GuideState => (state.hinted.includes(m) ? state : { ...state, hinted: [...state.hinted, m] });
