import { resolveWorld } from "@pitwall/world";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { modifiedLabel, sizeLabel, HOME } from "../../../content/files";
import { renderOs } from "../../testing";
import { FilesApp } from "./FilesApp";
import { TrashApp } from "./TrashApp";

afterEach(cleanup);
const world = resolveWorld(1);
const places = () => screen.getByRole("navigation", { name: "Places" });

describe("file helpers", () => {
  it("labels sizes and dates the way Nautilus does", () => {
    const docs = HOME.children.find((n) => n.name === "Documents")!;
    expect(sizeLabel(docs)).toBe("2 items");
    expect(sizeLabel({ kind: "text", name: "a", content: "", daysAgo: 0 })).toBe("0 bytes");
    expect(sizeLabel({ kind: "image", name: "a", bytes: 1_240_000, daysAgo: 0 })).toBe("1.2 MB");
    const now = new Date(2026, 8, 28, 15, 0).getTime();
    expect(modifiedLabel(0, now)).toBe("Today");
    expect(modifiedLabel(1, now)).toBe("Yesterday");
    expect(modifiedLabel(12, now)).toBe(new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(2026, 8, 16, 15, 0)));
  });
});

describe("FilesApp", () => {
  it("opens Home with README.md previewed and no personal files", () => {
    renderOs(<FilesApp />);
    expect(screen.getByRole("article", { name: "README.md" }).textContent).toContain("How to play");
    expect(screen.getByRole("table", { name: "Home" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /about-rafif/ })).toBeNull();
  });

  it("navigates with Places, the path bar, back and forward, and fills files with the shift's world", () => {
    renderOs(<FilesApp />);
    fireEvent.click(within(places()).getByRole("button", { name: "Documents" }));
    expect(screen.getByRole("table", { name: "Documents" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /on-call-handover\.md/ }));
    const doc = screen.getByRole("article", { name: "on-call-handover.md" });
    expect(doc.textContent).toContain(world.colleagues.infra);
    expect(doc.textContent).toContain(world.brand.domain);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Path" })).getByRole("button", { name: "Home" }));
    expect(screen.getByRole("table", { name: "Home" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("table", { name: "Documents" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(screen.getByRole("table", { name: "Home" })).toBeTruthy();
  });

  it("opens folders from the list and shows pictures in the preview", () => {
    const { container } = renderOs(<FilesApp />);
    fireEvent.click(within(screen.getByRole("table", { name: "Home" })).getByRole("button", { name: /^Pictures/ }));
    fireEvent.click(screen.getByRole("button", { name: /jakarta\.png/ }));
    expect(container.querySelector('.naut-preview svg.wallpaper[data-city="jakarta"]')).toBeTruthy();
  });

  it("switches between list and grid views", () => {
    renderOs(<FilesApp />);
    fireEvent.click(screen.getByRole("button", { name: "Grid" }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("list", { name: "Home" })).toBeTruthy();
  });

  it("shows the Trash from Places, with Empty Trash", () => {
    renderOs(<FilesApp />);
    fireEvent.click(within(places()).getByRole("button", { name: "Trash" }));
    expect(screen.getByRole("button", { name: "Empty Trash" })).toBeTruthy();
  });
});

describe("TrashApp", () => {
  it("shows its files and refuses to be emptied, with a reason", () => {
    renderOs(<TrashApp />);
    expect(screen.getByRole("button", { name: /final_final_v3\.yaml/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /rackets/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /prod-backup\.sql/ }));
    expect(screen.getByText(/backup job reported success anyway/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Empty Trash" }));
    expect(screen.getByRole("status").textContent).toMatch(/refused/i);
  });
});
