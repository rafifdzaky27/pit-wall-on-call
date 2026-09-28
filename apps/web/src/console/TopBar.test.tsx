import { ACK, Run } from "@pitwall/engine";
import { slowLeak } from "@pitwall/scenarios";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TopBar } from "./TopBar";

afterEach(cleanup);

describe("the Monitoring header (M2.5 walkthrough W1)", () => {
  it("says the cause is still active while only mitigated, in words that fit the header", () => {
    const run = new Run(slowLeak, 1);
    run.dispatch(ACK);
    run.dispatch("checkout.restart");
    for (let i = 0; i < 160; i++) run.step();
    expect(run.snapshot().status).toBe("mitigated");
    render(<TopBar scenario={slowLeak} snapshot={run.snapshot()} onPause={() => {}} />);
    expect(screen.getByText("Cause still active").className).toContain("tag warn");
  });
});
