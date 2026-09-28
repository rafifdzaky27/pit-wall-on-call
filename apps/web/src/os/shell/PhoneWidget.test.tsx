import { resolveWorld } from "@pitwall/world";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderOs } from "../testing";
import { PhoneWidget } from "./PhoneWidget";

afterEach(cleanup);

describe("PhoneWidget", () => {
  it("is quiet before the page", () => {
    renderOs(<PhoneWidget />);
    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(screen.getByText("No notifications.")).toBeTruthy();
  });

  it("rings at the page, shows the mention, and inspects it when opened", () => {
    const { incident } = renderOs(<PhoneWidget />);
    act(() => incident().start());
    act(() => incident().skipPrepage());
    const phone = screen.getByRole("button", { name: "Phone, 2 new" });
    expect(phone.className).toContain("ringing");
    fireEvent.click(phone);
    expect(screen.getByText(`@${resolveWorld(1).brand.name} checkout just errors out??`)).toBeTruthy();
    expect(incident().snapshot.inspected).toEqual(["phone.mention"]);
    fireEvent.click(screen.getByRole("button", { name: /Acknowledge/ }));
    expect(incident().phase).toBe("active");
  });
});
