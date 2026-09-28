import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LogoMark } from "./Logo";

afterEach(cleanup);

describe("LogoMark", () => {
  it("renders the mark as a named image", () => {
    const { getByRole } = render(<LogoMark size={64} />);
    const img = getByRole("img", { name: "Pit Wall On-Call" });
    expect(img.getAttribute("width")).toBe("64");
  });

  it("the favicon and the index page point at the mark and the preview image", () => {
    const web = resolve(__dirname, "../../..");
    const html = readFileSync(resolve(web, "index.html"), "utf8");
    expect(html).toContain('rel="icon" href="/favicon.svg"');
    expect(html).toContain('property="og:image" content="/og.png"');
    expect(readFileSync(resolve(web, "public/favicon.svg"), "utf8")).toContain("<svg");
  });
});
