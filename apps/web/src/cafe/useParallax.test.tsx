import { cleanup, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useParallax } from "./useParallax";

afterEach(cleanup);

function Layer({ moving }: { moving: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref);
  return <div ref={ref} data-testid="cafe" className={moving ? "cafe moving" : "cafe"} />;
}

const frame = () => new Promise((r) => setTimeout(r, 40));

describe("useParallax", () => {
  it("follows the pointer while the camera is still", async () => {
    const { getByTestId } = render(<Layer moving={false} />);
    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: 0 });
    await frame();
    expect(getByTestId("cafe").style.getPropertyValue("--px")).toBe("1.000");
  });

  it("holds the layers still while the camera moves, so the zoom never re-rasters them (M2.5 follow-up)", async () => {
    const { getByTestId } = render(<Layer moving />);
    fireEvent.pointerMove(window, { clientX: window.innerWidth, clientY: 0 });
    await frame();
    expect(getByTestId("cafe").style.getPropertyValue("--px")).toBe("");
  });
});
