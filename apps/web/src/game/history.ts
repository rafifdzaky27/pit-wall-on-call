import { mulberry32, TICKS_PER_SECOND } from "@pitwall/engine";

/** Last N one-second samples of every metric, for the sparklines. */
export class MetricHistory {
  private readonly series = new Map<string, number[]>();
  private lastSecond = -1;
  private readonly size: number;

  constructor(size = 120) {
    this.size = size;
  }

  /**
   * Fills the window with the two calm minutes before the page: the starting value with ±1.5 %
   * jitter from a fixed seed. Presentation only; nothing reads it but the sparklines.
   */
  prefill(metrics: Record<string, number>, seed = 1): void {
    const rng = mulberry32(seed);
    for (const [id, value] of Object.entries(metrics)) {
      const values: number[] = [];
      for (let i = 0; i < this.size - 1; i++) values.push(value === 0 ? 0 : value * (1 + (rng.next() - 0.5) * 0.03));
      this.series.set(id, values);
    }
  }

  record(tick: number, metrics: Record<string, number>): void {
    const second = Math.floor(tick / TICKS_PER_SECOND);
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    for (const [id, value] of Object.entries(metrics)) {
      const values = this.series.get(id) ?? [];
      values.push(value);
      if (values.length > this.size) values.shift();
      this.series.set(id, values);
    }
  }

  snapshot(): Record<string, number[]> {
    return Object.fromEntries([...this.series].map(([id, values]) => [id, [...values]]));
  }
}
