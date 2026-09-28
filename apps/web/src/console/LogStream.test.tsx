import type { LogEntry } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { resolveWorld } from "@pitwall/world";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LogStream } from "./LogStream";

afterEach(cleanup);

const world = resolveWorld(1);
const line = (seq: number, finding = false): LogEntry => ({ seq, tick: seq, serviceId: "checkout", level: "INFO", text: finding ? `finding ${seq}` : `line ${seq}`, finding });

describe("LogStream", () => {
  it("keeps findings pinned after they scroll out of the stream", () => {
    const logs = [line(0, true), ...Array.from({ length: 300 }, (_, i) => line(i + 1))];
    render(<LogStream scenario={slowLeak} world={world} logs={logs} filter={null} onClearFilter={() => undefined} />);
    const pinned = screen.getByRole("list", { name: "Pinned findings" });
    expect(within(pinned).getByText("finding 0")).toBeTruthy();
  });

  it("pins at most three findings, newest first, and none when there are none", () => {
    const logs = [line(1, true), line(2, true), line(3, true), line(4, true), line(5)];
    render(<LogStream scenario={slowLeak} world={world} logs={logs} filter={null} onClearFilter={() => undefined} />);
    const items = within(screen.getByRole("list", { name: "Pinned findings" })).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual([expect.stringContaining("finding 4"), expect.stringContaining("finding 3"), expect.stringContaining("finding 2")]);
    cleanup();
    render(<LogStream scenario={slowLeak} world={world} logs={[line(1)]} filter={null} onClearFilter={() => undefined} />);
    expect(screen.queryByRole("list", { name: "Pinned findings" })).toBeNull();
  });
});
