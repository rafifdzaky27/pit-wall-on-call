import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FACTS, FAVORITES } from "../../content/aboutRafif";
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

  it("rotates Rafif's favourite facts and can list all of them", () => {
    renderOs(<Lockscreen />);
    expect(screen.getByText(FACTS[FAVORITES[0]!]!)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Another fact" }));
    expect(screen.getByText(FACTS[FAVORITES[1]!]!)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All 20 facts" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
  });
});
