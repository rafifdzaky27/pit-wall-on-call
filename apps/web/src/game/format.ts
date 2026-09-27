import { TICKS_PER_SECOND } from "@pitwall/engine";

const pad = (n: number) => String(n).padStart(2, "0");

export function formatClock(ticks: number): string {
  const seconds = Math.floor(ticks / TICKS_PER_SECOND);
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

export function formatBp(bp: number): string {
  return `${(bp / 100).toFixed(1)}%`;
}

export function formatMetric(value: number): string {
  return Math.abs(value) >= 100 ? String(Math.round(value)) : value.toFixed(1);
}
