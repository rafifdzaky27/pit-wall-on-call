import { describe, expect, it } from "vitest";
import { TickDriver } from "./clock";

const fakeClock = () => {
  let t = 1000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
};

describe("TickDriver", () => {
  it("returns whole ticks and carries the remainder", () => {
    const c = fakeClock();
    const d = new TickDriver(c.now);
    d.start();
    c.advance(250);
    expect(d.due()).toBe(2);
    c.advance(60);
    expect(d.due()).toBe(1);
    c.advance(89);
    expect(d.due()).toBe(0);
    c.advance(1);
    expect(d.due()).toBe(1);
  });

  it("returns nothing before start", () => {
    const c = fakeClock();
    const d = new TickDriver(c.now);
    c.advance(500);
    expect(d.due()).toBe(0);
  });

  it("stops the clock while paused and keeps the partial tick", () => {
    const c = fakeClock();
    const d = new TickDriver(c.now);
    d.start();
    c.advance(40);
    d.pause();
    c.advance(60_000);
    expect(d.due()).toBe(0);
    d.resume();
    c.advance(60);
    expect(d.due()).toBe(1);
  });

  it("caps each call and catches up on the next ones", () => {
    const c = fakeClock();
    const d = new TickDriver(c.now, 50);
    d.start();
    c.advance(8000);
    expect(d.due()).toBe(50);
    expect(d.due()).toBe(30);
    expect(d.due()).toBe(0);
  });
});
