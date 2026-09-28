import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderOs } from "../testing";
import { useNoticeFeed } from "./noticeFeed";
import { StatusChip } from "./StatusChip";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Feed() {
  useNoticeFeed(() => {});
  return null;
}

const seconds = (n: number) => {
  for (let i = 0; i < n; i++) act(() => vi.advanceTimersByTime(1000));
};

describe("the status chip (M2.5 spec §3)", () => {
  it("says where the incident stands, all the way to Resolved", () => {
    const { incident } = renderOs(<StatusChip />);
    const chip = () => screen.getByRole("button", { name: /^Incident status/ });
    expect(chip().textContent).toBe("On call · Primary");
    act(() => incident().start());
    act(() => incident().skipPrepage());
    expect(chip().textContent).toBe("Paged · acknowledge");
    act(() => incident().acknowledge());
    expect(chip().textContent).toBe("Investigating");
    act(() => incident().dispatch("checkout.restart"));
    seconds(16);
    expect(chip().textContent).toBe("Mitigated · cause still active");
    act(() => incident().dispatch("checkout.rollback"));
    seconds(32);
    expect(chip().textContent).toMatch(/^Fix holding · \d+ s$/);
    seconds(12);
    expect(chip().textContent).toBe("Resolved");
  });

  it("opens Monitoring when pressed", () => {
    const { incident, os } = renderOs(<StatusChip />);
    act(() => incident().start());
    fireEvent.click(screen.getByRole("button", { name: /^Incident status/ }));
    expect(os().wm.windows.some((w) => w.appId === "monitoring")).toBe(true);
  });

  it("entering mitigated says the incident is still open, and records when it began", () => {
    const { incident, os } = renderOs(
      <>
        <StatusChip />
        <Feed />
      </>,
    );
    act(() => incident().start());
    act(() => incident().skipPrepage());
    act(() => incident().acknowledge());
    act(() => incident().dispatch("checkout.restart"));
    seconds(16);
    const notice = os().notices.find((n) => n.id === "mitigated");
    expect(notice?.title).toBe("Incident still open");
    expect(notice?.body).toBe("Symptoms are down, but the incident is still open. Is the cause fixed, or only its effect?");
    expect(incident().statusSince.mitigated).toBeTypeOf("number");
  });
});
