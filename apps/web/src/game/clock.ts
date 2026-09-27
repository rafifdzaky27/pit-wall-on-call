import { TICK_MS } from "@pitwall/engine";

/** Turns wall-clock time into whole engine ticks. Game time only moves while running. */
export class TickDriver {
  private last: number | null = null;
  private carry = 0;
  private readonly now: () => number;
  private readonly maxTicksPerCall: number;

  constructor(now: () => number, maxTicksPerCall = 50) {
    this.now = now;
    this.maxTicksPerCall = maxTicksPerCall;
  }

  start(): void {
    this.last = this.now();
    this.carry = 0;
  }

  pause(): void {
    if (this.last === null) return;
    this.carry += this.now() - this.last;
    this.last = null;
  }

  resume(): void {
    if (this.last === null) this.last = this.now();
  }

  /** Whole ticks elapsed since the previous call. The remainder carries over. */
  due(): number {
    if (this.last !== null) {
      const t = this.now();
      this.carry += t - this.last;
      this.last = t;
    }
    const ticks = Math.min(this.maxTicksPerCall, Math.floor(this.carry / TICK_MS));
    this.carry -= ticks * TICK_MS;
    return ticks;
  }
}
