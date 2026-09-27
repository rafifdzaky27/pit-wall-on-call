import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("App", () => {
  it("shows the API version when the API is up", async () => {
    render(<App fetchVersion={async () => "abc1234"} />);
    expect(await screen.findByText("API online · abc1234")).toBeTruthy();
  });

  it("shows unreachable when the API call fails", async () => {
    render(
      <App
        fetchVersion={async () => {
          throw new Error("HTTP 502");
        }}
      />,
    );
    expect(await screen.findByText("API unreachable")).toBeTruthy();
  });
});
