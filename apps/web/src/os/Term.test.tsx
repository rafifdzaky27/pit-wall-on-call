import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { glossaryEntry } from "../content/glossary";
import { Term } from "./Term";

afterEach(cleanup);

const P99 = glossaryEntry("p99").definition;

describe("Term", () => {
  it("is a focusable word described by its glossary definition", () => {
    render(
      <h3>
        <Term id="p99">p99</Term> latency
      </h3>,
    );
    const term = screen.getByText("p99");
    expect(term.tabIndex).toBe(0);
    expect(term.getAttribute("aria-describedby")).toBeTruthy();
    // The tooltip is hidden until asked for, and never joins the heading's name.
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("heading").textContent).toBe("p99 latency");
  });

  it("shows the definition on hover, and hides it on leave", async () => {
    render(<Term id="p99">p99</Term>);
    const term = screen.getByText("p99");
    fireEvent.mouseEnter(term);
    const tip = await screen.findByRole("tooltip");
    expect(tip.textContent).toBe(P99);
    expect(term.getAttribute("aria-describedby")).toBe(tip.id);
    fireEvent.mouseLeave(term);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the definition on keyboard focus, and Esc dismisses it", async () => {
    render(<Term id="error-budget">Error budget</Term>);
    const term = screen.getByText("Error budget");
    fireEvent.focus(term);
    expect((await screen.findByRole("tooltip")).textContent).toBe(glossaryEntry("error-budget").definition);
    fireEvent.keyDown(term, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.blur(term);
    fireEvent.focus(term);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
});
