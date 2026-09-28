import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GLOSSARY } from "../../../content/glossary";
import { useIncident } from "../../incident/IncidentProvider";
import { renderOs } from "../../testing";
import { HelpApp } from "./HelpApp";

afterEach(cleanup);

const nav = () => screen.getByRole("navigation", { name: "Help pages" });
const open = (page: string) => fireEvent.click(within(nav()).getByRole("button", { name: page }));
const item = (label: string) => within(screen.getByRole("list", { name: "Incident checklist" })).getByText(label).closest("li")!;

describe("HelpApp", () => {
  it("has four pages, and starts on How to play before a shift", () => {
    renderOs(<HelpApp />);
    expect(within(nav()).getAllByRole("button").map((b) => b.textContent)).toEqual(["How to play", "Checklist", "Glossary", "Tools"]);
    expect(within(nav()).getByRole("button", { name: "How to play" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("heading", { level: 2, name: "How to play" })).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "The loop" })).getAllByRole("listitem")).toHaveLength(6);
    const keys = screen.getByRole("table", { name: "Keyboard shortcuts" });
    expect(within(keys).getByRole("rowheader", { name: "?" }).closest("tr")!.textContent).toContain("Help");
  });

  it("the checklist says Done or To do in words, and ticks itself from the incident", () => {
    const { incident } = renderOs(<HelpApp />);
    open("Checklist");
    expect(within(item("Acknowledge the page")).getByText("To do")).toBeTruthy();
    expect(screen.getAllByText("To do")).toHaveLength(7);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    expect(within(item("Acknowledge the page")).getByText("Done")).toBeTruthy();
    expect(within(item("Form a hypothesis")).getByText("To do")).toBeTruthy();
  });

  it("opens on the checklist during an incident", () => {
    function OnceActive() {
      return useIncident().phase === "active" ? <HelpApp /> : null;
    }
    const { incident } = renderOs(<OnceActive />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    expect(screen.getByRole("heading", { level: 2, name: "Checklist" })).toBeTruthy();
    expect(within(nav()).getByRole("button", { name: "Checklist" }).getAttribute("aria-current")).toBe("page");
  });

  it("the glossary defines every term in plain words", () => {
    renderOs(<HelpApp />);
    open("Glossary");
    const list = screen.getByLabelText("Glossary");
    for (const e of GLOSSARY) expect(list.textContent).toContain(`${e.term}${e.definition}`);
  });

  it("Tools says what each app is for", () => {
    renderOs(<HelpApp />);
    open("Tools");
    const tools = screen.getByLabelText("Tools");
    for (const name of ["Monitoring", "Browser", "Chat", "Files", "Settings", "postmortem.md", "Help"]) expect(within(tools).getByText(name)).toBeTruthy();
  });
});
