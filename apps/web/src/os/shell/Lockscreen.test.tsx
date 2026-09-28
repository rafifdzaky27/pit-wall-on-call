import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderOs } from "../testing";
import { Lockscreen } from "./Lockscreen";

afterEach(cleanup);

describe("Lockscreen", () => {
  it("on a small screen, pitches the game and explains the laptop requirement", () => {
    renderOs(<Lockscreen />);
    expect(screen.getByRole("heading", { level: 1, name: "Pit Wall On-Call" })).toBeTruthy();
    expect(screen.getByText(/needs a screen at least 1024 px wide/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Unlock" })).toBeNull();
  });

  it("shows no personal facts about the developer", () => {
    renderOs(<Lockscreen />);
    expect(screen.queryByRole("heading", { name: "About the developer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Another fact" })).toBeNull();
  });
});
