import { TICKS_PER_SECOND } from "@pitwall/engine";

/** Last N one-second samples of every metric, for the sparklines. */
export class MetricHistory {
  private readonly series = new Map<string, number[]>();
  private lastSecond = -1;
  private readonly size: number;

  constructor(size = 120) {
    this.size = size;
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
