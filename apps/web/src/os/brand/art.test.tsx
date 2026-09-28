import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppIcon } from "./AppIcon";
import { Wallpaper } from "./Wallpaper";

afterEach(cleanup);

const WEB = resolve(__dirname, "../../..");

describe("art", () => {
  it.each(["monitoring", "browser", "chat", "files", "settings", "trash", "postmortem", "phone", "home"] as const)("draws the %s icon", (app) => {
    const { container } = render(<AppIcon app={app} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.classList.contains(`app-${app}`)).toBe(true);
    expect(svg.querySelectorAll("path, circle, rect").length).toBeGreaterThan(1);
  });

  it.each(["jakarta", "yogyakarta", "tokyo", "melbourne"] as const)("draws the %s wallpaper", (city) => {
    const { container } = render(<Wallpaper city={city} />);
    const svg = container.querySelector("svg.wallpaper")!;
    expect(svg.getAttribute("data-city")).toBe(city);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("every cursor referenced by the stylesheet exists", () => {
    const css = readFileSync(resolve(WEB, "src/styles/shell.css"), "utf8");
    const files = [...css.matchAll(/url\("\/cursors\/([a-z-]+\.svg)"\)/g)].map((m) => m[1]!);
    expect(new Set(files).size).toBe(7);
    for (const f of files) expect(existsSync(resolve(WEB, "public/cursors", f)), f).toBe(true);
  });
});
