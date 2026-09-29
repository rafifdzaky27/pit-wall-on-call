import { slowLeak } from "@pitwall/scenarios";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceMap } from "./ServiceMap";

afterEach(cleanup);

function setup() {
  const onSelect = vi.fn();
  const health = Object.fromEntries(slowLeak.services.map((s) => [s.id, "ok" as const]));
  const details = Object.fromEntries(slowLeak.services.map((s) => [s.id, "fine"]));
  render(<ServiceMap scenario={slowLeak} health={{ ...health, [slowLeak.services[0]!.id]: "crit" }} details={details} selected={slowLeak.services[0]!.id} onSelect={onSelect} />);
  return { onSelect };
}

describe("ServiceMap", () => {
  it("shows a legend for OK, Warn and Critical with what each means", () => {
    setup();
    const legend = screen.getByRole("list", { name: "Legend" });
    expect(within(legend).getByText("OK")).toBeTruthy();
    expect(within(legend).getByText("Warn")).toBeTruthy();
    expect(within(legend).getByText("Critical")).toBeTruthy();
    expect(within(legend).getByText(/customers feel it/)).toBeTruthy();
  });

  it("says how many services there are and that they can be clicked", () => {
    setup();
    expect(screen.getByText(`${slowLeak.services.length} services · click one or press 1–${slowLeak.services.length}`)).toBeTruthy();
  });

  it("renders every service as a named button that selects it", () => {
    const { onSelect } = setup();
    const nodes = screen.getAllByRole("button");
    expect(nodes).toHaveLength(slowLeak.services.length);
    for (const svc of slowLeak.services) expect(screen.getByRole("button", { name: new RegExp(`^${svc.label},`) })).toBeTruthy();
    fireEvent.click(nodes[1]!);
    expect(onSelect).toHaveBeenCalledWith(slowLeak.services[1]!.id);
  });
});
