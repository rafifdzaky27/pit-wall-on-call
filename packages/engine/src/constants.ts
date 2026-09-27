export const ENGINE_VERSION = "1.0.0";
export const TICK_MS = 100;
export const TICKS_PER_SECOND = 10;
/** 60 s without an ack pages the secondary (cold-open spec §3). */
export const ESCALATION_TICK = 60 * TICKS_PER_SECOND;
/** A run resolves after its resolve condition holds for 10 s straight. */
export const STABLE_TICKS_TO_RESOLVE = 10 * TICKS_PER_SECOND;
export const LOG_CAP = 2000;
export const ACK = "ack";
export const INSPECT_PREFIX = "inspect:";
export const inspectAction = (hotspotId: string): string => `${INSPECT_PREFIX}${hotspotId}`;
